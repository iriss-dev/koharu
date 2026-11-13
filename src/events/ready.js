'use strict';

const path = require('path');
const { Events, REST, Routes, ActivityType } = require('discord.js');
const config = require('../config');
const registry = require('../core/registry');
const emojis = require('../core/emojis');
const scheduler = require('../core/scheduler');
const deals = require('../features/deals');

const STATUS = [
  { name: '/ayuda · /help', type: ActivityType.Listening },
  { name: 'anime 🌸', type: ActivityType.Watching },
  { name: 'outfits ✨', type: ActivityType.Watching },
  { name: 'ofertas · deals 🎁', type: ActivityType.Watching },
];

async function deployCommands(client) {
  const { slashData } = registry.get();
  const rest = new REST({ version: '10' }).setToken(config.token);
  const appId = config.clientId || client.application.id;
  const route = config.devGuildId ? Routes.applicationGuildCommands(appId, config.devGuildId) : Routes.applicationCommands(appId);
  await rest.put(route, { body: slashData });
  console.log(`[Koharu] Registered ${slashData.length} slash commands ${config.devGuildId ? `in guild ${config.devGuildId}` : 'globally'}.`);
}

module.exports = {
  name: Events.ClientReady,
  once: true,
  async execute(client) {
    console.log(`[Koharu] Logged in as ${client.user.tag} · ${client.guilds.cache.size} servers`);

    if (config.deployCommands) await deployCommands(client).catch(err => console.error('[Koharu] Slash command registration failed:', err.message));
    if (config.emojiSync) {
      await emojis.sync(client, { stateFile: path.join(config.dataDir, 'emoji-state.json') })
        .catch(err => console.warn('[Emojis] Sync skipped:', err.message));
    }

    let i = 0;
    const rotate = () => {
      client.user.setPresence({ activities: [{ name: STATUS[i % STATUS.length].name, type: STATUS[i % STATUS.length].type }], status: 'online' });
      i += 1;
    };
    rotate();
    setInterval(rotate, 45_000).unref();

    scheduler.every('free-games', config.deals.freeGamesIntervalMinutes, () => deals.freeGamesTick(client, { defaultLocale: config.defaultLocale }));
    scheduler.every('price-alerts', config.deals.priceAlertIntervalMinutes, () => deals.priceAlertsTick(client), { firstRunAfterMs: 5 * 60_000 });
  },
};
