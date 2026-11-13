'use strict';

/**
 * Anime & manga cards (AniList) and their buttons: characters, similar titles,
 * favourites, list pagination and "open a title" menus.
 */

require('./strings');
const ui = require('../../core/ui');
const router = require('../../core/router');
const { t } = require('../../core/i18n');
const anilist = require('../../services/anilist');
const db = require('../../database/db');
const { anilistToMarkdown, truncate, formatNumber, ts, chunk } = require('../../utils/text');

const PER_PAGE = 5;
const L = (locale, key, vars) => t(locale, `anime.${key}`, vars);

const accentFor = item => item?.coverImage?.color || 'primary';
const coverOf = item => item?.coverImage?.extraLarge || item?.coverImage?.large || null;

function formatName(locale, item) {
  return L(locale, `formats.${item.format}`) !== `anime.formats.${item.format}` ? L(locale, `formats.${item.format}`) : (item.format ?? '—');
}

function genreName(locale, genre) {
  const key = `anime.genreNames.${genre}`;
  const value = t(locale, key);
  return value === key ? genre : value;
}

/** "TV · 28 episodes · 2023" style summary used in lists. */
function metaLine(locale, item) {
  const parts = [formatName(locale, item)];
  if (item.type === 'MANGA') {
    if (item.chapters) parts.push(L(locale, 'chapters', { n: item.chapters }));
  } else if (item.episodes) {
    parts.push(L(locale, 'episodes', { n: item.episodes }));
  }
  const year = item.seasonYear || item.startDate?.year;
  if (year) parts.push(String(year));
  if (item.averageScore) parts.push(`★ ${item.averageScore}%`);
  return parts.filter(Boolean).join(' · ');
}

function scoreBar(score) {
  const filled = Math.round((score ?? 0) / 20);
  return '♥'.repeat(filled) + '♡'.repeat(5 - filled);
}

function linkRow(locale, item) {
  const buttons = [ui.button({ url: item.siteUrl, label: 'AniList', emoji: 'link' })];
  if (item.idMal) {
    buttons.push(ui.button({ url: `https://myanimelist.net/${item.type === 'MANGA' ? 'manga' : 'anime'}/${item.idMal}`, label: 'MyAnimeList' }));
  }
  if (item.trailer?.site === 'youtube' && item.trailer.id) {
    buttons.push(ui.button({ url: `https://www.youtube.com/watch?v=${encodeURIComponent(item.trailer.id)}`, label: L(locale, 'trailer'), emoji: 'tv' }));
  }
  return ui.row(...buttons);
}

/** Full card for one anime or manga. */
function mediaCard(locale, item) {
  const title = anilist.titleOf(item);
  const alt = [item.title?.romaji, item.title?.native].filter(name => name && name !== title);
  const isManga = item.type === 'MANGA';

  const facts = [];
  if (item.averageScore) facts.push(ui.bullet('star', L(locale, 'score'), `**${item.averageScore}%** ${scoreBar(item.averageScore)}`));

  const formatParts = [formatName(locale, item)];
  if (isManga) {
    if (item.chapters) formatParts.push(L(locale, 'chapters', { n: item.chapters }));
    if (item.volumes) formatParts.push(L(locale, 'volumes', { n: item.volumes }));
  } else {
    if (item.episodes) formatParts.push(L(locale, 'episodes', { n: item.episodes }));
    if (item.duration) formatParts.push(L(locale, 'minutes', { n: item.duration }));
  }
  facts.push(ui.bullet(isManga ? 'book' : 'tv', L(locale, 'format'), formatParts.join(' · ')));

  const when = item.season && item.seasonYear
    ? `${L(locale, `seasons.${item.season}`)} ${item.seasonYear}`
    : item.startDate?.year ? String(item.startDate.year) : null;
  const status = item.status ? L(locale, `statuses.${item.status}`) : null;
  if (when || status) facts.push(ui.bullet('calendar', L(locale, 'aired'), [when, status].filter(Boolean).join(' · ')));

  const studio = item.studios?.nodes?.[0]?.name;
  if (studio) facts.push(ui.bullet('sparkle', L(locale, 'studio'), studio));

  if (item.nextAiringEpisode?.airingAt) {
    facts.push(ui.bullet('clock', L(locale, 'next'), L(locale, 'nextValue', { episode: item.nextAiringEpisode.episode, when: ts(item.nextAiringEpisode.airingAt, 'R') })));
  }
  if (item.genres?.length) facts.push(ui.bullet('tag', L(locale, 'genres'), item.genres.slice(0, 5).map(g => genreName(locale, g)).join(' · ')));

  const synopsis = anilistToMarkdown(item.description);
  const footer = [L(locale, 'source'), item.popularity ? L(locale, 'popularity', { n: formatNumber(locale, item.popularity) }) : null, locale === 'es' && synopsis ? L(locale, 'englishNote') : null]
    .filter(Boolean).join(' · ');

  return ui.card({
    accent: accentFor(item),
    emoji: isManga ? 'book' : 'tv',
    title,
    subtitle: alt.join(' · ') || undefined,
    intro: facts.join('\n'),
    thumbnail: coverOf(item),
    body: [
      'sep',
      ui.quote(synopsis ? truncate(synopsis, 650) : L(locale, 'synopsisMissing')),
      item.bannerImage ? ui.gallery({ url: item.bannerImage, description: title }) : null,
      linkRow(locale, item),
      ui.row(
        ui.button({ id: router.encode('anime', 'chars', '*', item.id), label: L(locale, 'characters'), emoji: 'chat' }),
        ui.button({ id: router.encode('anime', 'recs', '*', item.id), label: L(locale, 'similar'), emoji: 'sparkle' }),
        ui.button({ id: router.encode('anime', 'fav', '*', item.id), label: L(locale, 'favorite'), emoji: 'heart', style: 'primary' }),
      ),
    ],
    footer,
  });
}

