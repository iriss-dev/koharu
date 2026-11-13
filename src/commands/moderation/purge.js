'use strict';

const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { loc } = require('../../core/slash');
const ui = require('../../core/ui');
const args = require('../../core/args');
const mod = require('../../features/moderation');

const data = loc(new SlashCommandBuilder(), ['purge', 'limpiar'], ['Bulk delete recent messages', 'Borra mensajes recientes en bloque'])
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages)
  .addIntegerOption(opt => loc(opt, ['amount', 'cantidad'], ['How many (1–100)', 'Cuántos (1–100)']).setRequired(true).setMinValue(1).setMaxValue(100))
  .addUserOption(opt => loc(opt, ['user', 'usuario'], ['Only messages from this person', 'Solo mensajes de esta persona']));

module.exports = {
  data,
  category: 'moderation',
  emoji: 'sparkle',

  prefix: {
    aliases: ['clear', 'borrar'],
    async parse(message, rawArgs) {
      const { user, rest } = await args.userAndRest(message, rawArgs);
      const amount = Number.parseInt(rest, 10);
      return { options: { amount: Number.isFinite(amount) ? Math.min(Math.max(amount, 1), 100) : null, user } };
    },
  },

  async run(ctx) {
    const denied = mod.requirePermission(ctx, PermissionFlagsBits.ManageMessages);
    if (denied) return ctx.reply(denied);
    const amount = ctx.opt.integer('amount');
    if (!amount) return ctx.reply(ui.message(ui.notice('info', ctx.t('common.usageTitle'), '`/limpiar cantidad: usuario:` · `-clear 20`'), { ephemeral: true }));
    const user = ctx.opt.user('user');

    if (!ctx.isInteraction) await ctx.message.delete().catch(() => null);
    else await ctx.defer({ ephemeral: true });

    const fetched = await ctx.channel.messages.fetch({ limit: 100 });
    const cutoff = Date.now() - 14 * 24 * 60 * 60 * 1000 + 60_000;
    const candidates = [...fetched.values()].filter(m => (!user || m.author.id === user.id) && m.createdTimestamp > cutoff).slice(0, amount);
    const deleted = candidates.length ? await ctx.channel.bulkDelete(candidates, true) : new Map();

    const text = mod.L(ctx.locale, 'purged', { n: deleted.size, from: user ? mod.L(ctx.locale, 'purgedFrom', { user: `<@${user.id}>` }) : '' })
      + (deleted.size < amount ? `\n-# ${mod.L(ctx.locale, 'purgeOld')}` : '');
    const payload = ui.message(ui.notice('success', mod.L(ctx.locale, 'actions.purge'), text), { ephemeral: true });
    if (ctx.isInteraction) return ctx.reply(payload);
    const note = await ctx.channel.send(payload).catch(() => null);
    setTimeout(() => note?.delete().catch(() => null), 4000).unref?.();
    return note;
  },
};
