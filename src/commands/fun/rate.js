'use strict';

const { SlashCommandBuilder } = require('discord.js');
const { loc } = require('../../core/slash');
const ui = require('../../core/ui');
const fun = require('../../features/fun');

const data = loc(new SlashCommandBuilder(), ['rate', 'puntuar'], ['Koharu rates anything from 0 to 10', 'Koharu puntúa lo que sea del 0 al 10'])
  .addStringOption(opt => loc(opt, ['thing', 'cosa'], ['What to rate', 'Qué puntuar']).setRequired(true).setMaxLength(120));

module.exports = {
  data,
  category: 'fun',
  emoji: 'star',
  dm: true,

  prefix: {
    aliases: ['calificar', 'nota'],
    parse: (message, rawArgs) => ({ options: { thing: rawArgs.join(' ') || null } }),
  },

  async run(ctx) {
    const thing = ctx.opt.string('thing');
    if (!thing) return ctx.reply(ui.message(ui.notice('info', ctx.t('common.usageTitle'), '`/puntuar cosa:` · `-rate el ramen`'), { ephemeral: true }));
    return ctx.reply(fun.rateMessage(ctx.locale, thing));
  },
};
