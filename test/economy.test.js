'use strict';

process.env.DATABASE_PATH = ':memory:';

const { test, describe, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const Database = require('better-sqlite3');

const db = require('../src/database/db');
const casino = require('../src/features/casino');

after(() => db.close());

describe('per-server economy', () => {
  test('balances are separate per server', () => {
    db.addCoins('ga', 'u', 500);
    assert.equal(db.member('ga', 'u').coins, 500);
    assert.equal(db.member('gb', 'u').coins, 0);
  });

  test('spending is atomic and can never go negative', () => {
    db.addCoins('g1', 'a', 100);
    assert.equal(db.spendCoins('g1', 'a', 101), false);
    assert.equal(db.spendCoins('g1', 'a', 100), true);
    assert.equal(db.member('g1', 'a').coins, 0);
    assert.equal(db.spendCoins('g1', 'a', -5), false);
    assert.equal(db.addCoins('g1', 'a', -999).coins, 0);
  });

  test('deposit, withdraw and transfer', () => {
    db.addCoins('g2', 'a', 1000);
    db.deposit('g2', 'a', 400);
    assert.throws(() => db.deposit('g2', 'a', 601));
    db.withdraw('g2', 'a', 100);
    assert.deepEqual([db.member('g2', 'a').coins, db.member('g2', 'a').bank], [700, 300]);
    assert.equal(db.transfer('g2', 'a', 'b', 800), false);
    assert.equal(db.transfer('g2', 'a', 'a', 10), false);
    assert.equal(db.transfer('g2', 'a', 'b', 700), true);
    assert.equal(db.member('g2', 'b').coins, 700);
  });

  test('daily streak grows, survives 47 hours and resets after 48', () => {
    const t0 = 1_800_000_000;
    const first = db.claimDaily('g3', 'a', t0);
    assert.deepEqual([first.ok, first.streak, first.reward], [true, 1, 400]);
    assert.equal(db.claimDaily('g3', 'a', t0 + 3600).ok, false);
    const second = db.claimDaily('g3', 'a', t0 + 47 * 3600);
    assert.deepEqual([second.streak, second.reward], [2, 460]);
    let last = second;
    for (let day = 3; day <= 7; day++) last = db.claimDaily('g3', 'a', t0 + (47 + (day - 2) * 23) * 3600);
    assert.equal(last.streak, 7);
    assert.equal(last.weekly, true);
    assert.equal(last.reward, 400 + 6 * 60 + 500);
    const reset = db.claimDaily('g3', 'a', t0 + 1000 * 3600);
    assert.equal(reset.streak, 1);
  });

  test('leaderboard and rank are per server', () => {
    db.addCoins('g4', 'rich', 900);
    db.addCoins('g4', 'mid', 500);
    db.addCoins('g4', 'low', 10);
    db.addCoins('g5', 'other', 99999);
    assert.deepEqual(db.leaderboard('g4').map(r => r.user_id), ['rich', 'mid', 'low']);
    assert.equal(db.rank('g4', 'mid'), 2);
    assert.equal(db.leaderboardCount('g4'), 3);
  });

  test('keys never go below zero', () => {
    db.addKeys('g6', 'a', 2);
    assert.equal(db.spendKeys('g6', 'a', 3), false);
    assert.equal(db.addKeys('g6', 'a', -10).keys, 0);
  });

  test('favourites toggle and cap', () => {
    for (let i = 0; i < 12; i++) assert.equal(db.toggleFavorite('fan', { id: i, type: 'ANIME', title: `T${i}` }), 'added');
    assert.equal(db.toggleFavorite('fan', { id: 99, type: 'ANIME', title: 'X' }), 'full');
    assert.equal(db.toggleFavorite('fan', { id: 3, type: 'ANIME', title: 'T3' }), 'removed');
  });

  test('guild settings update only the given columns', () => {
    db.updateGuildSettings('g7', { language: 'en' });
    const s = db.updateGuildSettings('g7', { prefix: 'k!', not_a_column: 'x' });
    assert.deepEqual([s.language, s.prefix], ['en', 'k!']);
  });
});

describe('upgrading a Koharu 1.x database', () => {
  test('old global balances move into the first server once', () => {
    const file = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'koharu-')), 'old.sqlite');
    const old = new Database(file);
    old.exec(`
      CREATE TABLE users (user_id TEXT PRIMARY KEY, coins INTEGER NOT NULL DEFAULT 0, bank INTEGER NOT NULL DEFAULT 0, keys INTEGER NOT NULL DEFAULT 0, custom_role_id TEXT DEFAULT NULL, last_work INTEGER NOT NULL DEFAULT 0, created_at INTEGER NOT NULL DEFAULT 0);
      CREATE TABLE guild_settings (guild_id TEXT PRIMARY KEY, role_panel_channel_id TEXT, role_panel_message_id TEXT, role_cost_coins INTEGER NOT NULL DEFAULT 25000, role_cost_keys INTEGER NOT NULL DEFAULT 1, booster_free INTEGER NOT NULL DEFAULT 1, booster_dual_color INTEGER NOT NULL DEFAULT 1, anchor_role_id TEXT, mod_log_channel_id TEXT, updated_at INTEGER NOT NULL DEFAULT 0);
      CREATE INDEX idx_users_coins ON users(coins);
      INSERT INTO users (user_id, coins, bank, keys, custom_role_id) VALUES ('old', 900, 100, 2, 'role-1');
      INSERT INTO guild_settings (guild_id, role_cost_coins) VALUES ('g', 777);
    `);
    old.close();

    const upgraded = db.open(file);
    assert.equal(upgraded.raw.pragma('user_version', { simple: true }), db.MIGRATIONS_COUNT);
    assert.equal(upgraded.guildSettings('g').role_cost_coins, 777);
    const row = upgraded.member('g', 'old');
    assert.deepEqual([row.coins, row.bank, row.keys], [900, 100, 2]);
    assert.equal(upgraded.member('another', 'old').coins, 0, 'imported once, not duplicated');
    assert.equal(upgraded.legacyCustomRole('old'), 'role-1');
    upgraded.close();

    // Opening again is a no-op.
    const again = db.open(file);
    assert.equal(again.member('g', 'old').coins, 900);
    again.close();
  });
});

