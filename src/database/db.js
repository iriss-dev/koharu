const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');
const config = require('../config');

// Ensure parent data directory exists
const dbDir = path.dirname(config.dbPath);
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

const db = new Database(config.dbPath);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// Initialize schema
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    user_id TEXT PRIMARY KEY,
    coins INTEGER NOT NULL DEFAULT 0,
    bank INTEGER NOT NULL DEFAULT 0,
    keys INTEGER NOT NULL DEFAULT 0,
    custom_role_id TEXT DEFAULT NULL,
    last_work INTEGER NOT NULL DEFAULT 0,
    created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now'))
  );

  CREATE TABLE IF NOT EXISTS guild_settings (
    guild_id TEXT PRIMARY KEY,
    role_panel_channel_id TEXT DEFAULT NULL,
    role_panel_message_id TEXT DEFAULT NULL,
    role_cost_coins INTEGER NOT NULL DEFAULT 25000,
    role_cost_keys INTEGER NOT NULL DEFAULT 1,
    booster_free INTEGER NOT NULL DEFAULT 1,
    booster_dual_color INTEGER NOT NULL DEFAULT 1,
    anchor_role_id TEXT DEFAULT NULL,
    updated_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now'))
  );

  CREATE TABLE IF NOT EXISTS role_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT NOT NULL,
    guild_id TEXT NOT NULL,
    role_id TEXT NOT NULL,
    name TEXT NOT NULL,
    color TEXT NOT NULL,
    payment_method TEXT NOT NULL,
    created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now'))
  );

  CREATE INDEX IF NOT EXISTS idx_users_coins ON users(coins);
  CREATE INDEX IF NOT EXISTS idx_history_user ON role_history(user_id);
