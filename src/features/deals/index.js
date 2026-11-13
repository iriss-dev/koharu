'use strict';

/**
 * Game deals (CheapShark), free games (GamerPower), price alerts and the
 * automatic free-games channel.
 */

const ui = require('../../core/ui');
const emojis = require('../../core/emojis');
const router = require('../../core/router');
const { register, t } = require('../../core/i18n');
const db = require('../../database/db');
const cheapshark = require('../../services/cheapshark');
const gamerpower = require('../../services/gamerpower');
const { truncate, formatMoney, ts } = require('../../utils/text');

register('deals', {
  es: {
    gamesTitle: 'Ofertas de juegos',
    gamesSearchTitle: 'Ofertas: {query}',
    gamesSubtitle: 'Las mejores rebajas ahora mismo en más de 30 tiendas de PC',
    gamesFooter: 'Precios de CheapShark en USD · se actualizan cada pocos minutos',
    off: '-{n} %',
    view: 'Ver oferta',
    rating: 'Steam: {text}',
    metacritic: 'Metacritic {n}',
    noDeals: 'No encontré ofertas con esos filtros. Prueba con otro nombre o un precio máximo más alto.',
    freeTitle: 'Juegos gratis',
    freeSubtitle: 'Regalos activos en tiendas y plataformas',
    freeFooter: 'Datos de GamerPower · revisa siempre la tienda antes de reclamar',
    freeWorth: 'Gratis · antes {worth}',
    freeFree: 'Gratis',
    endsAt: 'termina {when}',
    noEnd: 'sin fecha de fin',
    claim: 'Reclamar',
    noFree: 'Ahora mismo no hay regalos activos con ese filtro.',
    types: { game: 'Juegos completos', loot: 'Contenido / DLC', beta: 'Betas y acceso anticipado' },
    feedTitle: '¡Juego gratis!',
    feedFooter: 'Koharu avisa aquí de cada juego gratis nuevo · /ofertas canal para cambiarlo',
    alertAdded: '{e:bell} Te escribiré por mensaje privado cuando **{title}** baje a **{price}** o menos. Ahora está en **{now}**.',
    alertAlready: 'Ya cuesta **{now}**, que está por debajo de tu precio. ¡Es buen momento para comprarlo!',
    alertLimit: 'Ya tienes {n} alertas activas. Borra alguna con `/ofertas alertas`.',
    alertNoGame: 'No encontré ese juego en CheapShark. Elige uno de la lista mientras escribes.',
    alertsTitle: 'Tus alertas de precio',
    alertsEmpty: 'No tienes alertas. Crea una con `/ofertas alerta`.',
    alertLine: '**{title}** · avisar a **{price}** o menos',
    removePlaceholder: 'Borrar una alerta…',
    removed: 'Alerta borrada.',
    alertHitTitle: '¡Bajó de precio!',
    alertHitBody: '**{title}** está a **{price}** en {store} (querías {target} o menos).',
    lowestEver: 'Mínimo histórico: {price}',
    channelSet: '{e:gift} Publicaré los juegos gratis nuevos en {channel}. Para empezar, ahí van los más recientes.',
    channelOff: 'Listo, ya no publicaré juegos gratis en este servidor.',
    channelPerm: 'Necesito permiso para **ver el canal y enviar mensajes** en {channel}.',
  },
  en: {
    gamesTitle: 'Game deals',
    gamesSearchTitle: 'Deals: {query}',
    gamesSubtitle: 'The best discounts right now across 30+ PC stores',
    gamesFooter: 'Prices from CheapShark in USD · refreshed every few minutes',
    off: '-{n}%',
    view: 'View deal',
    rating: 'Steam: {text}',
    metacritic: 'Metacritic {n}',
    noDeals: 'No deals match those filters. Try another name or a higher max price.',
    freeTitle: 'Free games',
    freeSubtitle: 'Active giveaways across stores and platforms',
    freeFooter: 'Data from GamerPower · always check the store before claiming',
    freeWorth: 'Free · was {worth}',
    freeFree: 'Free',
    endsAt: 'ends {when}',
    noEnd: 'no end date',
    claim: 'Claim',
    noFree: 'There are no active giveaways with that filter right now.',
    types: { game: 'Full games', loot: 'In-game loot / DLC', beta: 'Betas & early access' },
    feedTitle: 'Free game!',
    feedFooter: 'Koharu posts every new free game here · /deals channel to change it',
    alertAdded: '{e:bell} I will DM you when **{title}** drops to **{price}** or less. It is **{now}** right now.',
    alertAlready: 'It already costs **{now}**, below your price. Good time to buy!',
    alertLimit: 'You already have {n} active alerts. Remove one with `/deals alerts`.',
    alertNoGame: 'I could not find that game on CheapShark. Pick one from the list while typing.',
    alertsTitle: 'Your price alerts',
    alertsEmpty: 'You have no alerts. Create one with `/deals alert`.',
    alertLine: '**{title}** · notify at **{price}** or less',
    removePlaceholder: 'Remove an alert…',
    removed: 'Alert removed.',
    alertHitTitle: 'Price drop!',
    alertHitBody: '**{title}** is **{price}** at {store} (you wanted {target} or less).',
    lowestEver: 'All-time low: {price}',
    channelSet: '{e:gift} I will post new free games in {channel}. To start, here are the latest ones.',
    channelOff: 'Done, I will no longer post free games in this server.',
    channelPerm: 'I need permission to **view the channel and send messages** in {channel}.',
  },
});

