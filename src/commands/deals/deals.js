'use strict';

const { SlashCommandBuilder, PermissionFlagsBits, ChannelType } = require('discord.js');
const { loc, choice } = require('../../core/slash');
const ui = require('../../core/ui');
const db = require('../../database/db');
const config = require('../../config');
const cheapshark = require('../../services/cheapshark');
const gamerpower = require('../../services/gamerpower');
const deals = require('../../features/deals');
const { truncate, fold } = require('../../utils/text');

const PLATFORM_LABELS = {
  pc: 'PC', steam: 'Steam', 'epic-games-store': 'Epic Games Store', gog: 'GOG', itchio: 'itch.io', ubisoft: 'Ubisoft',
  battlenet: 'Battle.net', origin: 'EA / Origin', ps4: 'PlayStation 4', ps5: 'PlayStation 5', 'xbox-one': 'Xbox One',
  'xbox-series-xs': 'Xbox Series X|S', switch: 'Nintendo Switch', android: 'Android', ios: 'iOS', vr: 'VR',
};

const data = loc(new SlashCommandBuilder(), ['deals', 'ofertas'], ['Game deals, free games and price alerts', 'Ofertas de juegos, juegos gratis y alertas de precio'])
  .addSubcommand(sub => loc(sub, ['games', 'juegos'], ['Best PC game deals across 30+ stores', 'Las mejores ofertas de juegos de PC en más de 30 tiendas'])
    .addStringOption(opt => loc(opt, ['title', 'título'], ['Search a game (optional)', 'Busca un juego (opcional)']).setMaxLength(80))
    .addNumberOption(opt => loc(opt, ['max_price', 'precio_máximo'], ['Maximum price in USD', 'Precio máximo en USD']).setMinValue(0).setMaxValue(200))
    .addStringOption(opt => loc(opt, ['store', 'tienda'], ['Only this store', 'Solo esta tienda']).setAutocomplete(true)))
  .addSubcommand(sub => loc(sub, ['free', 'gratis'], ['Games and loot being given away right now', 'Juegos y contenido que regalan ahora mismo'])
    .addStringOption(opt => loc(opt, ['platform', 'plataforma'], ['Platform', 'Plataforma'])
      .addChoices(...Object.entries(PLATFORM_LABELS).map(([value, label]) => choice(value, label, label))))
    .addStringOption(opt => loc(opt, ['type', 'tipo'], ['What kind of giveaway', 'Qué tipo de regalo'])
      .addChoices(choice('game', 'Full games', 'Juegos completos'), choice('loot', 'In-game loot / DLC', 'Contenido / DLC'), choice('beta', 'Betas & early access', 'Betas y acceso anticipado'))))
  .addSubcommand(sub => loc(sub, ['alert', 'alerta'], ['DM me when a game drops to a price', 'Avísame por privado cuando un juego baje de precio'])
    .addStringOption(opt => loc(opt, ['game', 'juego'], ['Game', 'Juego']).setRequired(true).setAutocomplete(true).setMaxLength(100))
    .addNumberOption(opt => loc(opt, ['price', 'precio'], ['Target price in USD', 'Precio objetivo en USD']).setRequired(true).setMinValue(0).setMaxValue(200)))
  .addSubcommand(sub => loc(sub, ['alerts', 'alertas'], ['See and remove your price alerts', 'Mira y borra tus alertas de precio']))
  .addSubcommand(sub => loc(sub, ['channel', 'canal'], ['Post every new free game in a channel (admins)', 'Publica cada juego gratis nuevo en un canal (admins)'])
    .addChannelOption(opt => loc(opt, ['channel', 'canal'], ['Channel (leave empty to turn off)', 'Canal (vacío para desactivar)']).addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement)));

