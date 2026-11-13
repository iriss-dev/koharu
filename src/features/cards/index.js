'use strict';

/**
 * Picture cards drawn on the fly:
 *   ship  · two avatars, a heart that fills up to the percentage, anime background
 *   rank  · avatar, level, rank and a glossy progress bar over an anime background
 *
 * Every render returns a PNG Buffer, or null when the canvas package is not
 * installed (the commands then show their text version).
 */

const path = require('path');
const kawaii = require('../../services/kawaii');
const cv = require('../../utils/canvas');

const PINK = '#F472B6';
const ROSE = '#EC4899';
const LAVENDER = '#A78BFA';
const SKY = '#7DD3FC';
const LOCAL_BG = path.resolve(__dirname, '../../../assets/yui.png');

/** A random cute anime picture (neko / waifu / kitsune) for the background, or the local one. */
async function animeBackground(kinds = ['waifu', 'neko', 'kitsune']) {
  const kind = kinds[Math.floor(Math.random() * kinds.length)];
  const item = await kawaii.gif(kind).catch(() => null);
  const image = item ? await cv.loadRemote(item.url, { timeout: 6000 }) : null;
  return image ?? cv.loadLocal(LOCAL_BG);
}

function withFilter(ctx, filter, draw) {
  ctx.save();
  try {
    ctx.filter = filter;
  } catch {
    // Older canvas builds without filters: draw without blur.
  }
  draw();
  ctx.restore();
}

/** Anime picture, blurred and tinted so text stays readable. */
function paintBackground(ctx, w, h, image, { tint = ['rgba(46,16,64,0.72)', 'rgba(236,72,153,0.45)'], blur = 6 } = {}) {
  const base = ctx.createLinearGradient(0, 0, w, h);
  base.addColorStop(0, '#FBCFE8');
  base.addColorStop(0.5, '#F5D0FE');
  base.addColorStop(1, '#C7D2FE');
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, w, h);
  if (image) {
    withFilter(ctx, `blur(${blur}px)`, () => cv.drawCover(ctx, image, -20, -20, w + 40, h + 40));
  }
  const overlay = ctx.createLinearGradient(0, 0, w, h);
  overlay.addColorStop(0, tint[0]);
  overlay.addColorStop(1, tint[1]);
  ctx.fillStyle = overlay;
  ctx.fillRect(0, 0, w, h);
}

/**
 * Scattered sparkles and tiny hearts, kept out of the `avoid` boxes ([x, y, w, h]) where text and avatars live.
 */
function decorate(ctx, w, h, seed, { count = 14, hearts = true, avoid = [] } = {}) {
  const random = cv.seeded(seed);
  const blocked = (x, y) => avoid.some(([ax, ay, aw, ah]) => x > ax - 20 && x < ax + aw + 20 && y > ay - 20 && y < ay + ah + 20);
  for (let i = 0, tries = 0; i < count && tries < count * 20; tries++) {
    const x = random() * w;
    const y = random() * h;
    const size = 6 + random() * 14;
    if (blocked(x, y)) continue;
    i++;
    if (hearts && i % 3 === 0) {
      ctx.save();
      ctx.globalAlpha = 0.25 + random() * 0.35;
      ctx.fillStyle = i % 2 ? '#FFFFFF' : '#FBCFE8';
      cv.heartPath(ctx, x, y, size * 1.6, size * 1.5);
      ctx.fill();
      ctx.restore();
    } else {
      cv.sparkle(ctx, x, y, size * 0.7, `rgba(255,255,255,${0.35 + random() * 0.5})`);
    }
  }
}

// --------------------------------------------------------------------------- ship

/**
 * @param {{ a: { name: string, avatar: string|null }, b: { name: string, avatar: string|null }, percent: number, seed?: string }} data
 */
