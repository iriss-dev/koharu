'use strict';

/**
 * Universal search: one query fans out to AniList (anime, manga, characters),
 * the fashion library, CheapShark and Koharu's own commands, then shows the
 * best hits per section with a menu to open any of them.
 *
 * Results are referenced by compact tokens such as `anime:123`, `style:kawaii`,
 * `piece:t4`, `cmd:help` or `deal:<title>`.
 */

const ui = require('../../core/ui');
const router = require('../../core/router');
const { register, t, pick } = require('../../core/i18n');
const emojis = require('../../core/emojis');
const anilist = require('../../services/anilist');
const cheapshark = require('../../services/cheapshark');
const colors = require('../../utils/colors');
const { fold, truncate } = require('../../utils/text');

register('search', {
  es: {
    title: 'Resultados para «{query}»',
    subtitle: 'Anime, manga, personajes, moda, ofertas y comandos',
    sections: { anime: 'Anime', manga: 'Manga', character: 'Personajes', fashion: 'Moda', deal: 'Ofertas', cmd: 'Comandos' },
    open: 'Abrir un resultado…',
    none: 'No encontré nada con «{query}». Prueba con otra palabra o en otro idioma.',
    partial: 'Algunas fuentes no respondieron a tiempo; puede que falten resultados.',
    dealLine: 'desde {price}',
    styleLine: 'Guía de estilo',
    pieceLine: 'Buscar en tiendas',
    colorLine: 'Combinaciones de color',
  },
  en: {
    title: 'Results for “{query}”',
    subtitle: 'Anime, manga, characters, fashion, deals and commands',
    sections: { anime: 'Anime', manga: 'Manga', character: 'Characters', fashion: 'Fashion', deal: 'Deals', cmd: 'Commands' },
    open: 'Open a result…',
    none: 'I found nothing for “{query}”. Try another word or language.',
    partial: 'Some sources did not answer in time; results may be incomplete.',
    dealLine: 'from {price}',
    styleLine: 'Style guide',
    pieceLine: 'Find in shops',
    colorLine: 'Colour combinations',
  },
});

const L = (locale, key, vars) => t(locale, `search.${key}`, vars);
const KINDS = ['anime', 'manga', 'character', 'fashion', 'deal', 'cmd'];
const SECTION_EMOJI = { anime: 'tv', manga: 'book', character: 'star', fashion: 'dress', deal: 'tag', cmd: 'sakura' };

const withTimeout = (promise, ms = 4500) => Promise.race([promise, new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), ms))]);

function fashionHits(locale, query) {
  const fashion = require('../fashion');
  const q = fold(query);
  if (!q) return [];
  const hits = [];
  for (const [key, style] of Object.entries(fashion.data.STYLES)) {
    if ([style.name.es, style.name.en, key, style.search].some(name => fold(name).includes(q))) {
      hits.push({ token: `style:${key}`, label: pick(locale, style.name), detail: L(locale, 'styleLine'), emoji: style.emoji });
    }
  }
  for (const piece of fashion.data.WARDROBE) {
    if (fold(piece.es).includes(q) || fold(piece.en).includes(q)) {
      hits.push({ token: `piece:${piece.id}`, label: piece[locale], detail: L(locale, 'pieceLine'), emoji: 'search' });
    }
  }
  const color = colors.parseColor(query);
  if (color) hits.unshift({ token: `color:${color.slice(1)}`, label: `${colors.nearestName(color, locale).name} (${color})`, detail: L(locale, 'colorLine'), emoji: 'palette' });
  return hits.slice(0, 6);
}

function commandHits(locale, query) {
  const help = require('../help');
  return help.commandChoices(locale, query).slice(0, 4).map(choice => ({ token: `cmd:${choice.value}`, label: choice.name.split(' · ')[0], detail: truncate(choice.name.split(' · ').slice(1).join(' · '), 90), emoji: 'sakura' }));
}

/**
 * @param {string} locale
 * @param {string} query
 * @param {string} [kind] one of KINDS or 'all'
 */
async function run(locale, query, kind = 'all') {
  const want = k => kind === 'all' || kind === k;
  const tasks = {
    anime: want('anime') ? withTimeout(anilist.search('ANIME', query, { perPage: 5 })) : null,
    manga: want('manga') ? withTimeout(anilist.search('MANGA', query, { perPage: 5 })) : null,
    character: want('character') ? withTimeout(anilist.searchCharacters(query, { perPage: 5 })) : null,
    deal: want('deal') ? withTimeout(cheapshark.searchGames(query, { limit: 5 })) : null,
  };
  const settled = await Promise.allSettled(Object.values(tasks).map(task => task ?? Promise.resolve(null)));
  const results = Object.fromEntries(Object.keys(tasks).map((key, i) => [key, settled[i].status === 'fulfilled' ? settled[i].value : undefined]));
  const partial = Object.keys(tasks).some((key, i) => tasks[key] && settled[i].status === 'rejected');

  const { metaLine } = require('../anime');
  const sections = {};
  if (results.anime?.length) sections.anime = results.anime.slice(0, 4).map(item => ({ token: `anime:${item.id}`, label: anilist.titleOf(item), detail: metaLine(locale, item), emoji: 'tv' }));
  if (results.manga?.length) sections.manga = results.manga.slice(0, 3).map(item => ({ token: `manga:${item.id}`, label: anilist.titleOf(item), detail: metaLine(locale, item), emoji: 'book' }));
  if (results.character?.length) sections.character = results.character.slice(0, 3).map(item => ({ token: `char:${item.id}`, label: item.name.full, detail: item.name.native ?? '', emoji: 'star' }));
  if (want('fashion')) {
    const hits = fashionHits(locale, query);
    if (hits.length) sections.fashion = hits;
  }
  if (results.deal?.length) {
    const { money } = require('../deals');
    sections.deal = results.deal.slice(0, 3).map(game => ({ token: `deal:${truncate(game.title, 60)}`, label: game.title, detail: game.cheapest !== null ? L(locale, 'dealLine', { price: money(locale, game.cheapest) }) : '', emoji: 'tag' }));
  }
  if (want('cmd')) {
    const hits = commandHits(locale, query);
    if (hits.length) sections.cmd = hits;
  }
  return { sections, partial };
}

