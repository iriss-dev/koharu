'use strict';

/**
 * Casino games: blackjack (with dealer peek and an idle timeout that stands for
 * the player), coin flip and a cute slot machine. Bets are taken atomically
 * before a game starts, so a balance can never go negative.
 */

const ui = require('../../core/ui');
const router = require('../../core/router');
const emojis = require('../../core/emojis');
const { register, t } = require('../../core/i18n');
const db = require('../../database/db');
const config = require('../../config');
const { createDeck, calculateHand, formatHand } = require('../../utils/cards');
const { formatNumber, escapeMarkdown } = require('../../utils/text');

register('casino', {
  es: {
    bjTitle: 'Blackjack · {bet} {e:coin}',
    dealer: 'Crupier',
    you: 'Tú',
    hit: 'Pedir',
    stand: 'Plantarse',
    double: 'Doblar',
    choose: 'Elige tu jugada.',
    natural: '¡Blackjack natural {e:sakura}! Ganas **+{win}** {e:coin}.',
    bothNatural: 'Ambos tienen blackjack: empate, recuperas tu apuesta.',
    dealerNatural: 'El crupier tenía blackjack. Pierdes **{bet}** {e:coin}.',
    bust: 'Te pasaste de 21. Pierdes **{bet}** {e:coin}.',
    dealerBust: 'El crupier se pasó con {total}. ¡Ganas **+{win}** {e:coin}!',
    win: 'Le ganaste al crupier ({you} contra {dealer}). ¡Ganas **+{win}** {e:coin}!',
    lose: 'El crupier gana con {dealer} contra tu {you}. Pierdes **{bet}** {e:coin}.',
    push: 'Empate a {total}. Recuperas tu apuesta.',
    timeout: 'Te quedaste pensando, así que me planté por ti.',
    already: 'Ya tienes una partida de blackjack abierta. Termínala primero.',
    footer: 'Jugador: {name} · el crupier pide hasta 17 · el blackjack paga 3:2',
    noMoney: 'No te alcanza: tu monedero tiene **{wallet}** {e:coin}.',
    badBet: 'La apuesta debe estar entre **{min}** y **{max}** {e:coin}.',
    doubleNoMoney: 'No te alcanza para doblar.',
    notYourGame: 'Esta partida es de otra persona. Abre la tuya con `/blackjack`.',
    gameOver: 'Esta partida ya terminó.',
    coinTitle: 'Cara o cruz',
    heads: 'Cara',
    tails: 'Cruz',
    coinWin: 'Salió **{side}**. ¡Ganas **+{win}** {e:coin}!',
    coinLose: 'Salió **{side}**. Pierdes **{bet}** {e:coin}.',
    slotsTitle: 'Tragamonedas',
    spinning: 'Girando…',
    jackpot: '¡JACKPOT de flores! Ganas **+{win}** {e:coin}',
    triple: '¡Tres iguales! Ganas **+{win}** {e:coin}',
    pair: '¡Una pareja! Ganas **+{win}** {e:coin}',
    nothing: 'Esta vez no hubo suerte. Pierdes **{bet}** {e:coin}.',
    slotsFooter: '3 {e:sakura} ×10 · 3 iguales ×5 · pareja ×1.8',
    wallet: 'Monedero: {wallet}',
  },
  en: {
    bjTitle: 'Blackjack · {bet} {e:coin}',
    dealer: 'Dealer',
    you: 'You',
    hit: 'Hit',
    stand: 'Stand',
    double: 'Double',
    choose: 'Choose your move.',
    natural: 'Natural blackjack {e:sakura}! You win **+{win}** {e:coin}.',
    bothNatural: 'You both have blackjack: push, your bet is returned.',
    dealerNatural: 'The dealer had blackjack. You lose **{bet}** {e:coin}.',
    bust: 'You went over 21. You lose **{bet}** {e:coin}.',
    dealerBust: 'The dealer busts with {total}. You win **+{win}** {e:coin}!',
    win: 'You beat the dealer ({you} vs {dealer}). You win **+{win}** {e:coin}!',
    lose: 'The dealer wins with {dealer} against your {you}. You lose **{bet}** {e:coin}.',
    push: 'Push at {total}. Your bet is returned.',
    timeout: 'You were thinking for a while, so I stood for you.',
    already: 'You already have a blackjack game open. Finish it first.',
    footer: 'Player: {name} · dealer draws to 17 · blackjack pays 3:2',
    noMoney: 'Not enough: your wallet has **{wallet}** {e:coin}.',
    badBet: 'The bet must be between **{min}** and **{max}** {e:coin}.',
    doubleNoMoney: 'You cannot afford to double.',
    notYourGame: 'This game belongs to someone else. Start yours with `/blackjack`.',
    gameOver: 'This game has already ended.',
    coinTitle: 'Coin flip',
    heads: 'Heads',
    tails: 'Tails',
    coinWin: 'It landed on **{side}**. You win **+{win}** {e:coin}!',
    coinLose: 'It landed on **{side}**. You lose **{bet}** {e:coin}.',
    slotsTitle: 'Slot machine',
    spinning: 'Spinning…',
    jackpot: 'Flower JACKPOT! You win **+{win}** {e:coin}',
    triple: 'Three of a kind! You win **+{win}** {e:coin}',
    pair: 'A pair! You win **+{win}** {e:coin}',
    nothing: 'No luck this time. You lose **{bet}** {e:coin}.',
    slotsFooter: '3 {e:sakura} ×10 · three of a kind ×5 · pair ×1.8',
    wallet: 'Wallet: {wallet}',
  },
});

