'use strict';

process.env.DATABASE_PATH = ':memory:';

const { test, describe, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { Collection } = require('discord.js');

const http = require('../src/core/http');
const db = require('../src/database/db');
const emojis = require('../src/core/emojis');
const deals = require('../src/features/deals');
const { world } = require('./helpers/fake');
const { assertValid, textOf } = require('./helpers/lint');
const { mockFetch } = require('./fixtures/apis');

let restore;
before(() => { restore = http._setFetch(mockFetch()); });
after(() => { restore(); db.close(); });

function fakeApplication(existing = []) {
  const store = new Collection(existing.map(e => [e.id, e]));
  let seq = 1;
  const calls = { created: [], deleted: [] };
  return {
    calls,
    async fetch() {},
    emojis: {
      async fetch() { return store.clone(); },
      async create({ attachment, name }) {
        assert.ok(fs.existsSync(attachment), `uploads a real file: ${attachment}`);
        const emoji = { id: `e${seq++}`, name, animated: false };
        store.set(emoji.id, emoji);
        calls.created.push(name);
        return emoji;
      },
      async delete(id) { store.delete(id); calls.deleted.push(id); },
    },
  };
}

describe('application emoji sync', () => {
  const total = Object.keys(emojis.MANIFEST).length;
  const stateFile = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'koharu-emoji-')), 'state.json');
  const application = fakeApplication();
  const client = { application };

  test('first start uploads every emoji and uses them right away', async () => {
    const result = await emojis.sync(client, { stateFile, log: () => {} });
    assert.equal(result.uploaded, total);
    assert.match(emojis.e('sakura'), /^<:kh_sakura:e\d+>$/);
  });

  test('next start reuses them without uploading again', async () => {
    const result = await emojis.sync(client, { stateFile, log: () => {} });
    assert.deepEqual([result.uploaded, result.kept], [0, total]);
  });

  test('changed artwork is replaced, nothing else', async () => {
    const state = JSON.parse(fs.readFileSync(stateFile, 'utf8'));
    state.heart = 'old-hash';
    fs.writeFileSync(stateFile, JSON.stringify(state));
    const result = await emojis.sync(client, { stateFile, log: () => {} });
    assert.equal(result.uploaded, 1);
    assert.equal(application.calls.deleted.length, 1);
    assert.equal(application.calls.created.at(-1), 'kh_heart');
  });

  test('a failed upload falls back to Unicode', async () => {
    for (const name of Object.keys(emojis.MANIFEST)) emojis._setResolved(name, null);
    const broken = fakeApplication();
    broken.emojis.create = async () => { throw new Error('Maximum number of emojis reached'); };
    const warn = console.warn;
    console.warn = () => {};
    try {
      const freshState = path.join(path.dirname(stateFile), 'fresh.json');
      const result = await emojis.sync({ application: broken }, { stateFile: freshState, log: () => {} });
      assert.equal(result.failed, total);
    } finally {
      console.warn = warn;
    }
    assert.equal(emojis.e('sakura'), '🌸');
  });
});

describe('background jobs', () => {
  test('free games feed posts only new giveaways, once', async () => {
    const w = world();
    db.updateGuildSettings(w.guild.id, { free_games_channel_id: w.channel.id });
    db.markGiveawaysPosted(w.guild.id, ['3000', '3001']);
    await deals.freeGamesTick(w.client, { defaultLocale: 'es' });
    assert.equal(w.channel.sent.length, 4);
    w.channel.sent.forEach(payload => assertValid(payload, 'free game post'));
    await deals.freeGamesTick(w.client, { defaultLocale: 'es' });
    assert.equal(w.channel.sent.length, 4, 'nothing is posted twice');
  });

  test('price alerts message the user once when the price drops', async () => {
    const w = world();
    const sent = [];
    w.client.users.fetch = async id => ({ id, send: async payload => { sent.push(payload); } });
    db.addAlert({ userId: w.iris.id, guildId: w.guild.id, channelId: w.channel.id, gameId: '612', title: 'Hades', targetPrice: 10, locale: 'es' });
    db.addAlert({ userId: w.yuki.id, guildId: w.guild.id, channelId: w.channel.id, gameId: '612', title: 'Hades', targetPrice: 5, locale: 'en' });
    await deals.priceAlertsTick(w.client);
    assert.equal(sent.length, 1, 'only the alert whose target was reached fires');
    assertValid(sent[0], 'price alert');
    assert.match(textOf(sent[0]), /Hades/);
    assert.equal(db.alerts(w.iris.id).length, 0);
    assert.equal(db.alerts(w.yuki.id).length, 1);
  });

  test('joining a server says hello in a channel Koharu can write in', async () => {
    const w = world();
    w.guild.systemChannel = w.channel;
    await require('../src/events/guildCreate').execute(w.guild);
    assert.equal(w.channel.sent.length, 1);
    assertValid(w.channel.sent[0], 'welcome');
    assert.match(textOf(w.channel.sent[0]), /Koharu/);
  });
});
