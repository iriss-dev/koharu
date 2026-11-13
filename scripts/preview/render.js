'use strict';

/**
 * Renders real Koharu payloads in a Discord-like page and screenshots them, to
 * review layout without a live server.
 *
 *   npm run preview            → docs/preview/*.png
 *
 * It runs the actual commands with the fake Discord objects and API fixtures
 * from the test suite. Remote images (covers, GIFs) are drawn as placeholders
 * because previews run offline; local attachments and emojis are real.
 */

process.env.DATABASE_PATH = ':memory:';
process.env.EMOJI_SYNC = 'false';

const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const ROOT = path.resolve(__dirname, '../..');
const OUT = path.join(ROOT, 'docs/preview');

const emojis = require(path.join(ROOT, 'src/core/emojis'));
// Pretend every emoji is synced so previews show Koharu's own artwork.
Object.keys(emojis.MANIFEST).forEach((name, i) => emojis._setResolved(name, { id: String(9000 + i), name: `kh_${name}`, animated: false }));
const emojiFile = new Map(Object.keys(emojis.MANIFEST).map((name, i) => [String(9000 + i), emojis.fileFor(name)]));

const http = require(path.join(ROOT, 'src/core/http'));
const { handleInteraction } = require(path.join(ROOT, 'src/core/dispatch'));
const { world, slash } = require(path.join(ROOT, 'test/helpers/fake'));
const { mockFetch } = require(path.join(ROOT, 'test/fixtures/apis'));
require(path.join(ROOT, 'src/core/cooldowns')).setEnabled(false);

const dataUri = file => `data:image/png;base64,${fs.readFileSync(file).toString('base64')}`;
const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

function relative(unix) {
  const diff = unix - Date.now() / 1000;
  const abs = Math.abs(diff);
  const unit = abs >= 86400 ? [Math.round(abs / 86400), 'días'] : abs >= 3600 ? [Math.round(abs / 3600), 'horas'] : [Math.max(1, Math.round(abs / 60)), 'minutos'];
  return diff >= 0 ? `en ${unit[0]} ${unit[1]}` : `hace ${unit[0]} ${unit[1]}`;
}

/** Minimal Discord markdown → HTML. */
function markdown(src) {
  const lines = String(src).split('\n');
  const out = [];
  for (const raw of lines) {
    let line = raw;
    let cls = '';
    if (line.startsWith('### ')) { cls = 'h3'; line = line.slice(4); }
    else if (line.startsWith('## ')) { cls = 'h2'; line = line.slice(3); }
    else if (line.startsWith('-# ')) { cls = 'sub'; line = line.slice(3); }
    let quote = false;
    if (line.startsWith('> ')) { quote = true; line = line.slice(2); }
    let html = esc(line)
      .replace(/&lt;a?:(\w+):(\d+)&gt;/g, (_, name, id) => (emojiFile.has(id) ? `<img class="emoji" src="${dataUri(emojiFile.get(id))}">` : `:${name}:`))
      .replace(/&lt;t:(\d+):([tTdDfFR])&gt;/g, (_, t, style) => `<span class="ts">${style === 'R' ? relative(Number(t)) : new Date(Number(t) * 1000).toLocaleString('es-ES', { dateStyle: style === 't' ? undefined : 'medium', timeStyle: 'short' })}</span>`)
      .replace(/&lt;@&amp;(\d+)&gt;/g, '<span class="mention">@rol</span>')
      .replace(/&lt;@!?(\d+)&gt;/g, (_, id) => `<span class="mention">@${id.startsWith('1111') ? 'Iris' : id.startsWith('2222') ? 'Yuki' : 'usuario'}</span>`)
      .replace(/&lt;#(\w+)&gt;/g, '<span class="mention">#general</span>')
      .replace(/`([^`]+)`/g, '<code>$1</code>')
      .replace(/\*\*([^*]+)\*\*/g, '<b>$1</b>')
      .replace(/~~([^~]+)~~/g, '<s>$1</s>')
      .replace(/\|\|([^|]+)\|\|/g, '<span class="spoiler">$1</span>')
      .replace(/(^|[^*\\])\*([^*]+)\*/g, '$1<i>$2</i>')
      .replace(/\[([^\]]+)\]\((https?:[^)]+)\)/g, '<a>$1</a>')
      .replace(/\\([\\*_`~|>#\-[\]()])/g, '$1');
    if (cls) html = `<div class="${cls}">${html}</div>`;
    out.push(quote ? `<div class="quote">${html || '&nbsp;'}</div>` : (html || '<div class="gap"></div>'));
  }
  return out.map(l => (l.startsWith('<div') ? l : `<div>${l}</div>`)).join('');
}

