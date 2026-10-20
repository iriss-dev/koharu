/**
 * Blackjack deck management, card evaluation, and rendering.
 */

const SUITS = ['♠', '♥', '♦', '♣'];
const VALUES = [
  { label: 'A', value: 11 },
  { label: '2', value: 2 },
  { label: '3', value: 3 },
  { label: '4', value: 4 },
  { label: '5', value: 5 },
  { label: '6', value: 6 },
  { label: '7', value: 7 },
  { label: '8', value: 8 },
  { label: '9', value: 9 },
  { label: '10', value: 10 },
  { label: 'J', value: 10 },
  { label: 'Q', value: 10 },
  { label: 'K', value: 10 },
];

/**
 * Creates and shuffles a fresh standard 52-card deck.
 * @returns {Array<{ label: string, suit: string, value: number }>}
 */
function createDeck() {
  const deck = [];
  for (const suit of SUITS) {
    for (const v of VALUES) {
      deck.push({
        label: v.label,
        suit: suit,
        value: v.value,
      });
    }
  }

  // Fisher-Yates shuffle
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }

  return deck;
}

/**
 * Calculates the total value of a hand, handling soft Aces appropriately.
 * @param {Array<{ label: string, suit: string, value: number }>} hand
 * @returns {{ total: number, isSoft: boolean, isBust: boolean, isBlackjack: boolean }}
 */
function calculateHand(hand) {
  let total = 0;
  let aces = 0;

  for (const card of hand) {
    total += card.value;
    if (card.label === 'A') {
      aces++;
    }
  }

  // Adjust Aces from 11 down to 1 if busted
  while (total > 21 && aces > 0) {
    total -= 10;
    aces--;
  }

  const isBust = total > 21;
  const isBlackjack = hand.length === 2 && total === 21;
  const isSoft = aces > 0 && total <= 21;

  return { total, isSoft, isBust, isBlackjack };
}

/**
 * Formats a card for display, e.g. "[ K♠ ]".
 * @param {{ label: string, suit: string }} card
 * @returns {string}
 */
function formatCard(card) {
  return `\`[ ${card.label}${card.suit} ]\``;
}

/**
 * Formats an entire hand into a clean display line.
 * @param {Array<{ label: string, suit: string }>} hand
 * @param {boolean} hideSecondCard (for dealer's hidden hole card)
 * @returns {string}
 */
function formatHand(hand, hideSecondCard = false) {
  if (hand.length === 0) return '*(empty)*';

  if (hideSecondCard && hand.length > 1) {
    return `${formatCard(hand[0])} \`[ ? ]\``;
  }

  return hand.map(formatCard).join(' ');
}

module.exports = {
  createDeck,
  calculateHand,
  formatCard,
  formatHand,
};
