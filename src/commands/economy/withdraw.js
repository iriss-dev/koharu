const { SlashCommandBuilder } = require('discord.js');
const db = require('../../database/db');
const { successEmbed, errorEmbed } = require('../../utils/embeds');

function executeWithdraw(userId, input) {
  const user = db.getUser(userId);

  if (user.bank <= 0) {
    return {
      success: false,
      embed: errorEmbed('Empty Bank', 'You don\'t have any coins deposited in your bank!'),
    };
  }

  let amount = 0;
  if (typeof input === 'string' && (input.toLowerCase() === 'all' || input.toLowerCase() === 'max')) {
    amount = user.bank;
  } else {
    amount = parseInt(input, 10);
  }

  if (isNaN(amount) || amount <= 0) {
    return {
      success: false,
      embed: errorEmbed('Invalid Amount', 'Please specify a valid positive number or `all` to withdraw.'),
    };
  }

  if (amount > user.bank) {
    return {
      success: false,
      embed: errorEmbed('Insufficient Funds', `You only have **${user.bank.toLocaleString()} coins** in your bank account!`),
    };
  }

  db.withdraw(userId, amount);
  const updated = db.getUser(userId);

  return {
    success: true,
    embed: successEmbed(
      'Bank Withdrawal',
      `Withdrew **${amount.toLocaleString()} coins** from your bank account 🪙.\n` +
      `New Wallet Balance: **${updated.coins.toLocaleString()} coins**.`
    ),
  };
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('withdraw')
    .setDescription('Withdraw coins from your bank into your wallet')
    .addStringOption(opt =>
      opt.setName('amount')
        .setDescription('Amount of coins to withdraw, or "all"')
        .setRequired(true)
    ),

  aliases: ['with', 'wdraw'],

  async executeSlash(interaction) {
    const input = interaction.options.getString('amount');
    const res = executeWithdraw(interaction.user.id, input);
    return interaction.reply({ embeds: [res.embed], ephemeral: !res.success });
  },

  async executePrefix(message, args) {
    if (!args[0]) {
      return message.reply({
        embeds: [errorEmbed('Usage', 'Please specify an amount to withdraw: `-with <amount | all>`')],
      });
    }

    const res = executeWithdraw(message.author.id, args[0]);
    return message.reply({ embeds: [res.embed] });
  },
};
