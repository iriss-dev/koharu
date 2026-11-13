'use strict';

/**
 * Cute anime media for every card.
 *
 * GIFs and images come from nekos.best (SFW, no key) with waifu.pics as a
 * backup. Each category is fetched 20 at a time and kept as a pool, so a
 * command picks a random one locally instead of asking the API every time, and
 * the last few picks are skipped so the same GIF does not show up twice in a row.
 *
 * A "mood" (warn, ban, money, sleepy, win…) is a list of fitting categories:
 * kawaii.mood('warn') gives a pouting, "baka!" or bonk GIF, a different one each time.
 */

const { getJson } = require('../core/http');

const NEKOS = 'https://nekos.best/api/v2';
const WAIFU = 'https://api.waifu.pics/sfw';

// From GET https://nekos.best/api/v2/endpoints ("shoot" left out on purpose).
const NEKOS_GIFS = new Set([
  'lurk', 'sleep', 'clap', 'shrug', 'stare', 'wave', 'poke', 'confused', 'smile', 'peck', 'wink', 'sip', 'blush',
  'smug', 'tickle', 'yeet', 'think', 'highfive', 'feed', 'wag', 'bite', 'teehee', 'shocked', 'bleh', 'bored', 'nom',
  'nya', 'yawn', 'facepalm', 'cuddle', 'kick', 'happy', 'carry', 'hug', 'kabedon', 'baka', 'bonk', 'pat', 'angry',
  'spin', 'shake', 'run', 'nod', 'nope', 'kiss', 'dance', 'punch', 'handshake', 'slap', 'cry', 'lappillow', 'pout',
  'blowkiss', 'handhold', 'salute', 'thumbsup', 'laugh', 'tableflip',
]);
const NEKOS_IMAGES = new Set(['neko', 'waifu', 'husbando', 'kitsune']);
// waifu.pics SFW categories that make sense for Koharu.
const WAIFU_CATEGORIES = new Set([
  'waifu', 'neko', 'shinobu', 'megumin', 'cuddle', 'cry', 'hug', 'awoo', 'kiss', 'pat', 'smug', 'bonk', 'yeet',
  'blush', 'smile', 'wave', 'highfive', 'handhold', 'nom', 'bite', 'glomp', 'slap', 'kick', 'happy', 'wink', 'poke',
  'dance', 'cringe',
]);

/** Mood → categories that fit it. Every card in Koharu asks for a mood, not a file. */
const MOODS = Object.freeze({
  warn: ['pout', 'baka', 'bonk', 'angry', 'stare', 'facepalm'],
  ban: ['yeet', 'kick', 'wave', 'tableflip', 'bonk'],
  kick: ['kick', 'yeet', 'wave', 'run'],
  timeout: ['sleep', 'pout', 'bonk', 'lurk', 'shake'],
  untimeout: ['happy', 'wave', 'dance', 'smile', 'hug'],
  purge: ['nope', 'teehee', 'spin', 'shrug'],
  slowmode: ['sip', 'sleep', 'yawn', 'bored'],
  money: ['happy', 'dance', 'smug', 'thumbsup', 'clap'],
  sleepy: ['sleep', 'yawn', 'bored', 'lappillow', 'sip'],
  work: ['salute', 'thumbsup', 'nom', 'happy', 'nod'],
  daily: ['happy', 'dance', 'clap', 'blush', 'wave'],
  win: ['dance', 'happy', 'clap', 'smug', 'thumbsup'],
  lose: ['cry', 'pout', 'facepalm', 'shocked', 'tableflip'],
  push: ['shrug', 'think', 'confused', 'teehee'],
  cards: ['think', 'smug', 'stare', 'teehee', 'sip'],
  love: ['kiss', 'blush', 'handhold', 'cuddle', 'blowkiss', 'hug'],
  sad: ['cry', 'pout', 'sleep'],
  hello: ['wave', 'hug', 'happy', 'dance', 'smile'],
  bye: ['wave', 'cry', 'run'],
  levelup: ['dance', 'happy', 'clap', 'thumbsup', 'smug'],
  thinking: ['think', 'confused', 'stare', 'shrug'],
  yes: ['nod', 'thumbsup', 'happy', 'smile'],
  no: ['nope', 'shake', 'pout', 'baka'],
  error: ['confused', 'shocked', 'facepalm', 'teehee'],
});

const POOL_TTL = 30 * 60 * 1000;
const RECENT = 6;
/** @type {Map<string, { items: Array<{url: string, anime: string|null, artist: string|null, source: string|null}>, expires: number, recent: string[] }>} */
const pools = new Map();
const inflight = new Map();

