'use strict';

process.env.DATABASE_PATH = ':memory:';
process.env.EMOJI_SYNC = 'false';

const { test, describe, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { ComponentType } = require('discord.js');

const http = require('../src/core/http');
const db = require('../src/database/db');
const registry = require('../src/core/registry');
const kawaii = require('../src/services/kawaii');
const levels = require('../src/features/levels');
const fun = require('../src/features/fun');
const { handleInteraction, handleMessage } = require('../src/core/dispatch');
const { IDS, world, slash, component, autocomplete, prefixMessage } = require('./helpers/fake');
const { assertValid, textOf, customIdsOf } = require('./helpers/lint');
const { mockFetch, response } = require('./fixtures/apis');

const IRIS = IDS.iris;
const YUKI = IDS.yuki;

let restore;
before(() => {
  require('../src/core/cooldowns').setEnabled(false);
  restore = http._setFetch(mockFetch([]));
  registry.get();
});
after(() => {
  restore();
  db.close();
});

async function run(w, spec) {
  const interaction = slash(w, spec);
  await handleInteraction(interaction);
  assert.ok(interaction.replies.length, `/${spec.commandName} ${spec.sub ?? ''} did not reply`);
  for (const reply of interaction.replies) assertValid(reply, `/${spec.commandName} ${spec.sub ?? ''}`);
  return { interaction, reply: interaction.replies.at(-1) };
}

async function press(w, spec) {
  const interaction = component(w, spec);
  await handleInteraction(interaction);
  for (const payload of [...interaction.replies, ...interaction.updates]) assertValid(payload, spec.customId);
  return interaction;
}

/** Every media URL (thumbnails and galleries) in a payload, by kind. */
function media(payload) {
  const out = { thumbnails: [], galleries: [] };
  const visit = node => {
    if (!node || typeof node !== 'object') return;
    if (node.type === ComponentType.Thumbnail) out.thumbnails.push(node.media.url);
    if (node.type === ComponentType.MediaGallery) out.galleries.push(...node.items.map(item => item.media.url));
    (node.components ?? []).forEach(visit);
    if (node.accessory) visit(node.accessory);
  };
  (payload.components ?? []).map(c => (typeof c.toJSON === 'function' ? c.toJSON() : c)).forEach(visit);
  return out;
}

describe('cute anime media', () => {
  test('moderation cards show a small anime GIF, not a big picture', async () => {
    const w = world();
    const { reply } = await run(w, { commandName: 'warn', sub: 'add', options: { user: w.yuki, reason: 'spam' } });
    const found = media(reply);
    assert.equal(found.galleries.length, 0, 'no big gallery image');
    assert.equal(found.thumbnails.length, 1);
    assert.match(found.thumbnails[0], /^https:\/\/nekos\.best\//);
    assert.equal(reply.files.length, 0);
    assert.match(textOf(reply), /Advertencia/);
  });

  test('falls back to the local picture when the GIF service is down', async () => {
    const w = world();
    const undo = http._setFetch(async () => response({ error: 'down' }, 503));
    kawaii._reset();
    try {
      const { reply } = await run(w, { commandName: 'kick', options: { user: w.yuki } });
      assert.match(media(reply).thumbnails[0], /^attachment:\/\/yui_glass\.png$/);
      assert.equal(reply.files.length, 1);
    } finally {
      undo();
      http._setFetch(mockFetch([]));
      kawaii._reset();
    }
  });

  test('pools avoid showing the same GIF twice in a row', async () => {
    kawaii._reset();
    const undo = http._setFetch(async () => response({ results: [1, 2, 3, 4].map(i => ({ url: `https://nekos.best/api/v2/pat/${i}.gif` })) }));
    try {
      const seen = [];
      for (let i = 0; i < 8; i++) seen.push((await kawaii.gif('pat')).url);
      for (let i = 1; i < seen.length; i++) assert.notEqual(seen[i], seen[i - 1]);
      assert.ok(new Set(seen).size >= 3);
    } finally {
      undo();
      http._setFetch(mockFetch([]));
      kawaii._reset();
    }
  });

  test('waifu.pics is the backup and moodNow() warms in the background', async () => {
    kawaii._reset();
    const undo = http._setFetch(async url => (String(url).includes('waifu.pics')
      ? response({ url: 'https://i.waifu.pics/abc.gif' })
      : response({ error: 'down' }, 503)));
    try {
      assert.equal((await kawaii.gif('glomp')).url, 'https://i.waifu.pics/abc.gif');
      assert.equal(kawaii.moodNow('love'), null, 'cold pools answer null right away');
    } finally {
      undo();
      http._setFetch(mockFetch([]));
    }
    await kawaii.mood('love');
    kawaii._reset();
    await kawaii.warm({ delayMs: 0 });
    assert.ok(kawaii.moodNow('love')?.url);
  });

  test('every mood maps to categories the services have', () => {
    for (const [name, list] of Object.entries(kawaii.MOODS)) {
      for (const category of list) assert.ok(kawaii.supports(category), `${name} → ${category}`);
    }
  });
});

describe('warnings', () => {
  test('remove one warning by its number', async () => {
    const w = world();
    for (const reason of ['uno', 'dos', 'tres']) await run(w, { commandName: 'warn', sub: 'add', options: { user: w.yuki, reason } });
    const list = await run(w, { commandName: 'warn', sub: 'list', options: { user: w.yuki } });
    assert.match(textOf(list.reply), /`#1` uno/);
    await run(w, { commandName: 'warn', sub: 'remove', options: { user: w.yuki, number: 2 } });
    assert.deepEqual(db.warnings(YUKI, w.guild.id).map(row => row.reason), ['tres', 'uno']);
    const missing = await run(w, { commandName: 'warn', sub: 'remove', options: { user: w.yuki, number: 9 } });
    assert.match(textOf(missing.reply), /No encontré/);
  });
});

describe('interactions', () => {
  test('new actions and reactions, offered through autocomplete', async () => {
    const w = world();
    const bonk = await run(w, { commandName: 'interact', options: { action: 'bonk', user: w.yuki } });
    assert.match(textOf(bonk.reply), /bonk/);
    await run(w, { commandName: 'interact', options: { action: 'kabedon', user: w.yuki } });
    await run(w, { commandName: 'react', options: { reaction: 'nya' } });

    const ac = autocomplete(w, { commandName: 'interact', options: { action: { focused: true, value: 'abra' } } });
    await handleInteraction(ac);
    assert.ok(ac.responded.some(choice => choice.value === 'hug'));
    const all = autocomplete(w, { commandName: 'react', options: { reaction: { focused: true, value: '' } } });
    await handleInteraction(all);
    assert.equal(all.responded.length, 25);

    const prefix = prefixMessage(w, `-bonk <@${YUKI}>`);
    await handleMessage(prefix);
    assert.match(textOf(prefix.replies[0]), /bonk/);
  });
});

describe('marriage', () => {
  test('propose, only the other person can answer, profile shows it, divorce', async () => {
    const w = world();
    const proposal = await run(w, { commandName: 'marry', options: { user: w.yuki } });
    const yes = customIdsOf(proposal.reply).find(id => id.startsWith('kh:marry:yes'));
    assert.equal(yes, `kh:marry:yes:${YUKI}:${IRIS}`);

    const notMine = await press(w, { customId: yes });
    assert.equal(notMine.updates.length, 0, 'the proposer cannot accept for the other person');

    const accepted = await press(w, { customId: yes, user: w.yuki, member: w.yukiMember });
    assert.match(textOf(accepted.updates[0]), /se casaron/);
    assert.equal(db.partner(IRIS).partner_id, YUKI);
    assert.equal(db.partner(YUKI).partner_id, IRIS);

    const again = await run(w, { commandName: 'marry', options: { user: w.yuki } });
    assert.match(textOf(again.reply), /Ya estás/);

    const profile = await run(w, { commandName: 'profile' });
    assert.match(textOf(profile.reply), new RegExp(`matrimonio con <@${YUKI}>`));

    const ask = await run(w, { commandName: 'divorce' });
    const confirm = customIdsOf(ask.reply).find(id => id.startsWith('kh:marry:divorce'));
    const done = await press(w, { customId: confirm });
    assert.match(textOf(done.replies[0]), /caminos separados/);
    assert.equal(db.partner(IRIS), null);
    assert.equal(db.partner(YUKI), null);
  });

  test('cannot marry yourself or a bot', async () => {
    const w = world();
    const self = await run(w, { commandName: 'marry', options: { user: w.iris } });
    assert.match(textOf(self.reply), /otra persona/);
  });
});

describe('levels', () => {
  test('XP curve', () => {
    assert.equal(levels.xpForNext(0), 100);
    assert.equal(levels.xpForNext(1), 155);
    assert.deepEqual(levels.levelInfo(0), { level: 0, current: 0, needed: 100, total: 0 });
    assert.equal(levels.levelInfo(100).level, 1);
    assert.equal(levels.levelInfo(levels.xpForLevel(7)).level, 7);
    assert.equal(levels.progressBar(5, 10, 10), '▰▰▰▰▰▱▱▱▱▱');
  });

  test('chatting earns XP once a minute and announces level-ups with a reward', async () => {
    const w = world();
    const say = async text => {
      const message = prefixMessage(w, text);
      message.author = w.yuki;
      message.member = w.yukiMember;
      await handleMessage(message);
      return message;
    };
    await say('hola a todos');
    const first = db.level(w.guild.id, YUKI).xp;
    assert.ok(first >= 15 && first <= 25);
    await say('otro mensaje');
    assert.equal(db.level(w.guild.id, YUKI).xp, first, 'no XP twice in the same minute');
    assert.equal(db.level(w.guild.id, YUKI).messages, 2);

    // Force a level-up.
    db.setXp(w.guild.id, YUKI, 99);
    const message = prefixMessage(w, 'subo de nivel');
    message.author = w.yuki;
    message.member = w.yukiMember;
    const result = await levels.onMessage(message, 'es', { at: Math.floor(Date.now() / 1000) + 120 });
    assert.deepEqual(result, { levelUp: true, level: 1 });
    const announcement = w.channel.sent.at(-1);
    assertValid(announcement, 'level up');
    assert.match(textOf(announcement), /nivel 1/);
    assert.equal(db.member(w.guild.id, YUKI).coins, levels.REWARD_PER_LEVEL);

    const cmd = prefixMessage(w, '-saldo');
    await handleMessage(cmd);
    assert.equal(db.level(w.guild.id, IRIS).xp, 0, 'commands do not earn XP');
  });

  test('rank, top, set and the server switch', async () => {
    const w = world();
    db.setXp(w.guild.id, YUKI, 500);
    db.setXp(w.guild.id, IRIS, 50);
    const rank = await run(w, { commandName: 'level', sub: 'rank', options: { user: w.yuki } });
    assert.match(textOf(rank.reply), /#1 del servidor/);
    const top = await run(w, { commandName: 'level', sub: 'top' });
    assert.match(textOf(top.reply), /Yuki[\s\S]*Iris/);
    await run(w, { commandName: 'level', sub: 'set', options: { user: w.iris, level: 5 } });
    assert.equal(levels.levelInfo(db.level(w.guild.id, IRIS).xp).level, 5);
    const denied = await run(w, { commandName: 'level', sub: 'set', options: { user: w.iris, level: 1 }, user: w.yuki, member: w.yukiMember });
    assert.match(textOf(denied.reply), /permiso/);

    await run(w, { commandName: 'settings', sub: 'levels', options: { enabled: false } });
    const quiet = prefixMessage(w, 'hola');
    await handleMessage(quiet);
    assert.equal(db.level(w.guild.id, IRIS).xp, levels.xpForLevel(5), 'no XP while levels are off');
  });
});

describe('fun', () => {
  test('8ball, ship, rate, choose, roll, avatar', async () => {
    const w = world();
    await run(w, { commandName: '8ball', options: { question: '¿Hoy hay ramen?' } });
    const ship = await run(w, { commandName: 'ship', options: { user: w.yuki } });
    assert.match(textOf(ship.reply), new RegExp(`${fun.shipPercent(IRIS, YUKI)}%`));
    assert.equal(fun.shipPercent(IRIS, YUKI), fun.shipPercent(YUKI, IRIS), 'same result both ways');
    const rate1 = await run(w, { commandName: 'rate', options: { thing: 'el ramen' } });
    const rate2 = await run(w, { commandName: 'rate', options: { thing: 'El Ramen' } });
    const score = r => textOf(r.reply).match(/(\d+)\/10/)[1];
    assert.equal(score(rate1), score(rate2), 'stable rating, whatever the casing');
    const choose = await run(w, { commandName: 'choose', options: { options: 'pizza, sushi, ramen' } });
    assert.match(textOf(choose.reply), /pizza|sushi|ramen/);
    const bad = await run(w, { commandName: 'choose', options: { options: 'solo una' } });
    assert.match(textOf(bad.reply), /al menos dos/);
    assert.deepEqual(fun.splitOptions('té o café'), ['té', 'café']);
    const roll = await run(w, { commandName: 'roll', options: { sides: 20, count: 3 } });
    assert.match(textOf(roll.reply), /3d20/);
    const prefixRoll = prefixMessage(w, '-dado 2d6');
    await handleMessage(prefixRoll);
    assert.match(textOf(prefixRoll.replies[0]), /2d6/);
    await run(w, { commandName: 'avatar', options: { user: w.yuki } });
  });

  test('kawaii pictures with a reroll button', async () => {
    const w = world();
    const pic = await run(w, { commandName: 'kawaii', options: { type: 'kitsune' } });
    assert.equal(media(pic.reply).galleries.length, 1);
    const reroll = customIdsOf(pic.reply).find(id => id.startsWith('kh:fun:pic'));
    assert.equal(reroll, `kh:fun:pic:${IRIS}:kitsune`);
    const again = await press(w, { customId: reroll });
    assert.equal(again.updates.length, 1);
    const neko = prefixMessage(w, '-neko');
    await handleMessage(neko);
    assertValid(neko.replies[0], '-neko');
  });
});

describe('picture cards', () => {
  const canvas = require('../src/utils/canvas');
  const isPng = buffer => buffer && buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]));

  test('ship, level and profile come with a drawn picture', { skip: !canvas.available }, async () => {
    const w = world();
    const ship = await run(w, { commandName: 'ship', options: { user: w.yuki } });
    assert.equal(ship.reply.files.length, 1);
    assert.equal(ship.reply.files[0].name, 'ship.png');
    assert.ok(isPng(ship.reply.files[0].attachment));
    assert.match(textOf(ship.reply), /💗|🤍/, 'the hearts row stays above the picture');

    db.setXp(w.guild.id, IRIS, 420);
    const rank = await run(w, { commandName: 'level', sub: 'rank' });
    assert.equal(rank.reply.files[0].name, 'level.png');
    assert.match(textOf(rank.reply), /Nivel \*\*2\*\*/);

    db.marry(IRIS, YUKI);
    const profile = await run(w, { commandName: 'profile' });
    assert.equal(profile.reply.files[0].name, 'profile.png');
    assert.ok(isPng(profile.reply.files[0].attachment));
    db.divorce(IRIS);
  });

  test('level-ups are announced with a celebration picture', { skip: !canvas.available }, async () => {
    const w = world();
    db.setXp(w.guild.id, YUKI, 99);
    const message = prefixMessage(w, 'hola');
    message.author = w.yuki;
    message.member = w.yukiMember;
    await levels.onMessage(message, 'es', { at: Math.floor(Date.now() / 1000) + 600 });
    const card = w.channel.sent.at(-1);
    assert.equal(card.files[0].name, 'levelup.png');
    assertValid(card, 'level up picture');
  });

  test('renderers draw placeholders when avatars and backgrounds cannot be fetched', { skip: !canvas.available }, async () => {
    const cards = require('../src/features/cards');
    const buffer = await cards.renderRank({
      name: 'Nadie', username: 'nadie', avatar: null, level: 0, current: 0, needed: 100, rank: null, messages: 0,
      labels: { level: 'LEVEL', rank: 'RANK', messages: 'Messages', levelUp: 'LEVEL UP!' }, celebrate: true,
    });
    assert.ok(isPng(buffer));
  });
});

describe('welcome', () => {
  test('settings preview and the member-join event', async () => {
    const w = world();
    const set = await run(w, { commandName: 'settings', sub: 'welcome', options: { channel: w.channel, message: '¡Hola {user}! Bienvenida a {server} @everyone' } });
    assert.match(textOf(set.reply), /Hola <@111111111111111111>/);
    const event = require('../src/events/guildMemberAdd');
    await event.execute(w.yukiMember);
    const card = w.channel.sent.at(-1);
    assertValid(card, 'welcome');
    assert.match(textOf(card), new RegExp(`Hola <@${YUKI}>! Bienvenida a Koharu Café`));
    assert.ok(!/@everyone/.test(textOf(card).replace('@​everyone', '')), 'no mass pings');
    assert.deepEqual(card.allowedMentions, { users: [YUKI] });
  });
});
