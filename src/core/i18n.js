'use strict';

/**
 * Tiny bilingual (es / en) string table.
 *
 * Each feature registers its own namespace next to its code:
 *   i18n.register('anime', { es: { title: '...' }, en: { title: '...' } })
 * and looks strings up with t(locale, 'anime.title', { vars }).
 *
 * Strings may contain `{name}` variables and `{e:sakura}` emoji tokens, which
 * resolve to Koharu's application emojis (or their Unicode fallback).
 */

const emojis = require('./emojis');

const LOCALES = ['es', 'en'];
const tables = { es: {}, en: {} };

function register(namespace, strings) {
  for (const locale of LOCALES) {
    if (!strings[locale]) throw new Error(`i18n: namespace "${namespace}" is missing locale "${locale}"`);
    tables[locale][namespace] = strings[locale];
  }
}

function lookup(locale, key) {
  let node = tables[locale];
  for (const part of key.split('.')) {
    if (node == null || typeof node !== 'object') return undefined;
    node = node[part];
  }
  return node;
}

function format(template, vars = {}) {
  return template
    .replace(/\{e:([a-z_]+)\}/g, (_, name) => emojis.e(name))
    .replace(/\{(\w+)\}/g, (match, name) => (vars[name] !== undefined && vars[name] !== null ? String(vars[name]) : match));
}

/**
 * Translate a key. Arrays (e.g. random flavour lines) are returned as arrays of
 * formatted strings; missing keys fall back to English, then to the key itself.
 */
function t(locale, key, vars) {
  const value = lookup(locale, key) ?? lookup('en', key);
  if (value === undefined) return key;
  if (Array.isArray(value)) return value.map(item => (typeof item === 'string' ? format(item, vars) : item));
  if (typeof value === 'string') return format(value, vars);
  return value;
}

function normalize(locale) {
  if (!locale) return null;
  const lower = String(locale).toLowerCase();
  if (lower.startsWith('es')) return 'es';
  if (lower.startsWith('en')) return 'en';
  return null;
}

/**
 * Picks the language for a reply. A language chosen by the server admins wins
 * (messages are public), then the user's Discord language, then the server's
 * community locale, then the configured default.
 */
function resolve({ guildSetting, userLocale, guildLocale, fallback = 'es' } = {}) {
  return normalize(guildSetting) || normalize(userLocale) || normalize(guildLocale) || fallback;
}

/** Bilingual literal picked by locale: pick(locale, { es: '…', en: '…' }). */
function pick(locale, pair) {
  if (pair == null || typeof pair !== 'object') return pair;
  return pair[locale] ?? pair.en ?? pair.es;
}

/** Discord localisation map for a Spanish string (both Spanish locales). */
function esLocalizations(es) {
  return { 'es-ES': es, 'es-419': es };
}

module.exports = { LOCALES, register, t, format, normalize, resolve, pick, esLocalizations, _tables: tables };
