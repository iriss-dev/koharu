'use strict';

/**
 * Drawing helpers for Koharu's picture cards (ship, levels, profile), built on
 * @napi-rs/canvas. The package is optional: if it is missing, `available` is
 * false and every card falls back to its text version, so the bot never breaks.
 */

const path = require('path');
const { getBuffer } = require('../core/http');

let napi = null;
try {
  napi = require('@napi-rs/canvas');
} catch {
  napi = null;
}

const FONT_DIR = path.resolve(__dirname, '../../assets/fonts');
const FONT = 'Poppins';
let fontsReady = false;

function registerFonts() {
  if (fontsReady || !napi) return;
  fontsReady = true;
  for (const file of ['Poppins-Regular.ttf', 'Poppins-Medium.ttf', 'Poppins-Bold.ttf']) {
    try {
      napi.GlobalFonts.registerFromPath(path.join(FONT_DIR, file), FONT);
    } catch {
      // A system font is used instead.
    }
  }
}

const font = (weight, size) => `${weight} ${size}px ${FONT}, "Segoe UI", "Helvetica Neue", Arial, sans-serif`;

// --------------------------------------------------------------------------- remote images

const MAX_CACHE = 40;
const cache = new Map();

/**
 * Downloads and decodes an image, with a small LRU cache. Resolves to null on
 * any failure so a card can draw a placeholder instead.
 */
async function loadRemote(url, { timeout = 5000 } = {}) {
  if (!napi || !url || !/^https?:\/\//.test(url)) return null;
  if (cache.has(url)) {
    const hit = cache.get(url);
    cache.delete(url);
    cache.set(url, hit);
    return hit;
  }
  try {
    const buffer = await getBuffer(url, { timeout });
    const image = await napi.loadImage(buffer);
    cache.set(url, image);
    while (cache.size > MAX_CACHE) cache.delete(cache.keys().next().value);
    return image;
  } catch {
    return null;
  }
}

async function loadLocal(file) {
  if (!napi) return null;
  try {
    return await napi.loadImage(file);
  } catch {
    return null;
  }
}

// --------------------------------------------------------------------------- shapes

function roundRect(ctx, x, y, w, h, r) {
  const radius = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + w, y, x + w, y + h, radius);
  ctx.arcTo(x + w, y + h, x, y + h, radius);
  ctx.arcTo(x, y + h, x, y, radius);
  ctx.arcTo(x, y, x + w, y, radius);
  ctx.closePath();
}

/** Heart path inside the box (x, y, w, h). */
function heartPath(ctx, x, y, w, h) {
  const top = h * 0.3;
  ctx.beginPath();
  ctx.moveTo(x + w / 2, y + top);
  ctx.bezierCurveTo(x + w / 2, y, x, y, x, y + top);
  ctx.bezierCurveTo(x, y + (h + top) / 2, x + w / 2, y + (h + top) / 2, x + w / 2, y + h);
  ctx.bezierCurveTo(x + w / 2, y + (h + top) / 2, x + w, y + (h + top) / 2, x + w, y + top);
  ctx.bezierCurveTo(x + w, y, x + w / 2, y, x + w / 2, y + top);
  ctx.closePath();
}

/** Four-point sparkle. */
function sparkle(ctx, cx, cy, r, color = 'rgba(255,255,255,0.9)') {
  ctx.save();
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(cx, cy - r);
  ctx.quadraticCurveTo(cx, cy, cx + r, cy);
  ctx.quadraticCurveTo(cx, cy, cx, cy + r);
  ctx.quadraticCurveTo(cx, cy, cx - r, cy);
  ctx.quadraticCurveTo(cx, cy, cx, cy - r);
  ctx.fill();
  ctx.restore();
}

/** Draws an image covering the box, cropped from the centre (slightly towards the top, where faces are). */
function drawCover(ctx, image, x, y, w, h, { focusY = 0.3 } = {}) {
  const scale = Math.max(w / image.width, h / image.height);
  const sw = w / scale;
  const sh = h / scale;
  const sx = (image.width - sw) / 2;
  const sy = Math.max(0, Math.min(image.height - sh, (image.height - sh) * focusY));
  ctx.drawImage(image, sx, sy, sw, sh, x, y, w, h);
}

/** Round avatar with a gradient ring, or a soft placeholder with the initial. */
function drawAvatar(ctx, image, cx, cy, r, { ring = ['#F472B6', '#A78BFA'], ringWidth = 8, initial = '?' } = {}) {
  ctx.save();
  ctx.shadowColor = 'rgba(0,0,0,0.35)';
  ctx.shadowBlur = 24;
  const gradient = ctx.createLinearGradient(cx - r, cy - r, cx + r, cy + r);
  ring.forEach((color, i) => gradient.addColorStop(ring.length === 1 ? 0 : i / (ring.length - 1), color));
  ctx.fillStyle = gradient;
  ctx.beginPath();
  ctx.arc(cx, cy, r + ringWidth, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.clip();
  if (image) {
    ctx.drawImage(image, cx - r, cy - r, r * 2, r * 2);
  } else {
    const soft = ctx.createLinearGradient(cx - r, cy - r, cx + r, cy + r);
    soft.addColorStop(0, '#FBCFE8');
    soft.addColorStop(1, '#DDD6FE');
    ctx.fillStyle = soft;
    ctx.fillRect(cx - r, cy - r, r * 2, r * 2);
    ctx.fillStyle = '#9D174D';
    ctx.font = font('bold', Math.round(r * 0.9));
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(String(initial).slice(0, 1).toUpperCase(), cx, cy + r * 0.05);
  }
  ctx.restore();
}

/** Shrinks the font until the text fits `maxWidth`. */
function fitText(ctx, text, { weight = 'bold', size = 40, min = 16, maxWidth }) {
  let current = size;
  ctx.font = font(weight, current);
  while (current > min && ctx.measureText(text).width > maxWidth) {
    current -= 2;
    ctx.font = font(weight, current);
  }
  let out = String(text);
  while (out.length > 1 && ctx.measureText(out).width > maxWidth) out = `${out.slice(0, -2)}…`;
  return out;
}

/** Text with a soft shadow, the default for text on pictures. */
function shadowText(ctx, text, x, y, { blur = 10, color = 'rgba(0,0,0,0.45)' } = {}) {
  ctx.save();
  ctx.shadowColor = color;
  ctx.shadowBlur = blur;
  ctx.shadowOffsetY = 2;
  ctx.fillText(text, x, y);
  ctx.restore();
}

/** Deterministic pseudo-random numbers so decorations do not jump around between renders. */
function seeded(seed) {
  let a = 0;
  for (const ch of String(seed)) a = (Math.imul(31, a) + ch.charCodeAt(0)) | 0;
  return () => {
    a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function createCanvas(w, h) {
  registerFonts();
  return napi.createCanvas(w, h);
}

module.exports = {
  get available() { return Boolean(napi); },
  createCanvas, font, loadRemote, loadLocal, roundRect, heartPath, sparkle, drawCover, drawAvatar, fitText, shadowText, seeded,
  _cache: cache,
};
