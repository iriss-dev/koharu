'use strict';

/**
 * Small JSON HTTP client for the public APIs Koharu uses (AniList, CheapShark,
 * GamerPower, nekos.best): request timeout, one polite retry on 429/5xx that
 * honours Retry-After, and an in-memory TTL cache so autocomplete and repeated
 * lookups do not hammer free services.
 */

const USER_AGENT = 'KoharuDiscordBot/2.0 (+https://github.com/iriss-dev/koharu)';
const MAX_CACHE = 500;

class HttpError extends Error {
  constructor(status, url, body) {
    super(`HTTP ${status} for ${url}`);
    this.name = 'HttpError';
    this.status = status;
    this.body = body;
  }
}

const cache = new Map();
let fetchImpl = (...args) => globalThis.fetch(...args);

function cacheGet(key) {
  const hit = cache.get(key);
  if (!hit) return undefined;
  if (hit.expires < Date.now()) {
    cache.delete(key);
    return undefined;
  }
  // refresh LRU position
  cache.delete(key);
  cache.set(key, hit);
  return hit.value;
}

function cacheSet(key, value, ttl) {
  cache.set(key, { value, expires: Date.now() + ttl });
  while (cache.size > MAX_CACHE) cache.delete(cache.keys().next().value);
}

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

/**
 * @param {string} url
 * @param {{ method?: string, body?: any, headers?: object, timeout?: number, ttl?: number, retries?: number }} [options]
 */
async function getJson(url, { method = 'GET', body, headers = {}, timeout = 8000, ttl = 0, retries = 1 } = {}) {
  const payload = body === undefined ? undefined : (typeof body === 'string' ? body : JSON.stringify(body));
  const key = ttl > 0 ? `${method} ${url} ${payload ?? ''}` : null;
  if (key) {
    const cached = cacheGet(key);
    if (cached !== undefined) return cached;
  }

  for (let attempt = 0; ; attempt++) {
    let res;
    try {
      res = await fetchImpl(url, {
        method,
        body: payload,
        headers: {
          'User-Agent': USER_AGENT,
          Accept: 'application/json',
          ...(payload !== undefined ? { 'Content-Type': 'application/json' } : {}),
          ...headers,
        },
        signal: AbortSignal.timeout(timeout),
      });
    } catch (err) {
      if (attempt < retries) {
        await sleep(400);
        continue;
      }
      throw err;
    }

    if ((res.status === 429 || res.status >= 500) && attempt < retries) {
      const retryAfter = Number(res.headers?.get?.('retry-after'));
      await sleep(Number.isFinite(retryAfter) ? Math.min(retryAfter * 1000, 3000) : 800);
      continue;
    }

    const text = await res.text();
    let data;
    try {
      data = text ? JSON.parse(text) : null;
    } catch {
      data = text;
    }

    if (!res.ok) throw new HttpError(res.status, url, data);
    if (key) cacheSet(key, data, ttl);
    return data;
  }
}

/** Testing hook: replace fetch. Returns a function that restores the original. */
function _setFetch(fn) {
  const previous = fetchImpl;
  fetchImpl = fn;
  cache.clear();
  return () => {
    fetchImpl = previous;
    cache.clear();
  };
}

function clearCache() {
  cache.clear();
}

module.exports = { getJson, HttpError, USER_AGENT, clearCache, _setFetch };
