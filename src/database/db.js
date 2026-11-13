'use strict';

/**
 * SQLite storage (better-sqlite3, WAL). Schema changes are versioned with
 * PRAGMA user_version so existing installs upgrade in place.
 *
 * Economy is per server: coins earned in one server stay there. Balances from
 * the old global table are moved into the first server where each person shows
 * up after the upgrade, exactly once.
 */

const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');
const config = require('../config');

const MIGRATIONS = [
  // 1: original schema (installs before versioning had these tables already)
  `
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
  CREATE TABLE IF NOT EXISTS warnings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT NOT NULL,
    guild_id TEXT NOT NULL,
    moderator_id TEXT NOT NULL,
    reason TEXT NOT NULL,
    created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now'))
  );
  CREATE INDEX IF NOT EXISTS idx_history_user ON role_history(user_id);
  CREATE INDEX IF NOT EXISTS idx_warnings_user ON warnings(user_id, guild_id);
  `,
  // 2: per-server economy, profiles, anime favourites, interactions, deals
  db => {
    addColumn(db, 'guild_settings', 'mod_log_channel_id', 'TEXT DEFAULT NULL');
    addColumn(db, 'guild_settings', 'language', 'TEXT DEFAULT NULL');
    addColumn(db, 'guild_settings', 'prefix', 'TEXT DEFAULT NULL');
    addColumn(db, 'guild_settings', 'free_games_channel_id', 'TEXT DEFAULT NULL');
    addColumn(db, 'users', 'migrated', 'INTEGER NOT NULL DEFAULT 0');
    db.exec(`
      DROP INDEX IF EXISTS idx_users_coins;
      CREATE TABLE IF NOT EXISTS members (
        guild_id TEXT NOT NULL,
        user_id TEXT NOT NULL,
        coins INTEGER NOT NULL DEFAULT 0 CHECK (coins >= 0),
        bank INTEGER NOT NULL DEFAULT 0 CHECK (bank >= 0),
        keys INTEGER NOT NULL DEFAULT 0 CHECK (keys >= 0),
        last_work INTEGER NOT NULL DEFAULT 0,
        last_daily INTEGER NOT NULL DEFAULT 0,
        daily_streak INTEGER NOT NULL DEFAULT 0,
        created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
        PRIMARY KEY (guild_id, user_id)
      );
      CREATE INDEX IF NOT EXISTS idx_members_wealth ON members(guild_id, (coins + bank) DESC);

      CREATE TABLE IF NOT EXISTS custom_roles (
        guild_id TEXT NOT NULL,
        user_id TEXT NOT NULL,
        role_id TEXT NOT NULL,
        PRIMARY KEY (guild_id, user_id)
      );

      CREATE TABLE IF NOT EXISTS profiles (
        user_id TEXT PRIMARY KEY,
        bio TEXT DEFAULT NULL,
        style TEXT DEFAULT NULL,
        updated_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now'))
      );

      CREATE TABLE IF NOT EXISTS favorites (
        user_id TEXT NOT NULL,
        media_id INTEGER NOT NULL,
        media_type TEXT NOT NULL,
        title TEXT NOT NULL,
        created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
        PRIMARY KEY (user_id, media_id)
      );

      CREATE TABLE IF NOT EXISTS interactions (
        guild_id TEXT NOT NULL,
        actor_id TEXT NOT NULL,
        target_id TEXT NOT NULL,
        action TEXT NOT NULL,
        count INTEGER NOT NULL DEFAULT 0,
        PRIMARY KEY (guild_id, actor_id, target_id, action)
      );
      CREATE INDEX IF NOT EXISTS idx_interactions_target ON interactions(guild_id, target_id);

      CREATE TABLE IF NOT EXISTS deal_alerts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id TEXT NOT NULL,
        guild_id TEXT DEFAULT NULL,
        channel_id TEXT DEFAULT NULL,
        game_id TEXT NOT NULL,
        title TEXT NOT NULL,
        target_price REAL NOT NULL,
        locale TEXT NOT NULL DEFAULT 'es',
        created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
        triggered_at INTEGER DEFAULT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_alerts_user ON deal_alerts(user_id);

      CREATE TABLE IF NOT EXISTS posted_giveaways (
        guild_id TEXT NOT NULL,
        giveaway_id TEXT NOT NULL,
        posted_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
        PRIMARY KEY (guild_id, giveaway_id)
      );
    `);
  },
];

