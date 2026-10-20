const { REST, Routes, ActivityType } = require('discord.js');
const config = require('../config');
const { slashCommandData } = require('../commands');

const STATUS_ROTATION = [
  { name: 'over your custom roles 🌸', type: ActivityType.Watching },
  { name: 'Blackjack at the casino 🃏', type: ActivityType.Playing },
  { name: 'strawberry matcha lattes 🍵', type: ActivityType.Custom },
  { name: 'the cat café counter 🐾', type: ActivityType.Watching },
  { name: 'type /help or -help ✨', type: ActivityType.Listening },
];

module.exports = {
  name: 'ready',
  once: true,
  async execute(client) {
    console.log(`[Koharu] Logged in as ${client.user.tag} (${client.user.id})`);

    // Register slash commands via REST
    if (config.token && config.clientId) {
      try {
        const rest = new REST({ version: '10' }).setToken(config.token);
        console.log(`[Koharu] Deploying ${slashCommandData.length} application (/) commands...`);

        await rest.put(
          Routes.applicationCommands(config.clientId),
          { body: slashCommandData }
        );
        console.log('[Koharu] Successfully synced application commands with Discord!');
      } catch (err) {
        console.error('[Koharu] Failed to deploy application commands:', err);
      }
    } else {
      console.warn('[Koharu] Notice: DISCORD_TOKEN or CLIENT_ID not provided. Slash command deployment skipped.');
    }

    // Dynamic presence status loop
    let statusIndex = 0;
    const updatePresence = () => {
      const current = STATUS_ROTATION[statusIndex];
      client.user.setPresence({
        activities: [{ name: current.name, type: current.type }],
        status: 'online',
      });
      statusIndex = (statusIndex + 1) % STATUS_ROTATION.length;
    };

    updatePresence();
    setInterval(updatePresence, 30_000);
  },
};
