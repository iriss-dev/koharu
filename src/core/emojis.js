'use strict';

/**
 * Koharu's emoji set.
 *
 * The PNGs in assets/emojis are uploaded once as *application emojis* (owned by
 * the bot itself, not by any server), so they render in every server Koharu is
 * in without using guild emoji slots. Until the upload finishes, or if it fails,
 * every lookup falls back to a matching Unicode emoji, so messages never break.
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const ASSET_DIR = path.resolve(__dirname, '../../assets/emojis');
const PREFIX = 'kh_';

// name → Unicode fallback
const MANIFEST = Object.freeze({
  sakura: '🌸', tulip: '🌷', daisy: '🌼', heart: '💗', hearts: '💞', sparkle: '✨', star: '⭐',
  ribbon: '🎀', dress: '👗', bag: '🛍️', coin: '🪙', piggy: '🐷', key: '🔑', gift: '🎁', tag: '🏷️',
  search: '🔎', tv: '📺', book: '📖', cat: '🐱', paw: '🐾', check: '✅', cross: '❌', warn: '⚠️',
  info: 'ℹ️', help: '❓', arrow_left: '◀️', arrow_right: '▶️', clock: '⏰', crown: '👑', cards: '🃏',
  shield: '🛡️', gear: '⚙️', palette: '🎨', strawberry: '🍓', moon: '🌙', gamepad: '🎮', wand: '🪄',
  fire: '🔥', bell: '🔔', calendar: '📅', chat: '💬', link: '🔗', shuffle: '🔀', trophy: '🏆',
  coffee: '☕', slot: '🎰',
});

/** @type {Map<string, { id: string, name: string, animated: boolean }>} */
const resolved = new Map();

function has(name) {
  return Object.prototype.hasOwnProperty.call(MANIFEST, name);
}

/** Inline emoji for message text: `<:kh_sakura:123>` or the Unicode fallback. */
function e(name) {
  const hit = resolved.get(name);
  if (hit) return `<${hit.animated ? 'a' : ''}:${hit.name}:${hit.id}>`;
  return has(name) ? MANIFEST[name] : name;
}

/** Emoji for buttons and select options. */
function component(name) {
  const hit = resolved.get(name);
  if (hit) return { id: hit.id, name: hit.name, animated: hit.animated };
  return { name: has(name) ? MANIFEST[name] : '🌸' };
}

/** Public CDN image URL of a synced emoji (used for small icons), or null. */
function imageUrl(name) {
  const hit = resolved.get(name);
  return hit ? `https://cdn.discordapp.com/emojis/${hit.id}.png?size=96` : null;
}

function fileFor(name) {
  return path.join(ASSET_DIR, `${name}.png`);
}

function hashFile(file) {
  return crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex').slice(0, 16);
}

function readState(stateFile) {
  try {
    return JSON.parse(fs.readFileSync(stateFile, 'utf8'));
  } catch {
    return {};
  }
}

function writeState(stateFile, state) {
  try {
    fs.mkdirSync(path.dirname(stateFile), { recursive: true });
    fs.writeFileSync(stateFile, JSON.stringify(state, null, 2));
  } catch (err) {
    console.warn('[Emojis] Could not persist emoji state:', err.message);
  }
}

/**
 * Makes sure every emoji in the manifest exists as an application emoji.
 * Uploads missing ones and re-uploads any whose artwork changed since the last run.
 *
 * @param {import('discord.js').Client} client
 * @param {{ stateFile: string, log?: (msg: string) => void }} options
 */
async function sync(client, { stateFile, log = console.log } = {}) {
  if (!client.application) return { uploaded: 0, kept: 0, failed: 0 };
  await client.application.fetch().catch(() => null);

  const manager = client.application.emojis;
  const existing = await manager.fetch();
  const state = readState(stateFile);
  const result = { uploaded: 0, kept: 0, failed: 0 };

  for (const name of Object.keys(MANIFEST)) {
    const file = fileFor(name);
    if (!fs.existsSync(file)) continue;

    const appName = `${PREFIX}${name}`;
    const hash = hashFile(file);
    let current = existing.find(emoji => emoji.name === appName);

    if (current && state[name] && state[name] !== hash) {
      // Artwork changed: replace the uploaded emoji.
      await manager.delete(current.id).catch(() => null);
      current = null;
    }

    if (!current) {
      try {
        current = await manager.create({ attachment: file, name: appName });
        result.uploaded += 1;
      } catch (err) {
        result.failed += 1;
        console.warn(`[Emojis] Could not upload ${appName}: ${err.message}`);
        continue;
      }
    } else {
      result.kept += 1;
    }

    state[name] = hash;
    resolved.set(name, { id: current.id, name: current.name, animated: Boolean(current.animated) });
  }

  writeState(stateFile, state);
  log(`[Emojis] ${resolved.size}/${Object.keys(MANIFEST).length} ready (${result.uploaded} uploaded, ${result.kept} reused, ${result.failed} failed).`);
  return result;
}

/** Testing hook: pretend an emoji was synced. */
function _setResolved(name, value) {
  if (value) resolved.set(name, value);
  else resolved.delete(name);
}

module.exports = { MANIFEST, PREFIX, e, component, imageUrl, sync, fileFor, has, _setResolved };
