require('dotenv').config();

module.exports = {
  OWNER_NAME: process.env.BOT_OWNER_NAME || 'The Creator',
  BOT_NAME: process.env.BOT_NAME || 'Kitsune',
  PREFIX: process.env.BOT_PREFIX || '-',
  FATHER: process.env.BOT_FATHER ? process.env.BOT_FATHER.split(',') : [],
  AGGRESSIVE_COMMANDS: process.env.BOT_AGGRESSIVE_COMMANDS ? process.env.BOT_AGGRESSIVE_COMMANDS.split(',') : [],
  ACTIVATE_PHRASE: process.env.BOT_ACTIVATE_PHRASE || 'kitsune activate',
  DEACTIVATE_PHRASE: process.env.BOT_DEACTIVATE_PHRASE || 'kitsune deactivate',
  GIF_API_BASE: process.env.GIF_API_BASE || 'https://nekos.best/api/v2',
  SNIPE_LIMIT: process.env.SNIPE_LIMIT ? parseInt(process.env.SNIPE_LIMIT, 10) : 10,
  SNIPE_EXPIRY_MS: process.env.SNIPE_EXPIRY_MS ? parseInt(process.env.SNIPE_EXPIRY_MS, 10) : 86400000,
  DATA_DIR: process.env.DATA_DIR || './data',
  API_HOST: process.env.API_HOST || '127.0.0.1',
  WA_API_PORT: process.env.WA_API_PORT ? parseInt(process.env.WA_API_PORT, 10) : 3300,
  CORE_API_PORT: process.env.CORE_API_PORT ? parseInt(process.env.CORE_API_PORT, 10) : 3400,
  BRAIN_PORT: process.env.BRAIN_PORT ? parseInt(process.env.BRAIN_PORT, 10) : 3100,
  VIBE_REWARDS_API_KEY: process.env.VIBE_REWARDS_API_KEY || ''
};