'use strict';

const { SlashCommandBuilder } = require('discord.js');
const { loc } = require('../../core/slash');
const economy = require('../../features/economy');

const data = loc(new SlashCommandBuilder(), ['withdraw', 'retirar'], ['Move coins from the bank to your wallet', 'Pasa monedas del banco al monedero'])
  .addStringOption(opt => loc(opt, ['amount', 'cantidad'], ['A number, 1k, half or all', 'Un número, 1k, mitad o todo']).setRequired(true).setMaxLength(20));

module.exports = {
  data,
  category: 'economy',
  emoji: 'coin',

  prefix: {
    aliases: ['with', 'sacar'],
    parse(message, rawArgs) {
      return { options: { amount: rawArgs[0] ?? null } };
    },
  },

  async run(ctx) {
    return ctx.reply(economy.bankMove(ctx.locale, { guildId: ctx.guild.id, userId: ctx.user.id, input: ctx.opt.string('amount'), kind: 'withdraw' }));
  },
};
