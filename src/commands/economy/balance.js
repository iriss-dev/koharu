'use strict';

const { SlashCommandBuilder } = require('discord.js');
const { loc } = require('../../core/slash');
const args = require('../../core/args');
const economy = require('../../features/economy');

const data = loc(new SlashCommandBuilder(), ['balance', 'saldo'], ['Coins, bank, event keys and rank', 'Monedas, banco, llaves de evento y puesto'])
  .addUserOption(opt => loc(opt, ['user', 'usuario'], ['Whose balance', 'De quién']));

module.exports = {
  data,
  category: 'economy',
  emoji: 'coin',

  prefix: {
    aliases: ['bal', 'money', 'dinero', 'b'],
    async parse(message, rawArgs) {
      return { options: { user: (await args.user(message, rawArgs[0])) ?? null } };
    },
  },

  async run(ctx) {
    const user = ctx.opt.user('user') ?? ctx.user;
    const member = await ctx.guild.members.fetch(user.id).catch(() => null);
    return ctx.reply(economy.balanceMessage(ctx.locale, { guild: ctx.guild, user, member }));
  },
};
