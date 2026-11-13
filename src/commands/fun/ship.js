'use strict';

const { SlashCommandBuilder } = require('discord.js');
const { loc } = require('../../core/slash');
const ui = require('../../core/ui');
const args = require('../../core/args');
const fun = require('../../features/fun');

const data = loc(new SlashCommandBuilder(), ['ship', 'ship'], ['How compatible are two people? 💞', '¿Qué tan compatibles son dos personas? 💞'])
  .addUserOption(opt => loc(opt, ['user', 'usuario'], ['First person', 'Primera persona']).setRequired(true))
  .addUserOption(opt => loc(opt, ['other', 'otra'], ['Second person (you if empty)', 'Segunda persona (tú si lo dejas vacío)']));

module.exports = {
  data,
  category: 'fun',
  emoji: 'hearts',
  cooldown: 3,

  prefix: {
    aliases: ['amor', 'love', 'compatibilidad'],
    async parse(message, rawArgs) {
      const first = await args.user(message, rawArgs[0]);
      const second = await args.user(message, rawArgs[1]);
      return { options: { user: first, other: second } };
    },
  },

  async run(ctx) {
    const a = ctx.opt.user('user');
    if (!a) return ctx.reply(ui.message(ui.notice('info', ctx.t('common.usageTitle'), '`/ship usuario: otra:` · `-ship @alguien @otra`'), { ephemeral: true }));
    const b = ctx.opt.user('other') ?? ctx.user;
    await ctx.defer();
    const person = async user => {
      const member = await ctx.guild?.members.fetch(user.id).catch(() => null);
      return {
        id: user.id,
        name: member?.displayName ?? user.globalName ?? user.username,
        avatar: (member ?? user).displayAvatarURL?.({ size: 256, extension: 'png', forceStatic: true }) ?? null,
      };
    };
    return ctx.reply(await fun.shipMessage(ctx.locale, await person(b), await person(a)));
  },
};