/** Compact summaries kept in list sessions. */
function summarize(item) {
  return {
    id: item.id,
    type: item.type,
    title: anilist.titleOf(item),
    cover: item.coverImage?.large || null,
    color: item.coverImage?.color || null,
    format: item.format,
    episodes: item.episodes,
    chapters: item.chapters,
    seasonYear: item.seasonYear,
    startDate: item.startDate,
    averageScore: item.averageScore,
    genres: item.genres?.slice(0, 3) ?? [],
  };
}

/** Paginated list of titles with covers and an "open" menu. */
function listCard(locale, session, page) {
  const pages = Math.max(1, Math.ceil(session.items.length / PER_PAGE));
  const current = Math.min(Math.max(page, 0), pages - 1);
  const slice = session.items.slice(current * PER_PAGE, current * PER_PAGE + PER_PAGE);

  const body = [];
  slice.forEach((item, index) => {
    const genres = item.genres?.length ? `\n-# ${item.genres.map(g => genreName(locale, g)).join(' · ')}` : '';
    body.push(ui.section(`**${current * PER_PAGE + index + 1}. ${item.title}**\n${metaLine(locale, item)}${genres}`, { image: item.cover, imageAlt: item.title }));
  });

  body.push(ui.row(ui.select({
    id: router.encode('anime', 'open', '*'),
    placeholder: L(locale, 'openOne'),
    options: slice.map(item => ({ label: truncate(item.title, 100), value: String(item.id), description: truncate(metaLine(locale, item), 100), emoji: item.type === 'MANGA' ? 'book' : 'tv' })),
  })));
  if (pages > 1) body.push(ui.pager({ feature: 'anime', owner: session.owner, session: session.id, page: current, pages, locale }));

  return ui.card({ accent: session.accent || 'lavender', emoji: session.emoji, title: session.title, subtitle: session.subtitle, body: ['sep', ...body], footer: L(locale, 'source') });
}

function newListSession(owner, { title, subtitle, emoji, accent, items }) {
  const data = { owner, title, subtitle, emoji, accent, items: items.map(summarize) };
  data.id = router.createSession(data);
  return data;
}