async function renderShip({ a, b, percent, seed = '' }) {
  if (!cv.available) return null;
  const W = 1000;
  const H = 420;
  const [avatarA, avatarB, bg] = await Promise.all([cv.loadRemote(a.avatar), cv.loadRemote(b.avatar), animeBackground()]);
  const canvas = cv.createCanvas(W, H);
  const ctx = canvas.getContext('2d');

  paintBackground(ctx, W, H, bg, { tint: ['rgba(80,20,70,0.62)', 'rgba(236,72,153,0.50)'], blur: 8 });
  decorate(ctx, W, H, `ship:${seed}`, { count: 22, avoid: [[70, 70, 240, 240], [690, 70, 240, 240], [350, 50, 300, 320], [80, 330, 220, 50], [700, 330, 220, 50]] });

  // Dotted line joining the two avatars through the heart.
  ctx.save();
  ctx.strokeStyle = 'rgba(255,255,255,0.55)';
  ctx.lineWidth = 4;
  ctx.setLineDash([2, 14]);
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(320, 190);
  ctx.lineTo(680, 190);
  ctx.stroke();
  ctx.restore();

  cv.drawAvatar(ctx, avatarA, 190, 190, 112, { initial: a.name, ring: ['#FFFFFF', '#FBCFE8'] });
  cv.drawAvatar(ctx, avatarB, 810, 190, 112, { initial: b.name, ring: ['#FFFFFF', '#DDD6FE'] });

  // Names under the avatars.
  ctx.fillStyle = '#FFFFFF';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  for (const [person, x] of [[a, 190], [b, 810]]) {
    const label = cv.fitText(ctx, person.name, { weight: '600', size: 30, min: 18, maxWidth: 290 });
    cv.shadowText(ctx, label, x, 365);
  }

  // The heart, filled from the bottom up to the percentage.
  const hw = 270;
  const hh = 250;
  const hx = (W - hw) / 2;
  const hy = 62;
  ctx.save();
  ctx.shadowColor = percent >= 50 ? 'rgba(244,114,182,0.9)' : 'rgba(167,139,250,0.7)';
  ctx.shadowBlur = 40;
  cv.heartPath(ctx, hx, hy, hw, hh);
  ctx.fillStyle = 'rgba(255,255,255,0.22)';
  ctx.fill();
  ctx.restore();

  ctx.save();
  cv.heartPath(ctx, hx, hy, hw, hh);
  ctx.clip();
  const level = hy + hh - (hh * Math.max(0, Math.min(100, percent))) / 100;
  const fill = ctx.createLinearGradient(0, hy, 0, hy + hh);
  fill.addColorStop(0, '#FF8FC7');
  fill.addColorStop(1, ROSE);
  ctx.fillStyle = fill;
  // A gentle wave on the surface of the "liquid".
  ctx.beginPath();
  ctx.moveTo(hx, level);
  for (let x = 0; x <= hw; x += 10) ctx.lineTo(hx + x, level + Math.sin(x / 22) * 6);
  ctx.lineTo(hx + hw, hy + hh);
  ctx.lineTo(hx, hy + hh);
  ctx.closePath();
  ctx.fill();
  // Shine.
  ctx.fillStyle = 'rgba(255,255,255,0.35)';
  ctx.beginPath();
  ctx.ellipse(hx + hw * 0.3, hy + hh * 0.25, 34, 20, -0.6, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  cv.heartPath(ctx, hx, hy, hw, hh);
  ctx.lineWidth = 7;
  ctx.strokeStyle = '#FFFFFF';
  ctx.stroke();

  // Low scores get a little crack down the middle.
  if (percent < 30) {
    ctx.save();
    ctx.strokeStyle = '#FFFFFF';
    ctx.lineWidth = 6;
    ctx.lineJoin = 'round';
    ctx.beginPath();
    const cx = W / 2;
    ctx.moveTo(cx, hy + hh * 0.3);
    ctx.lineTo(cx - 16, hy + hh * 0.42);
    ctx.lineTo(cx + 12, hy + hh * 0.5);
    ctx.lineTo(cx - 10, hy + hh * 0.62);
    ctx.lineTo(cx + 8, hy + hh * 0.74);
    ctx.lineTo(cx, hy + hh * 0.86);
    ctx.globalAlpha = 0.85;
    ctx.stroke();
    ctx.restore();
  }

  // Percentage in the middle of the heart.
  ctx.fillStyle = '#FFFFFF';
  ctx.textAlign = 'center';
  ctx.font = cv.font('bold', 74);
  cv.shadowText(ctx, `${percent}%`, W / 2, hy + hh * 0.56, { blur: 14, color: 'rgba(120,10,70,0.6)' });

  // Little hearts row under the big heart.
  const filled = Math.round(percent / 10);
  for (let i = 0; i < 10; i++) {
    const x = W / 2 - 5 * 26 + i * 26;
    ctx.save();
    ctx.fillStyle = i < filled ? '#FF6FB5' : 'rgba(255,255,255,0.75)';
    ctx.shadowColor = 'rgba(0,0,0,0.25)';
    ctx.shadowBlur = 6;
    cv.heartPath(ctx, x, 340, 20, 19);
    ctx.fill();
    ctx.restore();
  }

  return canvas.toBuffer('image/png');
}

// --------------------------------------------------------------------------- rank / level

/**
 * @param {object} data
 * @param {string} data.name
 * @param {string} data.username
 * @param {string|null} data.avatar
 * @param {number} data.level
 * @param {number} data.current XP inside the level
 * @param {number} data.needed XP for the next level
 * @param {number|null} data.rank
 * @param {number} data.messages
 * @param {{ level: string, rank: string, messages: string, levelUp?: string }} data.labels
 * @param {string} [data.accent] member colour for the ring
 * @param {boolean} [data.celebrate] level-up variant with confetti and a ribbon
 * @param {(n: number) => string} [data.format]
 */
async function renderRank(data) {
  if (!cv.available) return null;
  const W = 1000;
  const H = 320;
  const format = data.format ?? (n => String(n));
  const [avatar, bg] = await Promise.all([cv.loadRemote(data.avatar), animeBackground()]);
  const canvas = cv.createCanvas(W, H);
  const ctx = canvas.getContext('2d');

  // Rounded outer card.
  ctx.save();
  cv.roundRect(ctx, 0, 0, W, H, 34);
  ctx.clip();
  paintBackground(ctx, W, H, bg, { tint: ['rgba(30,12,48,0.78)', 'rgba(167,139,250,0.40)'], blur: 5 });
  decorate(ctx, W, H, `rank:${data.username}:${data.level}`, { count: data.celebrate ? 26 : 14, hearts: true, avoid: [[50, 50, 230, 230], [290, 50, 420, 100], [290, 175, 670, 110], [620, 50, 340, 70]] });

  // Glass panel.
  ctx.save();
  cv.roundRect(ctx, 22, 22, W - 44, H - 44, 28);
  ctx.fillStyle = 'rgba(255,255,255,0.08)';
  ctx.fill();
  ctx.lineWidth = 2;
  ctx.strokeStyle = 'rgba(255,255,255,0.22)';
  ctx.stroke();
  ctx.restore();

  if (data.celebrate) {
    const random = cv.seeded(`confetti:${data.username}:${data.level}`);
    const colors = [PINK, LAVENDER, SKY, '#FDE68A', '#FFFFFF'];
    const keepClear = [[60, 50, 210, 220], [290, 60, 300, 90], [290, 180, 670, 110]];
    for (let i = 0; i < 70; i++) {
      const x = random() * W;
      const y = random() * H;
      if (keepClear.some(([ax, ay, aw, ah]) => x > ax && x < ax + aw && y > ay && y < ay + ah)) continue;
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(random() * Math.PI);
      ctx.fillStyle = colors[i % colors.length];
      ctx.globalAlpha = 0.55 + random() * 0.4;
      ctx.fillRect(-5, -2.5, 10, 5);
      ctx.restore();
    }
  }

  // Avatar with a level badge.
  const ring = data.accent && data.accent !== '#000000' ? [data.accent, LAVENDER] : [PINK, LAVENDER, SKY];
  cv.drawAvatar(ctx, avatar, 160, 160, 100, { initial: data.name, ring, ringWidth: 9 });
  ctx.save();
  ctx.shadowColor = 'rgba(0,0,0,0.4)';
  ctx.shadowBlur = 12;
  const badge = ctx.createLinearGradient(208, 200, 268, 260);
  badge.addColorStop(0, PINK);
  badge.addColorStop(1, LAVENDER);
  ctx.fillStyle = badge;
  ctx.beginPath();
  ctx.arc(238, 232, 34, 0, Math.PI * 2);
  ctx.fill();
  ctx.lineWidth = 5;
  ctx.strokeStyle = '#FFFFFF';
  ctx.stroke();
  ctx.restore();
  ctx.fillStyle = '#FFFFFF';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = cv.font('bold', data.level >= 100 ? 22 : 28);
  ctx.fillText(String(data.level), 238, 234);

  // Name and @username.
  const left = 300;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = '#FFFFFF';
  const name = cv.fitText(ctx, data.name, { weight: 'bold', size: 44, min: 22, maxWidth: 400 });
  cv.shadowText(ctx, name, left, 102);
  ctx.font = cv.font('500', 22);
  ctx.fillStyle = 'rgba(255,255,255,0.75)';
  ctx.fillText(`@${data.username}`, left, 136);

  // Level and rank pills on the right.
  const pill = (label, value, right, color) => {
    ctx.font = cv.font('bold', 34);
    const valueWidth = ctx.measureText(value).width;
    ctx.font = cv.font('500', 18);
    const labelWidth = ctx.measureText(label).width;
    const w = valueWidth + labelWidth + 48;
    const x = right - w;
    ctx.save();
    cv.roundRect(ctx, x, 58, w, 56, 28);
    ctx.fillStyle = 'rgba(255,255,255,0.14)';
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = color;
    ctx.stroke();
    ctx.restore();
    ctx.fillStyle = 'rgba(255,255,255,0.8)';
    ctx.font = cv.font('500', 18);
    ctx.fillText(label, x + 20, 93);
    ctx.fillStyle = '#FFFFFF';
    ctx.font = cv.font('bold', 34);
    ctx.fillText(value, x + 28 + labelWidth, 98);
    return x;
  };
  let edge = W - 50;
  edge = pill(data.labels.level, String(data.level), edge, PINK) - 12;
  if (data.rank) pill(data.labels.rank, `#${data.rank}`, edge, SKY);

  if (data.celebrate && data.labels.levelUp) {
    ctx.save();
    ctx.font = cv.font('bold', 30);
    ctx.textAlign = 'right';
    const ribbon = ctx.createLinearGradient(W - 400, 0, W - 50, 0);
    ribbon.addColorStop(0, '#FDE68A');
    ribbon.addColorStop(1, '#FBCFE8');
    ctx.fillStyle = ribbon;
    cv.shadowText(ctx, data.labels.levelUp, W - 52, 152, { blur: 12, color: 'rgba(0,0,0,0.5)' });
    ctx.restore();
  }

  // Progress bar.
  const barX = left;
  const barY = 186;
  const barW = W - left - 52;
  const barH = 38;
  const ratio = Math.max(0, Math.min(1, data.current / Math.max(1, data.needed)));
  ctx.save();
  cv.roundRect(ctx, barX, barY, barW, barH, barH / 2);
  ctx.fillStyle = 'rgba(255,255,255,0.18)';
  ctx.fill();
  ctx.restore();
  if (ratio > 0) {
    const fillW = Math.max(barH, barW * ratio);
    ctx.save();
    ctx.shadowColor = 'rgba(244,114,182,0.8)';
    ctx.shadowBlur = 18;
    cv.roundRect(ctx, barX, barY, fillW, barH, barH / 2);
    const g = ctx.createLinearGradient(barX, 0, barX + barW, 0);
    g.addColorStop(0, PINK);
    g.addColorStop(0.55, LAVENDER);
    g.addColorStop(1, SKY);
    ctx.fillStyle = g;
    ctx.fill();
    ctx.restore();
    // Gloss and a little heart riding the end of the bar.
    ctx.save();
    cv.roundRect(ctx, barX + 6, barY + 5, Math.max(0, fillW - 12), barH / 3, barH / 6);
    ctx.fillStyle = 'rgba(255,255,255,0.35)';
    ctx.fill();
    ctx.restore();
    ctx.save();
    ctx.fillStyle = '#FFFFFF';
    ctx.shadowColor = 'rgba(0,0,0,0.3)';
    ctx.shadowBlur = 6;
    cv.heartPath(ctx, barX + fillW - 30, barY + 8, 24, 22);
    ctx.fill();
    ctx.restore();
  }

  // XP and messages.
  ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = '#FFFFFF';
  ctx.font = cv.font('bold', 22);
  ctx.textAlign = 'left';
  cv.shadowText(ctx, `${format(data.current)} / ${format(data.needed)} XP`, barX + 4, barY + barH + 34, { blur: 6 });
  ctx.textAlign = 'right';
  cv.shadowText(ctx, `${Math.floor(ratio * 100)}%`, barX + barW - 4, barY + barH + 34, { blur: 6 });
  ctx.font = cv.font('500', 18);
  ctx.fillStyle = 'rgba(255,255,255,0.75)';
  ctx.textAlign = 'left';
  ctx.fillText(`${data.labels.messages}: ${format(data.messages)}`, barX + 4, barY + barH + 62);

  ctx.restore();
  return canvas.toBuffer('image/png');
}

// --------------------------------------------------------------------------- profile

/**
 * Profile banner: a clear anime picture on top, the avatar overlapping it, name,
 * stat chips, the level bar and, for married people, the partner's avatar.
 * @param {object} data
 * @param {string} data.name
 * @param {string} data.username
 * @param {string|null} data.avatar
 * @param {Array<{ label: string, value: string, color?: string }>} data.stats up to 4 chips
 * @param {{ level: number, current: number, needed: number }} data.level
 * @param {{ name: string, avatar: string|null, label: string }|null} [data.partner]
 * @param {string} [data.accent]
 * @param {string} data.levelLabel
 */
async function renderProfile(data) {
  if (!cv.available) return null;
  const W = 1000;
  const H = 470;
  const BANNER = 190;
  const [avatar, partnerAvatar, bg] = await Promise.all([
    cv.loadRemote(data.avatar),
    data.partner ? cv.loadRemote(data.partner.avatar) : null,
    animeBackground(),
  ]);
  const canvas = cv.createCanvas(W, H);
  const ctx = canvas.getContext('2d');

  ctx.save();
  cv.roundRect(ctx, 0, 0, W, H, 34);
  ctx.clip();

  // Lower part: soft dark glass over the same picture, blurred.
  paintBackground(ctx, W, H, bg, { tint: ['rgba(30,12,48,0.86)', 'rgba(76,29,149,0.70)'], blur: 14 });

  // Banner: the picture itself, sharp, with a fade into the lower part.
  ctx.save();
  ctx.beginPath();
  ctx.rect(0, 0, W, BANNER);
  ctx.clip();
  if (bg) cv.drawCover(ctx, bg, 0, 0, W, BANNER, { focusY: 0.25 });
  const fade = ctx.createLinearGradient(0, BANNER * 0.45, 0, BANNER);
  fade.addColorStop(0, 'rgba(30,12,48,0)');
  fade.addColorStop(1, 'rgba(30,12,48,0.85)');
  ctx.fillStyle = fade;
  ctx.fillRect(0, 0, W, BANNER);
  ctx.restore();
  decorate(ctx, W, BANNER, `profile:${data.username}`, { count: 10, avoid: [[40, 90, 220, 120]] });

  // Avatar overlapping the banner.
  const ring = data.accent && data.accent !== '#000000' ? [data.accent, LAVENDER] : [PINK, LAVENDER, SKY];
  cv.drawAvatar(ctx, avatar, 150, BANNER + 10, 92, { initial: data.name, ring, ringWidth: 9 });

  // Name.
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = '#FFFFFF';
  const name = cv.fitText(ctx, data.name, { weight: 'bold', size: 42, min: 22, maxWidth: data.partner ? 430 : 620 });
  cv.shadowText(ctx, name, 270, BANNER + 52);
  ctx.font = cv.font('500', 21);
  ctx.fillStyle = 'rgba(255,255,255,0.72)';
  ctx.fillText(`@${data.username}`, 272, BANNER + 84);

  // Partner bubble on the right.
  if (data.partner) {
    const px = W - 110;
    const py = BANNER + 40;
    cv.drawAvatar(ctx, partnerAvatar, px, py, 44, { initial: data.partner.name, ring: ['#FFFFFF', '#FBCFE8'], ringWidth: 5 });
    ctx.save();
    ctx.fillStyle = '#FF6FB5';
    ctx.shadowColor = 'rgba(0,0,0,0.35)';
    ctx.shadowBlur = 8;
    cv.heartPath(ctx, px - 92, py - 16, 34, 32);
    ctx.fill();
    ctx.restore();
    ctx.textAlign = 'right';
    ctx.font = cv.font('500', 17);
    ctx.fillStyle = 'rgba(255,255,255,0.8)';
    ctx.fillText(data.partner.label, px - 100, py - 2);
    ctx.font = cv.font('bold', 20);
    ctx.fillStyle = '#FFFFFF';
    ctx.fillText(cv.fitText(ctx, data.partner.name, { weight: 'bold', size: 20, min: 14, maxWidth: 170 }), px - 100, py + 22);
    ctx.textAlign = 'left';
  }

  // Stat chips.
  const chips = (data.stats ?? []).slice(0, 4);
  const chipY = BANNER + 118;
  const chipW = (W - 80 - (chips.length - 1) * 16) / Math.max(chips.length, 1);
  chips.forEach((chip, i) => {
    const x = 40 + i * (chipW + 16);
    ctx.save();
    cv.roundRect(ctx, x, chipY, chipW, 66, 20);
    ctx.fillStyle = 'rgba(255,255,255,0.10)';
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = chip.color ?? 'rgba(255,255,255,0.25)';
    ctx.stroke();
    ctx.restore();
    ctx.fillStyle = 'rgba(255,255,255,0.7)';
    ctx.font = cv.font('500', 16);
    ctx.fillText(chip.label, x + 18, chipY + 25);
    ctx.fillStyle = '#FFFFFF';
    ctx.fillText(cv.fitText(ctx, chip.value, { weight: 'bold', size: 24, min: 14, maxWidth: chipW - 36 }), x + 18, chipY + 54);
  });

  // Level bar along the bottom.
  const barX = 40;
  const barY = H - 46;
  const barW = W - 80;
  const barH = 18;
  const ratio = Math.max(0, Math.min(1, data.level.current / Math.max(1, data.level.needed)));
  ctx.fillStyle = 'rgba(255,255,255,0.8)';
  ctx.font = cv.font('bold', 16);
  ctx.fillText(`${data.levelLabel} ${data.level.level}`, barX, barY - 10);
  ctx.textAlign = 'right';
  ctx.fillText(`${Math.floor(ratio * 100)}%`, barX + barW, barY - 10);
  ctx.textAlign = 'left';
  ctx.save();
  cv.roundRect(ctx, barX, barY, barW, barH, barH / 2);
  ctx.fillStyle = 'rgba(255,255,255,0.18)';
  ctx.fill();
  if (ratio > 0) {
    cv.roundRect(ctx, barX, barY, Math.max(barH, barW * ratio), barH, barH / 2);
    const g = ctx.createLinearGradient(barX, 0, barX + barW, 0);
    g.addColorStop(0, PINK);
    g.addColorStop(0.55, LAVENDER);
    g.addColorStop(1, SKY);
    ctx.fillStyle = g;
    ctx.shadowColor = 'rgba(244,114,182,0.8)';
    ctx.shadowBlur = 12;
    ctx.fill();
  }
  ctx.restore();

  ctx.restore();
  return canvas.toBuffer('image/png');
}

module.exports = { renderShip, renderRank, renderProfile, animeBackground };
