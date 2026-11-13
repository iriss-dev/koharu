'use strict';

const { SlashCommandBuilder } = require('discord.js');
const { loc } = require('../../core/slash');
const economy = require('../../features/economy');

const data = loc(new SlashCommandBuilder(), ['daily', 'diario'], ['Daily reward with streak bonuses', 'Recompensa diaria con bonus por racha']);

module.exports = {
  data,
  category: 'economy',
  emoji: 'gift',

  prefix: { aliases: ['diaria', 'dailyreward'] },

  async run(ctx) {
    return ctx.reply(economy.daily(ctx.locale, { guildId: ctx.guild.id, userId: ctx.user.id }).payload);
  },
};