/** Airing schedule, 10 entries per page. */
function scheduleCard(locale, session, page) {
  const PER = 10;
  const pages = Math.max(1, Math.ceil(session.entries.length / PER));
  const current = Math.min(Math.max(page, 0), pages - 1);
  const slice = session.entries.slice(current * PER, current * PER + PER);
  const style = session.range === 'week' ? 'f' : 't';
  const lines = slice.map(entry => `${ts(entry.airingAt, style)} · ${ts(entry.airingAt, 'R')}\n**${entry.title}** · ${L(locale, 'episodeLine', { episode: entry.episode })}`);

  const body = ['sep', lines.length ? lines.join('\n\n') : ui.quote(L(locale, 'scheduleEmpty'))];
  if (slice.length) {
    body.push(ui.row(ui.select({
      id: router.encode('anime', 'open', '*'),
      placeholder: L(locale, 'openOne'),
      options: slice.map(entry => ({ label: truncate(entry.title, 100), value: String(entry.id), description: L(locale, 'episodeLine', { episode: entry.episode }), emoji: 'tv' })),
    })));
  }
  if (pages > 1) body.push(ui.pager({ feature: 'anime', action: 'spage', owner: session.owner, session: session.id, page: current, pages, locale }));

  const rangeLabel = { day: L(locale, 'range24'), tomorrow: L(locale, 'range48'), week: L(locale, 'rangeWeek') }[session.range];
  return ui.card({ accent: 'sky', emoji: 'calendar', title: L(locale, 'scheduleTitle'), subtitle: L(locale, 'scheduleSubtitle', { range: rangeLabel }), body, footer: L(locale, 'source') });
}

function charactersCard(locale, item, edges) {
  const title = anilist.titleOf(item);
  const body = ['sep'];
  if (!edges.length) body.push(ui.quote(L(locale, 'charactersEmpty')));
  for (const edge of edges.slice(0, 6)) {
    const node = edge.node;
    const role = edge.role ? L(locale, `role.${edge.role}`) : '';
    const voice = edge.voiceActors?.[0]?.name?.full ? L(locale, 'voice', { name: edge.voiceActors[0].name.full }) : '';
    body.push(ui.section(`**${node.name.full}**${node.name.native ? ` · ${node.name.native}` : ''}\n-# ${[role, voice].filter(Boolean).join(' · ')}`, { image: node.image?.large, imageAlt: node.name.full }));
  }
  return ui.card({ accent: accentFor(item), emoji: 'chat', title: L(locale, 'charactersTitle', { title }), body, footer: L(locale, 'source') });
}

function characterCard(locale, character) {
  const facts = [];
  if (character.age) facts.push(ui.bullet('sparkle', L(locale, 'characterAge'), character.age));
  if (character.dateOfBirth?.month && character.dateOfBirth?.day) {
    const date = new Date(Date.UTC(2000, character.dateOfBirth.month - 1, character.dateOfBirth.day));
    facts.push(ui.bullet('calendar', L(locale, 'characterBirthday'), date.toLocaleDateString(locale === 'es' ? 'es-ES' : 'en-US', { month: 'long', day: 'numeric', timeZone: 'UTC' })));
  }
  if (character.favourites) facts.push(ui.bullet('heart', 'AniList', L(locale, 'characterFavs', { n: formatNumber(locale, character.favourites) })));
  const appears = (character.media?.nodes ?? []).filter(m => !m.isAdult).slice(0, 4)
    .map(m => `[${anilist.titleOf(m)}](${m.siteUrl})`).join(' · ');
  if (appears) facts.push(ui.bullet('tv', L(locale, 'characterAppears'), appears));

  const about = anilistToMarkdown(character.description);
  const alt = [character.name?.native, ...(character.name?.alternative ?? []).slice(0, 2)].filter(Boolean).join(' · ');

  return ui.card({
    accent: 'rose',
    emoji: 'star',
    title: character.name?.full ?? '—',
    subtitle: alt || undefined,
    intro: facts.join('\n') || undefined,
    thumbnail: character.image?.large,
    body: [
      'sep',
      ui.quote(about ? truncate(about, 700) : L(locale, 'synopsisMissing')),
      ui.row(ui.button({ url: character.siteUrl, label: 'AniList', emoji: 'link' })),
    ],
    footer: L(locale, 'source'),
  });
}

function randomCard(locale, item, owner, { type, genre }) {
  const card = mediaCard(locale, item);
  // Prepend a small header so it reads as a recommendation, plus an "another" button.
  card.spliceComponents(0, 0, ui.text(`${ui.heading('wand', L(locale, 'randomTitle'))}\n${ui.sub(L(locale, 'randomSubtitle'))}`));
  card.addActionRowComponents(ui.row(ui.button({ id: router.encode('anime', 'another', owner, type, genre ?? ''), label: L(locale, 'another'), emoji: 'shuffle', style: 'success' })));
  return card;
}

// --------------------------------------------------------------------------- component handler