const L = (locale, key, vars) => t(locale, `casino.${key}`, vars);
const n = (locale, value) => formatNumber(locale, value);

/** Validates and takes a bet. @returns {{ ok: true } | { ok: false, payload: object }} */
function takeBet(locale, guildId, userId, bet) {
  const { minBet, maxBet } = config.economy;
  if (!Number.isInteger(bet) || bet < minBet || bet > maxBet) {
    return { ok: false, payload: ui.message(ui.notice('warn', 'Casino', L(locale, 'badBet', { min: n(locale, minBet), max: n(locale, maxBet) })), { ephemeral: true }) };
  }
  if (!db.spendCoins(guildId, userId, bet)) {
    return { ok: false, payload: ui.message(ui.notice('warn', 'Casino', L(locale, 'noMoney', { wallet: n(locale, db.member(guildId, userId).coins) })), { ephemeral: true }) };
  }
  return { ok: true };
}

// --------------------------------------------------------------------------- blackjack

const IDLE_MS = 2 * 60 * 1000;
const games = new Map(); // `${guildId}:${userId}` → game

const gameKey = (guildId, userId) => `${guildId}:${userId}`;

function settle(game, outcome) {
  game.inProgress = false;
  game.outcome = outcome;
  if (game.timer) clearTimeout(game.timer);
  games.delete(gameKey(game.guildId, game.userId));
  const payout = { natural: Math.floor(game.bet * 2.5), win: game.bet * 2, push: game.bet }[outcome.kind] ?? 0;
  if (payout) db.addCoins(game.guildId, game.userId, payout);
  game.payout = payout;
}

function dealerPlays(game) {
  let dealer = calculateHand(game.dealerHand);
  while (dealer.total < 17) {
    game.dealerHand.push(game.deck.pop());
    dealer = calculateHand(game.dealerHand);
  }
  const player = calculateHand(game.playerHand);
  if (dealer.isBust) return settle(game, { kind: 'win', key: 'dealerBust', vars: { total: dealer.total } });
  if (player.total > dealer.total) return settle(game, { kind: 'win', key: 'win', vars: { you: player.total, dealer: dealer.total } });
  if (player.total < dealer.total) return settle(game, { kind: 'lose', key: 'lose', vars: { you: player.total, dealer: dealer.total } });
  return settle(game, { kind: 'push', key: 'push', vars: { total: player.total } });
}

