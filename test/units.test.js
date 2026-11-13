'use strict';

process.env.DATABASE_PATH = ':memory:';

const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const zlib = require('zlib');

const router = require('../src/core/router');
const args = require('../src/core/args');
const text = require('../src/utils/text');
const colors = require('../src/utils/colors');
const png = require('../src/utils/png');
const fashion = require('../src/features/fashion');
const gamerpower = require('../src/services/gamerpower');
const cheapshark = require('../src/services/cheapshark');
const http = require('../src/core/http');
const { splitCommand } = require('../src/core/dispatch');
const fixtures = require('./fixtures/apis');

describe('router', () => {
  test('encodes and decodes custom IDs', () => {
    const id = router.encode('anime', 'page', '123', 'abc', 2);
    assert.equal(id, 'kh:anime:page:123:abc:2');
    assert.deepEqual(router.decode(id), { feature: 'anime', action: 'page', owner: '123', args: ['abc', '2'] });
    assert.equal(router.decode('something_else'), null);
  });

  test('rejects IDs Discord would refuse', () => {
    assert.throws(() => router.encode('x', 'y', '*', 'a'.repeat(100)), /too long/);
    assert.throws(() => router.encode('x', 'y', '*', 'a:b'), /may not contain/);
  });

  test('ownership', () => {
    assert.ok(router.isOwner({ owner: '*' }, 'anyone'));
    assert.ok(router.isOwner({ owner: '1' }, '1'));
    assert.ok(!router.isOwner({ owner: '1' }, '2'));
  });

  test('sessions expire', () => {
    const id = router.createSession({ a: 1 }, -1);
    assert.equal(router.getSession(id), null);
    const live = router.createSession({ b: 2 });
    assert.deepEqual(router.getSession(live), { b: 2 });
    assert.match(live, /^[A-Za-z0-9]{6}$/);
  });
});

describe('prefix arguments', () => {
  test('amounts', () => {
    assert.equal(args.amount('1500'), 1500);
    assert.equal(args.amount('2.5k'), 2500);
    assert.equal(args.amount('1m'), 1_000_000);
    assert.equal(args.amount('todo'), 'all');
    assert.equal(args.amount('mitad'), 'half');
    assert.equal(args.amount('-5'), null);
    assert.equal(args.amount('abc'), null);
    assert.equal(args.resolveAmount('half', 101), 50);
  });

  test('mentions and IDs', () => {
    assert.equal(args.userId('<@!123456789012345678>'), '123456789012345678');
    assert.equal(args.userId('123456789012345678'), '123456789012345678');
    assert.equal(args.userId('@someone'), null);
  });

  test('prefix and mention parsing', () => {
    assert.deepEqual(splitCommand('-Abrazo @yuki', '-', '999'), { name: 'abrazo', args: ['@yuki'], viaMention: false });
    assert.deepEqual(splitCommand('<@999> anime frieren', '-', '999'), { name: 'anime', args: ['frieren'], viaMention: true });
    assert.equal(splitCommand('hola', '-', '999'), null);
  });
});

describe('text', () => {
  test('AniList HTML becomes Discord markdown with spoilers', () => {
    const md = text.anilistToMarkdown('<b>Bold</b> and <i>soft</i><br>~!secret!~ &amp; more<br><br><br>end (Source: X)');
    assert.equal(md, '**Bold** and *soft*\n||secret|| & more\n\nend');
  });

  test('user text cannot ping or inject markdown', () => {
    const cleaned = text.cleanUserText('@everyone <@123> **hi**');
    assert.ok(!cleaned.includes('@everyone'));
    assert.ok(!/<@123>/.test(cleaned));
    assert.ok(cleaned.includes('\\*\\*hi\\*\\*'));
  });

  test('truncate prefers sentence boundaries', () => {
    assert.equal(text.truncate('Hello there friend. Bye now my friend.', 25), 'Hello there friend.…');
    assert.equal(text.truncate('One. Two three four five six seven.', 20), 'One. Two three four…');
    assert.equal(text.truncate('short', 10), 'short');
    assert.ok(text.truncate('x'.repeat(50), 10).length <= 10);
  });

  test('seeded random is deterministic', () => {
    const a = text.rng(42);
    const b = text.rng(42);
    assert.deepEqual([a(), a(), a()], [b(), b(), b()]);
  });
});

