'use strict';

const { SlashCommandBuilder } = require('discord.js');
const { loc } = require('../../core/slash');
const fun = require('../../features/fun');

const data = loc(new SlashCommandBuilder(), ['roll', 'dado'], ['Roll dice (e.g. 2 dice of 20 sides)', 'Tira dados (p. ej. 2 dados de 20 caras)'])
  .addIntegerOption(opt => loc(opt, ['sides', 'caras'], ['Sides per die (default 6)', 'Caras por dado (6 si lo dejas vacío)']).setMinValue(2).setMaxValue(1000))
  .addIntegerOption(opt => loc(opt, ['count', 'cantidad'], ['How many dice (1–20)', 'Cuántos dados (1–20)']).setMinValue(1).setMaxValue(20));

module.exports = {
  data,
  category: 'fun',
  emoji: 'cards',
  dm: true,

  prefix: {
    aliases: ['dados', 'dice'],
    parse(message, rawArgs) {
      // Accepts "2d20", "d20" or "20".
      const match = (rawArgs[0] ?? '').toLowerCase().match(/^(\d*)d(\d+)$/) ?? (rawArgs[0] ?? '').match(/^()(\d+)$/);
      return { options: { count: match?.[1] ? Number(match[1]) : null, sides: match ? Number(match[2]) : null } };
    },
  },

  async run(ctx) {
    return ctx.reply(fun.rollMessage(ctx.locale, { sides: ctx.opt.integer('sides') ?? 6, count: ctx.opt.integer('count') ?? 1 }));
  },
};
