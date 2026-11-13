'use strict';

const { SlashCommandBuilder } = require('discord.js');
const { loc } = require('../../core/slash');
const economy = require('../../features/economy');

const data = loc(new SlashCommandBuilder(), ['leaderboard', 'ranking'], ['Richest people in this server', 'Las personas más ricas del servidor']);

module.exports = {
  data,
  category: 'economy',
  emoji: 'trophy',

  prefix: { aliases: ['lb', 'top', 'rich', 'ricos'] },

  async run(ctx) {
    return ctx.reply(await economy.leaderboardMessage(ctx.locale, ctx.guild, ctx.user.id, 0));
  },
};
