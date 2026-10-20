const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const { parseDuration, formatDuration } = require('../src/utils/duration');

describe('Duration Parser Utilities', () => {
  test('parses seconds, minutes, hours, days cleanly', () => {
    assert.equal(parseDuration('30s'), 30 * 1000);
    assert.equal(parseDuration('10m'), 10 * 60 * 1000);
    assert.equal(parseDuration('2h'), 2 * 60 * 60 * 1000);
    assert.equal(parseDuration('1d'), 24 * 60 * 60 * 1000);
    assert.equal(parseDuration('7d'), 7 * 24 * 60 * 60 * 1000);
  });

  test('parses word variations', () => {
    assert.equal(parseDuration('15 min'), 15 * 60 * 1000);
    assert.equal(parseDuration('3 hours'), 3 * 60 * 60 * 1000);
    assert.equal(parseDuration('2 days'), 2 * 24 * 60 * 60 * 1000);
  });

  test('rejects invalid duration strings', () => {
    assert.equal(parseDuration(''), null);
    assert.equal(parseDuration('abc'), null);
    assert.equal(parseDuration('forever'), null);
    assert.equal(parseDuration(null), null);
  });

  test('formatDuration formats milliseconds cleanly', () => {
    assert.equal(formatDuration(30 * 1000), '30s');
    assert.equal(formatDuration(15 * 60 * 1000), '15m');
    assert.equal(formatDuration(2 * 60 * 60 * 1000), '2h');
    assert.equal(formatDuration(3 * 24 * 60 * 60 * 1000), '3d');
  });
});
