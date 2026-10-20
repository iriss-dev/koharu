const path = require('path');
require('dotenv').config();

module.exports = {
  token: process.env.DISCORD_TOKEN || '',
  clientId: process.env.CLIENT_ID || '',
  prefix: process.env.DEFAULT_PREFIX || '-',
  dbPath: path.resolve(process.env.DATABASE_PATH || './data/koharu.sqlite'),
  
  roles: {
    defaultCoinCost: parseInt(process.env.DEFAULT_ROLE_COST_COINS || '25000', 10),
    defaultKeyCost: parseInt(process.env.DEFAULT_ROLE_COST_KEYS || '1', 10),
    boosterFree: process.env.BOOSTER_ROLE_FREE !== 'false',
    boosterDualColor: process.env.BOOSTER_DUAL_COLOR !== 'false',
  },

  economy: {
    workCooldown: parseInt(process.env.WORK_COOLDOWN_SECONDS || '300', 10),
    workMin: parseInt(process.env.WORK_MIN_PAYOUT || '150', 10),
    workMax: parseInt(process.env.WORK_MAX_PAYOUT || '500', 10),
  },

  colors: {
    primary: '#F472B6',   // Soft pastel pink
    secondary: '#EC4899', // Rich rose
    accent: '#A78BFA',    // Lavender accent
    success: '#34D399',   // Mint green
    error: '#F87171',     // Soft red
    gold: '#FBBF24',      // Warm coin gold
  }
};
