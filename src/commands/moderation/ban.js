'use strict';

const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { loc } = require('../../core/slash');
const ui = require('../../core/ui');
const args = require('../../core/args');
const mod = require('../../features/moderation');

const data = loc(new SlashCommandBuilder(), ['ban', 'banear'], ['Ban someone from the server', 'Banea a alguien del servidor'])
  .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers)
  .addUserOption(opt => loc(opt, ['user', 'usuario'], ['Who', 'Quién']).setRequired(true))
  .addStringOption(opt => loc(opt, ['reason', 'motivo'], ['Why', 'Por qué']).setMaxLength(400))
  .addIntegerOption(opt => loc(opt, ['delete_days', 'borrar_días'], ['Days of messages to delete (0–7)', 'Días de mensajes a borrar (0–7)']).setMinValue(0).setMaxValue(7));

module.exports = {
  data,
  category: 'moderation',
  emoji: 'shield',

  prefix: {
    aliases: ['vetar'],
    async parse(message, rawArgs) {
      const { user, rest } = await args.userAndRest(message, rawArgs);
      return { options: { user, reason: rest || null } };
    },
  },

  async run(ctx) {
    const denied = mod.requirePermission(ctx, PermissionFlagsBits.BanMembers);
    if (denied) return ctx.reply(denied);
    const user = ctx.opt.user('user');
    if (!user) return ctx.reply(ui.message(ui.notice('info', ctx.t('common.usageTitle'), '`/banear usuario: motivo:` · `-ban @alguien motivo`'), { ephemeral: true }));
    const member = await ctx.guild.members.fetch(user.id).catch(() => null);
    const blocked = mod.checkTarget(ctx, user, member, 'bannable');
    if (blocked) return ctx.reply(blocked);

    const reason = ctx.opt.string('reason');
    if (member) await mod.notifyMember(user, ctx.locale, { guild: ctx.guild, action: 'ban', reason });
    await ctx.guild.members.ban(user.id, {
      reason: `${reason ?? '—'} (${ctx.user.tag})`.slice(0, 512),
      deleteMessageSeconds: (ctx.opt.integer('delete_days') ?? 0) * 86400,
    });
    return mod.respond(ctx, { action: 'ban', target: user, moderator: ctx.user, reason });
  },
};
