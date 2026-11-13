'use strict';

const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { loc } = require('../../core/slash');
const ui = require('../../core/ui');
const args = require('../../core/args');
const mod = require('../../features/moderation');
const { parseDuration, formatDuration } = require('../../utils/duration');

const MAX = 28 * 24 * 60 * 60 * 1000;

const data = loc(new SlashCommandBuilder(), ['timeout', 'aislar'], ['Time someone out for a while', 'Aísla a alguien por un tiempo'])
  .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
  .addUserOption(opt => loc(opt, ['user', 'usuario'], ['Who', 'Quién']).setRequired(true))
  .addStringOption(opt => loc(opt, ['duration', 'duración'], ['e.g. 10m, 2h, 1d (max 28d)', 'p. ej. 10m, 2h, 1d (máx. 28d)']).setRequired(true).setMaxLength(12))
  .addStringOption(opt => loc(opt, ['reason', 'motivo'], ['Why', 'Por qué']).setMaxLength(400));

module.exports = {
  data,
  category: 'moderation',
  emoji: 'clock',

  prefix: {
    aliases: ['mute', 'silenciar', 'to'],
    async parse(message, rawArgs) {
      const { user, rest } = await args.userAndRest(message, rawArgs);
      const [duration, ...reason] = rest.split(/\s+/).filter(Boolean);
      return { options: { user, duration: duration ?? null, reason: reason.join(' ') || null } };
    },
  },

  async run(ctx) {
    const denied = mod.requirePermission(ctx, PermissionFlagsBits.ModerateMembers);
    if (denied) return ctx.reply(denied);
    const user = ctx.opt.user('user');
    if (!user) return ctx.reply(ui.message(ui.notice('info', ctx.t('common.usageTitle'), '`/aislar usuario: duración: motivo:` · `-mute @alguien 10m motivo`'), { ephemeral: true }));
    const ms = parseDuration(ctx.opt.string('duration') ?? '');
    if (!ms || ms > MAX) return ctx.reply(ui.message(ui.notice('warn', ctx.t('common.errorTitle'), mod.L(ctx.locale, 'badDuration')), { ephemeral: true }));
    const member = await ctx.guild.members.fetch(user.id).catch(() => null);
    const blocked = mod.checkTarget(ctx, user, member, 'moderatable');
    if (blocked) return ctx.reply(blocked);

    const reason = ctx.opt.string('reason');
    await member.timeout(ms, `${reason ?? '—'} (${ctx.user.tag})`.slice(0, 512));
    await mod.notifyMember(user, ctx.locale, { guild: ctx.guild, action: 'timeout', reason });
    return mod.respond(ctx, { action: 'timeout', target: user, moderator: ctx.user, reason, duration: formatDuration(ms) });
  },
};