const L = (locale, key, vars) => t(locale, `deals.${key}`, vars);
const money = (locale, value) => formatMoney(locale, value, 'USD');

const DEALS_PER_PAGE = 5;
const FREE_PER_PAGE = 4;

function dealsCard(locale, session, page) {
  const pages = Math.max(1, Math.ceil(session.items.length / DEALS_PER_PAGE));
  const current = Math.min(Math.max(page, 0), pages - 1);
  const slice = session.items.slice(current * DEALS_PER_PAGE, (current + 1) * DEALS_PER_PAGE);
  const body = ['sep'];

  for (const deal of slice) {
    const store = session.stores[deal.storeId]?.name ?? 'Store';
    const extra = [store, deal.metacritic ? L(locale, 'metacritic', { n: deal.metacritic }) : null, deal.steamRating ? L(locale, 'rating', { text: deal.steamRating }) : null].filter(Boolean).join(' · ');
    const price = deal.salePrice === 0 ? `**${L(locale, 'freeFree')}**` : `~~${money(locale, deal.normalPrice)}~~ → **${money(locale, deal.salePrice)}**`;
    body.push(ui.section(
      `**${truncate(deal.title, 80)}**\n${price} · ${L(locale, 'off', { n: deal.savings })}\n-# ${extra} · [${L(locale, 'view')}](${deal.url})`,
      { image: deal.thumb, imageAlt: deal.title },
    ));
  }
  if (pages > 1) body.push(ui.pager({ feature: 'deals', owner: session.owner, session: session.id, page: current, pages, locale }));

  return ui.card({
    accent: 'mint',
    emoji: 'tag',
    title: session.query ? L(locale, 'gamesSearchTitle', { query: truncate(session.query, 60) }) : L(locale, 'gamesTitle'),
    subtitle: L(locale, 'gamesSubtitle'),
    body,
    footer: L(locale, 'gamesFooter'),
  });
}

function giveawayLine(locale, item) {
  const worth = item.worth ? L(locale, 'freeWorth', { worth: item.worth }) : L(locale, 'freeFree');
  const end = item.endsAt ? L(locale, 'endsAt', { when: ts(item.endsAt, 'R') }) : L(locale, 'noEnd');
  return `**${truncate(item.title, 80)}**\n${emojis.e('gift')} ${worth} · ${end}\n-# ${item.platforms.slice(0, 3).join(' · ')} · [${L(locale, 'claim')}](${item.url})`;
}

function freeCard(locale, session, page) {
  const pages = Math.max(1, Math.ceil(session.items.length / FREE_PER_PAGE));
  const current = Math.min(Math.max(page, 0), pages - 1);
  const slice = session.items.slice(current * FREE_PER_PAGE, (current + 1) * FREE_PER_PAGE);
  const body = ['sep'];
  for (const item of slice) body.push(ui.section(giveawayLine(locale, item), { image: item.thumbnail, imageAlt: item.title }));
  if (pages > 1) body.push(ui.pager({ feature: 'deals', action: 'fpage', owner: session.owner, session: session.id, page: current, pages, locale }));
  return ui.card({
    accent: 'gold',
    emoji: 'gift',
    title: L(locale, 'freeTitle'),
    subtitle: session.typeLabel ? `${L(locale, 'freeSubtitle')} · ${session.typeLabel}` : L(locale, 'freeSubtitle'),
    body,
    footer: L(locale, 'freeFooter'),
  });
}

/** Big announcement used by the automatic free-games channel. */
function feedMessage(locale, item) {
  const worth = item.worth ? L(locale, 'freeWorth', { worth: item.worth }) : L(locale, 'freeFree');
  const end = item.endsAt ? L(locale, 'endsAt', { when: ts(item.endsAt, 'R') }) : L(locale, 'noEnd');
  return ui.message(ui.card({
    accent: 'gold',
    emoji: 'gift',
    title: L(locale, 'feedTitle'),
    body: [
      `### ${item.title}\n${worth} · ${end}\n-# ${item.platforms.join(' · ')}`,
      item.image ? ui.gallery({ url: item.image, description: item.title }) : null,
      item.description ? ui.quote(truncate(item.description, 300)) : null,
      ui.row(ui.button({ url: item.url, label: L(locale, 'claim'), emoji: 'gift' })),
    ],
    footer: L(locale, 'feedFooter'),
  }));
}

