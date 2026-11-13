'use strict';

process.env.DATABASE_PATH = ':memory:';
process.env.EMOJI_SYNC = 'false';

const { test, describe, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { MessageFlags } = require('discord.js');

const http = require('../src/core/http');
const db = require('../src/database/db');
const registry = require('../src/core/registry');
const { handleInteraction, handleMessage } = require('../src/core/dispatch');
const { IDS, world, slash, component, autocomplete, prefixMessage } = require('./helpers/fake');

const IRIS = IDS.iris;
const YUKI = IDS.yuki;
const { assertValid, textOf, customIdsOf } = require('./helpers/lint');
const { mockFetch } = require('./fixtures/apis');

let restore;
const requests = [];

before(() => {
  require('../src/core/cooldowns').setEnabled(false);
  restore = http._setFetch(mockFetch(requests));
  registry.get();
});
after(() => {
  restore();
  db.close();
});

/** Runs a slash command and returns its last reply, validated. */
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

describe('every command runs and produces a valid Discord message', () => {
  test('general: help, ping, profile, settings, search', async () => {
    const w = world();
    const help = await run(w, { commandName: 'help' });
    assert.match(textOf(help.reply), /Koharu/);
    const helpCmd = await run(w, { commandName: 'help', options: { command: 'moda' } });
    assert.match(textOf(helpCmd.reply), /\/moda/);
    await run(w, { commandName: 'ping' });
    await run(w, { commandName: 'profile' });
    await run(w, { commandName: 'settings', sub: 'view' });
    await run(w, { commandName: 'settings', sub: 'prefix', options: { prefix: 'k!' } });
    assert.equal(db.guildSettings(w.guild.id).prefix, 'k!');
    const results = await run(w, { commandName: 'search', options: { query: 'frieren' } });
    assert.match(textOf(results.reply), /Frieren/);
    const opened = await run(w, { commandName: 'search', options: { query: 'style:kawaii' } });
    assert.match(textOf(opened.reply), /Kawaii/);
  });

  test('help category menu updates in place', async () => {
    const w = world();
    const { reply } = await run(w, { commandName: 'help' });
    const menuId = customIdsOf(reply).find(id => id.startsWith('kh:help:cat'));
    const click = await press(w, { customId: menuId, values: ['fashion'] });
    assert.equal(click.updates.length, 1);
    assert.match(textOf(click.updates[0]), /\/moda/);
  });

  test('menus refuse clicks from other people', async () => {
    const w = world();
    const click = await press(w, { customId: `kh:help:cat:${IRIS}`, values: ['fashion'], user: w.yuki, member: w.yukiMember });
    assert.equal(click.updates.length, 0);
    assert.match(click.replies[0].content, /otra persona/);
  });

  test('anime: search, season, trending, schedule, random, similar, manga, character', async () => {
    const w = world();
    const card = await run(w, { commandName: 'anime', sub: 'search', options: { title: 'id:154587' } });
    const text = textOf(card.reply);
    assert.match(text, /Frieren/);
    assert.match(text, /\|\|She outlives them all\.\|\|/, 'AniList spoilers become Discord spoilers');
    assert.ok(!/Source:/.test(text));
    await run(w, { commandName: 'anime', sub: 'season', options: { season: 'FALL', year: 2023 } });
    const trending = await run(w, { commandName: 'anime', sub: 'trending' });
    const schedule = await run(w, { commandName: 'anime', sub: 'schedule', options: { range: 'day' } });
    assert.ok(!/isAdult/.test(JSON.stringify(schedule.reply)));
    await run(w, { commandName: 'anime', sub: 'random', options: { genre: 'Fantasy' } });
    await run(w, { commandName: 'anime', sub: 'similar', options: { title: 'frieren' } });
    await run(w, { commandName: 'manga', sub: 'search', options: { title: 'berserk' } });
    await run(w, { commandName: 'manga', sub: 'trending' });
    const char = await run(w, { commandName: 'character', options: { name: 'frieren' } });
    assert.match(textOf(char.reply), /フリーレン/);
    const none = await run(w, { commandName: 'anime', sub: 'search', options: { title: 'nothing at all' } });
    assert.match(textOf(none.reply), /No encontré/);

    // Pagination and the per-title buttons.
    const next = customIdsOf(trending.reply).find(id => id.startsWith('kh:anime:page'));
    const [, , , , session] = next.split(':');
    const paged = await press(w, { customId: `kh:anime:page:${IRIS}:${session}:1` });
    assert.match(textOf(paged.updates[0]), /6\. Anime 6/);
    const chars = await press(w, { customId: 'kh:anime:chars:*:154587' });
    assert.match(textOf(chars.updates[0]), /Atsumi Tanezaki/);
    await press(w, { customId: 'kh:anime:recs:*:154587' });
    const fav = await press(w, { customId: 'kh:anime:fav:*:154587', user: w.yuki, member: w.yukiMember });
    assert.match(textOf(fav.replies[0]), /favoritos/);
    assert.equal(db.favorites(YUKI).length, 1);
    await press(w, { customId: 'kh:anime:open:*', values: ['154587'] });
  });

  test('AniList queries never declare unused variables', () => {
    const queries = requests.filter(r => r.url.startsWith('https://graphql.anilist.co')).map(r => r.body.query);
    assert.ok(queries.length > 5);
    for (const query of queries) {
      const declared = [...(query.match(/query\s*\(([^)]*)\)/)?.[1] ?? '').matchAll(/\$(\w+)/g)].map(m => m[1]);
      const bodyPart = query.slice(query.indexOf('{'));
      for (const name of declared) assert.ok(bodyPart.includes(`$${name}`), `$${name} declared but unused in:\n${query}`);
    }
  });

  test('social: interactions count per pair and can be returned', async () => {
    const w = world();
    const first = await run(w, { commandName: 'interact', options: { action: 'hug', user: w.yuki } });
    assert.match(textOf(first.reply), /Iris\*\* abraza a \*\*Yuki/);
    assert.match(textOf(first.reply), /primera vez/);
    const second = await run(w, { commandName: 'interact', options: { action: 'hug', user: w.yuki } });
    assert.match(textOf(second.reply), /Abrazos de Iris para Yuki: \*\*2\*\*/);
    const back = customIdsOf(second.reply).find(id => id.startsWith('kh:social:return'));
    assert.equal(back, `kh:social:return:${YUKI}:hug:${IRIS}`, 'only the person who was hugged can return it');
    const click = await press(w, { customId: back, user: w.yuki, member: w.yukiMember, message: { components: second.reply.components } });
    assert.equal(click.updates.length, 1);
    assert.match(textOf(click.replies[0]), /Yuki\*\* abraza a \*\*Iris/);
    const self = await run(w, { commandName: 'interact', options: { action: 'pat', user: w.iris } });
    assert.match(textOf(self.reply), /Koharu/);
    await run(w, { commandName: 'react', options: { reaction: 'blush' } });
  });

  test('fashion: outfit, reroll, find, style, colors, season, tip', async () => {
    const w = world();
    const outfit = await run(w, { commandName: 'fashion', sub: 'outfit', options: { occasion: 'date', weather: 'mild', style: 'coquette' } });
    assert.match(textOf(outfit.reply), /Cita/);
    assert.equal(outfit.reply.files.length, 1, 'palette image attached');
    const reroll = customIdsOf(outfit.reply).find(id => id.startsWith('kh:fashion:reroll'));
    const rerolled = await press(w, { customId: reroll });
    assert.deepEqual(rerolled.updates[0].attachments, [], 'old palette image is replaced');
    const find = await press(w, { customId: 'kh:fashion:find:*:coquette', values: ['t1'] });
    assert.match(JSON.stringify(find.replies[0].components), /pinterest\.com/);
    await run(w, { commandName: 'fashion', sub: 'style', options: { name: 'gothic' } });
    const colors = await run(w, { commandName: 'fashion', sub: 'colors', options: { color: 'lavanda' } });
    assert.match(textOf(colors.reply), /lavanda/);
    const bad = await run(w, { commandName: 'fashion', sub: 'colors', options: { color: 'unicornio' } });
    assert.match(textOf(bad.reply), /No reconocí/);
    const season = await run(w, { commandName: 'fashion', sub: 'season', options: { undertone: 'cool', hair: 'dark', eyes: 'dark' } });
    assert.match(textOf(season.reply), /Invierno/);
    await run(w, { commandName: 'fashion', sub: 'tip', options: { topic: 'care' } });
    await press(w, { customId: 'kh:fashion:setstyle:*:kawaii' });
    assert.equal(db.profile(IRIS).style, 'kawaii');
  });

  test('deals: games, free, alert, alerts, channel', async () => {
    const w = world();
    const list = await run(w, { commandName: 'deals', sub: 'games' });
    assert.match(textOf(list.reply), /Cozy Game 1/);
    assert.match(JSON.stringify(list.reply.components), /cheapshark\.com\/redirect\?dealID=deal%252B0/);
    const empty = await run(w, { commandName: 'deals', sub: 'games', options: { title: 'zzz' } });
    assert.match(textOf(empty.reply), /No encontré ofertas/);
    const free = await run(w, { commandName: 'deals', sub: 'free' });
    assert.match(textOf(free.reply), /Free Game 1\*\*/);
    const none = await run(w, { commandName: 'deals', sub: 'free', options: { platform: 'vr' } });
    assert.match(textOf(none.reply), /no hay regalos/);
    const alert = await run(w, { commandName: 'deals', sub: 'alert', options: { game: 'id:612', price: 5 } });
    assert.match(textOf(alert.reply), /Hades/);
    assert.equal(db.alerts(IRIS).length, 1);
    const cheap = await run(w, { commandName: 'deals', sub: 'alert', options: { game: 'id:612', price: 15 } });
    assert.match(textOf(cheap.reply), /buen momento/);
    const alerts = await run(w, { commandName: 'deals', sub: 'alerts' });
    const remove = customIdsOf(alerts.reply).find(id => id.startsWith('kh:deals:rmalert'));
    await press(w, { customId: remove, values: [String(db.alerts(IRIS)[0].id)] });
    assert.equal(db.alerts(IRIS).length, 0);
    await run(w, { commandName: 'deals', sub: 'channel', options: { channel: w.channel } });
    assert.equal(w.channel.sent.length, 3, 'three newest free games posted as a welcome');
    assert.equal(db.postedGiveaways(w.guild.id).size, 6, 'everything active counts as seen');
  });

  test('economy: work, daily, deposit, withdraw, pay, balance, leaderboard, keys', async () => {
    const w = world();
    await run(w, { commandName: 'work' });
    const coins = db.member(w.guild.id, IRIS).coins;
    assert.ok(coins >= 150);
    const rest = await run(w, { commandName: 'work' });
    assert.ok(rest.reply.flags & MessageFlags.Ephemeral, 'cooldown answer is private');
    await run(w, { commandName: 'daily' });
    const again = await run(w, { commandName: 'daily' });
    assert.match(textOf(again.reply), /Ya la reclamaste/);
    await run(w, { commandName: 'deposit', options: { amount: 'mitad' } });
    await run(w, { commandName: 'withdraw', options: { amount: '1' } });
    const bad = await run(w, { commandName: 'deposit', options: { amount: 'lots' } });
    assert.match(textOf(bad.reply), /cantidad válida/);
    await run(w, { commandName: 'pay', options: { user: w.yuki, amount: '10' } });
    assert.equal(db.member(w.guild.id, YUKI).coins, 10);
    const self = await run(w, { commandName: 'pay', options: { user: w.iris, amount: '10' } });
    assert.match(textOf(self.reply), /propia cuenta/);
    const balance = await run(w, { commandName: 'balance' });
    assert.equal(balance.reply.files.length, 0, 'no big decorative picture: a small GIF or the avatar');
    const depositAll = customIdsOf(balance.reply).find(id => id.startsWith('kh:eco:depall'));
    await press(w, { customId: depositAll });
    assert.equal(db.member(w.guild.id, IRIS).coins, 0);
    const lb = await run(w, { commandName: 'leaderboard' });
    assert.match(textOf(lb.reply), /Iris/);
    await run(w, { commandName: 'keys', sub: 'grant', options: { user: w.yuki, amount: 3 } });
    assert.equal(db.member(w.guild.id, YUKI).keys, 3);
    const denied = await run(w, { commandName: 'keys', sub: 'grant', options: { user: w.yuki, amount: 3 }, user: w.yuki, member: w.yukiMember });
    assert.match(textOf(denied.reply), /permiso/);
    await run(w, { commandName: 'keys', sub: 'check', options: { user: w.yuki } });
  });

  test('casino: blackjack, coinflip, slots never overdraw', async () => {
    const w = world();
    db.addCoins(w.guild.id, IRIS, 1000);
    const broke = await run(w, { commandName: 'blackjack', options: { bet: 5000 } });
    assert.match(textOf(broke.reply), /No te alcanza/);
    const game = await run(w, { commandName: 'blackjack', options: { bet: 100 } });
    const stand = customIdsOf(game.reply).find(id => id.startsWith('kh:bj:stand'));
    if (stand) await press(w, { customId: stand });
    await run(w, { commandName: 'coinflip', options: { bet: 50, side: 'heads' } });
    await run(w, { commandName: 'slots', options: { bet: 50 } });
    assert.ok(db.member(w.guild.id, IRIS).coins >= 0);
  });

  test('custom roles: panel, modal, preview, confirm with payment and refund', async () => {
    const w = world();
    db.updateGuildSettings(w.guild.id, { role_cost_coins: 500, role_cost_keys: 0, booster_free: false });
    await run(w, { commandName: 'rolepanel', sub: 'setup' });
    assert.equal(w.channel.sent.length, 1);
    assertValid(w.channel.sent[0], 'role panel');

    const open = await press(w, { customId: 'koharu_role_configure' }); // posted by Koharu 1.x
    assert.equal(open.modals.length, 1, 'legacy panels still open the modal');

    const modal = component(w, { customId: `kh:roles:modal:${IRIS}`, fields: { name: 'Sakura', color: 'rosa chicle', payment: ['coins'] } });
    modal.isMessageComponent = () => false;
    modal.isModalSubmit = () => true;
    await handleInteraction(modal);
    assertValid(modal.replies[0], 'role preview');
    assert.match(textOf(modal.replies[0]), /#F472B6/);
    const confirm = customIdsOf(modal.replies[0]).find(id => id.startsWith('kh:roles:confirm'));

    const poor = await press(w, { customId: confirm });
    assert.match(textOf(poor.updates[0]), /Necesitas \*\*500\*\*/);

    // New preview, now with enough coins.
    db.addCoins(w.guild.id, IRIS, 600);
    await handleInteraction(modal);
    const confirm2 = customIdsOf(modal.replies.at(-1)).find(id => id.startsWith('kh:roles:confirm'));
    const done = await press(w, { customId: confirm2 });
    assert.match(textOf(done.updates[0]), /está listo/);
    assert.equal(db.member(w.guild.id, IRIS).coins, 100);
    const roleId = db.customRole(w.guild.id, IRIS);
    assert.ok(roleId);
    assert.equal(w.guild.roles.cache.get(roleId).created.colors.primaryColor, '#F472B6');

    // A second confirm of the same preview does nothing (no double charge).
    const twice = await press(w, { customId: confirm2 });
    assert.match(textOf(twice.updates[0]), /expiró/);
    assert.equal(db.member(w.guild.id, IRIS).coins, 100);
  });

  test('custom roles: boosters get real gradients when the server supports them', async () => {
    const w = world({ features: ['ENHANCED_ROLE_COLORS'] });
    w.irisMember.premiumSince = new Date();
    const modal = component(w, { customId: `kh:roles:modal:${IRIS}`, fields: { name: 'Aurora', color: '#F472B6, #A78BFA' } });
    modal.isMessageComponent = () => false;
    modal.isModalSubmit = () => true;
    await handleInteraction(modal);
    const confirm = customIdsOf(modal.replies[0]).find(id => id.startsWith('kh:roles:confirm'));
    await press(w, { customId: confirm });
    const role = w.guild.roles.cache.get(db.customRole(w.guild.id, IRIS));
    assert.deepEqual(role.created.colors, { primaryColor: '#F472B6', secondaryColor: '#A78BFA' });
  });

  test('moderation: ban, kick, timeout, untimeout, warn, purge, slowmode and the log', async () => {
    const w = world();
    const log = require('./helpers/fake').fakeChannel('log');
    w.guild.channels.cache.set('log', log);
    db.updateGuildSettings(w.guild.id, { mod_log_channel_id: 'log' });

    await run(w, { commandName: 'warn', sub: 'add', options: { user: w.yuki, reason: 'spam' } });
    assert.equal(db.warnings(YUKI, w.guild.id).length, 1);
    assert.equal(w.yuki.sent.length, 1, 'member is told privately');
    assert.equal(log.sent.length, 1, 'case mirrored to the log channel');
    await run(w, { commandName: 'warn', sub: 'list', options: { user: w.yuki } });
    await run(w, { commandName: 'timeout', options: { user: w.yuki, duration: '10m', reason: 'calma' } });
    assert.equal(w.yukiMember.timedOut.ms, 600000);
    const tooLong = await run(w, { commandName: 'timeout', options: { user: w.yuki, duration: '40d' } });
    assert.match(textOf(tooLong.reply), /Duración no válida/);
    await run(w, { commandName: 'untimeout', options: { user: w.yuki } });
    await run(w, { commandName: 'kick', options: { user: w.yuki } });
    await run(w, { commandName: 'ban', options: { user: w.yuki, reason: 'raid', delete_days: 1 } });
    assert.equal(w.guild.banned.opts.deleteMessageSeconds, 86400);
    const self = await run(w, { commandName: 'ban', options: { user: w.iris } });
    assert.match(textOf(self.reply), /propia cuenta/);
    const noPerm = await run(w, { commandName: 'ban', options: { user: w.iris }, user: w.yuki, member: w.yukiMember });
    assert.match(textOf(noPerm.reply), /permiso/);
    await run(w, { commandName: 'purge', options: { amount: 5 } });
    await run(w, { commandName: 'slowmode', options: { seconds: 10 } });
    assert.equal(w.channel.rateLimit, 10);
  });

  test('English users get English replies', async () => {
    const w = world();
    const { reply } = await run(w, { commandName: 'fashion', sub: 'outfit', options: { occasion: 'work' }, locale: 'en-US' });
    assert.match(textOf(reply), /Outfit for: Work/);
  });
});

describe('autocomplete', () => {
  test('anime titles, colours, stores and commands', async () => {
    const w = world();
    const cases = [
      { commandName: 'anime', options: { title: { focused: true, value: 'fri' } } },
      { commandName: 'fashion', options: { color: { focused: true, value: 'lav' } } },
      { commandName: 'deals', options: { store: { focused: true, value: 'st' } } },
      { commandName: 'help', options: { command: { focused: true, value: 'mo' } } },
      { commandName: 'search', options: { query: { focused: true, value: 'kawaii' } } },
    ];
    for (const spec of cases) {
      const interaction = autocomplete(w, spec);
      await handleInteraction(interaction);
      assert.ok(interaction.responded.length > 0, `${spec.commandName} returned no choices`);
      for (const choice of interaction.responded) {
        assert.ok(choice.name.length <= 100 && String(choice.value).length <= 100);
      }
    }
  });
});

describe('prefix commands', () => {
  test('Spanish and English aliases with arguments', async () => {
    const w = world();
    const hug = prefixMessage(w, `-abrazo <@${YUKI}>`);
    await handleMessage(hug);
    assert.match(textOf(hug.replies[0]), /abraza a \*\*Yuki/);
    assert.equal(hug.replies[0].flags & MessageFlags.Ephemeral, 0);

    const outfit = prefixMessage(w, '-outfit fiesta frio gotico');
    await handleMessage(outfit);
    assert.match(textOf(outfit.replies[0]), /Fiesta/);

    const anime = prefixMessage(w, '-anime frieren');
    await handleMessage(anime);
    assert.match(textOf(anime.replies[0]), /Frieren/);

    const mention = prefixMessage(w, `<@${IDS.bot}>`);
    await handleMessage(mention);
    assert.match(textOf(mention.replies[0]), /Koharu/);

    const bare = prefixMessage(w, '-');
    await handleMessage(bare);
    assert.equal(bare.replies.length, 0);

    db.updateGuildSettings(w.guild.id, { prefix: 'k!' });
    const custom = prefixMessage(w, 'k!saldo');
    await handleMessage(custom);
    assert.equal(custom.replies.length, 1);
  });
});
