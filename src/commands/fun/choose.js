'use strict';

const { SlashCommandBuilder } = require('discord.js');
const { loc } = require('../../core/slash');
const fun = require('../../features/fun');

const data = loc(new SlashCommandBuilder(), ['choose', 'elegir'], ['Can\'t decide? Koharu picks for you', '¿No te decides? Koharu elige por ti'])
  .addStringOption(opt => loc(opt, ['options', 'opciones'], ['Options separated by commas', 'Opciones separadas por comas']).setRequired(true).setMaxLength(500));

module.exports = {
  data,
  category: 'fun',
  emoji: 'wand',
  dm: true,

  prefix: {
    aliases: ['escoger', 'pick'],
    parse: (message, rawArgs) => ({ options: { options: rawArgs.join(' ') || null } }),
  },

  async run(ctx) {
    return ctx.reply(fun.chooseMessage(ctx.locale, ctx.opt.string('options')));
  },
};