router.register('anime', async (interaction, route, { locale }) => {
  const { action, args } = route;

  if (action === 'noop') return interaction.deferUpdate();

  if (action === 'open') {
    await ui.deferEphemeral(interaction);
    const item = await anilist.media(interaction.values[0]);
    if (!item) return interaction.editReply(ui.forEdit(ui.message(ui.notice('error', t(locale, 'common.errorTitle'), t(locale, 'common.errorBody')))));
    return interaction.editReply(ui.forEdit(ui.message(mediaCard(locale, item))));
  }

  if (action === 'page' || action === 'spage') {
    const session = router.getSession(args[0]);
    if (!session) return interaction.reply(ui.message(ui.notice('info', t(locale, 'common.expired')), { ephemeral: true }));
    const page = Number(args[1]) || 0;
    return interaction.update(ui.message(action === 'page' ? listCard(locale, session, page) : scheduleCard(locale, session, page)));
  }

  if (action === 'chars') {
    await ui.deferEphemeral(interaction);
    const [item, edges] = await Promise.all([anilist.media(args[0]), anilist.characters(args[0])]);
    if (!item) return interaction.editReply(ui.forEdit(ui.message(ui.notice('error', t(locale, 'common.errorTitle'), t(locale, 'common.errorBody')))));
    return interaction.editReply(ui.forEdit(ui.message(charactersCard(locale, item, edges))));
  }

  if (action === 'recs') {
    await ui.deferEphemeral(interaction);
    const [item, recs] = await Promise.all([anilist.media(args[0]), anilist.recommendations(args[0])]);
    if (!item || !recs.length) {
      return interaction.editReply(ui.forEdit(ui.message(ui.notice('info', L(locale, 'similar'), L(locale, 'recsEmpty')))));
    }
    const session = newListSession(interaction.user.id, { title: L(locale, 'recsTitle', { title: anilist.titleOf(item) }), emoji: 'sparkle', accent: accentFor(item), items: recs });
    return interaction.editReply(ui.forEdit(ui.message(listCard(locale, session, 0))));
  }

  if (action === 'fav') {
    const item = await anilist.media(args[0]);
    if (!item) return interaction.reply(ui.message(ui.notice('error', t(locale, 'common.errorTitle'), t(locale, 'common.errorBody')), { ephemeral: true }));
    const title = anilist.titleOf(item);
    const result = db.toggleFavorite(interaction.user.id, { id: item.id, type: item.type, title }, 12);
    const text = result === 'added' ? L(locale, 'favAdded', { title }) : result === 'removed' ? L(locale, 'favRemoved', { title }) : L(locale, 'favFull', { limit: 12 });
    return interaction.reply(ui.message(ui.notice(result === 'full' ? 'warn' : 'success', L(locale, 'favorite'), text), { ephemeral: true }));
  }

  if (action === 'another') {
    await interaction.deferUpdate();
    const [type, genre] = args;
    const item = await anilist.random({ type, genre: genre || undefined });
    if (!item) return null;
    return interaction.editReply(ui.forEdit(ui.message(randomCard(locale, item, route.owner, { type, genre }))));
  }

  return null;
});

/** Autocomplete choices for a title option. */
async function titleChoices(type, focused) {
  const query = String(focused ?? '').trim();
  const items = query
    ? await anilist.search(type, query, { perPage: 10 })
    : (await anilist.browse({ type, sort: ['TRENDING_DESC'], perPage: 10 })).items;
  return items.map(item => {
    const year = item.seasonYear || item.startDate?.year;
    const label = `${anilist.titleOf(item)}${year ? ` (${year})` : ''}`;
    return { name: truncate(label, 100), value: `id:${item.id}` };
  });
}

/** Resolves "id:123" (autocomplete pick) or free text to a media object. */
async function resolveMedia(type, value) {
  const raw = String(value ?? '').trim();
  if (/^id:\d+$/.test(raw)) return anilist.media(raw.slice(3));
  if (/^\d+$/.test(raw)) return (await anilist.media(raw)) ?? anilist.findOne(type, raw);
  return anilist.findOne(type, raw);
}

module.exports = {
  PER_PAGE, mediaCard, listCard, newListSession, scheduleCard, charactersCard, characterCard, randomCard,
  metaLine, genreName, titleChoices, resolveMedia, summarize, chunk,
};
