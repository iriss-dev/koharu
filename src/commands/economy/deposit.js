'use strict';

const { SlashCommandBuilder } = require('discord.js');
const { loc } = require('../../core/slash');
const economy = require('../../features/economy');

const data = loc(new SlashCommandBuilder(), ['deposit', 'depositar'], ['Move coins from your wallet to the bank', 'Pasa monedas del monedero al banco'])
  .addStringOption(opt => loc(opt, ['amount', 'cantidad'], ['A number, 1k, half or all', 'Un número, 1k, mitad o todo']).setRequired(true).setMaxLength(20));

module.exports = {
  data,
  category: 'economy',
  emoji: 'piggy',

  prefix: {
    aliases: ['dep', 'd'],
    parse(message, rawArgs) {
      return { options: { amount: rawArgs[0] ?? null } };
    },
  },

  async run(ctx) {
    return ctx.reply(economy.bankMove(ctx.locale, { guildId: ctx.guild.id, userId: ctx.user.id, input: ctx.opt.string('amount'), kind: 'deposit' }));
  },
};