function media(url, files, cls) {
  if (url.startsWith('attachment://')) {
    const file = files.find(f => (f.name ?? f.attachment?.name) === url.slice(13));
    const source = file?.attachment;
    const buffer = Buffer.isBuffer(source) ? source : typeof source === 'string' ? fs.readFileSync(source) : null;
    if (buffer) return `<img class="${cls}" src="data:image/png;base64,${buffer.toString('base64')}">`;
  }
  const label = /\.gif$/.test(url) ? 'GIF de anime' : /avatar/.test(url) ? 'avatar' : 'imagen';
  return `<div class="${cls} ph"><span>${label}</span></div>`;
}

function emojiHtml(emoji) {
  if (!emoji) return '';
  if (emoji.id && emojiFile.has(emoji.id)) return `<img class="bemoji" src="${dataUri(emojiFile.get(emoji.id))}">`;
  return `<span>${esc(emoji.name ?? '')}</span>`;
}

function renderNode(node, files) {
  switch (node.type) {
    case 17: {
      const accent = node.accent_color != null ? `#${node.accent_color.toString(16).padStart(6, '0')}` : 'transparent';
      return `<div class="container" style="--accent:${accent}">${node.components.map(c => renderNode(c, files)).join('')}</div>`;
    }
    case 10: return `<div class="text">${markdown(node.content)}</div>`;
    case 14: return `<div class="separator ${node.divider ? 'divider' : ''} ${node.spacing === 2 ? 'large' : ''}"></div>`;
    case 9: {
      const accessory = node.accessory.type === 11 ? media(node.accessory.media.url, files, 'thumb') : renderNode(node.accessory, files);
      return `<div class="section"><div class="stext">${node.components.map(c => renderNode(c, files)).join('')}</div>${accessory}</div>`;
    }
    case 12: return `<div class="gallery">${node.items.map(item => media(item.media.url, files, 'gimg')).join('')}</div>`;
    case 1: return `<div class="row">${node.components.map(c => renderNode(c, files)).join('')}</div>`;
    case 2: {
      const style = { 1: 'primary', 2: 'secondary', 3: 'success', 4: 'danger', 5: 'secondary' }[node.style];
      return `<div class="btn ${style} ${node.disabled ? 'disabled' : ''}">${emojiHtml(node.emoji)}${node.label ? `<span>${esc(node.label)}</span>` : ''}${node.style === 5 ? '<span class="ext">↗</span>' : ''}</div>`;
    }
    case 3: return `<div class="select"><span>${esc(node.placeholder ?? node.options?.[0]?.label ?? '')}</span><span class="chev">⌄</span></div>`;
    default: return '';
  }
}

const CSS = `
  body { margin: 0; background: #313338; font: 15px/1.375 "Noto Sans", "DejaVu Sans", system-ui, sans-serif; color: #dbdee1; }
  .msg { display: flex; gap: 16px; padding: 16px 20px 20px; width: 640px; }
  .avatar { width: 40px; height: 40px; border-radius: 50%; background: #f472b6 url(AVATAR) center/70% no-repeat; flex: none; }
  .head { margin-bottom: 4px; } .name { color: #f9a8d4; font-weight: 600; } .tag { background: #5865f2; color: #fff; font-size: 10px; padding: 1px 4px; border-radius: 3px; margin-left: 4px; vertical-align: 2px; font-weight: 600; } .time { color: #949ba4; font-size: 12px; margin-left: 6px; }
  .container { background: #2b2d31; border-radius: 8px; border-left: 4px solid var(--accent); padding: 16px; display: flex; flex-direction: column; gap: 8px; max-width: 560px; }
  .text { word-wrap: break-word; } .h2 { font-size: 24px; font-weight: 700; line-height: 1.3; } .h3 { font-size: 18px; font-weight: 700; color: #f2f3f5; } .sub { font-size: 12.5px; color: #949ba4; }
  .quote { border-left: 4px solid #4e5058; padding-left: 12px; } .gap { height: 6px; }
  b { color: #f2f3f5; } a { color: #00a8fc; } code { background: #1e1f22; border-radius: 4px; padding: 0 4px; font-size: 13px; }
  .spoiler { background: #1e1f22; color: transparent; border-radius: 3px; } .ts { background: rgba(255,255,255,.06); border-radius: 3px; padding: 0 2px; }
  .mention { background: rgba(88,101,242,.3); color: #c9cdfb; border-radius: 3px; padding: 0 2px; font-weight: 500; }
  .emoji { width: 22px; height: 22px; vertical-align: -5px; } .h3 .emoji { width: 24px; height: 24px; } .h2 .emoji { width: 32px; height: 32px; vertical-align: -7px; }
  .separator { height: 4px; } .separator.divider { height: 1px; background: #3f4147; margin: 4px 0; } .separator.large { margin: 8px 0; }
  .section { display: flex; gap: 12px; align-items: flex-start; } .stext { flex: 1; display: flex; flex-direction: column; gap: 6px; }
  .thumb { width: 85px; height: 85px; border-radius: 8px; object-fit: cover; flex: none; }
  .gallery { display: flex; gap: 4px; } .gimg { width: 100%; max-height: 300px; border-radius: 8px; object-fit: cover; }
  .ph { display: flex; align-items: center; justify-content: center; background: linear-gradient(135deg, #3b3d44, #4a3c52); color: #b5bac1; font-size: 12px; min-height: 85px; }
  .gallery .ph { height: 180px; }
  .row { display: flex; flex-wrap: wrap; gap: 8px; }
  .btn { display: inline-flex; align-items: center; gap: 6px; height: 32px; padding: 0 14px; border-radius: 8px; font-size: 14px; font-weight: 500; color: #fff; }
  .btn.primary { background: #5865f2; } .btn.secondary { background: #4e5058; } .btn.success { background: #248046; } .btn.danger { background: #da373c; } .btn.disabled { opacity: .5; }
  .bemoji { width: 20px; height: 20px; } .ext { opacity: .8; font-size: 12px; }
  .select { flex: 1; display: flex; justify-content: space-between; align-items: center; height: 40px; padding: 0 12px; border-radius: 8px; background: #1e1f22; border: 1px solid #1e1f22; color: #949ba4; }
`;

