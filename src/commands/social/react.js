'use strict';

const { SlashCommandBuilder } = require('discord.js');
const { loc, choice } = require('../../core/slash');
const ui = require('../../core/ui');
const social = require('../../features/social');

const capitalize = text => text.charAt(0).toUpperCase() + text.slice(1);
const choices = Object.entries(social.REACTIONS).map(([key, def]) =>
  choice(key, capitalize(def.en.replace('{a} ', '').replace('… zzz', '')), capitalize(def.es.replace('{a} ', '').replace('… zzz', ''))));

const data = loc(new SlashCommandBuilder(), ['react', 'reaccionar'], ['Show how you feel with an anime GIF', 'Muestra cómo te sientes con un GIF de anime'])
  .addStringOption(opt => loc(opt, ['reaction', 'reacción'], ['How you feel', 'Cómo te sientes']).setRequired(true).addChoices(...choices));

module.exports = {
  data,
  category: 'social',
  emoji: 'sparkle',
  cooldown: 2,

  prefix: {
    aliases: ['reaction', 'reaccion'],
    presets: Object.fromEntries(Object.entries(social.presets(social.REACTIONS)).map(([alias, preset]) => [alias, { options: { reaction: preset.options.type } }])),
    parse(message, rawArgs, alias, preset) {
      if (preset) return preset;
      const key = rawArgs[0]?.toLowerCase();
      return { options: { reaction: social.REACTIONS[key] ? key : null } };
    },
  },

  async run(ctx) {
    const reaction = ctx.opt.string('reaction');
    if (!reaction || !social.REACTIONS[reaction]) {
      return ctx.reply(ui.message(ui.notice('info', ctx.t('common.usageTitle'), '`/reaccionar` · `-blush` · `-feliz` · `-bailar`'), { ephemeral: true }));
    }
    await ctx.defer();
    return ctx.reply(await social.reactionMessage({ locale: ctx.locale, reaction, actor: { id: ctx.user.id, name: ctx.displayName } }));
  },
};
