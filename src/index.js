const fs = require('fs');
const path = require('path');
const { Client, GatewayIntentBits, Partials } = require('discord.js');
const config = require('./config');
const db = require('./database/db');

// Global safety error handlers
process.on('unhandledRejection', (reason) => {
  console.error('[Koharu] Unhandled Promise Rejection:', reason);
});

process.on('uncaughtException', (error) => {
  console.error('[Koharu] Uncaught Exception:', error);
});

function initClient(intents) {
  const client = new Client({
    intents,
    partials: [Partials.Channel, Partials.Message, Partials.GuildMember],
  });

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

  return client;
}

const standardIntents = [
  GatewayIntentBits.Guilds,
  GatewayIntentBits.GuildMessages,
];

const privilegedIntents = [
  GatewayIntentBits.Guilds,
  GatewayIntentBits.GuildMessages,
  GatewayIntentBits.MessageContent,
  GatewayIntentBits.GuildMembers,
];

let activeClient = null;

const shutdown = () => {
  console.log('\n[Koharu] Gracefully stopping services...');
  try {
    db.close();
    console.log('[Koharu] Database closed.');
  } catch (err) {
    console.error('[Koharu] Error closing database:', err);
  }
  if (activeClient) activeClient.destroy();
  process.exit(0);
};

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

async function start() {
  if (!config.token) {
    console.log('[Koharu] Bot initialized in dry-run mode (no DISCORD_TOKEN specified).');
    return;
  }

  // Check if privileged intents are enabled or attempt standard first
  const usePrivileged = process.env.ENABLE_PRIVILEGED_INTENTS === 'true';

  try {
    const intentsToUse = usePrivileged ? privilegedIntents : standardIntents;
    activeClient = initClient(intentsToUse);
    await activeClient.login(config.token);

    if (!usePrivileged) {
      console.log('[Koharu] Running in Standard Mode (Slash Commands, Modals, Buttons active).');
      console.log('[Koharu] Tip: Enable "Message Content" & "Server Members" in Discord Dev Portal, then set ENABLE_PRIVILEGED_INTENTS=true in .env to unlock prefix commands (-work).');
    }
  } catch (err) {
    if (err.message && err.message.includes('disallowed intents')) {
      console.warn('[Koharu] Privileged intents disallowed by Discord. Falling back to Standard Mode...');
      activeClient = initClient(standardIntents);
      await activeClient.login(config.token);
    } else {
      console.error('[Koharu] Fatal login error:', err);
    }
  }
}

start();

module.exports = { initClient };
