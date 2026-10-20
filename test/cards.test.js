const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const { createDeck, calculateHand, formatHand } = require('../src/utils/cards');

describe('Blackjack & Card Logic', () => {
  test('createDeck creates a 52-card standard shuffled deck', () => {
    const deck = createDeck();
    assert.equal(deck.length, 52);

    // Verify all 4 suits exist
    const suits = new Set(deck.map(c => c.suit));
    assert.equal(suits.size, 4);
  });

  test('calculateHand identifies natural Blackjack', () => {
    const hand = [
      { label: 'A', suit: '♠', value: 11 },
      { label: 'K', suit: '♥', value: 10 },
    ];
    const score = calculateHand(hand);
    assert.equal(score.total, 21);
    assert.equal(score.isBlackjack, true);
    assert.equal(score.isBust, false);
  });

  test('calculateHand adjusts soft Aces down to 1 when exceeding 21', () => {
    const hand = [
      { label: 'A', suit: '♠', value: 11 },
      { label: '8', suit: '♦', value: 8 },
      { label: '5', suit: '♣', value: 5 },
    ];
    // 11 + 8 + 5 = 24 -> Ace becomes 1 -> 1 + 8 + 5 = 14
    const score = calculateHand(hand);
    assert.equal(score.total, 14);
    assert.equal(score.isBust, false);
  });

  test('calculateHand handles multiple Aces correctly', () => {
    const hand = [
      { label: 'A', suit: '♠', value: 11 },
      { label: 'A', suit: '♥', value: 11 },
      { label: '9', suit: '♦', value: 9 },
    ];
    // 11 + 1 + 9 = 21
    const score = calculateHand(hand);
    assert.equal(score.total, 21);
    assert.equal(score.isBust, false);
  });

  test('calculateHand detects bust correctly', () => {
    const hand = [
      { label: '10', suit: '♠', value: 10 },
      { label: '9', suit: '♦', value: 9 },
      { label: '7', suit: '♣', value: 7 },
    ];
    // 10 + 9 + 7 = 26
    const score = calculateHand(hand);
    assert.equal(score.total, 26);
    assert.equal(score.isBust, true);
  });

  test('formatHand handles hidden dealer hole card', () => {
    const hand = [
      { label: '10', suit: '♦', value: 10 },
      { label: '5', suit: '♠', value: 5 },
    ];
    const hidden = formatHand(hand, true);
    assert.ok(hidden.includes('[ 10♦ ]'));
    assert.ok(hidden.includes('[ ? ]'));
    assert.ok(!hidden.includes('[ 5♠ ]'));
  });
});