/** Starts a game; the bet must already be taken. */
function startBlackjack({ guildId, userId, name, bet }, deck = createDeck()) {
  const game = {
    guildId, userId, name, bet, deck,
    playerHand: [deck.pop(), deck.pop()],
    dealerHand: [deck.pop(), deck.pop()],
    inProgress: true,
    doubled: false,
    timer: null,
    message: null,
  };
  const player = calculateHand(game.playerHand);
  const dealer = calculateHand(game.dealerHand);
  // Dealer peeks for blackjack before the player acts.
  if (player.isBlackjack && dealer.isBlackjack) settle(game, { kind: 'push', key: 'bothNatural' });
  else if (player.isBlackjack) settle(game, { kind: 'natural', key: 'natural' });
  else if (dealer.isBlackjack) settle(game, { kind: 'lose', key: 'dealerNatural' });
  else games.set(gameKey(guildId, userId), game);
  return game;
}

function hit(game) {
  game.playerHand.push(game.deck.pop());
  const player = calculateHand(game.playerHand);
  if (player.isBust) settle(game, { kind: 'lose', key: 'bust' });
  else if (player.total === 21) dealerPlays(game);
}

function stand(game) {
  dealerPlays(game);
}

/** @returns {boolean} false when the player cannot afford to double. */
function double(game) {
  if (game.playerHand.length !== 2 || !db.spendCoins(game.guildId, game.userId, game.bet)) return false;
  game.bet *= 2;
  game.doubled = true;
  game.playerHand.push(game.deck.pop());
  if (calculateHand(game.playerHand).isBust) settle(game, { kind: 'lose', key: 'bust' });
  else dealerPlays(game);
  return true;
}

function blackjackMessage(locale, game) {
  const player = calculateHand(game.playerHand);
  const dealer = calculateHand(game.dealerHand);
  const cards = ui.asset('pink_cards.png');
  const status = game.inProgress
    ? L(locale, 'choose')
    : `${game.timedOut ? `${L(locale, 'timeout')}\n` : ''}${L(locale, game.outcome.key, { ...game.outcome.vars, bet: n(locale, game.bet), win: n(locale, game.outcome.kind === 'natural' ? Math.floor(game.bet * 1.5) : game.bet) })}`;
  const accent = game.inProgress ? 'primary' : { win: 'mint', natural: 'mint', push: 'gold', lose: 'error' }[game.outcome.kind];

  const body = [
    'sep',
    `**${L(locale, 'dealer')}** \`${game.inProgress ? '?' : dealer.total}\`\n${formatHand(game.dealerHand, game.inProgress)}`,
    `**${L(locale, 'you')}** \`${player.total}\`\n${formatHand(game.playerHand)}`,
    ui.quote(status),
    ui.gallery({ url: cards.url, description: 'Blackjack' }),
  ];
  if (game.inProgress) {
    const canDouble = game.playerHand.length === 2 && db.member(game.guildId, game.userId).coins >= game.bet;
    body.push(ui.row(
      ui.button({ id: router.encode('bj', 'hit', game.userId), label: L(locale, 'hit'), emoji: 'cards', style: 'primary' }),
      ui.button({ id: router.encode('bj', 'stand', game.userId), label: L(locale, 'stand'), emoji: 'shield' }),
      ui.button({ id: router.encode('bj', 'double', game.userId), label: L(locale, 'double'), emoji: 'sparkle', style: 'success', disabled: !canDouble }),
    ));
  }
  return ui.message(ui.card({
    accent,
    emoji: 'cards',
    title: L(locale, 'bjTitle', { bet: n(locale, game.bet) }),
    body,
    footer: L(locale, 'footer', { name: escapeMarkdown(game.name) }),
  }), { files: [cards.attachment] });
}

/** Arms (or re-arms) the idle timer that stands for an absent player. */
function armTimeout(game, locale, onTimeout) {
  if (game.timer) clearTimeout(game.timer);
  game.timer = setTimeout(() => {
    if (!game.inProgress) return;
    game.timedOut = true;
    stand(game);
    onTimeout?.(blackjackMessage(locale, game));
  }, IDLE_MS);
  game.timer.unref?.();
}

const activeGame = (guildId, userId) => games.get(gameKey(guildId, userId)) ?? null;

