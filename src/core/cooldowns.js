'use strict';

/** Per-user, per-command cooldowns kept in memory. */

const last = new Map();
let enabled = true;

/** Tests turn cooldowns off so commands can run back to back. */
function setEnabled(value) {
  enabled = Boolean(value);
}

/**
 * @returns {number} 0 when allowed (and records the use), otherwise the unix second when it frees up.
 */
function hit(key, userId, seconds, now = Date.now()) {
  if (!seconds || !enabled) return 0;
  const id = `${key}:${userId}`;
  const previous = last.get(id) ?? 0;
  const readyAt = previous + seconds * 1000;
  if (readyAt > now) return Math.ceil(readyAt / 1000);
  last.set(id, now);
  return 0;
}

const sweeper = setInterval(() => {
  const cutoff = Date.now() - 60 * 60 * 1000;
  for (const [id, at] of last) if (at < cutoff) last.delete(id);
}, 10 * 60 * 1000);
sweeper.unref();

module.exports = { hit, setEnabled };