describe('colours', () => {
  test('parses codes and names in both languages', () => {
    assert.equal(colors.parseColor('#f472b6'), '#F472B6');
    assert.equal(colors.parseColor('fab'), '#FFAABB');
    assert.equal(colors.parseColor('Lavanda'), '#E6E6FA');
    assert.equal(colors.parseColor('sage green'), '#B2AC88');
    assert.equal(colors.parseColor('marrón'), '#8B5E3C');
    assert.equal(colors.parseColor('unicorn'), null);
  });

  test('harmonies and HSL round-trip', () => {
    const h = colors.harmonies('#FF0000');
    assert.equal(h.complementary[1], '#00FFFF');
    assert.equal(h.triadic.length, 3);
    assert.equal(colors.hslToHex(colors.hexToHsl('#A78BFA')), '#A78BFA');
  });

  test('monochrome always gives five distinct shades, dark to light', () => {
    for (const hex of ['#000000', '#FFFFFF', '#E6E6FA', '#F472B6', '#1F2A44', '#808000']) {
      const shades = colors.harmonies(hex).monochrome;
      assert.equal(new Set(shades).size, 5, hex);
      assert.ok(shades.includes(colors.normalizeHex(hex)), `${hex} keeps the base colour`);
      const lightness = shades.map(s => colors.hexToHsl(s).l);
      assert.deepEqual([...lightness].sort((a, b) => a - b), lightness, `${hex} is ordered`);
    }
  });

  test('nearest colour name uses perceptual distance', () => {
    assert.equal(colors.nearestName('#F472B6', 'es').name, 'rosa chicle');
    assert.equal(colors.nearestName('#1E2B45', 'en').name, 'navy');
  });

  test('temperature', () => {
    assert.equal(colors.temperature('#E2725B'), 'warm');
    assert.equal(colors.temperature('#1F2A44'), 'cool');
    assert.equal(colors.temperature('#808080'), 'neutral');
  });
});

describe('png', () => {
  test('produces a valid PNG with the requested size', () => {
    const buffer = png.swatchRows([['#F472B6', '#A78BFA'], ['#34D399']], { width: 200, rowHeight: 40, gap: 10, padding: 10 });
    assert.deepEqual([...buffer.subarray(0, 8)], [0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]);
    const width = buffer.readUInt32BE(16);
    const height = buffer.readUInt32BE(20);
    assert.deepEqual([width, height], [200, 10 * 2 + 40 * 2 + 10]);
    // IDAT inflates to (width * 4 + 1) * height bytes.
    const idatStart = buffer.indexOf('IDAT') + 4;
    const idatLength = buffer.readUInt32BE(idatStart - 8);
    const raw = zlib.inflateSync(buffer.subarray(idatStart, idatStart + idatLength));
    assert.equal(raw.length, (width * 4 + 1) * height);
  });

  test('CRC32 matches the reference value', () => {
    assert.equal(png.crc32(Buffer.from('123456789')), 0xCBF43926);
  });
});

