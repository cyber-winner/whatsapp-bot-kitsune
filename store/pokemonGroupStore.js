const PokemonGroupConfig = require('../models/PokemonGroupConfig');
const pokemonStore = require('./pokemonStore');
const axios = require('axios');
const {
  MessageMedia
} = require('whatsapp-web.js');
const groupConfigs = {};
const spawnTimers = {};
let client = null;
const MIN_SPAWN_DELAY_MS = 5 * 60 * 1000;
const MAX_SPAWN_DELAY_MS = 10 * 60 * 1000;
async function loadAll() {
  try {
    const configs = await PokemonGroupConfig.find({});
    for (const cfg of configs) {
      groupConfigs[cfg.groupId] = {
        isPokemonDisabled: cfg.isPokemonDisabled || false,
        spawnMode: cfg.spawnMode || 'msg'
      };
    }
    console.log(`[PokemonGroupStore] Loaded ${configs.length} Pokémon group configurations.`);
  } catch (err) {
    console.error('[PokemonGroupStore] Failed to load configurations:', err.message);
  }
}
function initialize(clientInstance) {
  client = clientInstance;
  console.log('[PokemonGroupStore] Initialized with WhatsApp client.');
  const startTimers = () => {
    console.log('[PokemonGroupStore] Client is ready — starting timed spawn timers...');
    for (const groupId of Object.keys(groupConfigs)) {
      const cfg = groupConfigs[groupId];
      if (cfg.spawnMode === 'time' && !cfg.isPokemonDisabled) {
        scheduleTimedSpawn(groupId);
      }
    }
  };
  if (client.info && client.info.wid) {
    startTimers();
  } else {
    client.once('ready', startTimers);
  }
}
function isPokemonDisabled(groupId) {
  if (!groupConfigs[groupId]) return false;
  return groupConfigs[groupId].isPokemonDisabled || false;
}
async function setPokemonDisabled(groupId, disabled) {
  if (!groupConfigs[groupId]) {
    groupConfigs[groupId] = {
      isPokemonDisabled: false,
      spawnMode: 'msg'
    };
  }
  groupConfigs[groupId].isPokemonDisabled = disabled;
  try {
    await PokemonGroupConfig.findOneAndUpdate({
      groupId
    }, {
      isPokemonDisabled: disabled
    }, {
      upsert: true,
      returnDocument: 'after'
    });
  } catch (err) {
    console.error(`[PokemonGroupStore] DB Update failed for ${groupId}:`, err.message);
  }
  if (disabled) {
    clearTimedSpawn(groupId);
  } else {
    if (groupConfigs[groupId].spawnMode === 'time') {
      scheduleTimedSpawn(groupId);
    }
  }
}
function getSpawnMode(groupId) {
  if (!groupConfigs[groupId]) return 'msg';
  return groupConfigs[groupId].spawnMode || 'msg';
}
async function setSpawnMode(groupId, mode) {
  if (!groupConfigs[groupId]) {
    groupConfigs[groupId] = {
      isPokemonDisabled: false,
      spawnMode: 'msg'
    };
  }
  groupConfigs[groupId].spawnMode = mode;
  try {
    await PokemonGroupConfig.findOneAndUpdate({
      groupId
    }, {
      spawnMode: mode
    }, {
      upsert: true,
      returnDocument: 'after'
    });
  } catch (err) {
    console.error(`[PokemonGroupStore] DB Update failed for ${groupId}:`, err.message);
  }
  if (mode === 'time') {
    if (!groupConfigs[groupId].isPokemonDisabled) {
      scheduleTimedSpawn(groupId);
    }
  } else {
    clearTimedSpawn(groupId);
  }
}
function scheduleTimedSpawn(groupId) {
  clearTimedSpawn(groupId);
  const delay = Math.floor(Math.random() * (MAX_SPAWN_DELAY_MS - MIN_SPAWN_DELAY_MS + 1)) + MIN_SPAWN_DELAY_MS;
  console.log(`[PokemonGroupStore] Scheduled timed spawn for ${groupId} in ${(delay / 60000).toFixed(1)} minutes (${Math.round(delay / 1000)}s).`);
  spawnTimers[groupId] = setTimeout(() => {
    triggerTimedSpawn(groupId);
  }, delay);
}
function clearTimedSpawn(groupId) {
  if (spawnTimers[groupId]) {
    clearTimeout(spawnTimers[groupId]);
    delete spawnTimers[groupId];
  }
}
async function triggerTimedSpawn(groupId) {
  if (isPokemonDisabled(groupId) || getSpawnMode(groupId) !== 'time' || !client) {
    return;
  }
  try {
    const spawn = pokemonStore.spawnPokemon(groupId);
    if (spawn) {
      pokemonStore.tickCatchCooldowns(groupId);
      let spawnText = `🌿 *A wild ${spawn.name} appeared!* 🌿\n\n` + `Type \`kitsune catch ${spawn.name}\` to catch it!\n\n` + `⏳ _Hurry! It will flee in 2 minutes!_ ⚡`;
      if (spawn.rarity === 'easter egg') {
        spawnText = `🚨 *A MYSTERIOUS EASTER EGG CARD HAS APPEARED!* 🚨\n\n` + `Type \`kitsune catch ${spawn.name}\` to claim this rare artifact!\n\n` + `⏳ _Hurry!_ ⚡`;
      }
      if (spawn.cardImage) {
        try {
          let media;
          if (spawn.cardImage.startsWith('http')) {
            const imgRes = await axios.get(spawn.cardImage, {
              responseType: 'arraybuffer',
              timeout: 15000
            });
            const base64 = Buffer.from(imgRes.data).toString('base64');
            media = new MessageMedia('image/png', base64, 'wild_pokemon.png');
          } else {
            media = MessageMedia.fromFilePath(spawn.cardImage);
          }
          await client.sendMessage(groupId, media);
        } catch (imgErr) {
          console.warn(`[PokemonGroupStore] Timed spawn image failed for ${groupId}:`, imgErr.message);
        }
      }
      await client.sendMessage(groupId, spawnText);
      pokemonStore.markSpawnSent(groupId);
    }
  } catch (err) {
    console.error(`[PokemonGroupStore] Error during timed spawn for ${groupId}:`, err.message);
  }
  scheduleTimedSpawn(groupId);
}
module.exports = {
  loadAll,
  initialize,
  isPokemonDisabled,
  setPokemonDisabled,
  getSpawnMode,
  setSpawnMode,
  scheduleTimedSpawn,
  clearTimedSpawn
};