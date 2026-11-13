'use strict';

const fs = require('fs');
const path = require('path');
const { Client, GatewayIntentBits, Partials } = require('discord.js');
const config = require('./config');
const db = require('./database/db');
const registry = require('./core/registry');
const scheduler = require('./core/scheduler');

process.on('unhandledRejection', reason => console.error('[Koharu] Unhandled rejection:', reason));
process.on('uncaughtException', error => console.error('[Koharu] Uncaught exception:', error));

const STANDARD_INTENTS = [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages];
// Prefix commands (-abrazo @alguien) need to read message content.
const PRIVILEGED_INTENTS = [...STANDARD_INTENTS, GatewayIntentBits.MessageContent, GatewayIntentBits.GuildMembers];

function createClient(intents) {
  const client = new Client({
    intents,
    partials: [Partials.Channel, Partials.GuildMember],
    allowedMentions: { parse: ['users'], repliedUser: false },
  });
  const dir = path.join(__dirname, 'events');
  for (const file of fs.readdirSync(dir).filter(name => name.endsWith('.js'))) {
    const event = require(path.join(dir, file));
    const run = (...args) => Promise.resolve(event.execute(...args)).catch(err => console.error(`[Event] ${event.name}:`, err));
    if (event.once) client.once(event.name, run);
    else client.on(event.name, run);
  }
  return client;
}

let client = null;

function shutdown() {
  console.log('\n[Koharu] Shutting down…');
  scheduler.stopAll();
  client?.destroy();
  db.close();
  process.exit(0);
}
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

async function start() {
  // Load every command up front so configuration mistakes fail fast.
  const { commands, slashData } = registry.get();
  console.log(`[Koharu] ${commands.size} commands loaded (${slashData.length} slash).`);

  if (!config.token) {
    console.log('[Koharu] No DISCORD_TOKEN set: commands loaded in dry-run mode, not connecting.');
    return;
  }

  try {
    client = createClient(config.privilegedIntents ? PRIVILEGED_INTENTS : STANDARD_INTENTS);
    await client.login(config.token);
    if (!config.privilegedIntents) {
      console.log('[Koharu] Slash commands only. Enable "Message Content" in the Developer Portal and set ENABLE_PRIVILEGED_INTENTS=true for prefix commands.');
    }
  } catch (err) {
    if (/disallowed intents/i.test(err?.message ?? '')) {
      console.warn('[Koharu] Privileged intents are not enabled in the Developer Portal; continuing with slash commands only.');
      client = createClient(STANDARD_INTENTS);
      await client.login(config.token);
    } else {
      console.error('[Koharu] Login failed:', err);
      process.exitCode = 1;
    }
  }
}

if (require.main === module) start();

module.exports = { createClient, start };
