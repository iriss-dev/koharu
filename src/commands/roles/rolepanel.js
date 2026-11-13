'use strict';

const { SlashCommandBuilder, PermissionFlagsBits, ChannelType } = require('discord.js');
const { loc } = require('../../core/slash');
const ui = require('../../core/ui');
const db = require('../../database/db');
const roles = require('../../features/roles');

const data = loc(new SlashCommandBuilder(), ['rolepanel', 'panelroles'], ['Custom role panel and its prices', 'Panel de roles personalizados y sus precios'])
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles)
  .addSubcommand(sub => loc(sub, ['setup', 'publicar'], ['Post the panel in a channel', 'Publica el panel en un canal'])
    .addChannelOption(opt => loc(opt, ['channel', 'canal'], ['Channel (default: this one)', 'Canal (por defecto, este)']).addChannelTypes(ChannelType.GuildText)))
  .addSubcommand(sub => loc(sub, ['config', 'ajustes'], ['Prices, booster perks and hierarchy', 'Precios, ventajas de boosters y jerarquía'])
    .addIntegerOption(opt => loc(opt, ['coins_cost', 'precio_monedas'], ['Price in coins (0 = not sold for coins)', 'Precio en monedas (0 = no se vende por monedas)']).setMinValue(0).setMaxValue(10_000_000))
    .addIntegerOption(opt => loc(opt, ['keys_cost', 'precio_llaves'], ['Price in event keys (0 = not sold for keys)', 'Precio en llaves (0 = no se vende por llaves)']).setMinValue(0).setMaxValue(100))
    .addBooleanOption(opt => loc(opt, ['booster_free', 'gratis_boosters'], ['Free for server boosters', 'Gratis para boosters']))
    .addBooleanOption(opt => loc(opt, ['booster_gradient', 'degradado_boosters'], ['Boosters can use two colours', 'Los boosters pueden usar dos colores']))
    .addRoleOption(opt => loc(opt, ['anchor_role', 'rol_ancla'], ['Custom roles go right below this role', 'Los roles se colocan justo debajo de este'])));

module.exports = {
  data,
  category: 'roles',
  emoji: 'palette',

  prefix: {
    aliases: ['rpanel', 'roles'],
    parse(message, rawArgs) {
      return { sub: ['config', 'ajustes'].includes(rawArgs[0]?.toLowerCase()) ? 'config' : 'setup', options: {} };
    },
  },

  async run(ctx) {
    const locale = ctx.locale;
    if (!ctx.member.permissions.has(PermissionFlagsBits.ManageRoles)) {
      return ctx.reply(ui.message(ui.notice('error', roles.L(locale, 'panelTitle'), ctx.t('common.missingPerm', { perm: 'Manage Roles' })), { ephemeral: true }));
    }
    const sub = ctx.sub ?? 'setup';
    const guildId = ctx.guild.id;

    if (sub === 'setup') {
      const channel = ctx.opt.channel('channel') ?? ctx.channel;
      const message = await channel.send(roles.panelMessage(locale, db.guildSettings(guildId)));
      db.updateGuildSettings(guildId, { role_panel_channel_id: channel.id, role_panel_message_id: message.id });
      return ctx.reply(ui.message(ui.notice('success', roles.L(locale, 'panelTitle'), roles.L(locale, 'panelPosted', { channel: channel.toString() })), { ephemeral: true }));
    }

    const changes = {};
    const coins = ctx.opt.integer('coins_cost');
    const keys = ctx.opt.integer('keys_cost');
    const boosterFree = ctx.opt.boolean('booster_free');
    const gradient = ctx.opt.boolean('booster_gradient');
    const anchor = ctx.opt.role('anchor_role');
    if (coins !== null) changes.role_cost_coins = coins;
    if (keys !== null) changes.role_cost_keys = keys;
    if (boosterFree !== null) changes.booster_free = boosterFree;
    if (gradient !== null) changes.booster_dual_color = gradient;
    if (anchor) changes.anchor_role_id = anchor.id;
    const s = db.updateGuildSettings(guildId, changes);

    return ctx.reply(ui.message(ui.card({
      accent: 'mint',
      emoji: 'palette',
      title: roles.L(locale, 'configSaved'),
      body: [
        roles.priceLines(locale, s),
        [
          ui.bullet('sparkle', roles.L(locale, 'dualColor'), s.booster_dual_color ? ctx.t('common.yes') : ctx.t('common.no')),
          ui.bullet('shield', roles.L(locale, 'anchor'), s.anchor_role_id ? `<@&${s.anchor_role_id}>` : roles.L(locale, 'anchorNone')),
        ].join('\n'),
      ],
    }), { ephemeral: true }));
  },
};
