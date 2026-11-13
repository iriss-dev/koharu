'use strict';

const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { loc } = require('../../core/slash');
const ui = require('../../core/ui');
const mod = require('../../features/moderation');

const data = loc(new SlashCommandBuilder(), ['slowmode', 'modolento'], ['Seconds between messages in this channel', 'Segundos entre mensajes en este canal'])
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels)
  .addIntegerOption(opt => loc(opt, ['seconds', 'segundos'], ['0 turns it off, up to 21600', '0 lo desactiva, hasta 21600']).setRequired(true).setMinValue(0).setMaxValue(21600));

module.exports = {
  data,
  category: 'moderation',
  emoji: 'clock',

  prefix: {
    aliases: ['lento', 'sm'],
    parse(message, rawArgs) {
      const seconds = Number.parseInt(rawArgs[0] ?? '', 10);
      return { options: { seconds: Number.isFinite(seconds) ? Math.min(Math.max(seconds, 0), 21600) : null } };
    },
  },

  async run(ctx) {
    const denied = mod.requirePermission(ctx, PermissionFlagsBits.ManageChannels);
    if (denied) return ctx.reply(denied);
    const seconds = ctx.opt.integer('seconds');
    if (seconds === null) return ctx.reply(ui.message(ui.notice('info', ctx.t('common.usageTitle'), '`/modolento segundos:` · `-lento 10`'), { ephemeral: true }));
    await ctx.channel.setRateLimitPerUser(seconds, `Koharu slowmode (${ctx.user.tag})`);
    const text = seconds ? mod.L(ctx.locale, 'slowmodeSet', { channel: ctx.channel.toString(), seconds }) : mod.L(ctx.locale, 'slowmodeOff', { channel: ctx.channel.toString() });
    return ctx.reply(ui.message(ui.notice('success', mod.L(ctx.locale, 'actions.slowmode'), text)));
  },
};
