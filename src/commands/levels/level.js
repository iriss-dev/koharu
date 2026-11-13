'use strict';

const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { loc } = require('../../core/slash');
const ui = require('../../core/ui');
const args = require('../../core/args');
const db = require('../../database/db');
const levels = require('../../features/levels');
const { t } = require('../../core/i18n');

const data = loc(new SlashCommandBuilder(), ['level', 'nivel'], ['Levels: your XP, the ranking or set someone\'s level', 'Niveles: tu experiencia, el ranking o fijar el nivel de alguien'])
  .addSubcommand(sub => loc(sub, ['rank', 'ver'], ['Level, XP and rank of someone', 'Nivel, experiencia y puesto de alguien'])
    .addUserOption(opt => loc(opt, ['user', 'usuario'], ['Whose level', 'De quién'])))
  .addSubcommand(sub => loc(sub, ['top', 'top'], ['Most active members of the server', 'Miembros más activos del servidor']))
  .addSubcommand(sub => loc(sub, ['set', 'fijar'], ['Set someone\'s level (Manage Server)', 'Fija el nivel de alguien (Gestionar servidor)'])
    .addUserOption(opt => loc(opt, ['user', 'usuario'], ['Who', 'Quién']).setRequired(true))
    .addIntegerOption(opt => loc(opt, ['level', 'nivel'], ['New level', 'Nuevo nivel']).setRequired(true).setMinValue(0).setMaxValue(500)));

module.exports = {
  data,
  category: 'general',
  emoji: 'trophy',

  prefix: {
    aliases: ['lvl', 'rank', 'xp', 'toplevels', 'topniveles', 'levels', 'niveles'],
    async parse(message, rawArgs, alias) {
      const lowered = alias?.toLowerCase();
      if (['toplevels', 'topniveles', 'levels', 'niveles'].includes(lowered) || /^top$/i.test(rawArgs[0] ?? '')) return { sub: 'top' };
      return { sub: 'rank', options: { user: (await args.user(message, rawArgs[0])) ?? null } };
    },
  },

  async run(ctx) {
    const sub = ctx.sub ?? 'rank';
    if (sub === 'top') return ctx.reply(await levels.topMessage(ctx.locale, ctx.guild, ctx.user.id));
    if (sub === 'set') {
      if (!ctx.member?.permissions?.has(PermissionFlagsBits.ManageGuild)) {
        return ctx.reply(ui.message(ui.notice('error', ctx.t('common.errorTitle'), ctx.t('common.missingPerm', { perm: 'Manage Server' })), { ephemeral: true }));
      }
      const user = ctx.opt.user('user');
      const level = ctx.opt.integer('level') ?? 0;
      db.setXp(ctx.guild.id, user.id, levels.xpForLevel(level));
      const member = await ctx.guild.members.fetch(user.id).catch(() => null);
      return ctx.reply(levels.rankMessage(ctx.locale, { guild: ctx.guild, user, member }));
    }
    const user = ctx.opt.user('user') ?? ctx.user;
    if (user.bot) return ctx.reply(ui.message(ui.notice('info', t(ctx.locale, 'levels.topTitle'), t(ctx.locale, 'levels.howTo')), { ephemeral: true }));
    const member = await ctx.guild.members.fetch(user.id).catch(() => null);
    return ctx.reply(levels.rankMessage(ctx.locale, { guild: ctx.guild, user, member }));
  },
};
