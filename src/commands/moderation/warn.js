'use strict';

const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { loc } = require('../../core/slash');
const ui = require('../../core/ui');
const args = require('../../core/args');
const db = require('../../database/db');
const mod = require('../../features/moderation');
const { cleanUserText, ts } = require('../../utils/text');

const data = loc(new SlashCommandBuilder(), ['warn', 'advertir'], ['Warnings: add, list or clear', 'Advertencias: añadir, ver o borrar'])
  .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
  .addSubcommand(sub => loc(sub, ['add', 'añadir'], ['Warn someone', 'Advierte a alguien'])
    .addUserOption(opt => loc(opt, ['user', 'usuario'], ['Who', 'Quién']).setRequired(true))
    .addStringOption(opt => loc(opt, ['reason', 'motivo'], ['Why', 'Por qué']).setRequired(true).setMaxLength(400)))
  .addSubcommand(sub => loc(sub, ['list', 'ver'], ['See someone\'s warnings', 'Mira las advertencias de alguien'])
    .addUserOption(opt => loc(opt, ['user', 'usuario'], ['Who', 'Quién']).setRequired(true)))
  .addSubcommand(sub => loc(sub, ['clear', 'borrar'], ['Clear someone\'s warnings', 'Borra las advertencias de alguien'])
    .addUserOption(opt => loc(opt, ['user', 'usuario'], ['Who', 'Quién']).setRequired(true)));

module.exports = {
  data,
  category: 'moderation',
  emoji: 'warn',

  prefix: {
    aliases: ['warning', 'warnings', 'avisos', 'clearwarns'],
    async parse(message, rawArgs, alias) {
      const { user, rest } = await args.userAndRest(message, rawArgs);
      const lowered = alias?.toLowerCase();
      if (['warnings', 'avisos'].includes(lowered)) return { sub: 'list', options: { user: user ?? message.author } };
      if (lowered === 'clearwarns') return { sub: 'clear', options: { user } };
      return { sub: 'add', options: { user, reason: rest || null } };
    },
  },

  async run(ctx) {
    const denied = mod.requirePermission(ctx, PermissionFlagsBits.ModerateMembers);
    if (denied) return ctx.reply(denied);
    const locale = ctx.locale;
    const sub = ctx.sub ?? 'add';
    const user = ctx.opt.user('user');
    if (!user) return ctx.reply(ui.message(ui.notice('info', ctx.t('common.usageTitle'), '`/advertir añadir usuario: motivo:` · `-warn @alguien motivo`'), { ephemeral: true }));

    if (sub === 'list') {
      const warns = db.warnings(user.id, ctx.guild.id);
      const body = warns.length
        ? warns.slice(0, 15).map((w, i) => `\`#${warns.length - i}\` ${cleanUserText(w.reason, 160)}\n-# <@${w.moderator_id}> · ${ts(w.created_at, 'R')}`).join('\n')
        : mod.L(locale, 'warnEmpty');
      return ctx.reply(ui.message(ui.card({ accent: 'gold', emoji: 'warn', title: mod.L(locale, 'warnList', { user: user.username }), thumbnail: user.displayAvatarURL({ size: 128 }), intro: body })));
    }
    if (sub === 'clear') {
      const n = db.clearWarnings(user.id, ctx.guild.id);
      return ctx.reply(ui.message(ui.notice('success', mod.L(locale, 'actions.warn'), mod.L(locale, 'warnCleared', { n, user: `<@${user.id}>` }))));
    }

    const reason = ctx.opt.string('reason');
    if (!reason) return ctx.reply(ui.message(ui.notice('info', ctx.t('common.usageTitle'), '`-warn @alguien motivo`'), { ephemeral: true }));
    if (user.id === ctx.user.id) return ctx.reply(ui.message(ui.notice('warn', ctx.t('common.errorTitle'), mod.L(locale, 'self')), { ephemeral: true }));
    db.addWarning(user.id, ctx.guild.id, ctx.user.id, reason);
    const total = db.warnings(user.id, ctx.guild.id).length;
    await mod.notifyMember(user, locale, { guild: ctx.guild, action: 'warn', reason });
    return mod.respond(ctx, { action: 'warn', target: user, moderator: ctx.user, reason, total });
  },
};
