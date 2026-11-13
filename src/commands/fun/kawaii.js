'use strict';

const { SlashCommandBuilder } = require('discord.js');
const { loc, choice } = require('../../core/slash');
const fun = require('../../features/fun');

const data = loc(new SlashCommandBuilder(), ['kawaii', 'kawaii'], ['A cute anime picture: neko, waifu, kitsune or husbando', 'Una imagen anime tierna: neko, waifu, kitsune o husbando'])
  .addStringOption(opt => loc(opt, ['type', 'tipo'], ['What kind of picture', 'Qué tipo de imagen'])
    .addChoices(choice('neko', 'Neko', 'Neko'), choice('waifu', 'Waifu', 'Waifu'), choice('kitsune', 'Kitsune', 'Kitsune'), choice('husbando', 'Husbando', 'Husbando')));

module.exports = {
  data,
  category: 'fun',
  emoji: 'sparkle',
  cooldown: 2,

  prefix: {
    aliases: ['neko', 'kitsune', 'cute', 'waifupic', 'husbandopic'],
    parse(message, rawArgs, alias) {
      const lowered = alias?.toLowerCase();
      const type = lowered === 'waifupic' ? 'waifu' : lowered === 'husbandopic' ? 'husbando' : fun.PICTURE_TYPES.includes(lowered) ? lowered : fun.PICTURE_TYPES.find(kind => kind === rawArgs[0]?.toLowerCase()) ?? 'neko';
      return { options: { type } };
    },
  },

  async run(ctx) {
    await ctx.defer();
    return ctx.reply(await fun.pictureMessage(ctx.locale, ctx.opt.string('type') ?? 'neko', ctx.user.id));
  },
};