const validUrl = url => typeof url === 'string' && /^https:\/\//.test(url);

function supports(category) {
  return NEKOS_GIFS.has(category) || NEKOS_IMAGES.has(category) || WAIFU_CATEGORIES.has(category);
}

async function fetchNekos(category) {
  const data = await getJson(`${NEKOS}/${encodeURIComponent(category)}?amount=20`, { timeout: 6000 });
  return (data?.results ?? [])
    .filter(item => validUrl(item?.url))
    .map(item => ({ url: item.url, anime: item.anime_name || null, artist: item.artist_name || null, source: item.source_url || null }));
}

async function fetchWaifu(category) {
  const data = await getJson(`${WAIFU}/${encodeURIComponent(category)}`, { timeout: 6000 });
  return validUrl(data?.url) ? [{ url: data.url, anime: null, artist: null, source: null }] : [];
}

/** Fills (or refreshes) one category's pool. Never throws. */
async function load(category) {
  if (inflight.has(category)) return inflight.get(category);
  const job = (async () => {
    let items = [];
    if (NEKOS_GIFS.has(category) || NEKOS_IMAGES.has(category)) items = await fetchNekos(category).catch(() => []);
    if (!items.length && WAIFU_CATEGORIES.has(category)) items = await fetchWaifu(category).catch(() => []);
    if (items.length) {
      const previous = pools.get(category);
      const merged = new Map([...(previous?.items ?? []), ...items].map(item => [item.url, item]));
      // Keep the pool small but varied: newest 40.
      pools.set(category, { items: [...merged.values()].slice(-40), expires: Date.now() + POOL_TTL, recent: previous?.recent ?? [] });
    }
    return pools.get(category) ?? null;
  })().finally(() => inflight.delete(category));
  inflight.set(category, job);
  return job;
}

function pickFrom(pool, random = Math.random) {
  if (!pool?.items.length) return null;
  const fresh = pool.items.filter(item => !pool.recent.includes(item.url));
  const list = fresh.length ? fresh : pool.items;
  const item = list[Math.floor(random() * list.length)];
  pool.recent.push(item.url);
  while (pool.recent.length > Math.min(RECENT, pool.items.length - 1)) pool.recent.shift();
  return item;
}

/**
 * A random GIF / image of one category.
 * @returns {Promise<{ url: string, anime: string|null, artist: string|null, source: string|null } | null>}
 */
async function gif(category, random = Math.random) {
  if (!supports(category)) return null;
  let pool = pools.get(category);
  if (!pool || pool.expires < Date.now()) {
    const refreshed = await load(category);
    pool = refreshed ?? pool;
  }
  const item = pickFrom(pool, random);
  // Keep fetching more in the background once a small pool has been used up.
  if (pool && pool.items.length < 20 && pool.recent.length >= pool.items.length - 1) load(category).catch(() => null);
  return item;
}

function categoriesFor(mood) {
  return MOODS[mood] ?? (supports(mood) ? [mood] : []);
}

/** A random GIF that fits the mood, trying another category if one is down. */
async function mood(name, random = Math.random) {
  const categories = [...categoriesFor(name)].sort(() => random() - 0.5);
  for (const category of categories.slice(0, 3)) {
    const item = await gif(category, random);
    if (item) return item;
  }
  return null;
}

/**
 * Same as mood() but synchronous: answers from the warm pools only and starts
 * warming the mood in the background when nothing is cached yet. For code paths
 * that must stay synchronous (economy, casino), with a local fallback.
 */
function moodNow(name, random = Math.random) {
  const categories = [...categoriesFor(name)].sort(() => random() - 0.5);
  for (const category of categories) {
    const pool = pools.get(category);
    if (pool?.items.length) {
      if (pool.expires < Date.now()) load(category).catch(() => null);
      return pickFrom(pool, random);
    }
  }
  for (const category of categories.slice(0, 2)) load(category).catch(() => null);
  return null;
}

/** Fetches every mood's categories once, gently, so moodNow() has pictures. */
async function warm({ delayMs = 900 } = {}) {
  const all = new Set(Object.values(MOODS).flat());
  for (const category of all) {
    if (pools.get(category)?.expires > Date.now()) continue;
    await load(category);
    if (delayMs) await new Promise(resolve => setTimeout(resolve, delayMs));
  }
  return pools.size;
}

function _reset() {
  pools.clear();
  inflight.clear();
}

module.exports = { MOODS, NEKOS_GIFS, NEKOS_IMAGES, WAIFU_CATEGORIES, supports, gif, mood, moodNow, warm, _reset, NEKOS, WAIFU };
