'use strict';

/**
 * Colour utilities: hex parsing, blending, HSL harmonies and perceptual naming
 * (nearest named colour in CIELAB), used by custom roles and the fashion module.
 */

const HEX_REGEX = /^#?([0-9a-fA-F]{6})$/;
const SHORT_HEX = /^#?([0-9a-fA-F]{3})$/;

function isValidHex(input) {
  if (!input || typeof input !== 'string') return false;
  return HEX_REGEX.test(input.trim());
}

function normalizeHex(input) {
  const raw = String(input).trim().replace(/^#/, '');
  const full = raw.length === 3 ? raw.split('').map(c => c + c).join('') : raw;
  return `#${full.toUpperCase()}`;
}

function hexToRgb(hex) {
  const num = Number.parseInt(normalizeHex(hex).slice(1), 16);
  return { r: (num >> 16) & 255, g: (num >> 8) & 255, b: num & 255 };
}

function rgbToHex(r, g, b) {
  const clamp = v => Math.max(0, Math.min(255, Math.round(v)));
  const toHex = v => clamp(v).toString(16).padStart(2, '0').toUpperCase();
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

function blendColors(hex1, hex2, t = 0.5) {
  const a = hexToRgb(hex1);
  const b = hexToRgb(hex2);
  return rgbToHex(a.r + (b.r - a.r) * t, a.g + (b.g - a.g) * t, a.b + (b.b - a.b) * t);
}

function getDualColorPreview(hex1, hex2 = null) {
  if (!hex2) return `\`${normalizeHex(hex1)}\``;
  return `\`${normalizeHex(hex1)}\` ➔ \`${blendColors(hex1, hex2, 0.5)}\` ➔ \`${normalizeHex(hex2)}\``;
}

// --------------------------------------------------------------------------- HSL

function rgbToHsl({ r, g, b }) {
  const rn = r / 255, gn = g / 255, bn = b / 255;
  const max = Math.max(rn, gn, bn), min = Math.min(rn, gn, bn);
  const l = (max + min) / 2;
  if (max === min) return { h: 0, s: 0, l: l * 100 };
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h;
  if (max === rn) h = (gn - bn) / d + (gn < bn ? 6 : 0);
  else if (max === gn) h = (bn - rn) / d + 2;
  else h = (rn - gn) / d + 4;
  return { h: h * 60, s: s * 100, l: l * 100 };
}

function hslToRgb({ h, s, l }) {
  const hn = (((h % 360) + 360) % 360) / 360, sn = s / 100, ln = l / 100;
  if (sn === 0) return { r: ln * 255, g: ln * 255, b: ln * 255 };
  const q = ln < 0.5 ? ln * (1 + sn) : ln + sn - ln * sn;
  const p = 2 * ln - q;
  const channel = t => {
    let x = t;
    if (x < 0) x += 1;
    if (x > 1) x -= 1;
    if (x < 1 / 6) return p + (q - p) * 6 * x;
    if (x < 1 / 2) return q;
    if (x < 2 / 3) return p + (q - p) * (2 / 3 - x) * 6;
    return p;
  };
  return { r: channel(hn + 1 / 3) * 255, g: channel(hn) * 255, b: channel(hn - 1 / 3) * 255 };
}

const hexToHsl = hex => rgbToHsl(hexToRgb(hex));
const hslToHex = hsl => {
  const { r, g, b } = hslToRgb(hsl);
  return rgbToHex(r, g, b);
};

function rotate(hex, degrees) {
  const hsl = hexToHsl(hex);
  return hslToHex({ ...hsl, h: hsl.h + degrees });
}

function withLightness(hex, l) {
  const hsl = hexToHsl(hex);
  return hslToHex({ ...hsl, l: Math.max(4, Math.min(96, l)) });
}

/**
 * Five shades of one hue, dark to light, always including the base. Very light
 * or very dark bases spread to one side so no two shades collapse together.
 */
function monochrome(base, l) {
  const offsets = l > 78 ? [-60, -45, -30, -15] : l < 22 ? [15, 30, 45, 60] : [-30, -15, 15, 30];
  const shades = offsets.map(offset => ({ l: l + offset, hex: withLightness(base, l + offset) }));
  return [...shades, { l, hex: base }].sort((a, b) => a.l - b.l).map(shade => shade.hex);
}

/** Classic colour-wheel harmonies for a base colour. */
function harmonies(hex) {
  const base = normalizeHex(hex);
  const { l } = hexToHsl(base);
  return {
    complementary: [base, rotate(base, 180)],
    analogous: [rotate(base, -30), base, rotate(base, 30)],
    triadic: [base, rotate(base, 120), rotate(base, 240)],
    split: [base, rotate(base, 150), rotate(base, 210)],
    monochrome: monochrome(base, l),
  };
}

/** Warm, cool or neutral, from hue and saturation. */
function temperature(hex) {
  const { h, s, l } = hexToHsl(hex);
  if (s < 12 || l < 6 || l > 97) return 'neutral';
  // In fashion colour theory fuchsias and magentas read cool, corals and peaches warm.
  if (h < 70 || h >= 345) return 'warm';
  if (h >= 160) return 'cool';
  return 'neutral';
}

// --------------------------------------------------------------------------- CIELAB naming

function srgbToLinear(c) {
  const v = c / 255;
  return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
}

function rgbToLab({ r, g, b }) {
  const R = srgbToLinear(r), G = srgbToLinear(g), B = srgbToLinear(b);
  const x = (R * 0.4124 + G * 0.3576 + B * 0.1805) / 0.95047;
  const y = (R * 0.2126 + G * 0.7152 + B * 0.0722) / 1.0;
  const z = (R * 0.0193 + G * 0.1192 + B * 0.9505) / 1.08883;
  const f = v => (v > 0.008856 ? Math.cbrt(v) : 7.787 * v + 16 / 116);
  return { L: 116 * f(y) - 16, a: 500 * (f(x) - f(y)), b: 200 * (f(y) - f(z)) };
}

function deltaE(hexA, hexB) {
  const a = rgbToLab(hexToRgb(hexA));
  const b = rgbToLab(hexToRgb(hexB));
  return Math.hypot(a.L - b.L, a.a - b.a, a.b - b.b);
}

// Fashion-friendly colour names.
const NAMED = [
  ['#FFFFFF', 'blanco', 'white'], ['#F5F0E6', 'crema', 'cream'], ['#F5E6CC', 'beige', 'beige'],
  ['#E8D3B9', 'nude', 'nude'], ['#C8A27A', 'camel', 'camel'], ['#8B5E3C', 'café', 'brown'],
  ['#5C4033', 'chocolate', 'chocolate'], ['#000000', 'negro', 'black'], ['#2B2B2B', 'carbón', 'charcoal'],
  ['#808080', 'gris', 'grey'], ['#C0C0C0', 'gris perla', 'pearl grey'], ['#FFC0CB', 'rosa', 'pink'],
  ['#FFD1DC', 'rosa pastel', 'pastel pink'], ['#F472B6', 'rosa chicle', 'bubblegum pink'],
  ['#FF1493', 'fucsia', 'fuchsia'], ['#E0B0B6', 'rosa empolvado', 'dusty rose'], ['#FF7F7F', 'coral', 'coral'],
  ['#FFCBA4', 'durazno', 'peach'], ['#FF0000', 'rojo', 'red'], ['#C1121F', 'rojo cereza', 'cherry red'],
  ['#800020', 'burdeos', 'burgundy'], ['#722F37', 'vino', 'wine'], ['#FFA500', 'naranja', 'orange'],
  ['#E2725B', 'terracota', 'terracotta'], ['#B7410E', 'óxido', 'rust'], ['#FFD700', 'dorado', 'gold'],
  ['#FFF44F', 'amarillo limón', 'lemon yellow'], ['#FFE8A3', 'amarillo mantequilla', 'butter yellow'],
  ['#E1AD01', 'mostaza', 'mustard'], ['#98FF98', 'verde menta', 'mint green'], ['#B2AC88', 'verde salvia', 'sage green'],
  ['#808000', 'verde oliva', 'olive'], ['#2E8B57', 'verde esmeralda', 'emerald'], ['#355E3B', 'verde bosque', 'forest green'],
  ['#40E0D0', 'turquesa', 'turquoise'], ['#87CEEB', 'celeste', 'sky blue'], ['#AEC6CF', 'azul pastel', 'pastel blue'],
  ['#4169E1', 'azul rey', 'royal blue'], ['#0047AB', 'azul cobalto', 'cobalt blue'], ['#1F2A44', 'azul marino', 'navy'],
  ['#5D8AA8', 'azul denim', 'denim blue'], ['#E6E6FA', 'lavanda', 'lavender'], ['#C8A2C8', 'lila', 'lilac'],
  ['#A78BFA', 'lila pastel', 'pastel lilac'], ['#800080', 'morado', 'purple'], ['#4B0082', 'índigo', 'indigo'],
  ['#673147', 'ciruela', 'plum'], ['#B5838D', 'malva', 'mauve'], ['#C0C0C1', 'plateado', 'silver'],
];

const NAME_INDEX = new Map();
for (const [hex, es, en] of NAMED) {
  NAME_INDEX.set(es.normalize('NFD').replace(/[̀-ͯ]/g, ''), hex);
  NAME_INDEX.set(en, hex);
}
// Extra spellings people type.
for (const [alias, hex] of [['rosado', '#FFC0CB'], ['marron', '#8B5E3C'], ['marrón', '#8B5E3C'], ['violeta', '#8F00FF'], ['purpura', '#800080'], ['azul', '#1E5AA8'], ['verde', '#2E8B57'], ['amarillo', '#FFE135'], ['gray', '#808080'], ['blue', '#1E5AA8'], ['green', '#2E8B57'], ['yellow', '#FFE135'], ['brown', '#8B5E3C'], ['menta', '#98FF98'], ['salvia', '#B2AC88'], ['oliva', '#808000'], ['marino', '#1F2A44']]) {
  NAME_INDEX.set(alias.normalize('NFD').replace(/[̀-ͯ]/g, ''), hex);
}

/** Accepts "#F472B6", "f472b6", "#fab", or a colour name in Spanish or English. */
function parseColor(input) {
  if (!input) return null;
  const raw = String(input).trim();
  if (HEX_REGEX.test(raw) || SHORT_HEX.test(raw)) return normalizeHex(raw);
  const key = raw.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  return NAME_INDEX.get(key) ?? null;
}

/** Closest named colour, e.g. { name: 'rosa chicle', hex: '#F472B6' }. */
function nearestName(hex, locale = 'es') {
  let best = null;
  for (const [candidate, es, en] of NAMED) {
    const distance = deltaE(hex, candidate);
    if (!best || distance < best.distance) best = { hex: candidate, name: locale === 'es' ? es : en, distance };
  }
  return best;
}

function colorNames(locale = 'es') {
  return NAMED.map(([hex, es, en]) => ({ hex, name: locale === 'es' ? es : en }));
}

module.exports = {
  isValidHex, normalizeHex, hexToRgb, rgbToHex, blendColors, getDualColorPreview,
  rgbToHsl, hslToRgb, hexToHsl, hslToHex, rotate, withLightness, harmonies, temperature,
  rgbToLab, deltaE, parseColor, nearestName, colorNames,
};
