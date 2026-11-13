'use strict';

/**
 * Component routing.
 *
 * Every button, select menu and modal Koharu sends carries a custom ID of the form
 *   kh:<feature>:<action>:<owner>:<arg>:<arg>…
 * where <owner> is the user allowed to press it (or `*` for anyone). Features
 * register one handler; ownership is checked here once instead of in every file.
 *
 * Long state (search results, pagination) lives in a short-lived session store and
 * only its 6-character ID travels in the custom ID, which Discord caps at 100 chars.
 */

const crypto = require('crypto');

const PREFIX = 'kh';
const MAX_ID = 100;
const handlers = new Map();

function encode(feature, action, owner = '*', ...args) {
  const parts = [PREFIX, feature, action, owner || '*', ...args.map(a => String(a ?? ''))];
  for (const part of parts) {
    if (part.includes(':')) throw new Error(`custom ID part may not contain ":" (${part})`);
  }
  const id = parts.join(':');
  if (id.length > MAX_ID) throw new Error(`custom ID too long (${id.length}): ${id}`);
  return id;
}

function decode(customId) {
  if (typeof customId !== 'string') return null;
  const parts = customId.split(':');
  if (parts[0] !== PREFIX || parts.length < 4) return null;
  const [, feature, action, owner, ...args] = parts;
  return { feature, action, owner, args };
}

/**
 * @param {string} feature
 * @param {(interaction: any, route: { action: string, owner: string, args: string[] }, ctx: any) => Promise<any>} handler
 */
function register(feature, handler) {
  if (handlers.has(feature)) throw new Error(`router: feature "${feature}" registered twice`);
  handlers.set(feature, handler);
}

function handlerFor(feature) {
  return handlers.get(feature);
}

function isOwner(route, userId) {
  return route.owner === '*' || route.owner === userId;
}

// ---------------------------------------------------------------------------
// Sessions

const DEFAULT_TTL = 15 * 60 * 1000;
const MAX_SESSIONS = 5000;
const sessions = new Map();

function createSession(data, ttl = DEFAULT_TTL) {
  let id;
  do {
    id = crypto.randomBytes(5).toString('base64url').slice(0, 6).replace(/[-_]/g, 'x');
  } while (sessions.has(id));
  sessions.set(id, { data, expires: Date.now() + ttl });
  if (sessions.size > MAX_SESSIONS) sessions.delete(sessions.keys().next().value);
  return id;
}

function getSession(id) {
  const entry = sessions.get(id);
  if (!entry) return null;
  if (entry.expires < Date.now()) {
    sessions.delete(id);
    return null;
  }
  return entry.data;
}

function updateSession(id, data) {
  const entry = sessions.get(id);
  if (entry) entry.data = data;
}

function deleteSession(id) {
  sessions.delete(id);
}

const sweeper = setInterval(() => {
  const now = Date.now();
  for (const [id, entry] of sessions) if (entry.expires < now) sessions.delete(id);
}, 60_000);
sweeper.unref();

module.exports = {
  encode, decode, register, handlerFor, isOwner,
  createSession, getSession, updateSession, deleteSession,
  _handlers: handlers,
};
