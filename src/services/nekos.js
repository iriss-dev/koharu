'use strict';

/**
 * nekos.best v2 (https://docs.nekos.best): free SFW anime reaction GIFs, no key.
 */

const { getJson } = require('../core/http');

const BASE = 'https://nekos.best/api/v2';

/** @returns {Promise<{ url: string, anime: string|null } | null>} */
async function gif(category) {
  try {
    const data = await getJson(`${BASE}/${encodeURIComponent(category)}`, { timeout: 5000 });
    const result = data?.results?.[0];
    if (!result?.url || !/^https:\/\//.test(result.url)) return null;
    return { url: result.url, anime: result.anime_name || null };
  } catch {
    return null; // the reaction still works without a GIF
  }
}

module.exports = { gif, BASE };
