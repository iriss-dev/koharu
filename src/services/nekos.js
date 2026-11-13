'use strict';

/**
 * nekos.best v2 (https://docs.nekos.best): free SFW anime reaction GIFs, no key.
 * Kept for compatibility; the pooling and fallbacks live in services/kawaii.js.
 */

const kawaii = require('./kawaii');

const BASE = kawaii.NEKOS;

/** @returns {Promise<{ url: string, anime: string|null } | null>} */
async function gif(category) {
  try {
    const item = await kawaii.gif(category);
    return item ? { url: item.url, anime: item.anime } : null;
  } catch {
    return null; // the reaction still works without a GIF
  }
}

module.exports = { gif, BASE };
