const fs = require('fs');
const path = require('path');
const { Client, GatewayIntentBits, Partials } = require('discord.js');
const config = require('./config');
const db = require('./database/db');

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers,
  ],
  partials: [Partials.Channel, Partials.Message, Partials.GuildMember],
});

// Load event handlers
const eventsPath = path.join(__dirname, 'events');
const eventFiles = fs.readdirSync(eventsPath).filter(file => file.endsWith('.js'));

for (const file of eventFiles) {
  const filePath = path.join(eventsPath, file);
  const event = require(filePath);

  if (event.once) {
    client.once(event.name, (...args) => event.execute(...args, client));
  } else {
    client.on(event.name, (...args) => event.execute(...args, client));
  }
}

// Global safety error handlers
process.on('unhandledRejection', (reason, promise) => {
  console.error('[Koharu] Unhandled Promise Rejection:', reason);
});

process.on('uncaughtException', (error) => {
  console.error('[Koharu] Uncaught Exception:', error);
});

// Graceful shutdown
const shutdown = () => {
  console.log('\n[Koharu] Gracefully stopping services...');
  try {
    db.close();
    console.log('[Koharu] Database closed.');
  } catch (err) {
    console.error('[Koharu] Error closing database:', err);
  }
  client.destroy();
  process.exit(0);
};

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

// Launch bot
if (config.token) {
  client.login(config.token).catch((err) => {
    console.error('[Koharu] Failed to login with provided DISCORD_TOKEN:', err);
  });
} else {
  console.log('[Koharu] Bot initialized in dry-run/development mode (no DISCORD_TOKEN specified).');
}

module.exports = client;
