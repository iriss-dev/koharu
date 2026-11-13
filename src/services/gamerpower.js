'use strict';

/**
 * GamerPower (https://www.gamerpower.com/api-read): free games, in-game loot
 * and beta keys being given away across stores and platforms. Free, no key.
 */

const { getJson } = require('../core/http');

const BASE = 'https://www.gamerpower.com/api';

const PLATFORMS = [
  'pc', 'steam', 'epic-games-store', 'gog', 'itchio', 'ubisoft', 'battlenet', 'origin',
  'ps4', 'ps5', 'xbox-one', 'xbox-series-xs', 'switch', 'android', 'ios', 'vr',
];

/** "2026-11-20 23:59:00" (UTC) → unix seconds, or null for "N/A". */
function parseDate(value) {
  if (!value || value === 'N/A') return null;
  const ms = Date.parse(`${String(value).replace(' ', 'T')}Z`);
  return Number.isFinite(ms) ? Math.floor(ms / 1000) : null;
}

function normalize(raw) {
  return {
    id: String(raw.id),
    title: String(raw.title ?? '').replace(/\s+Giveaway$/i, ''),
    worth: raw.worth && raw.worth !== 'N/A' ? raw.worth : null,
    image: raw.image || raw.thumbnail || null,
    thumbnail: raw.thumbnail || raw.image || null,
    description: raw.description || '',
    instructions: raw.instructions || '',
    url: raw.open_giveaway_url || raw.gamerpower_url,
    platforms: String(raw.platforms ?? '').split(',').map(p => p.trim()).filter(Boolean),
    type: raw.type || 'Game',
    endsAt: parseDate(raw.end_date),
    publishedAt: parseDate(raw.published_date),
    users: Number(raw.users) || 0,
  };
}

/**
 * @param {{ platform?: string, type?: 'game'|'loot'|'beta', sort?: 'date'|'value'|'popularity' }} [options]
 */
async function giveaways({ platform, type = 'game', sort = 'popularity' } = {}) {
  const params = new URLSearchParams({ 'sort-by': sort });
  if (platform && platform !== 'all') params.set('platform', platform);
  if (type && type !== 'all') params.set('type', type);
  const data = await getJson(`${BASE}/giveaways?${params}`, { ttl: 20 * 60 * 1000 });
  // With no active giveaways the API answers an object with a status message.
  return (Array.isArray(data) ? data : []).map(normalize).filter(g => g.url);
}

module.exports = { BASE, PLATFORMS, giveaways, normalize, parseDate };
