'use strict';

/**
 * Renders scripts/emojis/designs.js to assets/emojis/<name>.png (128 × 128, transparent).
 *
 *   npm run emojis:render                 # PNGs only
 *   npm run emojis:render -- --sheet out.png   # also a contact sheet for review
 *
 * Needs Playwright with Chromium. It is a development tool only: the rendered
 * PNGs are committed, so running the bot never requires a browser.
 */

const fs = require('fs');
const path = require('path');
const { designs } = require('./designs');

const OUT_DIR = path.resolve(__dirname, '../../assets/emojis');

async function main() {
  let chromium;
  try {
    ({ chromium } = require('playwright'));
  } catch {
    console.error('Playwright is required: npm i -D playwright && npx playwright install chromium');
    process.exit(1);
  }

  const sheetIdx = process.argv.indexOf('--sheet');
  const sheetPath = sheetIdx > -1 ? path.resolve(process.argv[sheetIdx + 1]) : null;

  fs.mkdirSync(OUT_DIR, { recursive: true });
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 128, height: 128 }, deviceScaleFactor: 1 });

  const names = Object.keys(designs).sort();
  const markup = {};
  for (const name of names) {
    markup[name] = designs[name]();
    await page.setContent(`<html><body style="margin:0;background:transparent">${markup[name]}</body></html>`);
    const file = path.join(OUT_DIR, `${name}.png`);
    await page.locator('svg').screenshot({ path: file, omitBackground: true });
    console.log(`rendered ${name}.png (${fs.statSync(file).size} bytes)`);
  }

  if (sheetPath) {
    const cell = (name, size) => `<div class="c"><div style="width:${size}px;height:${size}px">${markup[name].replace('width="128" height="128"', `width="${size}" height="${size}"`)}</div><span>${name}</span></div>`;
    const grid = (bg, fg, size) => `<div class="g" style="background:${bg};color:${fg}">${names.map(n => cell(n, size)).join('')}</div>`;
    const sheetPage = await browser.newPage({ viewport: { width: 1100, height: 400 }, deviceScaleFactor: 2 });
    await sheetPage.setContent(`<html><head><style>
      body{margin:0;font:12px system-ui,sans-serif}
      .g{display:flex;flex-wrap:wrap;gap:10px;padding:16px}
      .c{display:flex;flex-direction:column;align-items:center;width:90px;gap:4px}
      h3{margin:0;padding:10px 16px 0;font-weight:600}
    </style></head><body>
      <h3>48 px (jumbo) · dark theme</h3>${grid('#313338', '#dbdee1', 48)}
      <h3>22 px (inline) · dark theme</h3>${grid('#313338', '#dbdee1', 22)}
      <h3>48 px · light theme</h3>${grid('#ffffff', '#313338', 48)}
    </body></html>`);
    await sheetPage.screenshot({ path: sheetPath, fullPage: true });
    console.log(`contact sheet: ${sheetPath}`);
  }

  await browser.close();
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