`);

// Prepared statements for high performance
const statements = {
  getUser: db.prepare('SELECT * FROM users WHERE user_id = ?'),
  createUser: db.prepare('INSERT OR IGNORE INTO users (user_id, coins, bank, keys, last_work) VALUES (?, 0, 0, 0, 0)'),
  updateCoins: db.prepare('UPDATE users SET coins = coins + ? WHERE user_id = ?'),
  updateBank: db.prepare('UPDATE users SET bank = bank + ? WHERE user_id = ?'),
  updateKeys: db.prepare('UPDATE users SET keys = keys + ? WHERE user_id = ?'),
  updateLastWork: db.prepare('UPDATE users SET last_work = ? WHERE user_id = ?'),
  setCustomRole: db.prepare('UPDATE users SET custom_role_id = ? WHERE user_id = ?'),
  getGuildSettings: db.prepare('SELECT * FROM guild_settings WHERE guild_id = ?'),
  upsertGuildSettings: db.prepare(`
    INSERT INTO guild_settings (guild_id, role_cost_coins, role_cost_keys, booster_free, booster_dual_color, anchor_role_id)
    VALUES (@guild_id, @role_cost_coins, @role_cost_keys, @booster_free, @booster_dual_color, @anchor_role_id)
    ON CONFLICT(guild_id) DO UPDATE SET
      role_cost_coins = excluded.role_cost_coins,
      role_cost_keys = excluded.role_cost_keys,
      booster_free = excluded.booster_free,
      booster_dual_color = excluded.booster_dual_color,
      anchor_role_id = excluded.anchor_role_id,
      updated_at = strftime('%s', 'now')
  `),
  setRolePanel: db.prepare(`
    INSERT INTO guild_settings (guild_id, role_panel_channel_id, role_panel_message_id)
    VALUES (?, ?, ?)
    ON CONFLICT(guild_id) DO UPDATE SET
      role_panel_channel_id = excluded.role_panel_channel_id,
      role_panel_message_id = excluded.role_panel_message_id,
      updated_at = strftime('%s', 'now')
  `),
  recordRolePurchase: db.prepare(`
    INSERT INTO role_history (user_id, guild_id, role_id, name, color, payment_method)
    VALUES (?, ?, ?, ?, ?, ?)
  `),
  getTopUsers: db.prepare(`
    SELECT user_id, (coins + bank) AS net_worth, coins, bank, keys 
    FROM users 
    ORDER BY net_worth DESC 
    LIMIT ?
  `),
};

const DatabaseService = {
  /**
   * Fetch a user profile or create one if it does not exist.
   * @param {string} userId
   * @returns {object}
   */
  getUser(userId) {
    statements.createUser.run(userId);
    return statements.getUser.get(userId);
  },

  /**
   * Add or subtract coins from a user's wallet.
   * @param {string} userId
   * @param {number} amount
   * @returns {object}
   */
  addCoins(userId, amount) {
    this.getUser(userId);
    statements.updateCoins.run(amount, userId);
    return statements.getUser.get(userId);
  },

  /**
   * Transfer coins from wallet into bank.
   * @param {string} userId
   * @param {number} amount
   */
  deposit(userId, amount) {
    const user = this.getUser(userId);
    if (amount <= 0 || user.coins < amount) {
      throw new Error('Insufficient wallet funds.');
    }

    const tx = db.transaction(() => {
      statements.updateCoins.run(-amount, userId);
      statements.updateBank.run(amount, userId);
    });
    tx();

    return statements.getUser.get(userId);
  },

  /**
   * Transfer coins from bank into wallet.
   * @param {string} userId
   * @param {number} amount
   */
  withdraw(userId, amount) {
    const user = this.getUser(userId);
    if (amount <= 0 || user.bank < amount) {
      throw new Error('Insufficient bank funds.');
    }

    const tx = db.transaction(() => {
      statements.updateBank.run(-amount, userId);
      statements.updateCoins.run(amount, userId);
    });
    tx();

    return statements.getUser.get(userId);
  },

  /**
   * Add or deduct event keys for a user.
   * @param {string} userId
   * @param {number} amount
   */
  modifyKeys(userId, amount) {
    this.getUser(userId);
    statements.updateKeys.run(amount, userId);
    return statements.getUser.get(userId);
  },

  /**
   * Set the last work timestamp for cooldown checks.
   * @param {string} userId
   * @param {number} timestamp
   */
  setLastWork(userId, timestamp = Math.floor(Date.now() / 1000)) {
    this.getUser(userId);
    statements.updateLastWork.run(timestamp, userId);
    return statements.getUser.get(userId);
  },

  /**
   * Link an existing role ID to the user.
   * @param {string} userId
   * @param {string|null} roleId
   */
  setCustomRole(userId, roleId) {
    this.getUser(userId);
    statements.setCustomRole.run(roleId, userId);
    return statements.getUser.get(userId);
  },

  /**
   * Fetch guild configuration, filling in global defaults if unconfigured.
   * @param {string} guildId
   */
  getGuildSettings(guildId) {
    const row = statements.getGuildSettings.get(guildId);
    if (row) return row;

    return {
      guild_id: guildId,
      role_panel_channel_id: null,
      role_panel_message_id: null,
      role_cost_coins: config.roles.defaultCoinCost,
      role_cost_keys: config.roles.defaultKeyCost,
      booster_free: config.roles.boosterFree ? 1 : 0,
      booster_dual_color: config.roles.boosterDualColor ? 1 : 0,
      anchor_role_id: null,
    };
  },

  /**
   * Update guild configuration parameters.
   */
  saveGuildSettings(settings) {
    statements.upsertGuildSettings.run({
      guild_id: settings.guild_id,
      role_cost_coins: settings.role_cost_coins ?? config.roles.defaultCoinCost,
      role_cost_keys: settings.role_cost_keys ?? config.roles.defaultKeyCost,
      booster_free: settings.booster_free ? 1 : 0,
      booster_dual_color: settings.booster_dual_color ? 1 : 0,
      anchor_role_id: settings.anchor_role_id || null,
    });
    return this.getGuildSettings(settings.guild_id);
  },

  /**
   * Save the channel & message ID of an active role panel embed.
   */
  setRolePanel(guildId, channelId, messageId) {
    statements.setRolePanel.run(guildId, channelId, messageId);
  },

  /**
   * Record a role purchase or re-color in history.
   */
  recordRolePurchase(userId, guildId, roleId, name, color, paymentMethod) {
    statements.recordRolePurchase.run(userId, guildId, roleId, name, color, paymentMethod);
  },

  /**
   * Retrieve top users ordered by total net worth.
   */
  getLeaderboard(limit = 10) {
    return statements.getTopUsers.all(limit);
  },

  /**
   * Close the database connection cleanly (e.g. for testing or shutdown).
   */
  close() {
    db.close();
  }
};

module.exports = DatabaseService;