function alertsCard(locale, owner, alerts) {
  const body = ['sep'];
  if (!alerts.length) body.push(ui.quote(L(locale, 'alertsEmpty')));
  else {
    body.push(alerts.map(alert => `${emojis.e('bell')} ${L(locale, 'alertLine', { title: alert.title, price: money(locale, alert.target_price) })}`).join('\n'));
    body.push(ui.row(ui.select({
      id: router.encode('deals', 'rmalert', owner),
      placeholder: L(locale, 'removePlaceholder'),
      options: alerts.slice(0, 25).map(alert => ({ label: truncate(alert.title, 100), value: String(alert.id), description: money(locale, alert.target_price), emoji: 'cross' })),
    })));
  }
  return ui.card({ accent: 'gold', emoji: 'bell', title: L(locale, 'alertsTitle'), body });
}

function newSession(owner, data) {
  const session = { owner, ...data };
  session.id = router.createSession(session);
  return session;
}

router.register('deals', async (interaction, route, { locale }) => {
  const { action, args, owner } = route;
  if (action === 'noop') return interaction.deferUpdate();

  if (action === 'page' || action === 'fpage') {
    const session = router.getSession(args[0]);
    if (!session) return interaction.reply(ui.message(ui.notice('info', t(locale, 'common.expired')), { ephemeral: true }));
    const page = Number(args[1]) || 0;
    return interaction.update(ui.forEdit(ui.message(action === 'page' ? dealsCard(locale, session, page) : freeCard(locale, session, page))));
  }

  if (action === 'rmalert') {
    db.removeAlert(owner, Number(interaction.values[0]));
    return interaction.update(ui.forEdit(ui.message(alertsCard(locale, owner, db.alerts(owner)))));
  }
  return null;
});

// --------------------------------------------------------------------------- background jobs

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

async function postFreeGames(client, { guildId, channelId, locale, items, limit = 5 }) {
  const channel = await client.channels.fetch(channelId).catch(() => null);
  if (!channel?.isTextBased?.()) return 0;
  const fresh = items.slice(0, limit).reverse(); // oldest first so the newest ends at the bottom
  let sent = 0;
  for (const item of fresh) {
    const ok = await channel.send(feedMessage(locale, item)).then(() => true).catch(() => false);
    if (ok) sent += 1;
  }
  db.markGiveawaysPosted(guildId, fresh.map(item => item.id));
  return sent;
}

async function freeGamesTick(client, { defaultLocale }) {
  const guilds = db.freeGameGuilds();
  if (!guilds.length) return;
  const items = await gamerpower.giveaways({ type: 'game', sort: 'date' });
  for (const guild of guilds) {
    if (!client.guilds.cache.has(guild.guild_id)) continue;
    const posted = db.postedGiveaways(guild.guild_id);
    const fresh = items.filter(item => !posted.has(item.id));
    if (fresh.length) {
      await postFreeGames(client, { guildId: guild.guild_id, channelId: guild.channel_id, locale: guild.language || defaultLocale, items: fresh });
    }
  }
  db.prunePostedGiveaways();
}

async function priceAlertsTick(client) {
  const alerts = db.activeAlerts();
  const byGame = new Map();
  for (const alert of alerts) {
    if (!byGame.has(alert.game_id)) byGame.set(alert.game_id, []);
    byGame.get(alert.game_id).push(alert);
  }
  if (!byGame.size) return;
  const stores = await cheapshark.stores().catch(() => new Map());

  for (const [gameId, list] of byGame) {
    const game = await cheapshark.game(gameId).catch(() => null);
    await sleep(1200); // be gentle with a free API
    const best = game?.deals?.[0];
    if (!best) continue;
    for (const alert of list) {
      if (best.price > alert.target_price) continue;
      const locale = alert.locale === 'en' ? 'en' : 'es';
      const card = ui.card({
        accent: 'mint',
        emoji: 'bell',
        title: L(locale, 'alertHitTitle'),
        thumbnail: game.thumb,
        intro: L(locale, 'alertHitBody', { title: game.title, price: money(locale, best.price), store: stores.get(best.storeId)?.name ?? 'store', target: money(locale, alert.target_price) }),
        body: [
          game.lowestEver ? ui.sub(L(locale, 'lowestEver', { price: money(locale, game.lowestEver) })) : null,
          ui.row(ui.button({ url: best.url, label: L(locale, 'view'), emoji: 'tag' })),
        ],
      });
      const user = await client.users.fetch(alert.user_id).catch(() => null);
      let delivered = await user?.send(ui.message(card)).then(() => true).catch(() => false);
      if (!delivered && alert.channel_id) {
        const channel = await client.channels.fetch(alert.channel_id).catch(() => null);
        delivered = await channel?.send(ui.message(card)).then(() => true).catch(() => false);
      }
      db.triggerAlert(alert.id);
    }
  }
}

module.exports = {
  DEALS_PER_PAGE, FREE_PER_PAGE, dealsCard, freeCard, feedMessage, alertsCard, newSession, postFreeGames,
  freeGamesTick, priceAlertsTick, money,
};
