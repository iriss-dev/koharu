'use strict';

const { SlashCommandBuilder } = require('discord.js');
const { loc } = require('../../core/slash');
const economy = require('../../features/economy');

const data = loc(new SlashCommandBuilder(), ['work', 'trabajar'], ['Work a cosy part-time job for coins', 'Haz un turno en un trabajito tierno para ganar monedas']);

module.exports = {
  data,
  category: 'economy',
  emoji: 'coffee',

  prefix: { aliases: ['w', 'job', 'chamba', 'trabajo'] },

  async run(ctx) {
    const result = economy.work(ctx.locale, { guildId: ctx.guild.id, userId: ctx.user.id, name: ctx.displayName });
    return ctx.reply(result.payload);
  },
};
