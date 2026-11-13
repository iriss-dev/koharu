'use strict';

const path = require('path');
require('dotenv').config({ quiet: true });

const int = (name, fallback) => {
  const value = Number.parseInt(process.env[name] ?? '', 10);
  return Number.isFinite(value) ? value : fallback;
};

const bool = (name, fallback) => {
  const value = process.env[name];
  if (value === undefined || value === '') return fallback;
  return value !== 'false' && value !== '0';
};

module.exports = {
  token: process.env.DISCORD_TOKEN || '',
  clientId: process.env.CLIENT_ID || '',
  prefix: process.env.DEFAULT_PREFIX || '-',
  defaultLocale: (process.env.DEFAULT_LOCALE || 'es').toLowerCase().startsWith('en') ? 'en' : 'es',
  dbPath: process.env.DATABASE_PATH === ':memory:'
    ? ':memory:'
    : path.resolve(process.env.DATABASE_PATH || './data/koharu.sqlite'),
  dataDir: path.resolve(process.env.DATA_DIR || './data'),

  // Upload Koharu's emoji set as application emojis on startup.
  emojiSync: bool('EMOJI_SYNC', true),
  // Register slash commands on startup.
  deployCommands: bool('DEPLOY_COMMANDS', true),
  // Register slash commands to one guild only (instant updates while developing).
  devGuildId: process.env.DEV_GUILD_ID || '',
  // Prefix commands need the privileged Message Content intent.
  privilegedIntents: bool('ENABLE_PRIVILEGED_INTENTS', false),

  roles: {
    defaultCoinCost: int('DEFAULT_ROLE_COST_COINS', 25000),
    defaultKeyCost: int('DEFAULT_ROLE_COST_KEYS', 1),
    boosterFree: bool('BOOSTER_ROLE_FREE', true),
    boosterDualColor: bool('BOOSTER_DUAL_COLOR', true),
  },

  economy: {
    workCooldown: int('WORK_COOLDOWN_SECONDS', 300),
    workMin: int('WORK_MIN_PAYOUT', 150),
    workMax: int('WORK_MAX_PAYOUT', 500),
    dailyBase: int('DAILY_BASE', 400),
    dailyStreakStep: int('DAILY_STREAK_STEP', 60),
    dailyStreakCap: int('DAILY_STREAK_CAP', 10),
    dailyWeeklyBonus: int('DAILY_WEEKLY_BONUS', 500),
    minBet: int('MIN_BET', 10),
    maxBet: int('MAX_BET', 1_000_000),
  },

  deals: {
    freeGamesIntervalMinutes: int('FREE_GAMES_INTERVAL_MINUTES', 120),
    priceAlertIntervalMinutes: int('PRICE_ALERT_INTERVAL_MINUTES', 180),
    maxAlertsPerUser: int('MAX_ALERTS_PER_USER', 10),
  },

  colors: {
    primary: '#F472B6', // soft pastel pink
    secondary: '#EC4899', // rich rose
    accent: '#A78BFA', // lavender
    success: '#34D399', // mint
    error: '#F87171', // soft red
    gold: '#FBBF24', // coin gold
    sky: '#7DD3FC', // baby blue
  },
};
