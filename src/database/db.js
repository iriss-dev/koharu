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
    mod_log_channel_id TEXT DEFAULT NULL,
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

  CREATE TABLE IF NOT EXISTS warnings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT NOT NULL,
    guild_id TEXT NOT NULL,
    moderator_id TEXT NOT NULL,
    reason TEXT NOT NULL,
    created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now'))
  );

  CREATE INDEX IF NOT EXISTS idx_users_coins ON users(coins);
  CREATE INDEX IF NOT EXISTS idx_history_user ON role_history(user_id);
  CREATE INDEX IF NOT EXISTS idx_warnings_user ON warnings(user_id, guild_id);
`);

// Safe column migrations for existing databases
try {
  db.exec('ALTER TABLE guild_settings ADD COLUMN mod_log_channel_id TEXT DEFAULT NULL;');
} catch {
  // Column already exists
}

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
    INSERT INTO guild_settings (guild_id, role_cost_coins, role_cost_keys, booster_free, booster_dual_color, anchor_role_id, mod_log_channel_id)
    VALUES (@guild_id, @role_cost_coins, @role_cost_keys, @booster_free, @booster_dual_color, @anchor_role_id, @mod_log_channel_id)
    ON CONFLICT(guild_id) DO UPDATE SET
      role_cost_coins = excluded.role_cost_coins,
      role_cost_keys = excluded.role_cost_keys,
      booster_free = excluded.booster_free,
      booster_dual_color = excluded.booster_dual_color,
      anchor_role_id = excluded.anchor_role_id,
      mod_log_channel_id = excluded.mod_log_channel_id,
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
  addWarning: db.prepare(`
    INSERT INTO warnings (user_id, guild_id, moderator_id, reason)
    VALUES (?, ?, ?, ?)
  `),
  getWarnings: db.prepare(`
    SELECT * FROM warnings WHERE user_id = ? AND guild_id = ? ORDER BY id DESC
  `),
  clearWarnings: db.prepare(`
    DELETE FROM warnings WHERE user_id = ? AND guild_id = ?
  `),
};

const DatabaseService = {
  getUser(userId) {
    statements.createUser.run(userId);
    return statements.getUser.get(userId);
  },

  addCoins(userId, amount) {
    this.getUser(userId);
    statements.updateCoins.run(amount, userId);
    return statements.getUser.get(userId);
  },

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

  modifyKeys(userId, amount) {
    this.getUser(userId);
    statements.updateKeys.run(amount, userId);
    return statements.getUser.get(userId);
  },

  setLastWork(userId, timestamp = Math.floor(Date.now() / 1000)) {
    this.getUser(userId);
    statements.updateLastWork.run(timestamp, userId);
    return statements.getUser.get(userId);
  },

  setCustomRole(userId, roleId) {
    this.getUser(userId);
    statements.setCustomRole.run(roleId, userId);
    return statements.getUser.get(userId);
  },

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
      mod_log_channel_id: null,
    };
  },

  saveGuildSettings(settings) {
    statements.upsertGuildSettings.run({
      guild_id: settings.guild_id,
      role_cost_coins: settings.role_cost_coins ?? config.roles.defaultCoinCost,
      role_cost_keys: settings.role_cost_keys ?? config.roles.defaultKeyCost,
      booster_free: settings.booster_free ? 1 : 0,
      booster_dual_color: settings.booster_dual_color ? 1 : 0,
      anchor_role_id: settings.anchor_role_id || null,
      mod_log_channel_id: settings.mod_log_channel_id || null,
    });
    return this.getGuildSettings(settings.guild_id);
  },

  setRolePanel(guildId, channelId, messageId) {
    statements.setRolePanel.run(guildId, channelId, messageId);
  },

  recordRolePurchase(userId, guildId, roleId, name, color, paymentMethod) {
    statements.recordRolePurchase.run(userId, guildId, roleId, name, color, paymentMethod);
  },

  getLeaderboard(limit = 10) {
    return statements.getTopUsers.all(limit);
  },

  addWarning(userId, guildId, moderatorId, reason) {
    return statements.addWarning.run(userId, guildId, moderatorId, reason);
  },

  getWarnings(userId, guildId) {
    return statements.getWarnings.all(userId, guildId);
  },

  clearWarnings(userId, guildId) {
    return statements.clearWarnings.run(userId, guildId);
  },

  close() {
    db.close();
  }
};

module.exports = DatabaseService;
