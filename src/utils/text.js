'use strict';

/** Text helpers shared by every feature. */

function truncate(value, max) {
  const text = String(value ?? '');
  if (text.length <= max) return text;
  const cut = text.slice(0, max - 1);
  const boundary = Math.max(cut.lastIndexOf('. '), cut.lastIndexOf('\n'));
  return (boundary > max * 0.6 ? cut.slice(0, boundary + 1) : cut.trimEnd()) + '…';
}

const ENTITIES = {
  '&amp;': '&', '&lt;': '<', '&gt;': '>', '&quot;': '"', '&#039;': "'", '&#39;': "'", '&apos;': "'",
  '&nbsp;': ' ', '&mdash;': '—', '&ndash;': '–', '&hellip;': '…', '&rsquo;': '’', '&lsquo;': '‘',
  '&ldquo;': '“', '&rdquo;': '”',
};

function decodeEntities(text) {
  return text
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(Number.parseInt(code, 16)))
    .replace(/&[a-z#0-9]+;/gi, match => ENTITIES[match] ?? match);
}

/**
 * AniList descriptions are HTML with AniList spoiler markup (~!text!~).
 * Converts them to Discord markdown, keeping spoilers hidden behind ||…||.
 */
function anilistToMarkdown(html) {
  if (!html) return '';
  let text = String(html)
    .replace(/\r/g, '')
    .replace(/<(i|em|b|strong)>\s*<\/\1>/gi, '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/?(i|em)>/gi, '*')
    .replace(/<\/?(b|strong)>/gi, '**')
    .replace(/<[^>]+>/g, '');
  text = decodeEntities(text)
    .replace(/~!([\s\S]*?)!~/g, (_, inner) => `||${inner.trim()}||`)
    .replace(/\(Source:[^)]*\)/gi, '')
    .replace(/\[Written by MAL Rewrite\]/gi, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
  return text;
}

/** Escapes Discord markdown so user input is shown literally. */
function escapeMarkdown(text) {
  return String(text ?? '').replace(/([\\*_`~|>#\-[\]()])/g, '\\$1');
}

/** Removes mass mentions and mention syntax from user-provided text. */
function stripMentions(text) {
  return String(text ?? '')
    .replace(/@(everyone|here)/gi, '@​$1')
    .replace(/<(@[!&]?|#)(\d+)>/g, '`$1$2`');
}

/** User text that will be displayed back: no pings, no markdown tricks, one line. */
function cleanUserText(text, max = 200) {
  return truncate(stripMentions(escapeMarkdown(String(text ?? '').replace(/\s+/g, ' ').trim())), max);
}

function formatNumber(locale, value) {
  return Number(value ?? 0).toLocaleString(locale === 'es' ? 'es-ES' : 'en-US');
}

function formatMoney(locale, value, currency = 'USD') {
  return new Intl.NumberFormat(locale === 'es' ? 'es-ES' : 'en-US', { style: 'currency', currency }).format(Number(value));
}

/** Discord timestamp markup, rendered in each viewer's own timezone. */
const ts = (unixSeconds, style = 'R') => `<t:${Math.floor(unixSeconds)}:${style}>`;

function chunk(list, size) {
  const out = [];
  for (let i = 0; i < list.length; i += size) out.push(list.slice(i, i + size));
  return out;
}

/** Deterministic PRNG (mulberry32) so "show another" buttons can carry a seed. */
function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6D2B79F5) >>> 0;
    let x = a;
    x = Math.imul(x ^ (x >>> 15), x | 1);
    x ^= x + Math.imul(x ^ (x >>> 7), x | 61);
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
  };
}

const randomSeed = () => Math.floor(Math.random() * 2 ** 31);
const pickOne = (list, random = Math.random) => list[Math.floor(random() * list.length)];

/** Accent-insensitive lowercase key for search. */
function fold(text) {
  return String(text ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
}

module.exports = {
  truncate, decodeEntities, anilistToMarkdown, escapeMarkdown, stripMentions, cleanUserText,
  formatNumber, formatMoney, ts, chunk, rng, randomSeed, pickOne, fold,
};
