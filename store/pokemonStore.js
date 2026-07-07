const PokemonEntry = require('../models/Pokemon');
const PokemonListing = require('../models/PokemonListing');
const POKEMON_LIST = require('../data/pokemon.json');
const economyStore = require('./economyStore');
const fs = require('fs');
const path = require('path');
const obtainedCardsFile = path.join(__dirname, '../data/obtainedCards.json');
if (!fs.existsSync(obtainedCardsFile)) {
  fs.writeFileSync(obtainedCardsFile, '[]');
}
const nameToIdMap = {};
const pokemonMetaMap = {};
for (const p of POKEMON_LIST) {
  if (p.name) {
    const nameLower = p.name.toLowerCase();
    nameToIdMap[nameLower] = p.id;
    const desc = (p.description || '').toLowerCase();
    const gen = (p.genus || '').toLowerCase();
    const isLeg = p.isLegendary || desc.includes('legendary pokemon');
    const isMyth = p.isMythical || desc.includes('mythical pokemon');
    const isUB = gen.includes('beast') || gen.includes('ultra') || desc.includes('ultra beast');
    if (!pokemonMetaMap[nameLower]) {
      pokemonMetaMap[nameLower] = {
        isLeg,
        isMyth,
        isUB
      };
    } else {
      if (isLeg) pokemonMetaMap[nameLower].isLeg = true;
      if (isMyth) pokemonMetaMap[nameLower].isMyth = true;
      if (isUB) pokemonMetaMap[nameLower].isUB = true;
    }
  }
}
function getDexId(pokemonName) {
  if (!pokemonName) return 0;
  let name = pokemonName.toLowerCase().trim();
  if (nameToIdMap[name]) return nameToIdMap[name];
  name = name.replace(/\b(shiny|gacha|shadow|mega|gigantamax|alolan|galarian|hisuian|paldean)\b/g, '').replace(/[()[\]{}]/g, '').trim();
  if (nameToIdMap[name]) return nameToIdMap[name];
  for (const key of Object.keys(nameToIdMap)) {
    if (name.includes(key) || key.includes(name)) {
      return nameToIdMap[key];
    }
  }
  return 0;
}
const messageCounters = {};
const activeSpawns = {};
const pokeLocks = {};
const catchCooldowns = {};
const SPAWN_INTERVAL = 25;
const SPAWN_EXPIRY_MS = 2 * 60 * 1000;
const GRACE_PERIOD_MS = 5000;
const POKELOCK_DURATION_MS = 2 * 60 * 1000;
function calculateSpawnLevel(pkmn) {
  if (!pkmn) return 15;
  const bs = pkmn.baseStats || {
    hp: 50,
    atk: 50,
    def: 50,
    spAtk: 50,
    spDef: 50,
    speed: 50
  };
  const bst = (bs.hp || 50) + (bs.atk || 50) + (bs.def || 50) + (bs.spAtk || 50) + (bs.spDef || 50) + (bs.speed || 50);
  const bstScore = bst / 720 * 35;
  const tcgHp = parseInt(pkmn.hp) || 70;
  const hpScore = Math.min(15, tcgHp / 340 * 15);
  const capRate = pkmn.captureRate || 45;
  const capScore = (255 - capRate) / 252 * 15;
  const rarityScore = (pkmn.isLegendary ? 7.5 : 0) + (pkmn.isMythical ? 7.5 : 0);
  let growthBonus = 0;
  const gr = (pkmn.growthRate || 'medium').toLowerCase();
  if (gr === 'slow') growthBonus = 5;else if (gr === 'medium-slow') growthBonus = 3;else if (gr === 'medium') growthBonus = 2;else if (gr === 'medium-fast') growthBonus = 1;
  const movesList = pkmn.attacks || pkmn.moves || [];
  const maxPower = Math.max(...movesList.map(m => m.power || 0), 0);
  const moveScore = Math.min(10, maxPower / 180 * 10);
  const weight = parseFloat(pkmn.weight) || 10;
  const height = parseFloat(pkmn.height) || 1.0;
  const density = weight / (height || 1);
  const densityBonus = Math.min(5, Math.max(-5, Math.log10(density) * 1.5));
  const hapBonus = (pkmn.baseHappiness || 70) / 255 * 5;
  const tcgAttacksCount = Array.isArray(pkmn.tcgAttacks) ? pkmn.tcgAttacks.length : 0;
  const tcgBonus = Math.min(5, tcgAttacksCount * 2.5);
  let calculatedLevel = Math.round(bstScore + hpScore + capScore + rarityScore + growthBonus + moveScore + densityBonus + hapBonus + tcgBonus);
  return Math.min(100, Math.max(1, calculatedLevel));
}
function isPokelocked(userId) {
  const expiry = pokeLocks[userId];
  if (!expiry) return false;
  if (Date.now() >= expiry) {
    delete pokeLocks[userId];
    return false;
  }
  return true;
}
function getPokelockRemaining(userId) {
  const expiry = pokeLocks[userId];
  if (!expiry) return 0;
  const remaining = expiry - Date.now();
  return remaining > 0 ? remaining : 0;
}
function applyPokelock(userId) {
  pokeLocks[userId] = Date.now() + POKELOCK_DURATION_MS;
}
function isCatchCooledDown(groupId, userId) {
  const key = `${groupId}:${userId}`;
  return (catchCooldowns[key] || 0) > 0;
}
function getCatchCooldownRemaining(groupId, userId) {
  const key = `${groupId}:${userId}`;
  return catchCooldowns[key] || 0;
}
function applyCatchCooldown(groupId, userId) {
  const key = `${groupId}:${userId}`;
  catchCooldowns[key] = 2;
}
function tickCatchCooldowns(groupId) {
  const prefix = `${groupId}:`;
  for (const key of Object.keys(catchCooldowns)) {
    if (key.startsWith(prefix) && catchCooldowns[key] > 0) {
      catchCooldowns[key]--;
      if (catchCooldowns[key] <= 0) {
        delete catchCooldowns[key];
      }
    }
  }
}
function countMessage(groupId, isMaster = false) {
  if (!messageCounters[groupId]) messageCounters[groupId] = 0;
  messageCounters[groupId]++;
  if (messageCounters[groupId] >= SPAWN_INTERVAL) {
    messageCounters[groupId] = 0;
    const spawn = spawnPokemon(groupId, isMaster);
    if (spawn) {
      tickCatchCooldowns(groupId);
    }
    return spawn;
  }
  return null;
}
function spawnPokemon(groupId, isMaster = false) {
  const SPECIAL_CARDS = [
    { name: 'sabrina carpenter', weight: 25 },
    { name: 'ai hoshino', weight: 20 },
    { name: 'ai hoshino ex', weight: 5 }
  ];
  let pkmn = null;
  
  if (Math.random() < 0.25) {
    let obtained = [];
    try {
      obtained = JSON.parse(fs.readFileSync(obtainedCardsFile, 'utf8'));
    } catch (e) {}
    
    const availableSpecials = SPECIAL_CARDS.filter(c => !obtained.includes(c.name));
    if (availableSpecials.length > 0) {
      const totalWeight = availableSpecials.reduce((sum, card) => sum + card.weight, 0);
      let rand = Math.random() * totalWeight;
      let chosenName = null;
      for (const card of availableSpecials) {
        if (rand < card.weight) {
          chosenName = card.name;
          break;
        }
        rand -= card.weight;
      }
      if (chosenName) {
        pkmn = POKEMON_LIST.find(p => p.name.toLowerCase() === chosenName);
      }
    }
  }

  if (!pkmn) {
    let spawnableList = POKEMON_LIST.filter(p => p.isSpawnable !== false);
    if (isMaster && Math.random() < 0.05) {
      const rareList = spawnableList.filter(p => p.isLegendary || p.isMythical);
      if (rareList.length > 0) {
        spawnableList = rareList;
      }
    }
    pkmn = spawnableList[Math.floor(Math.random() * spawnableList.length)];
  }

  const level = calculateSpawnLevel(pkmn);
  const spawn = {
    name: pkmn.name,
    level,
    cardImage: pkmn.cardImage,
    spriteUrl: pkmn.spriteUrl,
    types: pkmn.types,
    hp: pkmn.hp,
    description: pkmn.description,
    attacks: pkmn.attacks,
    abilities: pkmn.abilities,
    dexId: pkmn.id,
    baseStats: pkmn.baseStats || null,
    weight: pkmn.weight || null,
    height: pkmn.height || null,
    genus: pkmn.genus || null,
    captureRate: pkmn.captureRate || null,
    isLegendary: pkmn.isLegendary || false,
    isMythical: pkmn.isMythical || false,
    rarity: pkmn.rarity || null,
    spawnedAt: Date.now() + 999999
  };
  activeSpawns[groupId] = spawn;
  const PlayerWallet = require('../models/PlayerWallet');
  PlayerWallet.updateMany({
    wandBlockSpawns: {
      $gt: 0
    }
  }, {
    $inc: {
      wandBlockSpawns: -1
    }
  }).catch(console.error);
  setTimeout(() => {
    if (activeSpawns[groupId] && activeSpawns[groupId].spawnedAt === spawn.spawnedAt) {
      delete activeSpawns[groupId];
      console.log(`[Pokemon] Spawn expired in ${groupId}: ${spawn.name}`);
    }
  }, SPAWN_EXPIRY_MS);
  return spawn;
}
function forceSpawnPokemon(groupId, pokemonName) {
  const pkmn = POKEMON_LIST.find(p => p.name.toLowerCase() === pokemonName.toLowerCase());
  if (!pkmn) return null;
  const level = calculateSpawnLevel(pkmn);
  const spawn = {
    name: pkmn.name,
    level,
    cardImage: pkmn.cardImage,
    spriteUrl: pkmn.spriteUrl,
    types: pkmn.types,
    hp: pkmn.hp,
    description: pkmn.description,
    attacks: pkmn.attacks,
    abilities: pkmn.abilities,
    dexId: pkmn.id,
    baseStats: pkmn.baseStats || null,
    weight: pkmn.weight || null,
    height: pkmn.height || null,
    genus: pkmn.genus || null,
    captureRate: pkmn.captureRate || null,
    isLegendary: pkmn.isLegendary || false,
    isMythical: pkmn.isMythical || false,
    rarity: pkmn.rarity || null,
    spawnedAt: Date.now() + 999999
  };
  activeSpawns[groupId] = spawn;
  const PlayerWallet = require('../models/PlayerWallet');
  PlayerWallet.updateMany({
    wandBlockSpawns: {
      $gt: 0
    }
  }, {
    $inc: {
      wandBlockSpawns: -1
    }
  }).catch(console.error);
  setTimeout(() => {
    if (activeSpawns[groupId] && activeSpawns[groupId].spawnedAt === spawn.spawnedAt) {
      delete activeSpawns[groupId];
      console.log(`[Pokemon] Force Spawn expired in ${groupId}: ${spawn.name}`);
    }
  }, SPAWN_EXPIRY_MS);
  return spawn;
}
function markSpawnSent(groupId) {
  const spawn = activeSpawns[groupId];
  if (spawn) {
    spawn.spawnedAt = Date.now();
  }
}
function getActiveSpawn(groupId) {
  const spawn = activeSpawns[groupId];
  if (!spawn) return null;
  if (Date.now() - spawn.spawnedAt > SPAWN_EXPIRY_MS) {
    delete activeSpawns[groupId];
    return null;
  }
  return spawn;
}
async function attemptCatch(groupId, userId, guessedName) {
  const spawn = getActiveSpawn(groupId);
  if (!spawn) {
    return {
      success: false,
      reason: 'no_spawn'
    };
  }
  if (spawn.locked) {
    return {
      success: false,
      reason: 'no_spawn'
    };
  }
  spawn.locked = true;
  const unlock = () => {
    if (activeSpawns[groupId] === spawn) spawn.locked = false;
  };
  const hasBypass = await economyStore.hasCooldownBypass(userId);
  const PlayerWallet = require('../models/PlayerWallet');
  const wallet = await PlayerWallet.findOne({
    userId
  });
  if (wallet && wallet.wandBlockSpawns > 0) {
    unlock();
    return {
      success: false,
      reason: 'wand_blocked',
      wandBlockSpawns: wallet.wandBlockSpawns
    };
  }
  if (!hasBypass && isPokelocked(userId)) {
    const remaining = Math.ceil(getPokelockRemaining(userId) / 1000);
    unlock();
    return {
      success: false,
      reason: 'pokelocked',
      remaining
    };
  }
  if (!hasBypass && isCatchCooledDown(groupId, userId)) {
    const skipsLeft = getCatchCooldownRemaining(groupId, userId);
    unlock();
    return {
      success: false,
      reason: 'catch_cooldown',
      skipsLeft
    };
  }
  const elapsed = Date.now() - spawn.spawnedAt;
  if (!hasBypass && elapsed < GRACE_PERIOD_MS) {
    applyPokelock(userId);
    const lockSecs = Math.ceil(POKELOCK_DURATION_MS / 1000);
    unlock();
    return {
      success: false,
      reason: 'too_fast',
      lockDuration: lockSecs
    };
  }
  const diaperActive = wallet && wallet.diaperModeSpawns > 0;
  if (!diaperActive && spawn.name.toLowerCase() !== guessedName.toLowerCase()) {
    unlock();
    return {
      success: false,
      reason: 'wrong_name'
    };
  }
  const hasBalls = await economyStore.hasPokeballs(userId);
  if (!hasBalls) {
    unlock();
    return {
      success: false,
      reason: 'no_pokeballs'
    };
  }
  const ballResult = await economyStore.consumePokeball(userId);
  const remainingBalls = ballResult.remaining;
  const catchRoll = Math.random();
  if (catchRoll > 0.85) {
    unlock();
    return {
      success: false,
      reason: 'ball_failed',
      pokemonName: spawn.name,
      remainingBalls
    };
  }
  delete activeSpawns[groupId];
  
  const SPECIAL_CARD_NAMES = ['sabrina carpenter', 'ai hoshino', 'ai hoshino ex'];
  if (SPECIAL_CARD_NAMES.includes(spawn.name.toLowerCase())) {
    let obtained = [];
    try {
      obtained = JSON.parse(fs.readFileSync(obtainedCardsFile, 'utf8'));
    } catch (e) {}
    if (!obtained.includes(spawn.name.toLowerCase())) {
      obtained.push(spawn.name.toLowerCase());
      fs.writeFileSync(obtainedCardsFile, JSON.stringify(obtained));
    }
  }

  applyCatchCooldown(groupId, userId);
  if (wallet && wallet.diaperModeSpawns > 0) {
    wallet.diaperModeSpawns -= 1;
    await wallet.save();
  }
  const coinReward = economyStore.calculateCoinReward(spawn);
  await economyStore.addCoins(userId, coinReward);
  await economyStore.addUserXP(userId, 10);
  let crystalReward = 0;
  if (spawn.isMythical) {
    crystalReward = 160;
  } else if (spawn.isLegendary) {
    crystalReward = 80;
  }
  if (crystalReward > 0) {
    await economyStore.addRadiantCrystals(userId, crystalReward);
  }
  const userWallet = await economyStore.getWallet(userId);
  const levelCap = economyStore.getLevelCap(userWallet);
  let finalLevel = spawn.level;
  if (levelCap > 100) {
    finalLevel = Math.min(levelCap, Math.max(1, Math.round(spawn.level / 100 * levelCap)));
  }
  const entry = await PokemonEntry.create({
    userId,
    pokemonName: spawn.name,
    level: finalLevel,
    dexId: spawn.dexId,
    prestigeStamp: userWallet.prestigeLevel || 0
  });
  const balance = await economyStore.getBalance(userId);
  return {
    success: true,
    pokemon: {
      name: spawn.name,
      level: finalLevel,
      cardImage: spawn.cardImage,
      spriteUrl: spawn.spriteUrl,
      types: spawn.types,
      hp: spawn.hp,
      description: spawn.description,
      attacks: spawn.attacks,
      abilities: spawn.abilities,
      dexId: spawn.dexId,
      baseStats: spawn.baseStats,
      weight: spawn.weight,
      height: spawn.height,
      genus: spawn.genus,
      isLegendary: spawn.isLegendary,
      isMythical: spawn.isMythical,
      dbId: entry._id
    },
    coinReward,
    crystalReward,
    totalCoins: balance.pokecoins,
    totalCrystals: balance.radiantCrystals,
    remainingBalls,
    levelCap,
    diaperTriesLeft: wallet ? wallet.diaperModeSpawns : 0
  };
}
async function getUserPokedex(userId) {
  if (global.BOT_ID && userId === global.BOT_ID) {
    const dex = {};
    for (const p of POKEMON_LIST) {
      dex[p.name] = {
        name: p.name,
        count: 1,
        bestLevel: 1000,
        entries: [{
          level: 1000,
          caughtAt: new Date(),
          id: 'celestia_1'
        }]
      };
    }
    return Object.values(dex);
  }
  const entries = await PokemonEntry.find({
    userId
  }).sort({
    level: -1
  });
  const dex = {};
  for (const e of entries) {
    if (!dex[e.pokemonName]) {
      dex[e.pokemonName] = {
        name: e.pokemonName,
        count: 0,
        bestLevel: 0,
        entries: []
      };
    }
    dex[e.pokemonName].count++;
    if (e.level > dex[e.pokemonName].bestLevel) dex[e.pokemonName].bestLevel = e.level;
    dex[e.pokemonName].entries.push({
      level: e.level,
      caughtAt: e.caughtAt,
      id: e._id
    });
  }
  return Object.values(dex).sort((a, b) => b.bestLevel - a.bestLevel);
}
async function getPokemonDetails(userId, pokemonName) {
  if (global.BOT_ID && userId === global.BOT_ID) {
    const staticData = POKEMON_LIST.find(p => p.name.toLowerCase() === pokemonName.toLowerCase());
    if (!staticData) return null;
    const multipliedStats = {};
    if (staticData.baseStats) {
      for (const key in staticData.baseStats) {
        multipliedStats[key] = staticData.baseStats[key] * 100;
      }
    }
    const multipliedAttacks = (staticData.attacks || []).map(atk => {
      if (atk && typeof atk.power === 'number' && atk.power > 0) {
        return {
          ...atk,
          power: atk.power * 100
        };
      }
      return atk;
    });
    return {
      name: staticData.name,
      count: 1,
      bestLevel: 1000,
      entries: [{
        level: 1000,
        caughtAt: new Date()
      }],
      cardImage: staticData.cardImage || null,
      spriteUrl: staticData.spriteUrl || null,
      types: staticData.types || [],
      hp: staticData.hp && !isNaN(parseInt(staticData.hp)) ? (parseInt(staticData.hp) * 100).toString() : '??',
      description: staticData.description || 'A mysterious Pokémon.',
      attacks: multipliedAttacks,
      abilities: staticData.abilities || [],
      dexId: staticData.id || 0,
      baseStats: staticData.baseStats ? multipliedStats : null,
      weight: staticData.weight || null,
      height: staticData.height || null,
      genus: staticData.genus || null,
      captureRate: staticData.captureRate || null,
      isLegendary: staticData.isLegendary || false,
      isMythical: staticData.isMythical || false,
      rarity: staticData.rarity || null,
      growthRate: staticData.growthRate || null,
      prestigeMultiplier: 100
    };
  }
  const entries = await PokemonEntry.find({
    userId,
    pokemonName: {
      $regex: new RegExp(`^${pokemonName.replace(/[.*+?^${}()|[\\]\\\\]/g, '\\\\$&')}$`, 'i')
    }
  }).sort({
    level: -1
  });
  if (entries.length === 0) return null;
  const staticData = POKEMON_LIST.find(p => p.name.toLowerCase() === pokemonName.toLowerCase());
  const wallet = await economyStore.getWallet(userId);
  const ownerPrestige = wallet.prestigeLevel || 0;
  const bestEntry = entries[0];
  const effectivePrestige = economyStore.getEffectivePrestige(ownerPrestige, bestEntry.prestigeStamp);
  const mult = economyStore.getPrestigeMultiplier(effectivePrestige);
  const rawStats = staticData?.baseStats || null;
  const boostedStats = rawStats ? economyStore.applyPrestigeToStats(rawStats, effectivePrestige) : null;
  const rawAttacks = staticData?.attacks || [];
  const boostedAttacks = economyStore.applyPrestigeToAttacks(rawAttacks, effectivePrestige);
  const rawHp = staticData?.hp || '??';
  let boostedHp = rawHp;
  if (rawHp !== '??' && !isNaN(parseInt(rawHp)) && mult > 1) {
    boostedHp = Math.floor(parseInt(rawHp) * mult).toString();
  }
  return {
    name: entries[0].pokemonName,
    count: entries.length,
    bestLevel: entries[0].level,
    entries: entries.map(e => ({
      level: e.level,
      caughtAt: e.caughtAt
    })),
    cardImage: staticData?.cardImage || null,
    spriteUrl: staticData?.spriteUrl || null,
    types: staticData?.types || [],
    hp: boostedHp,
    description: staticData?.description || 'A mysterious Pokémon.',
    attacks: boostedAttacks,
    abilities: staticData?.abilities || [],
    dexId: staticData?.id || 0,
    baseStats: boostedStats,
    weight: staticData?.weight || null,
    height: staticData?.height || null,
    genus: staticData?.genus || null,
    captureRate: staticData?.captureRate || null,
    isLegendary: staticData?.isLegendary || false,
    isMythical: staticData?.isMythical || false,
    rarity: staticData?.rarity || null,
    growthRate: staticData?.growthRate || null,
    prestigeMultiplier: mult,
    inheritedPrestige: bestEntry.prestigeStamp || 0
  };
}
async function getUserStats(userId) {
  if (global.BOT_ID && userId === global.BOT_ID) {
    return {
      total: POKEMON_LIST.length,
      unique: POKEMON_LIST.length
    };
  }
  const entries = await PokemonEntry.find({
    userId
  });
  const uniqueIds = new Set(entries.map(e => e.dexId || getDexId(e.pokemonName)));
  uniqueIds.delete(0);
  uniqueIds.delete(undefined);
  return {
    total: entries.length,
    unique: uniqueIds.size
  };
}
function getStaticData(pokemonName) {
  return POKEMON_LIST.find(p => p.name.toLowerCase() === pokemonName.toLowerCase()) || null;
}
async function giftPokemon(fromUserId, toUserId, pokemonName) {
  const entry = await PokemonEntry.findOne({
    userId: fromUserId,
    pokemonName: {
      $regex: new RegExp(`^${pokemonName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i')
    }
  }).sort({
    level: -1
  });
  if (!entry) return {
    success: false,
    reason: 'not_owned'
  };
  const gifterWallet = await economyStore.getWallet(fromUserId);
  const gifterPrestige = gifterWallet.prestigeLevel || 0;
  entry.prestigeStamp = Math.max(entry.prestigeStamp || 0, gifterPrestige);
  entry.userId = toUserId;
  await entry.save();
  return {
    success: true,
    pokemon: {
      name: entry.pokemonName,
      level: entry.level,
      inheritedPrestige: entry.prestigeStamp
    }
  };
}
const activeSummons = {};
function summonPokemon(groupId, summonerId, pokemonBaseName) {
  const basePkmn = POKEMON_LIST.find(p => p.name.toLowerCase() === pokemonBaseName.toLowerCase());
  if (!basePkmn) return null;
  const dexId = basePkmn.id;
  const allVariants = POKEMON_LIST.filter(p => p.id === dexId && p.isSpawnable !== false);
  const pkmn = allVariants[Math.floor(Math.random() * allVariants.length)];
  const level = calculateSpawnLevel(pkmn);
  const summon = {
    summonerId,
    name: pkmn.name,
    level,
    cardImage: pkmn.cardImage,
    spriteUrl: pkmn.spriteUrl,
    types: pkmn.types,
    hp: pkmn.hp,
    description: pkmn.description,
    attacks: pkmn.attacks,
    abilities: pkmn.abilities,
    dexId: pkmn.id,
    baseStats: pkmn.baseStats || null,
    weight: pkmn.weight || null,
    height: pkmn.height || null,
    genus: pkmn.genus || null,
    captureRate: pkmn.captureRate || null,
    isLegendary: pkmn.isLegendary || false,
    isMythical: pkmn.isMythical || false,
    rarity: pkmn.rarity || null,
    triesLeft: 3
  };
  activeSummons[groupId] = summon;
  return summon;
}
function getSummonedSpawn(groupId) {
  return activeSummons[groupId] || null;
}
async function attemptSummonCatch(groupId, userId, guessedName) {
  const summon = activeSummons[groupId];
  if (!summon) {
    return {
      success: false,
      reason: 'no_summon'
    };
  }
  if (summon.locked) {
    return {
      success: false,
      reason: 'no_summon'
    };
  }
  summon.locked = true;
  const unlock = () => {
    if (activeSummons[groupId] === summon) summon.locked = false;
  };
  
  try {
    if (summon.summonerId !== userId) {
      return {
        success: false,
        reason: 'not_summoner'
      };
    }
    if (summon.name.toLowerCase() !== guessedName.toLowerCase()) {
      return {
        success: false,
        reason: 'wrong_name'
      };
    }
    const balance = await economyStore.getBalance(userId);
    if (balance.pokeballs < 2) {
      return {
        success: false,
        reason: 'no_pokeballs',
        needed: 2,
        have: balance.pokeballs
      };
    }
    await economyStore.consumePokeball(userId);
    await economyStore.consumePokeball(userId);
    const updatedBalance = await economyStore.getBalance(userId);
    const remainingBalls = updatedBalance.pokeballs;
    summon.triesLeft--;
    const catchChance = summon.triesLeft === 2 ? 0.50 : summon.triesLeft === 1 ? 0.65 : 0.75;
    const catchRoll = Math.random();
    if (catchRoll < catchChance) {
      delete activeSummons[groupId];
    const coinReward = economyStore.calculateCoinReward(summon);
    await economyStore.addCoins(userId, coinReward);
    await economyStore.addUserXP(userId, 20);
    const wallet = await economyStore.getWallet(userId);
    const levelCap = economyStore.getLevelCap(wallet);
    let finalLevel = summon.level;
    if (levelCap > 100) {
      finalLevel = Math.min(levelCap, Math.max(1, Math.round(summon.level / 100 * levelCap)));
    }
    const entry = await PokemonEntry.create({
      userId,
      pokemonName: summon.name,
      level: finalLevel,
      dexId: summon.dexId,
      prestigeStamp: wallet.prestigeLevel || 0
    });
      const finalBalance = await economyStore.getBalance(userId);
      return {
        success: true,
        catchChance,
        pokemon: {
          name: summon.name,
          level: finalLevel,
          cardImage: summon.cardImage,
          spriteUrl: summon.spriteUrl,
          types: summon.types,
          hp: summon.hp,
          description: summon.description,
          attacks: summon.attacks,
          abilities: summon.abilities,
          dexId: summon.dexId,
          baseStats: summon.baseStats,
          weight: summon.weight,
          height: summon.height,
          genus: summon.genus,
          isLegendary: summon.isLegendary,
          isMythical: summon.isMythical,
          dbId: entry._id
        },
        coinReward,
        totalCoins: finalBalance.pokecoins,
        remainingBalls,
        levelCap
      };
    }
    const triesLeft = summon.triesLeft;
    if (triesLeft <= 0) {
      delete activeSummons[groupId];
    }
    return {
      success: false,
      reason: 'summon_ball_failed',
      pokemonName: summon.name,
      remainingBalls,
      triesLeft,
      catchChance,
      despawned: triesLeft <= 0
    };
  } finally {
    unlock();
  }
}
async function getTrainerLeaderboard() {
  const {
    FATHER
  } = require('../config');
  const entries = await PokemonEntry.find({
    userId: {
      $nin: FATHER
    }
  });
  const userStats = {};
  for (const entry of entries) {
    const userId = entry.userId;
    if (!userStats[userId]) {
      userStats[userId] = {
        userId,
        totalCaught: 0,
        uniqueIds: new Set(),
        bestLevel: 0,
        sumLevels: 0
      };
    }
    const stats = userStats[userId];
    stats.totalCaught++;
    const speciesId = entry.dexId || getDexId(entry.pokemonName);
    if (speciesId) {
      stats.uniqueIds.add(speciesId);
    }
    if (entry.level > stats.bestLevel) {
      stats.bestLevel = entry.level;
    }
    stats.sumLevels += entry.level;
  }
  const leaderboard = Object.values(userStats).map(stats => {
    const uniqueCount = stats.uniqueIds.size;
    const avgLevel = stats.totalCaught > 0 ? Math.round(stats.sumLevels / stats.totalCaught) : 0;
    const score = uniqueCount * 150 + stats.totalCaught * 35 + stats.bestLevel * 10 + avgLevel;
    return {
      userId: stats.userId,
      totalCaught: stats.totalCaught,
      uniqueCount,
      bestLevel: stats.bestLevel,
      avgLevel,
      score
    };
  });
  leaderboard.sort((a, b) => b.score - a.score);
  return leaderboard.slice(0, 10);
}
function isValidPokemon(name) {
  if (!name) return false;
  return pokemonMetaMap.hasOwnProperty(name.toLowerCase());
}
async function sellPokemon(sellerId, cost, pokemonName) {
  if (isNaN(cost) || cost <= 0) {
    return {
      success: false,
      reason: 'invalid_price'
    };
  }
  const entry = await PokemonEntry.findOne({
    userId: sellerId,
    pokemonName: {
      $regex: new RegExp(`^${pokemonName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i')
    }
  }).sort({
    level: -1
  });
  if (!entry) return {
    success: false,
    reason: 'not_owned'
  };
  const listing = await PokemonListing.create({
    sellerId,
    pokemonEntryId: entry._id,
    pokemonName: entry.pokemonName,
    level: entry.level,
    price: cost
  });
  entry.userId = 'marketplace_listed';
  await entry.save();
  return {
    success: true,
    pokemonName: entry.pokemonName,
    level: entry.level,
    price: cost,
    listingId: listing._id
  };
}
async function buyPokemon(buyerId, sellerId, pokemonName) {
  if (buyerId === sellerId) {
    return {
      success: false,
      reason: 'buy_self'
    };
  }
  const listing = await PokemonListing.findOne({
    sellerId,
    pokemonName: {
      $regex: new RegExp(`^${pokemonName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i')
    }
  });
  if (!listing) return {
    success: false,
    reason: 'listing_not_found'
  };
  const familyStore = require('./familyStore');
  const taxPayers = await familyStore.resolveTaxPayers(buyerId);
  const isExempt = taxPayers.length === 0;
  const selfPays = taxPayers.length === 1 && taxPayers[0].userId === buyerId;
  const taxAmount = isExempt ? 0 : Math.ceil(listing.price * economyStore.TAX_RATE);
  const buyerPays = isExempt || !selfPays ? listing.price : listing.price + taxAmount;
  const buyerWallet = await economyStore.getWallet(buyerId);
  if (buyerWallet.pokecoins < buyerPays) {
    return {
      success: false,
      reason: 'insufficient_coins',
      needed: buyerPays,
      have: buyerWallet.pokecoins,
      basePrice: listing.price,
      taxAmount: isExempt ? 0 : taxAmount
    };
  }
  const entry = await PokemonEntry.findById(listing.pokemonEntryId);
  if (!entry) {
    await listing.deleteOne();
    return {
      success: false,
      reason: 'pokemon_not_found'
    };
  }
  buyerWallet.pokecoins -= buyerPays;
  await buyerWallet.save();
  const sellerWallet = await economyStore.getWallet(sellerId);
  sellerWallet.pokecoins += listing.price;
  await sellerWallet.save();
  let taxDetails = [];
  const {
    FATHER
  } = require('../config');
  const fatherId = FATHER[0];
  if (!isExempt && !selfPays && taxAmount > 0) {
    for (const payer of taxPayers) {
      const payerAmount = Math.ceil(taxAmount * payer.share);
      if (payerAmount <= 0) continue;
      const payerWallet = await economyStore.getWallet(payer.userId);
      payerWallet.pokecoins = Math.max(0, payerWallet.pokecoins - payerAmount);
      await payerWallet.save();
      taxDetails.push({
        userId: payer.userId,
        amount: payerAmount
      });
    }
    const totalTax = taxDetails.reduce((sum, t) => sum + t.amount, 0);
    if (totalTax > 0) {
      const fatherWallet = await economyStore.getWallet(fatherId);
      fatherWallet.pokecoins += totalTax;
      await fatherWallet.save();
    }
  } else if (selfPays && taxAmount > 0) {
    const fatherWallet = await economyStore.getWallet(fatherId);
    fatherWallet.pokecoins += taxAmount;
    await fatherWallet.save();
    taxDetails = [{
      userId: buyerId,
      amount: taxAmount
    }];
  }
  const sellerPrestige = sellerWallet.prestigeLevel || 0;
  entry.prestigeStamp = Math.max(entry.prestigeStamp || 0, sellerPrestige);
  entry.userId = buyerId;
  await entry.save();
  await listing.deleteOne();
  return {
    success: true,
    pokemonName: listing.pokemonName,
    level: listing.level,
    price: listing.price,
    basePrice: listing.price,
    taxAmount: isExempt ? 0 : taxAmount,
    taxPaidBy: taxDetails,
    totalCost: buyerPays
  };
}
module.exports = {
  countMessage,
  spawnPokemon,
  forceSpawnPokemon,
  tickCatchCooldowns,
  getActiveSpawn,
  attemptCatch,
  summonPokemon,
  getSummonedSpawn,
  attemptSummonCatch,
  getUserPokedex,
  getPokemonDetails,
  getUserStats,
  getStaticData,
  giftPokemon,
  isPokelocked,
  markSpawnSent,
  getDexId,
  getTrainerLeaderboard,
  POKEMON_LIST,
  pokemonMetaMap,
  isValidPokemon,
  sellPokemon,
  buyPokemon
};