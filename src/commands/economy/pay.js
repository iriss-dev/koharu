'use strict';

const { SlashCommandBuilder } = require('discord.js');
const { loc } = require('../../core/slash');
const ui = require('../../core/ui');
const args = require('../../core/args');
const db = require('../../database/db');
const { formatNumber, escapeMarkdown } = require('../../utils/text');
const { L } = require('../../features/economy');

const data = loc(new SlashCommandBuilder(), ['pay', 'pagar'], ['Send coins from your wallet to someone', 'Envía monedas de tu monedero a alguien'])
  .addUserOption(opt => loc(opt, ['user', 'usuario'], ['Who receives them', 'Quién las recibe']).setRequired(true))
  .addStringOption(opt => loc(opt, ['amount', 'cantidad'], ['A number, 1k, half or all', 'Un número, 1k, mitad o todo']).setRequired(true).setMaxLength(20));

module.exports = {
  data,
  category: 'economy',
  emoji: 'hearts',

  prefix: {
    aliases: ['give', 'dar', 'transferir'],
    async parse(message, rawArgs) {
      const { user, rest } = await args.userAndRest(message, rawArgs);
      return { options: { user, amount: rest.trim() || null } };
    },
  },

  async run(ctx) {
    const locale = ctx.locale;
    const target = ctx.opt.user('user');
    const title = L(locale, 'payTitle');
    if (!target) return ctx.reply(ui.message(ui.notice('info', ctx.t('common.usageTitle'), '`/pagar usuario: cantidad:` · `-pagar @alguien 500`'), { ephemeral: true }));
    if (target.id === ctx.user.id) return ctx.reply(ui.message(ui.notice('warn', title, L(locale, 'paySelf')), { ephemeral: true }));
    if (target.bot) return ctx.reply(ui.message(ui.notice('warn', title, L(locale, 'payBot')), { ephemeral: true }));

    const wallet = db.member(ctx.guild.id, ctx.user.id).coins;
    const parsed = args.amount(String(ctx.opt.string('amount') ?? ''));
    const amount = parsed === null ? null : args.resolveAmount(parsed, wallet);
    if (!amount || amount <= 0) return ctx.reply(ui.message(ui.notice('warn', title, L(locale, 'invalidAmount')), { ephemeral: true }));
    if (!db.transfer(ctx.guild.id, ctx.user.id, target.id, amount)) {
      return ctx.reply(ui.message(ui.notice('warn', title, L(locale, 'notEnoughWallet', { amount: formatNumber(locale, wallet) })), { ephemeral: true }));
    }
    const member = await ctx.guild.members.fetch(target.id).catch(() => null);
    return ctx.reply(ui.message(ui.notice('success', title, L(locale, 'paid', { amount: formatNumber(locale, amount), name: escapeMarkdown(member?.displayName ?? target.username) }))));
  },
};
