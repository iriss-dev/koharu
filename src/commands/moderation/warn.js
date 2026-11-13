'use strict';

const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { loc } = require('../../core/slash');
const ui = require('../../core/ui');
const args = require('../../core/args');
const db = require('../../database/db');
const mod = require('../../features/moderation');
const kawaii = require('../../services/kawaii');
const { cleanUserText, ts } = require('../../utils/text');

const data = loc(new SlashCommandBuilder(), ['warn', 'advertir'], ['Warnings: add, list, remove or clear', 'Advertencias: añadir, ver, quitar o borrar'])
  .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
  .addSubcommand(sub => loc(sub, ['add', 'añadir'], ['Warn someone', 'Advierte a alguien'])
    .addUserOption(opt => loc(opt, ['user', 'usuario'], ['Who', 'Quién']).setRequired(true))
    .addStringOption(opt => loc(opt, ['reason', 'motivo'], ['Why', 'Por qué']).setRequired(true).setMaxLength(400)))
  .addSubcommand(sub => loc(sub, ['list', 'ver'], ['See someone\'s warnings', 'Mira las advertencias de alguien'])
    .addUserOption(opt => loc(opt, ['user', 'usuario'], ['Who', 'Quién']).setRequired(true)))
  .addSubcommand(sub => loc(sub, ['remove', 'quitar'], ['Remove one warning by its number', 'Quita una advertencia por su número'])
    .addUserOption(opt => loc(opt, ['user', 'usuario'], ['Who', 'Quién']).setRequired(true))
    .addIntegerOption(opt => loc(opt, ['number', 'número'], ['Number shown in the list (#1 is the oldest)', 'Número de la lista (#1 es la más antigua)']).setRequired(true).setMinValue(1)))
  .addSubcommand(sub => loc(sub, ['clear', 'borrar'], ['Clear someone\'s warnings', 'Borra las advertencias de alguien'])
    .addUserOption(opt => loc(opt, ['user', 'usuario'], ['Who', 'Quién']).setRequired(true)));

module.exports = {
  data,
  category: 'moderation',
  emoji: 'warn',

  prefix: {
    aliases: ['warning', 'warnings', 'avisos', 'clearwarns', 'unwarn', 'delwarn'],
    async parse(message, rawArgs, alias) {
      const { user, rest } = await args.userAndRest(message, rawArgs);
      const lowered = alias?.toLowerCase();
      if (['warnings', 'avisos'].includes(lowered)) return { sub: 'list', options: { user: user ?? message.author } };
      if (lowered === 'clearwarns') return { sub: 'clear', options: { user } };
      if (['unwarn', 'delwarn'].includes(lowered)) return { sub: 'remove', options: { user, number: Number.parseInt(rest, 10) || null } };
      return { sub: 'add', options: { user, reason: rest || null } };
    },
  },

  async run(ctx) {
    const denied = mod.requirePermission(ctx, PermissionFlagsBits.ModerateMembers);
    if (denied) return ctx.reply(denied);
    const locale = ctx.locale;
    const sub = ctx.sub ?? 'add';
    const user = ctx.opt.user('user');
    if (!user) return ctx.reply(ui.message(ui.notice('info', ctx.t('common.usageTitle'), '`/advertir añadir usuario: motivo:` · `-warn @alguien motivo` · `-unwarn @alguien 2`'), { ephemeral: true }));

    if (sub === 'list') {
      const warns = db.warnings(user.id, ctx.guild.id);
      const body = warns.length
        ? warns.slice(0, 15).map((w, i) => `\`#${warns.length - i}\` ${cleanUserText(w.reason, 160)}\n-# <@${w.moderator_id}> · ${ts(w.created_at, 'R')}`).join('\n')
        : mod.L(locale, 'warnEmpty');
      const gif = await kawaii.mood(warns.length ? 'warn' : 'yes').catch(() => null);
      return ctx.reply(ui.message(ui.card({
        accent: warns.length ? 'gold' : 'mint',
        emoji: 'warn',
        title: mod.L(locale, 'warnList', { user: user.username }),
        subtitle: `${mod.L(locale, 'total')}: ${warns.length}`,
        thumbnail: gif?.url ?? user.displayAvatarURL({ size: 128 }),
        intro: body,
      })));
    }
    if (sub === 'clear') {
      const n = db.clearWarnings(user.id, ctx.guild.id);
      return ctx.reply(ui.message(ui.notice('success', mod.L(locale, 'actions.warn'), mod.L(locale, 'warnCleared', { n, user: `<@${user.id}>` }))));
    }
    if (sub === 'remove') {
      const n = ctx.opt.integer('number');
      if (!n) return ctx.reply(ui.message(ui.notice('info', ctx.t('common.usageTitle'), '`/advertir quitar usuario: número:` · `-unwarn @alguien 2`'), { ephemeral: true }));
      const ok = db.removeWarning(user.id, ctx.guild.id, n);
      return ctx.reply(ui.message(ok
        ? ui.notice('success', mod.L(locale, 'actions.warn'), mod.L(locale, 'warnRemoved', { n, user: `<@${user.id}>` }))
        : ui.notice('warn', mod.L(locale, 'actions.warn'), mod.L(locale, 'warnNotFound', { n, user: `<@${user.id}>` })), { ephemeral: !ok }));
    }

    const reason = ctx.opt.string('reason');
    if (!reason) return ctx.reply(ui.message(ui.notice('info', ctx.t('common.usageTitle'), '`-warn @alguien motivo`'), { ephemeral: true }));
    if (user.id === ctx.user.id) return ctx.reply(ui.message(ui.notice('warn', ctx.t('common.errorTitle'), mod.L(locale, 'self')), { ephemeral: true }));
    if (ctx.isInteraction) await ctx.defer();
    db.addWarning(user.id, ctx.guild.id, ctx.user.id, reason);
    const total = db.warnings(user.id, ctx.guild.id).length;
    await mod.notifyMember(user, locale, { guild: ctx.guild, action: 'warn', reason });
    return mod.respond(ctx, { action: 'warn', target: user, moderator: ctx.user, reason, total, caseId: String(total) });
  },
};