async function screenshot(page, payload, file) {
  const avatar = dataUri(emojis.fileFor('sakura'));
  const body = payload.components.map(c => (typeof c.toJSON === 'function' ? c.toJSON() : c)).map(c => renderNode(c, payload.files ?? [])).join('');
  await page.setContent(`<html><head><style>${CSS.replace('AVATAR', avatar)}</style></head><body><div class="msg"><div class="avatar"></div><div><div class="head"><span class="name">Koharu</span><span class="tag">APP</span><span class="time">hoy a las 18:30</span></div>${body}</div></div></body></html>`);
  await page.locator('.msg').screenshot({ path: file });
}

const SHOTS = [
  ['help', { commandName: 'help' }],
  ['anime', { commandName: 'anime', sub: 'search', options: { title: 'id:154587' } }],
  ['anime-season', { commandName: 'anime', sub: 'season', options: { season: 'FALL', year: 2023 } }],
  ['outfit', { commandName: 'fashion', sub: 'outfit', options: { occasion: 'date', weather: 'mild', style: 'coquette' } }],
  ['style', { commandName: 'fashion', sub: 'style', options: { name: 'kawaii' } }],
  ['colors', { commandName: 'fashion', sub: 'colors', options: { color: 'lavanda' } }],
  ['season', { commandName: 'fashion', sub: 'season', options: { undertone: 'warm', hair: 'dark', eyes: 'dark' } }],
  ['deals', { commandName: 'deals', sub: 'games' }],
  ['free-games', { commandName: 'deals', sub: 'free' }],
  ['hug', { commandName: 'interact', options: { action: 'hug' } }],
  ['balance', { commandName: 'balance' }],
  ['blackjack', { commandName: 'blackjack', options: { bet: 250 } }],
  ['profile', { commandName: 'profile' }],
  ['search', { commandName: 'search', options: { query: 'frieren' } }],
];

async function main() {
  fs.mkdirSync(OUT, { recursive: true });
  const restore = http._setFetch(mockFetch());
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 700, height: 400 }, deviceScaleFactor: 2 });
  const only = process.argv.slice(2);

  for (const [name, spec] of SHOTS) {
    if (only.length && !only.includes(name)) continue;
    const w = world();
    require(path.join(ROOT, 'src/database/db')).addCoins(w.guild.id, w.iris.id, 12_500);
    if (spec.commandName === 'interact') spec.options.user = w.yuki;
    if (spec.commandName === 'profile') {
      const db = require(path.join(ROOT, 'src/database/db'));
      db.setBio(w.iris.id, 'Amo el matcha, el shoujo y los lazos rosas 🎀');
      db.setStyle(w.iris.id, 'coquette');
      db.toggleFavorite(w.iris.id, { id: 154587, type: 'ANIME', title: "Frieren: Beyond Journey's End" });
    }
    const interaction = slash(w, spec);
    await handleInteraction(interaction);
    const payload = interaction.replies.at(-1);
    await screenshot(page, payload, path.join(OUT, `${name}.png`));
    console.log(`preview: docs/preview/${name}.png`);
  }
  await browser.close();
  restore();
  process.exit(0);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
