const { SlashCommandBuilder } = require('discord.js');
const db = require('../../database/db');
const { createDeck, calculateHand } = require('../../utils/cards');
const { buildBlackjackView, errorEmbed } = require('../../utils/embeds');

// Active games cache: userId -> gameState
const activeGames = new Map();

function getActiveGame(userId) {
  return activeGames.get(userId);
}

function clearActiveGame(userId) {
  const game = activeGames.get(userId);
  if (game && game.timeout) {
    clearTimeout(game.timeout);
  }
  activeGames.delete(userId);
}

/**
 * Initializes a new Blackjack game session.
 */
function startBlackjack(userId, username, betAmount) {
  if (activeGames.has(userId)) {
    return { error: 'You already have an active Blackjack game in progress! Finish it first.' };
  }

  const user = db.getUser(userId);
  if (user.coins < betAmount) {
    return { error: `You don't have enough coins! Your wallet has **${user.coins.toLocaleString()} coins**.` };
  }

  // Deduct initial bet
  db.addCoins(userId, -betAmount);

  const deck = createDeck();
  const playerHand = [deck.pop(), deck.pop()];
  const dealerHand = [deck.pop(), deck.pop()];

  const pScore = calculateHand(playerHand);
  const dScore = calculateHand(dealerHand);

  const game = {
    userId,
    username,
    bet: betAmount,
    deck,
    playerHand,
    dealerHand,
    inProgress: true,
    won: false,
    push: false,
    canDouble: user.coins >= betAmount * 2, // Check if user has funds to double
    statusText: null,
    timeout: null,
  };

  // Check for immediate natural Blackjack
  if (pScore.isBlackjack) {
    game.inProgress = false;
    if (dScore.isBlackjack) {
      game.push = true;
      game.statusText = 'Both you and the dealer got Blackjack! It\'s a Push (Tie). Bet refunded.';
      db.addCoins(userId, betAmount);
    } else {
      game.won = true;
      const payout = Math.floor(betAmount * 2.5); // 3:2 payout = initial bet + 1.5x
      game.statusText = `Natural Blackjack 🌸! You won **+${Math.floor(betAmount * 1.5).toLocaleString()} coins**!`;
      db.addCoins(userId, payout);
    }
    return { game };
  }

  // Store active game and set 60s auto-stand timeout
  activeGames.set(userId, game);

  return { game };
}

/**
 * Executes a 'Hit' action for a player.
 */
function handleHit(game) {
  game.canDouble = false;
  game.playerHand.push(game.deck.pop());
  const score = calculateHand(game.playerHand);

  if (score.isBust) {
    game.inProgress = false;
    game.won = false;
    game.statusText = `Bust! Your hand exceeded 21. You lost **${game.bet.toLocaleString()} coins** 💔.`;
    clearActiveGame(game.userId);
  } else if (score.total === 21) {
    // Reached 21, automatically resolve dealer turn
    handleStand(game);
  }

  return game;
}

/**
 * Executes a 'Stand' action and resolves the dealer's hand.
 */
function handleStand(game) {
  game.inProgress = false;
  clearActiveGame(game.userId);

  let pScore = calculateHand(game.playerHand);
  let dScore = calculateHand(game.dealerHand);

  // Dealer draws until 17 or higher
  while (dScore.total < 17) {
    game.dealerHand.push(game.deck.pop());
    dScore = calculateHand(game.dealerHand);
  }

  if (dScore.isBust) {
    game.won = true;
    const winnings = game.bet * 2;
    db.addCoins(game.userId, winnings);
    game.statusText = `Dealer busts with ${dScore.total}! You won **+${game.bet.toLocaleString()} coins** 🎉!`;
  } else if (pScore.total > dScore.total) {
    game.won = true;
    const winnings = game.bet * 2;
    db.addCoins(game.userId, winnings);
    game.statusText = `You beat the dealer (${pScore.total} vs ${dScore.total})! You won **+${game.bet.toLocaleString()} coins** 🌸!`;
  } else if (pScore.total < dScore.total) {
    game.won = false;
    game.statusText = `Dealer wins with ${dScore.total} against your ${pScore.total}. You lost **${game.bet.toLocaleString()} coins**.`;
  } else {
    game.push = true;
    db.addCoins(game.userId, game.bet);
    game.statusText = `Push! Tie at ${pScore.total}. Your bet of **${game.bet.toLocaleString()} coins** was returned.`;
  }

  return game;
}

/**
 * Executes a 'Double Down' action.
 */
function handleDoubleDown(game) {
  const user = db.getUser(game.userId);
  if (user.coins < game.bet) {
    return { error: 'Insufficient funds in wallet to Double Down!' };
  }

  // Deduct additional bet
  db.addCoins(game.userId, -game.bet);
  game.bet *= 2;
  game.canDouble = false;

  // Deal exactly one card then stand
  game.playerHand.push(game.deck.pop());
  const score = calculateHand(game.playerHand);

  if (score.isBust) {
    game.inProgress = false;
    game.won = false;
    game.statusText = `Double Down Bust! Hand totaled ${score.total}. You lost **${game.bet.toLocaleString()} coins**.`;
    clearActiveGame(game.userId);
    return { game };
  }

  handleStand(game);
  return { game };
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('blackjack')
    .setDescription('Play a classic game of Blackjack against the dealer')
    .addIntegerOption(opt =>
      opt.setName('bet')
        .setDescription('Amount of coins to bet (minimum 10)')
        .setMinValue(10)
        .setRequired(true)
    ),

  aliases: ['bj', '21'],
  getActiveGame,
  clearActiveGame,
  handleHit,
  handleStand,
  handleDoubleDown,

  async executeSlash(interaction) {
    const bet = interaction.options.getInteger('bet');
    const result = startBlackjack(interaction.user.id, interaction.user.username, bet);

    if (result.error) {
      return interaction.reply({ embeds: [errorEmbed('Blackjack', result.error)], ephemeral: true });
    }

    const view = buildBlackjackView(result.game);
    const replyMsg = await interaction.reply({ embeds: [view.embed], components: view.components, fetchReply: true });

    if (result.game.inProgress) {
      result.game.messageId = replyMsg.id;
    }
  },

  async executePrefix(message, args) {
    if (!args[0]) {
      return message.reply({
        embeds: [errorEmbed('Usage', 'Please specify a bet: `-bj <amount | all>` (min 10 coins)')],
      });
    }

    const user = db.getUser(message.author.id);
    let bet = 0;
    if (args[0].toLowerCase() === 'all' || args[0].toLowerCase() === 'max') {
      bet = user.coins;
    } else {
      bet = parseInt(args[0], 10);
    }

    if (isNaN(bet) || bet < 10) {
      return message.reply({
        embeds: [errorEmbed('Invalid Bet', 'The minimum bet is **10 coins** 🪙.')],
      });
    }

    const result = startBlackjack(message.author.id, message.author.username, bet);
    if (result.error) {
      return message.reply({ embeds: [errorEmbed('Blackjack', result.error)] });
    }

    const view = buildBlackjackView(result.game);
    const replyMsg = await message.reply({ embeds: [view.embed], components: view.components });

    if (result.game.inProgress) {
      result.game.messageId = replyMsg.id;
    }
  },
};