describe('fashion', () => {
  const { OCCASIONS, WEATHER, STYLES } = fashion.data;

  test('every style × occasion × weather produces a complete outfit', () => {
    for (const style of [null, ...Object.keys(STYLES)]) {
      for (const occasion of Object.keys(OCCASIONS)) {
        for (const weather of Object.keys(WEATHER)) {
          const outfit = fashion.generateOutfit({ occasion, weather, style, seed: 7 });
          const p = outfit.pieces;
          assert.ok(p.shoes && p.bag && p.accessories.length >= 1, `${style}/${occasion}/${weather}`);
          assert.ok(p.dress || (p.top && p.bottom), `${style}/${occasion}/${weather} has no main piece`);
          if (weather === 'cold' || weather === 'rain') {
            if (occasion !== 'beach') assert.ok(p.outer, `${occasion}/${weather} needs a layer`);
          }
          if (occasion === 'beach') assert.ok(!p.outer);
        }
      }
    }
  });

  test('a random style always fits the occasion when one exists', () => {
    for (const occasion of Object.keys(OCCASIONS)) {
      for (const weather of Object.keys(WEATHER)) {
        if (!fashion.stylesFor(occasion, weather).length) continue;
        for (let seed = 1; seed < 20; seed++) {
          assert.equal(fashion.generateOutfit({ occasion, weather, seed }).relaxed, false, `${occasion}/${weather}/${seed}`);
        }
      }
    }
  });

  test('outfits are reproducible from their seed', () => {
    const a = fashion.generateOutfit({ occasion: 'date', weather: 'mild', seed: 99 });
    const b = fashion.generateOutfit({ occasion: 'date', weather: 'mild', seed: 99 });
    assert.deepEqual(a, b);
  });

  test('seasonal colour analysis', () => {
    assert.equal(fashion.colorSeason({ undertone: 'warm', hair: 'light', eyes: 'light' }).season, 'spring');
    assert.equal(fashion.colorSeason({ undertone: 'warm', hair: 'dark', eyes: 'dark' }).season, 'autumn');
    assert.equal(fashion.colorSeason({ undertone: 'cool', hair: 'light', eyes: 'light' }).season, 'summer');
    assert.equal(fashion.colorSeason({ undertone: 'cool', hair: 'dark', eyes: 'light' }).season, 'winter');
    assert.ok(fashion.colorSeason({ undertone: 'neutral', hair: 'medium', eyes: 'light' }).alt);
  });

  test('shop links are encoded searches', () => {
    const links = fashion.shopLinks('falda plisada & lazo');
    assert.ok(links.every(link => link.url.startsWith('https://')));
    assert.ok(links.some(link => link.url.includes('falda%20plisada%20%26%20lazo')));
  });
});

describe('services', () => {
  test('GamerPower: dates, "N/A" and the no-results object', async () => {
    assert.equal(gamerpower.parseDate('2026-11-20 23:59:00'), Date.UTC(2026, 10, 20, 23, 59) / 1000);
    assert.equal(gamerpower.parseDate('N/A'), null);
    const restore = http._setFetch(fixtures.mockFetch());
    try {
      assert.deepEqual(await gamerpower.giveaways({ platform: 'vr' }), []);
      const list = await gamerpower.giveaways({});
      assert.equal(list[0].title, 'Free Game 1');
      assert.equal(list[0].worth, null);
      assert.deepEqual(list[0].platforms, ['PC', 'Epic Games Store']);
    } finally {
      restore();
    }
  });

  test('CheapShark: prices become numbers, inactive stores are hidden, games sort by price', async () => {
    const restore = http._setFetch(fixtures.mockFetch());
    try {
      const stores = await cheapshark.stores();
      assert.deepEqual([...stores.keys()], ['1', '7']);
      const [deal] = await cheapshark.deals();
      assert.equal(deal.salePrice, 4.99);
      assert.equal(deal.savings, 83);
      assert.equal(deal.metacritic, null);
      const game = await cheapshark.game('612');
      assert.deepEqual(game.deals.map(d => d.price), [9.99, 12.49]);
      assert.equal(game.lowestEver, 7.99);
    } finally {
      restore();
    }
  });

  test('HTTP client retries once on 429 and caches with a TTL', async () => {
    let calls = 0;
    const restore = http._setFetch(async () => {
      calls += 1;
      if (calls === 1) return { ok: false, status: 429, headers: { get: () => '0' }, text: async () => '' };
      return fixtures.response({ ok: true });
    });
    try {
      assert.deepEqual(await http.getJson('https://example.com/a', { ttl: 60_000 }), { ok: true });
      assert.deepEqual(await http.getJson('https://example.com/a', { ttl: 60_000 }), { ok: true });
      assert.equal(calls, 2, 'second call served from cache');
    } finally {
      restore();
    }
    const restoreFail = http._setFetch(async () => ({ ok: false, status: 500, headers: { get: () => null }, text: async () => '{"error":"boom"}' }));
    try {
      await assert.rejects(http.getJson('https://example.com/b', { retries: 0 }), err => err instanceof http.HttpError && err.status === 500);
    } finally {
      restoreFail();
    }
  });
});