router.register('bj', async (interaction, route, { locale }) => {
  const game = activeGame(interaction.guild?.id, route.owner);
  if (!game || !game.inProgress) {
    return interaction.reply(ui.message(ui.notice('info', 'Blackjack', L(locale, 'gameOver')), { ephemeral: true }));
  }
  if (route.action === 'hit') hit(game);
  else if (route.action === 'stand') stand(game);
  else if (route.action === 'double' && !double(game)) {
    return interaction.reply(ui.message(ui.notice('warn', 'Blackjack', L(locale, 'doubleNoMoney')), { ephemeral: true }));
  }
  if (game.inProgress) armTimeout(game, locale, payload => interaction.message.edit({ ...ui.forEdit(payload), attachments: [] }).catch(() => null));
  return interaction.update({ ...ui.forEdit(blackjackMessage(locale, game)), attachments: [] });
});

// --------------------------------------------------------------------------- coin flip

function coinflip(locale, { guildId, userId, bet, side }, random = Math.random) {
  const taken = takeBet(locale, guildId, userId, bet);
  if (!taken.ok) return taken.payload;
  const result = random() < 0.5 ? 'heads' : 'tails';
  const won = result === side;
  if (won) db.addCoins(guildId, userId, bet * 2);
  const wallet = db.member(guildId, userId).coins;
  return ui.message(ui.card({
    accent: won ? 'mint' : 'error',
    emoji: 'coin',
    title: L(locale, 'coinTitle'),
    body: [ui.quote(L(locale, won ? 'coinWin' : 'coinLose', { side: L(locale, result), win: n(locale, bet), bet: n(locale, bet) })), ui.sub(L(locale, 'wallet', { wallet: n(locale, wallet) }))],
  }));
}

// --------------------------------------------------------------------------- slots

const REELS = ['sakura', 'strawberry', 'star', 'heart', 'ribbon', 'cat'];
const PAYOUT = { jackpot: 10, triple: 5, pair: 1.8 };

function spinReels(random = Math.random) {
  return [0, 1, 2].map(() => REELS[Math.floor(random() * REELS.length)]);
}

/** @returns {{ kind: 'jackpot'|'triple'|'pair'|'nothing', multiplier: number }} */
function scoreReels(reels) {
  const [a, b, c] = reels;
  if (a === b && b === c) return a === 'sakura' ? { kind: 'jackpot', multiplier: PAYOUT.jackpot } : { kind: 'triple', multiplier: PAYOUT.triple };
  if (a === b || b === c || a === c) return { kind: 'pair', multiplier: PAYOUT.pair };
  return { kind: 'nothing', multiplier: 0 };
}

/** Exact expected return per coin bet (house edge = 1 - this). */
function slotsExpectedReturn() {
  let total = 0;
  const count = REELS.length ** 3;
  for (const a of REELS) for (const b of REELS) for (const c of REELS) total += scoreReels([a, b, c]).multiplier;
  return total / count;
}

function slotsFrame(locale, reels, { spinning = false, result = null, bet = 0, wallet = null } = {}) {
  const line = spinning ? '🎰 ❔ ❔ ❔' : `🎰 ${reels.map(emojis.e).join('  ')}`;
  const body = [`## ${line}`];
  if (result) {
    const win = Math.floor(bet * result.multiplier);
    body.push(ui.quote(L(locale, result.kind, { win: n(locale, win), bet: n(locale, bet) })));
    if (wallet !== null) body.push(ui.sub(L(locale, 'wallet', { wallet: n(locale, wallet) })));
  } else {
    body.push(ui.sub(L(locale, 'spinning')));
  }
  return ui.message(ui.card({
    accent: !result ? 'lavender' : result.multiplier ? 'mint' : 'error',
    emoji: 'slot',
    title: L(locale, 'slotsTitle'),
    body,
    footer: L(locale, 'slotsFooter'),
  }));
}

function playSlots(locale, { guildId, userId, bet }, random = Math.random) {
  const taken = takeBet(locale, guildId, userId, bet);
  if (!taken.ok) return { error: taken.payload };
  const reels = spinReels(random);
  const result = scoreReels(reels);
  if (result.multiplier) db.addCoins(guildId, userId, Math.floor(bet * result.multiplier));
  const wallet = db.member(guildId, userId).coins;
  return { reels, result, wallet, bet };
}

module.exports = {
  L, takeBet, startBlackjack, hit, stand, double, blackjackMessage, armTimeout, activeGame, games,
  coinflip, REELS, PAYOUT, spinReels, scoreReels, slotsExpectedReturn, slotsFrame, playSlots,
};