module.exports = {
  data,
  category: 'deals',
  emoji: 'tag',
  cooldown: 3,

  prefix: {
    aliases: ['ofertas', 'deal', 'oferta', 'gratis', 'free'],
    parse(message, args, alias) {
      const lowered = alias?.toLowerCase();
      if (lowered === 'gratis' || lowered === 'free') return { sub: 'free', options: {} };
      const first = fold(args[0] ?? '');
      if (['gratis', 'free'].includes(first)) return { sub: 'free', options: {} };
      if (['alertas', 'alerts'].includes(first)) return { sub: 'alerts', options: {} };
      const rest = (['juegos', 'games'].includes(first) ? args.slice(1) : args).join(' ').trim();
      return { sub: 'games', options: { title: rest || null } };
    },
  },

  async autocomplete(interaction) {
    const focused = interaction.options.getFocused(true);
    if (focused.name === 'store') {
      const stores = await cheapshark.stores();
      const query = fold(focused.value);
      return [...stores.values()].filter(store => !query || fold(store.name).includes(query)).slice(0, 25)
        .map(store => ({ name: store.name, value: store.id }));
    }
    if (focused.name === 'game') {
      const query = String(focused.value ?? '').trim();
      if (query.length < 2) return [];
      const games = await cheapshark.searchGames(query, { limit: 10 });
      return games.map(game => ({ name: truncate(`${game.title}${game.cheapest !== null ? ` · $${game.cheapest}` : ''}`, 100), value: `id:${game.gameId}` }));
    }
    return [];
  },

  async run(ctx) {
    const sub = ctx.sub ?? 'games';
    const locale = ctx.locale;

    if (sub === 'games') {
      await ctx.defer();
      const title = ctx.opt.string('title');
      const [items, stores] = await Promise.all([
        cheapshark.deals({ title: title ?? undefined, upperPrice: ctx.opt.number('max_price') ?? undefined, storeId: ctx.opt.string('store') ?? undefined }),
        cheapshark.stores(),
      ]);
      if (!items.length) return ctx.reply(ui.message(ui.notice('info', ctx.t('deals.gamesTitle'), ctx.t('deals.noDeals'))));
      const session = deals.newSession(ctx.user.id, { items, query: title, stores: Object.fromEntries(stores) });
      return ctx.reply(ui.message(deals.dealsCard(locale, session, 0)));
    }

    if (sub === 'free') {
      await ctx.defer();
      const type = ctx.opt.string('type') ?? 'game';
      const items = await gamerpower.giveaways({ platform: ctx.opt.string('platform') ?? 'all', type, sort: 'popularity' });
      if (!items.length) return ctx.reply(ui.message(ui.notice('info', ctx.t('deals.freeTitle'), ctx.t('deals.noFree'))));
      const session = deals.newSession(ctx.user.id, { items, typeLabel: ctx.t(`deals.types.${type}`) });
      return ctx.reply(ui.message(deals.freeCard(locale, session, 0)));
    }

    if (sub === 'alert') {
      const raw = ctx.opt.string('game');
      const target = ctx.opt.number('price');
      if (db.alertCount(ctx.user.id) >= config.deals.maxAlertsPerUser) {
        return ctx.reply(ui.message(ui.notice('warn', ctx.t('deals.alertsTitle'), ctx.t('deals.alertLimit', { n: config.deals.maxAlertsPerUser })), { ephemeral: true }));
      }
      await ctx.defer({ ephemeral: true });
      let gameId = /^id:\d+$/.test(raw ?? '') ? raw.slice(3) : null;
      if (!gameId && raw) gameId = (await cheapshark.searchGames(raw, { limit: 1 }))[0]?.gameId ?? null;
      const game = gameId ? await cheapshark.game(gameId) : null;
      if (!game) return ctx.reply(ui.message(ui.notice('info', ctx.t('deals.alertsTitle'), ctx.t('deals.alertNoGame'))));

      const now = game.deals[0]?.price;
      if (now !== undefined && now <= target) {
        return ctx.reply(ui.message(ui.notice('success', game.title, ctx.t('deals.alertAlready', { now: deals.money(locale, now) }))));
      }
      db.addAlert({ userId: ctx.user.id, guildId: ctx.guild?.id ?? null, channelId: ctx.channel?.id ?? null, gameId: game.gameId, title: game.title, targetPrice: target, locale });
      return ctx.reply(ui.message(ui.notice('success', ctx.t('deals.alertsTitle'), ctx.t('deals.alertAdded', { title: game.title, price: deals.money(locale, target), now: now !== undefined ? deals.money(locale, now) : '—' }))));
    }

    if (sub === 'alerts') {
      return ctx.reply(ui.message(deals.alertsCard(locale, ctx.user.id, db.alerts(ctx.user.id)), { ephemeral: true }));
    }

    if (sub === 'channel') {
      if (!ctx.member?.permissions?.has(PermissionFlagsBits.ManageGuild)) {
        return ctx.reply(ui.message(ui.notice('error', ctx.t('deals.freeTitle'), ctx.t('common.missingPerm', { perm: 'Manage Server' })), { ephemeral: true }));
      }
      const channel = ctx.opt.channel('channel');
      if (!channel) {
        db.updateGuildSettings(ctx.guild.id, { free_games_channel_id: null });
        return ctx.reply(ui.message(ui.notice('success', ctx.t('deals.freeTitle'), ctx.t('deals.channelOff')), { ephemeral: true }));
      }
      const perms = channel.permissionsFor?.(ctx.guild.members.me);
      if (!perms?.has([PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages])) {
        return ctx.reply(ui.message(ui.notice('error', ctx.t('deals.freeTitle'), ctx.t('deals.channelPerm', { channel: channel.toString() })), { ephemeral: true }));
      }
      await ctx.defer({ ephemeral: true });
      db.updateGuildSettings(ctx.guild.id, { free_games_channel_id: channel.id });
      const items = await gamerpower.giveaways({ type: 'game', sort: 'date' }).catch(() => []);
      // Everything currently active counts as seen; the three newest are posted as a welcome.
      db.markGiveawaysPosted(ctx.guild.id, items.slice(3).map(item => item.id));
      await deals.postFreeGames(ctx.client, { guildId: ctx.guild.id, channelId: channel.id, locale, items: items.slice(0, 3), limit: 3 });
      return ctx.reply(ui.message(ui.notice('success', ctx.t('deals.freeTitle'), ctx.t('deals.channelSet', { channel: channel.toString() }))));
    }
    return null;
  },
};
