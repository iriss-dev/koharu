'use strict';

const { SlashCommandBuilder } = require('discord.js');
const { loc } = require('../../core/slash');
const marriage = require('../../features/marriage');

const data = loc(new SlashCommandBuilder(), ['divorce', 'divorcio'], ['End your marriage (asks for confirmation)', 'Termina tu matrimonio (pide confirmación)']);

module.exports = {
  data,
  category: 'social',
  emoji: 'moon',

  prefix: { aliases: ['divorciarse', 'divorciar'] },

  async run(ctx) {
    return ctx.reply(marriage.divorceAsk(ctx.locale, ctx.user.id));
  },
};
