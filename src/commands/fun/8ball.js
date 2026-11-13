'use strict';

const { SlashCommandBuilder } = require('discord.js');
const { loc } = require('../../core/slash');
const ui = require('../../core/ui');
const fun = require('../../features/fun');

const data = loc(new SlashCommandBuilder(), ['8ball', 'bola8'], ['Ask the magic ball a yes/no question', 'Hazle una pregunta de sí o no a la bola mágica'])
  .addStringOption(opt => loc(opt, ['question', 'pregunta'], ['Your question', 'Tu pregunta']).setRequired(true).setMaxLength(200));

module.exports = {
  data,
  category: 'fun',
  emoji: 'moon',
  dm: true,

  prefix: {
    aliases: ['bola', 'pregunta', 'ball'],
    parse: (message, rawArgs) => ({ options: { question: rawArgs.join(' ') || null } }),
  },

  async run(ctx) {
    const question = ctx.opt.string('question');
    if (!question) return ctx.reply(ui.message(ui.notice('info', ctx.t('common.usageTitle'), '`/bola8 pregunta:` · `-8ball ¿hoy llueve?`'), { ephemeral: true }));
    return ctx.reply(fun.eightBall(ctx.locale, question));
  },
};
