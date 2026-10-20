const { test, describe, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

// Configure test db path before requiring db
const testDbPath = path.resolve(__dirname, 'test.sqlite');
process.env.DATABASE_PATH = testDbPath;

const db = require('../src/database/db');

describe('Database Service', () => {
  after(() => {
    db.close();
    if (fs.existsSync(testDbPath)) {
      try {
        fs.unlinkSync(testDbPath);
      } catch {}
    }
  });

  test('creates new user with default 0 balances', () => {
    const user = db.getUser('test_user_1');
    assert.equal(user.user_id, 'test_user_1');
    assert.equal(user.coins, 0);
    assert.equal(user.bank, 0);
    assert.equal(user.keys, 0);
  });

  test('adds coins and deposits to bank cleanly', () => {
    db.addCoins('test_user_1', 1000);
    let user = db.getUser('test_user_1');
    assert.equal(user.coins, 1000);

    db.deposit('test_user_1', 400);
    user = db.getUser('test_user_1');
    assert.equal(user.coins, 600);
    assert.equal(user.bank, 400);

    db.withdraw('test_user_1', 200);
    user = db.getUser('test_user_1');
    assert.equal(user.coins, 800);
    assert.equal(user.bank, 200);
  });

  test('prevents overdrawing wallet or bank', () => {
    assert.throws(() => {
      db.deposit('test_user_1', 999999);
    }, /Insufficient wallet funds/);

    assert.throws(() => {
      db.withdraw('test_user_1', 999999);
    }, /Insufficient bank funds/);
  });

  test('modifies and tracks event keys', () => {
    db.modifyKeys('test_user_1', 3);
    let user = db.getUser('test_user_1');
    assert.equal(user.keys, 3);

    db.modifyKeys('test_user_1', -1);
    user = db.getUser('test_user_1');
    assert.equal(user.keys, 2);
  });

  test('updates guild settings and saves anchor role', () => {
    const updated = db.saveGuildSettings({
      guild_id: 'test_guild_1',
      role_cost_coins: 30000,
      role_cost_keys: 2,
      booster_free: 1,
      booster_dual_color: 1,
      anchor_role_id: '1234567890',
    });

    assert.equal(updated.role_cost_coins, 30000);
    assert.equal(updated.role_cost_keys, 2);
    assert.equal(updated.anchor_role_id, '1234567890');
  });

  test('sets and fetches user custom role', () => {
    db.setCustomRole('test_user_1', 'custom_role_999');
    const user = db.getUser('test_user_1');
    assert.equal(user.custom_role_id, 'custom_role_999');
  });

  test('records and clears member warnings', () => {
    db.addWarning('bad_user_1', 'guild_123', 'mod_456', 'Spamming emojis');
    db.addWarning('bad_user_1', 'guild_123', 'mod_456', 'Disrespectful language');

    const list = db.getWarnings('bad_user_1', 'guild_123');
    assert.equal(list.length, 2);
    assert.equal(list[0].reason, 'Disrespectful language');

    db.clearWarnings('bad_user_1', 'guild_123');
    const emptyList = db.getWarnings('bad_user_1', 'guild_123');
    assert.equal(emptyList.length, 0);
  });
});
