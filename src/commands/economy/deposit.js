const { SlashCommandBuilder } = require('discord.js');
const db = require('../../database/db');
const { successEmbed, errorEmbed } = require('../../utils/embeds');

function executeDeposit(userId, input) {
  const user = db.getUser(userId);

  if (user.coins <= 0) {
    return {
      success: false,
      embed: errorEmbed('Empty Wallet', 'You don\'t have any coins in your wallet to deposit!'),
    };
  }

  let amount = 0;
  if (typeof input === 'string' && (input.toLowerCase() === 'all' || input.toLowerCase() === 'max')) {
    amount = user.coins;
  } else {
    amount = parseInt(input, 10);
  }

  if (isNaN(amount) || amount <= 0) {
    return {
      success: false,
      embed: errorEmbed('Invalid Amount', 'Please specify a valid positive number or `all` to deposit.'),
    };
  }

  if (amount > user.coins) {
    return {
      success: false,
      embed: errorEmbed('Insufficient Funds', `You only have **${user.coins.toLocaleString()} coins** in your wallet!`),
    };
  }

  db.deposit(userId, amount);
  const updated = db.getUser(userId);

  return {
    success: true,
    embed: successEmbed(
      'Bank Deposit',
      `Safely stored **${amount.toLocaleString()} coins** into your bank account 🏦.\n` +
      `New Bank Balance: **${updated.bank.toLocaleString()} coins**.`
    ),
  };
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('deposit')
    .setDescription('Deposit coins from your wallet into the secure bank')
    .addStringOption(opt =>
      opt.setName('amount')
        .setDescription('Amount of coins to deposit, or "all"')
        .setRequired(true)
    ),

  aliases: ['dep', 'd'],

  async executeSlash(interaction) {
    const input = interaction.options.getString('amount');
    const res = executeDeposit(interaction.user.id, input);
    return interaction.reply({ embeds: [res.embed], ephemeral: !res.success });
  },

  async executePrefix(message, args) {
    if (!args[0]) {
      return message.reply({
        embeds: [errorEmbed('Usage', 'Please specify an amount to deposit: `-dep <amount | all>`')],
      });
    }

    const res = executeDeposit(message.author.id, args[0]);
    return message.reply({ embeds: [res.embed] });
  },
};