function resultsCard(locale, query, { sections, partial }, owner) {
  const kinds = KINDS.filter(kind => sections[kind]?.length);
  if (!kinds.length) return ui.notice('info', L(locale, 'title', { query: truncate(query, 60) }), L(locale, 'none', { query: truncate(query, 60) }));

  const body = ['sep'];
  const options = [];
  for (const kind of kinds) {
    const lines = sections[kind].map(hit => `**${truncate(hit.label, 70)}**${hit.detail ? ` · ${hit.detail}` : ''}`);
    body.push(`**${emojis.e(SECTION_EMOJI[kind])} ${L(locale, `sections.${kind}`)}**\n${lines.join('\n')}`);
    for (const hit of sections[kind]) {
      if (options.length < 25) options.push({ label: truncate(hit.label, 100), value: hit.token.slice(0, 100), description: truncate(`${L(locale, `sections.${kind}`)}${hit.detail ? ` · ${hit.detail}` : ''}`, 100), emoji: hit.emoji });
    }
  }
  body.push(ui.row(ui.select({ id: router.encode('search', 'open', '*'), placeholder: L(locale, 'open'), options })));
  if (partial) body.push(ui.sub(L(locale, 'partial')));

  return ui.card({ accent: 'sky', emoji: 'search', title: L(locale, 'title', { query: truncate(query, 60) }), subtitle: L(locale, 'subtitle'), body });
}

/** Opens one result token as a full card. Returns { card, files } or null. */
async function open(locale, token, { owner, prefix }) {
  const [kind, ...rest] = String(token).split(':');
  const value = rest.join(':');
  const anime = require('../anime');
  const fashion = require('../fashion');

  if (kind === 'anime' || kind === 'manga') {
    const item = await anilist.media(value);
    return item ? { card: anime.mediaCard(locale, item), files: [] } : null;
  }
  if (kind === 'char') {
    const character = await anilist.character(value);
    return character ? { card: anime.characterCard(locale, character), files: [] } : null;
  }
  if (kind === 'style' && fashion.data.STYLES[value]) return fashion.styleMessage(locale, value, owner);
  if (kind === 'piece') {
    const piece = fashion.data.WARDROBE.find(item => item.id === value);
    return piece ? { card: fashion.findMessage(locale, piece, null), files: [] } : null;
  }
  if (kind === 'color') return fashion.colorsMessage(locale, `#${value}`);
  if (kind === 'cmd') {
    const help = require('../help');
    const command = help.findCommand(value);
    return command ? { card: help.commandCard(locale, command, prefix), files: [] } : null;
  }
  if (kind === 'deal') {
    const deals = require('../deals');
    const [items, stores] = await Promise.all([cheapshark.deals({ title: value }), cheapshark.stores()]);
    if (!items.length) return null;
    const session = deals.newSession(owner, { items, query: value, stores: Object.fromEntries(stores) });
    return { card: deals.dealsCard(locale, session, 0), files: [] };
  }
  return null;
}

/** Autocomplete: a few quick local suggestions plus AniList titles. */
async function suggestions(locale, query, kind = 'all') {
  const q = String(query ?? '').trim();
  if (q.length < 2) return [];
  const out = [];
  if (kind === 'all' || kind === 'anime') {
    const items = await withTimeout(anilist.search('ANIME', q, { perPage: kind === 'anime' ? 15 : 6 }), 2200).catch(() => []);
    out.push(...items.map(item => ({ name: truncate(`${anilist.titleOf(item)} · Anime`, 100), value: `anime:${item.id}` })));
  }
  if (kind === 'manga') {
    const items = await withTimeout(anilist.search('MANGA', q, { perPage: 15 }), 2200).catch(() => []);
    out.push(...items.map(item => ({ name: truncate(`${anilist.titleOf(item)} · Manga`, 100), value: `manga:${item.id}` })));
  }
  if (kind === 'all' || kind === 'fashion') {
    out.push(...fashionHits(locale, q).map(hit => ({ name: truncate(`${hit.label} · ${hit.detail}`, 100), value: hit.token })));
  }
  if (kind === 'all' || kind === 'cmd') {
    out.push(...commandHits(locale, q).map(hit => ({ name: truncate(`${hit.label} · ${hit.detail}`, 100), value: hit.token })));
  }
  // Keep the raw text as the first option so "search everything" is always one Enter away.
  return [{ name: truncate(`🔎 ${q}`, 100), value: truncate(q, 100) }, ...out].slice(0, 25);
}

const TOKEN_RE = /^(anime|manga|char|style|piece|color|cmd|deal):.+/;

router.register('search', async (interaction, route, { locale, prefix }) => {
  if (route.action !== 'open') return null;
  await ui.deferEphemeral(interaction);
  const result = await open(locale, interaction.values[0], { owner: interaction.user.id, prefix });
  if (!result) return interaction.editReply(ui.forEdit(ui.message(ui.notice('info', t(locale, 'common.noResults', { query: interaction.values[0].split(':').slice(1).join(':') })))));
  return interaction.editReply({ ...ui.forEdit(ui.message(result.card)), files: result.files });
});

module.exports = { KINDS, TOKEN_RE, run, resultsCard, open, suggestions, fashionHits };