describe('casino', () => {
  const card = (label, value) => ({ label, value, suit: '♥' });
  // The deck is dealt with pop(): last element first (player, player, dealer, dealer).
  const deck = (...cards) => [...cards].reverse();

  test('slots keep a house edge', () => {
    const ret = casino.slotsExpectedReturn();
    assert.ok(ret < 1 && ret > 0.85, `expected return ${ret}`);
    assert.deepEqual(casino.scoreReels(['sakura', 'sakura', 'sakura']).kind, 'jackpot');
    assert.deepEqual(casino.scoreReels(['cat', 'cat', 'cat']).kind, 'triple');
    assert.deepEqual(casino.scoreReels(['cat', 'star', 'cat']).kind, 'pair');
    assert.deepEqual(casino.scoreReels(['cat', 'star', 'heart']).kind, 'nothing');
  });

  test('natural blackjack pays 3:2', () => {
    db.addCoins('bj', 'p1', 100);
    assert.ok(db.spendCoins('bj', 'p1', 100));
    const game = casino.startBlackjack({ guildId: 'bj', userId: 'p1', name: 'P', bet: 100 }, deck(card('A', 11), card('K', 10), card('9', 9), card('7', 7)));
    assert.equal(game.inProgress, false);
    assert.equal(db.member('bj', 'p1').coins, 250);
  });

  test('dealer peeks: a dealer blackjack ends the hand at once', () => {
    db.addCoins('bj', 'p2', 100);
    db.spendCoins('bj', 'p2', 100);
    const game = casino.startBlackjack({ guildId: 'bj', userId: 'p2', name: 'P', bet: 100 }, deck(card('9', 9), card('8', 8), card('A', 11), card('Q', 10)));
    assert.equal(game.inProgress, false);
    assert.equal(game.outcome.key, 'dealerNatural');
    assert.equal(db.member('bj', 'p2').coins, 0);
  });

  test('hit to bust loses, stand vs bust dealer wins, double needs funds', () => {
    db.addCoins('bj', 'p3', 100);
    db.spendCoins('bj', 'p3', 100);
    const bust = casino.startBlackjack({ guildId: 'bj', userId: 'p3', name: 'P', bet: 100 }, deck(card('K', 10), card('6', 6), card('9', 9), card('7', 7), card('Q', 10)));
    casino.hit(bust);
    assert.equal(bust.outcome.key, 'bust');
    assert.equal(casino.activeGame('bj', 'p3'), null, 'finished games are released');

    db.addCoins('bj', 'p4', 100);
    db.spendCoins('bj', 'p4', 100);
    const win = casino.startBlackjack({ guildId: 'bj', userId: 'p4', name: 'P', bet: 100 }, deck(card('K', 10), card('8', 8), card('9', 9), card('6', 6), card('K', 10)));
    assert.equal(casino.double(win), false, 'no coins left to double');
    casino.stand(win);
    assert.equal(win.outcome.key, 'dealerBust');
    assert.equal(db.member('bj', 'p4').coins, 200);
  });

  test('coin flip pays double or takes the bet', () => {
    db.addCoins('cf', 'p', 100);
    casino.coinflip('es', { guildId: 'cf', userId: 'p', bet: 100, side: 'heads' }, () => 0.1);
    assert.equal(db.member('cf', 'p').coins, 200);
    casino.coinflip('es', { guildId: 'cf', userId: 'p', bet: 50, side: 'heads' }, () => 0.9);
    assert.equal(db.member('cf', 'p').coins, 150);
  });
});
