'use strict';

const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { loc } = require('../../core/slash');
const ui = require('../../core/ui');
const args = require('../../core/args');
const db = require('../../database/db');
const { L } = require('../../features/economy');

const data = loc(new SlashCommandBuilder(), ['keys', 'llaves'], ['Event keys for custom roles and prizes', 'Llaves de evento para roles personalizados y premios'])
  .addSubcommand(sub => loc(sub, ['check', 'ver'], ['How many keys someone has', 'Cuántas llaves tiene alguien'])
    .addUserOption(opt => loc(opt, ['user', 'usuario'], ['Who', 'Quién'])))
  .addSubcommand(sub => loc(sub, ['grant', 'dar'], ['Give keys (admins)', 'Dar llaves (admins)'])
    .addUserOption(opt => loc(opt, ['user', 'usuario'], ['Who', 'Quién']).setRequired(true))
    .addIntegerOption(opt => loc(opt, ['amount', 'cantidad'], ['How many', 'Cuántas']).setRequired(true).setMinValue(1).setMaxValue(1000)))
  .addSubcommand(sub => loc(sub, ['revoke', 'quitar'], ['Take keys away (admins)', 'Quitar llaves (admins)'])
    .addUserOption(opt => loc(opt, ['user', 'usuario'], ['Who', 'Quién']).setRequired(true))
    .addIntegerOption(opt => loc(opt, ['amount', 'cantidad'], ['How many', 'Cuántas']).setRequired(true).setMinValue(1).setMaxValue(1000)));

module.exports = {
  data,
  category: 'economy',
  emoji: 'key',

  prefix: {
    aliases: ['key', 'eventkeys'],
    async parse(message, rawArgs) {
      const sub = { grant: 'grant', dar: 'grant', revoke: 'revoke', quitar: 'revoke', check: 'check', ver: 'check' }[rawArgs[0]?.toLowerCase()] ?? 'check';
      const rest = rawArgs[0] && ['grant', 'dar', 'revoke', 'quitar', 'check', 'ver'].includes(rawArgs[0].toLowerCase()) ? rawArgs.slice(1) : rawArgs;
      const { user } = await args.userAndRest(message, rest);
      const amount = rest.map(a => Number.parseInt(a, 10)).find(v => Number.isFinite(v) && v > 0) ?? null;
      return { sub, options: { user, amount } };
    },
  },

  async run(ctx) {
    const locale = ctx.locale;
    const sub = ctx.sub ?? 'check';
    const target = ctx.opt.user('user') ?? ctx.user;
    const title = L(locale, 'keysTitle');

    if (sub === 'check') {
      const total = db.member(ctx.guild.id, target.id).keys;
      return ctx.reply(ui.message(ui.notice('info', title, L(locale, 'keysCheck', { user: `<@${target.id}>`, total }))));
    }
    if (!ctx.member.permissions.has(PermissionFlagsBits.ManageGuild)) {
      return ctx.reply(ui.message(ui.notice('error', title, ctx.t('common.missingPerm', { perm: 'Manage Server' })), { ephemeral: true }));
    }
    const amount = ctx.opt.integer('amount');
    if (!amount || amount <= 0) return ctx.reply(ui.message(ui.notice('info', ctx.t('common.usageTitle'), '`/llaves dar usuario: cantidad:`'), { ephemeral: true }));
    if (sub === 'grant') {
      const row = db.addKeys(ctx.guild.id, target.id, amount);
      return ctx.reply(ui.message(ui.notice('success', title, L(locale, 'keysGranted', { n: amount, user: `<@${target.id}>`, total: row.keys }))));
    }
    const before = db.member(ctx.guild.id, target.id).keys;
    const row = db.addKeys(ctx.guild.id, target.id, -amount);
    return ctx.reply(ui.message(ui.notice('success', title, L(locale, 'keysRevoked', { n: before - row.keys, user: `<@${target.id}>`, total: row.keys }))));
  },
};