function addColumn(db, table, column, definition) {
  const exists = db.prepare(`PRAGMA table_info(${table})`).all().some(col => col.name === column);
  if (!exists) db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
}

function migrate(db) {
  const current = db.pragma('user_version', { simple: true });
  for (let version = current; version < MIGRATIONS.length; version++) {
    const step = MIGRATIONS[version];
    db.transaction(() => {
      if (typeof step === 'string') db.exec(step);
      else step(db);
      db.pragma(`user_version = ${version + 1}`);
    })();
  }
}

const now = () => Math.floor(Date.now() / 1000);

function open(file = config.dbPath) {
  if (file !== ':memory:') fs.mkdirSync(path.dirname(file), { recursive: true });
  const db = new Database(file);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  migrate(db);

  const q = {
    member: db.prepare('SELECT * FROM members WHERE guild_id = ? AND user_id = ?'),
    insertMember: db.prepare('INSERT OR IGNORE INTO members (guild_id, user_id, coins, bank, keys, last_work) VALUES (?, ?, ?, ?, ?, ?)'),
    legacy: db.prepare('SELECT * FROM users WHERE user_id = ? AND migrated = 0'),
    markLegacy: db.prepare('UPDATE users SET migrated = 1 WHERE user_id = ?'),
    legacyRole: db.prepare('SELECT custom_role_id FROM users WHERE user_id = ?'),
    clearLegacyRole: db.prepare('UPDATE users SET custom_role_id = NULL WHERE user_id = ?'),
    addCoins: db.prepare('UPDATE members SET coins = MAX(0, coins + ?) WHERE guild_id = ? AND user_id = ?'),
    spendCoins: db.prepare('UPDATE members SET coins = coins - ? WHERE guild_id = ? AND user_id = ? AND coins >= ?'),
    moveToBank: db.prepare('UPDATE members SET coins = coins - ?, bank = bank + ? WHERE guild_id = ? AND user_id = ? AND coins >= ?'),
    moveToWallet: db.prepare('UPDATE members SET bank = bank - ?, coins = coins + ? WHERE guild_id = ? AND user_id = ? AND bank >= ?'),
    addKeys: db.prepare('UPDATE members SET keys = MAX(0, keys + ?) WHERE guild_id = ? AND user_id = ?'),
    spendKeys: db.prepare('UPDATE members SET keys = keys - ? WHERE guild_id = ? AND user_id = ? AND keys >= ?'),
    setLastWork: db.prepare('UPDATE members SET last_work = ? WHERE guild_id = ? AND user_id = ?'),
    setDaily: db.prepare('UPDATE members SET last_daily = ?, daily_streak = ?, coins = coins + ? WHERE guild_id = ? AND user_id = ?'),
    leaderboard: db.prepare('SELECT user_id, coins, bank, keys, (coins + bank) AS net_worth FROM members WHERE guild_id = ? AND (coins + bank) > 0 ORDER BY net_worth DESC, user_id LIMIT ? OFFSET ?'),
    leaderboardCount: db.prepare('SELECT COUNT(*) AS n FROM members WHERE guild_id = ? AND (coins + bank) > 0'),
    rank: db.prepare('SELECT COUNT(*) + 1 AS rank FROM members WHERE guild_id = ? AND (coins + bank) > ?'),

    customRole: db.prepare('SELECT role_id FROM custom_roles WHERE guild_id = ? AND user_id = ?'),
    setCustomRole: db.prepare('INSERT INTO custom_roles (guild_id, user_id, role_id) VALUES (?, ?, ?) ON CONFLICT(guild_id, user_id) DO UPDATE SET role_id = excluded.role_id'),
    clearCustomRole: db.prepare('DELETE FROM custom_roles WHERE guild_id = ? AND user_id = ?'),
    recordRolePurchase: db.prepare('INSERT INTO role_history (user_id, guild_id, role_id, name, color, payment_method) VALUES (?, ?, ?, ?, ?, ?)'),

    guildSettings: db.prepare('SELECT * FROM guild_settings WHERE guild_id = ?'),
    ensureGuild: db.prepare('INSERT OR IGNORE INTO guild_settings (guild_id, role_cost_coins, role_cost_keys, booster_free, booster_dual_color) VALUES (?, ?, ?, ?, ?)'),

    addWarning: db.prepare('INSERT INTO warnings (user_id, guild_id, moderator_id, reason) VALUES (?, ?, ?, ?)'),
    warnings: db.prepare('SELECT * FROM warnings WHERE user_id = ? AND guild_id = ? ORDER BY id DESC'),
    clearWarnings: db.prepare('DELETE FROM warnings WHERE user_id = ? AND guild_id = ?'),

    profile: db.prepare('SELECT * FROM profiles WHERE user_id = ?'),
    upsertBio: db.prepare("INSERT INTO profiles (user_id, bio) VALUES (?, ?) ON CONFLICT(user_id) DO UPDATE SET bio = excluded.bio, updated_at = strftime('%s', 'now')"),
    upsertStyle: db.prepare("INSERT INTO profiles (user_id, style) VALUES (?, ?) ON CONFLICT(user_id) DO UPDATE SET style = excluded.style, updated_at = strftime('%s', 'now')"),

    favorites: db.prepare('SELECT * FROM favorites WHERE user_id = ? ORDER BY created_at DESC, rowid DESC'),
    favoriteCount: db.prepare('SELECT COUNT(*) AS n FROM favorites WHERE user_id = ?'),
    isFavorite: db.prepare('SELECT 1 FROM favorites WHERE user_id = ? AND media_id = ?'),
    addFavorite: db.prepare('INSERT OR IGNORE INTO favorites (user_id, media_id, media_type, title) VALUES (?, ?, ?, ?)'),
    removeFavorite: db.prepare('DELETE FROM favorites WHERE user_id = ? AND media_id = ?'),

    bumpInteraction: db.prepare('INSERT INTO interactions (guild_id, actor_id, target_id, action, count) VALUES (?, ?, ?, ?, 1) ON CONFLICT(guild_id, actor_id, target_id, action) DO UPDATE SET count = count + 1 RETURNING count'),
    interactionsGiven: db.prepare('SELECT action, SUM(count) AS n FROM interactions WHERE guild_id = ? AND actor_id = ? GROUP BY action ORDER BY n DESC'),
    interactionsReceived: db.prepare('SELECT action, SUM(count) AS n FROM interactions WHERE guild_id = ? AND target_id = ? GROUP BY action ORDER BY n DESC'),

    addAlert: db.prepare('INSERT INTO deal_alerts (user_id, guild_id, channel_id, game_id, title, target_price, locale) VALUES (?, ?, ?, ?, ?, ?, ?)'),
    alerts: db.prepare('SELECT * FROM deal_alerts WHERE user_id = ? AND triggered_at IS NULL ORDER BY id'),
    alertCount: db.prepare('SELECT COUNT(*) AS n FROM deal_alerts WHERE user_id = ? AND triggered_at IS NULL'),
    activeAlerts: db.prepare('SELECT * FROM deal_alerts WHERE triggered_at IS NULL ORDER BY game_id'),
    removeAlert: db.prepare('DELETE FROM deal_alerts WHERE id = ? AND user_id = ?'),
    triggerAlert: db.prepare('UPDATE deal_alerts SET triggered_at = ? WHERE id = ?'),

    freeGameGuilds: db.prepare('SELECT guild_id, free_games_channel_id AS channel_id, language FROM guild_settings WHERE free_games_channel_id IS NOT NULL'),
    posted: db.prepare('SELECT giveaway_id FROM posted_giveaways WHERE guild_id = ?'),
    markPosted: db.prepare('INSERT OR IGNORE INTO posted_giveaways (guild_id, giveaway_id) VALUES (?, ?)'),
    prunePosted: db.prepare('DELETE FROM posted_giveaways WHERE posted_at < ?'),
  };

  const SETTINGS_COLUMNS = new Set([
    'role_panel_channel_id', 'role_panel_message_id', 'role_cost_coins', 'role_cost_keys', 'booster_free',
    'booster_dual_color', 'anchor_role_id', 'mod_log_channel_id', 'language', 'prefix', 'free_games_channel_id',
  ]);

  const service = {
    raw: db,

    // ------------------------------------------------------------------ economy

    /** The member's row in this server, importing an old global balance once. */
    member(guildId, userId) {
      const row = q.member.get(guildId, userId);
      if (row) return row;
      db.transaction(() => {
        const legacy = q.legacy.get(userId);
        if (legacy) {
          q.insertMember.run(guildId, userId, legacy.coins, legacy.bank, legacy.keys, legacy.last_work);
          q.markLegacy.run(userId);
        } else {
          q.insertMember.run(guildId, userId, 0, 0, 0, 0);
        }
      })();
      return q.member.get(guildId, userId);
    },

    addCoins(guildId, userId, amount) {
      service.member(guildId, userId);
      q.addCoins.run(Math.trunc(amount), guildId, userId);
      return q.member.get(guildId, userId);
    },

    /** Atomically spends wallet coins. @returns {boolean} */
    spendCoins(guildId, userId, amount) {
      if (!(amount > 0)) return false;
      service.member(guildId, userId);
      return q.spendCoins.run(amount, guildId, userId, amount).changes === 1;
    },

    deposit(guildId, userId, amount) {
      service.member(guildId, userId);
      if (!(amount > 0) || q.moveToBank.run(amount, amount, guildId, userId, amount).changes !== 1) {
        throw new Error('Insufficient wallet funds.');
      }
      return q.member.get(guildId, userId);
    },

    withdraw(guildId, userId, amount) {
      service.member(guildId, userId);
      if (!(amount > 0) || q.moveToWallet.run(amount, amount, guildId, userId, amount).changes !== 1) {
        throw new Error('Insufficient bank funds.');
      }
      return q.member.get(guildId, userId);
    },

    /** Moves wallet coins between members. @returns {boolean} */
    transfer(guildId, fromId, toId, amount) {
      if (!(amount > 0) || fromId === toId) return false;
      service.member(guildId, fromId);
      service.member(guildId, toId);
      return db.transaction(() => {
        if (q.spendCoins.run(amount, guildId, fromId, amount).changes !== 1) return false;
        q.addCoins.run(amount, guildId, toId);
        return true;
      })();
    },

    addKeys(guildId, userId, amount) {
      service.member(guildId, userId);
      q.addKeys.run(Math.trunc(amount), guildId, userId);
      return q.member.get(guildId, userId);
    },

    spendKeys(guildId, userId, amount) {
      if (!(amount > 0)) return false;
      service.member(guildId, userId);
      return q.spendKeys.run(amount, guildId, userId, amount).changes === 1;
    },

    setLastWork(guildId, userId, timestamp = now()) {
      service.member(guildId, userId);
      q.setLastWork.run(timestamp, guildId, userId);
    },

    /**
     * Daily reward with streaks: claimable every 22 h, the streak survives if the
     * previous claim was less than 48 h ago, every 7th day adds a bonus.
     */
    claimDaily(guildId, userId, at = now()) {
      const COOLDOWN = 22 * 3600;
      const GRACE = 48 * 3600;
      const e = config.economy;
      return db.transaction(() => {
        const row = service.member(guildId, userId);
        if (row.last_daily && at - row.last_daily < COOLDOWN) {
          return { ok: false, nextAt: row.last_daily + COOLDOWN, streak: row.daily_streak };
        }
        const streak = row.last_daily && at - row.last_daily < GRACE ? row.daily_streak + 1 : 1;
        const weekly = streak % 7 === 0;
        const reward = e.dailyBase + Math.min(streak - 1, e.dailyStreakCap) * e.dailyStreakStep + (weekly ? e.dailyWeeklyBonus : 0);
        q.setDaily.run(at, streak, reward, guildId, userId);
        return { ok: true, reward, streak, weekly, nextAt: at + COOLDOWN };
      })();
    },

    leaderboard(guildId, limit = 10, offset = 0) {
      return q.leaderboard.all(guildId, limit, offset);
    },

    leaderboardCount(guildId) {
      return q.leaderboardCount.get(guildId).n;
    },

    rank(guildId, userId) {
      const row = service.member(guildId, userId);
      return q.rank.get(guildId, row.coins + row.bank).rank;
    },

    // ------------------------------------------------------------------ custom roles

    customRole(guildId, userId) {
      return q.customRole.get(guildId, userId)?.role_id ?? null;
    },

    /** Role ID stored by versions before per-server roles, if any. */
    legacyCustomRole(userId) {
      return q.legacyRole.get(userId)?.custom_role_id ?? null;
    },

    setCustomRole(guildId, userId, roleId) {
      q.setCustomRole.run(guildId, userId, roleId);
    },

    adoptLegacyRole(guildId, userId, roleId) {
      db.transaction(() => {
        q.setCustomRole.run(guildId, userId, roleId);
        q.clearLegacyRole.run(userId);
      })();
    },

    clearCustomRole(guildId, userId) {
      q.clearCustomRole.run(guildId, userId);
    },

    recordRolePurchase(userId, guildId, roleId, name, color, paymentMethod) {
      q.recordRolePurchase.run(userId, guildId, roleId, name, color, paymentMethod);
    },

    // ------------------------------------------------------------------ guild settings

    guildSettings(guildId) {
      const row = guildId ? q.guildSettings.get(guildId) : null;
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
        language: null,
        prefix: null,
        free_games_channel_id: null,
        ...(row ?? {}),
      };
    },

    /** Updates only the given columns. */
    updateGuildSettings(guildId, changes) {
      const keys = Object.keys(changes).filter(key => SETTINGS_COLUMNS.has(key));
      db.transaction(() => {
        q.ensureGuild.run(guildId, config.roles.defaultCoinCost, config.roles.defaultKeyCost, config.roles.boosterFree ? 1 : 0, config.roles.boosterDualColor ? 1 : 0);
        if (keys.length) {
          const assignments = keys.map(key => `${key} = @${key}`).join(', ');
          const values = Object.fromEntries(keys.map(key => [key, typeof changes[key] === 'boolean' ? Number(changes[key]) : changes[key]]));
          db.prepare(`UPDATE guild_settings SET ${assignments}, updated_at = strftime('%s', 'now') WHERE guild_id = @guild_id`).run({ ...values, guild_id: guildId });
        }
      })();
      return service.guildSettings(guildId);
    },

    // ------------------------------------------------------------------ moderation

    addWarning(userId, guildId, moderatorId, reason) {
      return q.addWarning.run(userId, guildId, moderatorId, reason);
    },
    warnings(userId, guildId) {
      return q.warnings.all(userId, guildId);
    },
    clearWarnings(userId, guildId) {
      return q.clearWarnings.run(userId, guildId).changes;
    },

    // ------------------------------------------------------------------ profiles & favourites

    profile(userId) {
      return q.profile.get(userId) ?? { user_id: userId, bio: null, style: null };
    },
    setBio(userId, bio) {
      q.upsertBio.run(userId, bio || null);
    },
    setStyle(userId, style) {
      q.upsertStyle.run(userId, style || null);
    },

    favorites(userId) {
      return q.favorites.all(userId);
    },
    isFavorite(userId, mediaId) {
      return Boolean(q.isFavorite.get(userId, mediaId));
    },
    /** Toggles a favourite. @returns {'added'|'removed'|'full'} */
    toggleFavorite(userId, media, limit = 12) {
      return db.transaction(() => {
        if (q.isFavorite.get(userId, media.id)) {
          q.removeFavorite.run(userId, media.id);
          return 'removed';
        }
        if (q.favoriteCount.get(userId).n >= limit) return 'full';
        q.addFavorite.run(userId, media.id, media.type, media.title);
        return 'added';
      })();
    },

    // ------------------------------------------------------------------ interactions

    recordInteraction(guildId, actorId, targetId, action) {
      return q.bumpInteraction.get(guildId, actorId, targetId, action).count;
    },
    interactionStats(guildId, userId) {
      return { given: q.interactionsGiven.all(guildId, userId), received: q.interactionsReceived.all(guildId, userId) };
    },

    // ------------------------------------------------------------------ deals

    addAlert({ userId, guildId, channelId, gameId, title, targetPrice, locale }) {
      return q.addAlert.run(userId, guildId, channelId, String(gameId), title, targetPrice, locale).lastInsertRowid;
    },
    alerts(userId) {
      return q.alerts.all(userId);
    },
    alertCount(userId) {
      return q.alertCount.get(userId).n;
    },
    activeAlerts() {
      return q.activeAlerts.all();
    },
    removeAlert(userId, id) {
      return q.removeAlert.run(id, userId).changes === 1;
    },
    triggerAlert(id, at = now()) {
      q.triggerAlert.run(at, id);
    },

    freeGameGuilds() {
      return q.freeGameGuilds.all();
    },
    postedGiveaways(guildId) {
      return new Set(q.posted.all(guildId).map(row => row.giveaway_id));
    },
    markGiveawaysPosted(guildId, ids) {
      db.transaction(() => {
        for (const id of ids) q.markPosted.run(guildId, String(id));
      })();
    },
    prunePostedGiveaways(olderThanDays = 120) {
      q.prunePosted.run(now() - olderThanDays * 86400);
    },

    close() {
      if (db.open) db.close();
    },
  };

  return service;
}

const instance = open();

module.exports = instance;
module.exports.open = open;
module.exports.MIGRATIONS_COUNT = MIGRATIONS.length;
