'use strict';

const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { loc } = require('../../core/slash');
const ui = require('../../core/ui');
const args = require('../../core/args');
const mod = require('../../features/moderation');

const data = loc(new SlashCommandBuilder(), ['untimeout', 'desaislar'], ['Lift a timeout', 'Retira un aislamiento'])
  .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
  .addUserOption(opt => loc(opt, ['user', 'usuario'], ['Who', 'Quién']).setRequired(true))
  .addStringOption(opt => loc(opt, ['reason', 'motivo'], ['Why', 'Por qué']).setMaxLength(400));

module.exports = {
  data,
  category: 'moderation',
  emoji: 'check',

  prefix: {
    aliases: ['unmute', 'desilenciar'],
    async parse(message, rawArgs) {
      const { user, rest } = await args.userAndRest(message, rawArgs);
      return { options: { user, reason: rest || null } };
    },
  },

  async run(ctx) {
    const denied = mod.requirePermission(ctx, PermissionFlagsBits.ModerateMembers);
    if (denied) return ctx.reply(denied);
    const user = ctx.opt.user('user');
    if (!user) return ctx.reply(ui.message(ui.notice('info', ctx.t('common.usageTitle'), '`/desaislar usuario:` · `-unmute @alguien`'), { ephemeral: true }));
    const member = await ctx.guild.members.fetch(user.id).catch(() => null);
    const blocked = mod.checkTarget(ctx, user, member, 'moderatable');
    if (blocked) return ctx.reply(blocked);
    const reason = ctx.opt.string('reason');
    await member.timeout(null, `${reason ?? '—'} (${ctx.user.tag})`.slice(0, 512));
    return mod.respond(ctx, { action: 'untimeout', target: user, moderator: ctx.user, reason });
  },
};
