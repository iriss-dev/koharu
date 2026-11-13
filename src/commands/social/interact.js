'use strict';

const { SlashCommandBuilder } = require('discord.js');
const { loc, choice } = require('../../core/slash');
const ui = require('../../core/ui');
const args = require('../../core/args');
const social = require('../../features/social');

const LABELS = {
  hug: ['Hug', 'Abrazar'], pat: ['Headpat', 'Acariciar la cabeza'], cuddle: ['Cuddle', 'Acurrucarse'], kiss: ['Kiss', 'Besar'],
  peck: ['Little peck', 'Dar un besito'], handhold: ['Hold hands', 'Tomar la mano'], highfive: ['High five', 'Chocar los cinco'],
  wave: ['Wave', 'Saludar'], poke: ['Poke', 'Picar la mejilla'], tickle: ['Tickle', 'Hacer cosquillas'], feed: ['Feed', 'Dar de comer'],
  wink: ['Wink', 'Guiñar el ojo'], stare: ['Stare', 'Mirar fijamente'], handshake: ['Handshake', 'Estrechar la mano'],
  baka: ['Baka!', '¡Baka!'], bite: ['Nibble', 'Mordisquear'], slap: ['Slap', 'Cachetada'], kick: ['Little kick', 'Patadita'],
  yeet: ['Yeet', 'Lanzar por los aires'],
};

const choices = Object.keys(social.ACTIONS).map(key => choice(key, LABELS[key][0], LABELS[key][1]));

const data = loc(new SlashCommandBuilder(), ['interact', 'interactuar'], ['Hug, pat, high-five… someone, with an anime GIF', 'Abraza, acaricia, choca los cinco… a alguien, con un GIF de anime'])
  .addStringOption(opt => loc(opt, ['action', 'acción'], ['What to do', 'Qué hacer']).setRequired(true).addChoices(...choices))
  .addUserOption(opt => loc(opt, ['user', 'usuario'], ['Who', 'A quién']).setRequired(true));

module.exports = {
  data,
  category: 'social',
  emoji: 'hearts',
  cooldown: 2,

  prefix: {
    aliases: ['action', 'accion'],
    presets: social.presets(social.ACTIONS),
    async parse(message, rawArgs, alias, preset) {
      const type = preset?.options?.type ?? (social.ACTIONS[rawArgs[0]?.toLowerCase()] ? rawArgs.shift().toLowerCase() : null);
      const target = await args.user(message, rawArgs[0]) ?? message.mentions.users.first() ?? null;
      return { options: { action: type, user: target } };
    },
  },

  async run(ctx) {
    const action = ctx.opt.string('action');
    const target = ctx.opt.user('user');
    if (!action || !social.ACTIONS[action] || !target) {
      return ctx.reply(ui.message(ui.notice('info', ctx.t('common.usageTitle'), ctx.t('social.usage')), { ephemeral: true }));
    }
    await ctx.defer();
    const targetMember = ctx.guild ? await ctx.guild.members.fetch(target.id).catch(() => null) : null;
    const payload = await social.actionMessage({
      locale: ctx.locale,
      action,
      actor: { id: ctx.user.id, name: ctx.displayName },
      target: { id: target.id, name: targetMember?.displayName ?? target.globalName ?? target.username, bot: target.bot },
      guildId: ctx.guild?.id ?? null,
      botId: ctx.client.user.id,
    });
    return ctx.reply(payload);
  },
};
