const PokemonEntry = require('../models/Pokemon');
const PokemonGroupConfig = require('../models/PokemonGroupConfig');
const ActiveRaid = require('../models/ActiveRaid');
const RaidSettings = require('../models/RaidSettings');
const POKEMON_LIST = require('../data/pokemon.json');
const economyStore = require('./economyStore');
const axios = require('axios');
const {
  MessageMedia
} = require('whatsapp-web.js');
let globalRaid = null;
let isAutoRaidEnabled = true;
const activeRaids = {
  get: groupId => globalRaid,
  has: groupId => globalRaid !== null,
  set: (groupId, val) => {
    globalRaid = val;
  },
  delete: groupId => {
    globalRaid = null;
  },
  values: () => globalRaid ? [globalRaid] : []
};
const activeGroups = new Set();
function registerGroup(groupId) {
  if (groupId) activeGroups.add(groupId);
}
async function loadRaidSettings() {
  try {
    const setting = await RaidSettings.findOne({
      key: 'autoRaidEnabled'
    });
    if (setting) {
      isAutoRaidEnabled = setting.value;
    }
    console.log(`[RaidStore] Loaded fatherAutoRaidEnabled: ${isAutoRaidEnabled}`);
  } catch (err) {
    console.error('[RaidStore] Failed to load raid settings:', err.message);
  }
}
async function setAutoRaidEnabled(enabled) {
  isAutoRaidEnabled = enabled;
  try {
    await RaidSettings.findOneAndUpdate({
      key: 'autoRaidEnabled'
    }, {
      value: enabled
    }, {
      upsert: true
    });
    console.log(`[RaidStore] Saved fatherAutoRaidEnabled: ${enabled}`);
  } catch (err) {
    console.error('[RaidStore] Failed to save raid settings:', err.message);
  }
}
function getAutoRaidEnabled() {
  return isAutoRaidEnabled;
}
const TYPE_CHART = {
  Fire: {
    Grass: 1.5,
    Ice: 1.5,
    Bug: 1.5,
    Steel: 1.5,
    Water: 0.5,
    Fire: 0.5,
    Rock: 0.5,
    Dragon: 0.5
  },
  Water: {
    Fire: 1.5,
    Ground: 1.5,
    Rock: 1.5,
    Water: 0.5,
    Grass: 0.5,
    Dragon: 0.5
  },
  Grass: {
    Water: 1.5,
    Ground: 1.5,
    Rock: 1.5,
    Fire: 0.5,
    Grass: 0.5,
    Poison: 0.5,
    Flying: 0.5,
    Bug: 0.5,
    Dragon: 0.5,
    Steel: 0.5
  },
  Electric: {
    Water: 1.5,
    Flying: 1.5,
    Grass: 0.5,
    Electric: 0.5,
    Dragon: 0.5,
    Ground: 0
  },
  Ice: {
    Grass: 1.5,
    Ground: 1.5,
    Flying: 1.5,
    Dragon: 1.5,
    Steel: 0.5,
    Fire: 0.5,
    Water: 0.5,
    Ice: 0.5
  },
  Fighting: {
    Normal: 1.5,
    Ice: 1.5,
    Rock: 1.5,
    Dark: 1.5,
    Steel: 1.5,
    Poison: 0.5,
    Flying: 0.5,
    Psychic: 0.5,
    Bug: 0.5,
    Fairy: 0.5,
    Ghost: 0
  },
  Poison: {
    Grass: 1.5,
    Fairy: 1.5,
    Poison: 0.5,
    Ground: 0.5,
    Rock: 0.5,
    Ghost: 0.5,
    Steel: 0
  },
  Ground: {
    Fire: 1.5,
    Electric: 1.5,
    Poison: 1.5,
    Rock: 1.5,
    Steel: 1.5,
    Grass: 0.5,
    Bug: 0.5,
    Flying: 0
  },
  Flying: {
    Grass: 1.5,
    Fighting: 1.5,
    Bug: 1.5,
    Electric: 0.5,
    Rock: 0.5,
    Steel: 0.5
  },
  Psychic: {
    Fighting: 1.5,
    Poison: 1.5,
    Psychic: 0.5,
    Steel: 0.5,
    Dark: 0
  },
  Bug: {
    Grass: 1.5,
    Psychic: 1.5,
    Dark: 1.5,
    Fire: 0.5,
    Fighting: 0.5,
    Poison: 0.5,
    Flying: 0.5,
    Ghost: 0.5,
    Steel: 0.5,
    Fairy: 0.5
  },
  Rock: {
    Fire: 1.5,
    Ice: 1.5,
    Flying: 1.5,
    Bug: 1.5,
    Fighting: 0.5,
    Ground: 0.5,
    Steel: 0.5
  },
  Ghost: {
    Psychic: 1.5,
    Ghost: 1.5,
    Dark: 0.5,
    Normal: 0
  },
  Dragon: {
    Dragon: 1.5,
    Steel: 0.5,
    Fairy: 0
  },
  Dark: {
    Psychic: 1.5,
    Ghost: 1.5,
    Fighting: 0.5,
    Dark: 0.5,
    Fairy: 0.5
  },
  Steel: {
    Ice: 1.5,
    Rock: 1.5,
    Fairy: 1.5,
    Steel: 0.5,
    Fire: 0.5,
    Water: 0.5,
    Electric: 0.5
  },
  Fairy: {
    Fighting: 1.5,
    Dragon: 1.5,
    Dark: 1.5,
    Poison: 0.5,
    Steel: 0.5,
    Fire: 0.5
  }
};
const RAID_DURATION_MS = 50 * 60 * 1000;
function getRaidBossCandidates() {
  return POKEMON_LIST.filter(p => {
    if (p.isSpawnable === false) return false;
    const desc = (p.description || '').toLowerCase();
    const gen = (p.genus || '').toLowerCase();
    return p.isLegendary || p.isMythical || gen.includes('beast') || gen.includes('ultra') || desc.includes('ultra beast') || desc.includes('legendary pokemon') || desc.includes('mythical pokemon');
  });
}
function getBasePokemonName(fullName) {
  let name = fullName;
  name = name.replace(/^(Mega\s+|Primal\s+|Shadow\s+|Gigantamax\s+|Shining\s+|Origin\s+Forme\s+|Therian\s+Forme\s+|Alolan\s+|Galarian\s+|Hisuian\s+|Paldean\s+|Origin\s+|Therian\s+|Forme\s+)/i, '');
  name = name.replace(/^[a-zA-Z]\s+/i, '');
  name = name.replace(/(\s*[-–—]\s*(EX|GX|VMAX|VSTAR|V|ex|gx|vmax|vstar|v|Star|Shining|Promo|Tag Team))/i, '');
  name = name.replace(/\s+(EX|GX|VMAX|VSTAR|V|ex|gx|vmax|vstar|v)$/i, '');
  name = name.replace(/\s+[a-zA-Z]$/i, '');
  return name.trim();
}
async function spawnRaid(groupId, client) {
  if (globalRaid !== null) {
    if (groupId) globalRaid.groupIds.add(groupId);
    return globalRaid;
  }
  const candidates = getRaidBossCandidates();
  if (candidates.length === 0) return null;
  const bossData = candidates[Math.floor(Math.random() * candidates.length)];
  const bossLvl = Math.floor(Math.random() * 21) + 80;
  const scale = (base, lvl) => Math.floor(base * (1 + lvl / 50));
  const baseHp = parseInt(bossData.hp || 70);
  const bossMaxHp = scale(baseHp, bossLvl) * 100;
  let enabledGroupIds = [groupId];
  try {
    const configs = await PokemonGroupConfig.find({
      isPokemonDisabled: {
        $ne: true
      }
    });
    if (configs.length > 0) {
      enabledGroupIds = configs.map(c => c.groupId);
    }
  } catch (err) {
    console.error('[Global Raid Spawn] Failed to query enabled groups from DB:', err.message);
  }
  globalRaid = {
    boss: {
      id: bossData.id,
      name: bossData.name,
      level: bossLvl,
      hp: bossMaxHp,
      maxHp: bossMaxHp,
      atk: scale(bossData.baseStats?.atk || 60, bossLvl),
      def: scale(bossData.baseStats?.def || 55, bossLvl),
      speed: scale(bossData.baseStats?.speed || 50, bossLvl),
      types: bossData.types || ["Normal"],
      attacks: bossData.attacks || [{
        name: 'Tackle',
        power: 40,
        type: 'Normal'
      }],
      cardImage: bossData.cardImage
    },
    spawnedAt: Date.now(),
    participants: new Map(),
    groupIds: new Set(enabledGroupIds),
    combatInterval: null
  };
  const currentSpawnTime = globalRaid.spawnedAt;
  globalRaid.resolveTimer = setTimeout(async () => {
    if (globalRaid && globalRaid.spawnedAt === currentSpawnTime) {
      await resolveRaid(client);
    }
  }, RAID_DURATION_MS);
  startCombatLoop(client);
  try {
    await _injectOwnerParticipant();
  } catch (injectErr) {}
  await saveActiveRaidToDb();
  const typeStr = (globalRaid.boss.types || []).join(' / ');
  const announceText = `🚨  ▂ ▃ ▅ ▆ ▇ *GLOBAL RAID SPAWN* ▇ ▆ ▅ ▃ ▂  🚨\n` + `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n` + `⚡ *A Colossal Global Raid Boss has entered all stadiums!* ⚡\n\n` + `🔴 *Raid Boss:* *${globalRaid.boss.name}*\n` + `📊 *Boss HP:* ❤️ *${globalRaid.boss.hp.toLocaleString()} HP* (100x Multiplier!)\n` + `⭐ *Rarity:* 👑 *RAID SPECIAL*\n` + `🔖 *Type:* ${typeStr}\n` + `⏳ *Time Limit:* 50 Minutes\n\n` + `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` + `🎟️ *HOW TO ENTER THE GLOBAL RAID:* 🎟️\n` + `👉 Type \`-raid enter <your_pokemon>\` to join!\n` + `• *Costs:* 1 Raid Pass (purchasable at the PokéMart for 2,000 PokéCoins).\n` + `• *Global Co-op:* Team up with trainers from all active groups in real-time!\n` + `• *Top Spot:* The top trainer wins a rare variant card and a much higher level!\n` + `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` + `_~All active trainers globally, unite for battle!~_ ⚔️`;
  let media = null;
  if (globalRaid.boss.cardImage) {
    try {
      if (globalRaid.boss.cardImage.startsWith('http')) {
        const imgRes = await axios.get(globalRaid.boss.cardImage, {
          responseType: 'arraybuffer',
          timeout: 15000
        });
        const base64 = Buffer.from(imgRes.data).toString('base64');
        media = new MessageMedia('image/png', base64, 'raid_boss.png');
      } else {
        media = MessageMedia.fromFilePath(globalRaid.boss.cardImage);
      }
    } catch (err) {
      console.warn('[Raid Spawn] Failed to load card image:', err.message);
    }
  }
  for (const gid of globalRaid.groupIds) {
    try {
      const chat = await client.getChatById(gid);
      if (media) {
        await chat.sendMessage(media);
      }
      await chat.sendMessage(announceText);
    } catch (chatErr) {
      console.warn(`[Raid Broadcast] Failed to send spawn to group ${gid}:`, chatErr.message);
    }
  }
  return globalRaid;
}
function startCombatLoop(client) {
  if (!globalRaid) return;
  if (globalRaid.combatInterval) clearInterval(globalRaid.combatInterval);
  globalRaid.combatInterval = setInterval(async () => {
    if (!globalRaid) {
      clearInterval(globalRaid.combatInterval);
      return;
    }
    try {
      const doc = await ActiveRaid.findOne({});
      if (doc && doc.participants) {
        for (const p of doc.participants) {
          if (!globalRaid.participants.has(p.userId)) {
            globalRaid.participants.set(p.userId, {
              userId: p.userId,
              senderName: p.senderName,
              pokemonName: p.pokemonName,
              fighter: p.fighter,
              damageDealt: p.damageDealt || 0,
              tries: p.tries || 1,
              joinedAt: p.joinOrder
            });
          }
        }
      }
    } catch (err) {
      console.error('[Raid DB Sync] Failed to sync before combat:', err.message);
    }
    if (globalRaid.participants.size === 0) return;
    const raiders = Array.from(globalRaid.participants.values());
    const boss = globalRaid.boss;
    const initialBossHp = boss.hp;
    let roundsSimulated = 0;
    const maxSimRounds = 150;
    const turnDamage = new Map();
    const turnFaints = new Map();
    for (const r of raiders) {
      turnDamage.set(r.userId, 0);
      turnFaints.set(r.userId, 0);
    }
    for (let round = 1; round <= maxSimRounds; round++) {
      if (boss.hp <= 0) break;
      roundsSimulated++;
      for (const raider of raiders) {
        const f = raider.fighter;
        const moveList = f.attacks.filter(m => m && m.power > 0) || [];
        const move = moveList[Math.floor(Math.random() * moveList.length)] || {
          name: 'Tackle',
          power: 40,
          type: 'Normal'
        };
        const movePower = move.power || 40;
        const moveType = move.type || 'Normal';
        let typeMult = 1.0;
        for (const bossType of boss.types) {
          if (TYPE_CHART[moveType] && TYPE_CHART[moveType][bossType] !== undefined) {
            typeMult *= TYPE_CHART[moveType][bossType];
          }
        }
        const baseDmg = Math.floor(movePower * (f.atk / 40) * (f.level / 30) + 12);
        const critMult = Math.random() < 0.10 ? 1.8 : 1.0;
        const variance = Math.random() * 0.15 + 0.85;
        const beforeDef = Math.floor(baseDmg * critMult * typeMult * variance);
        const mitigationPct = Math.min(0.55, boss.def / (boss.def + 180));
        const finalDmg = Math.max(12, Math.floor(beforeDef * (1 - mitigationPct)));
        boss.hp = Math.max(0, boss.hp - finalDmg);
        raider.damageDealt += finalDmg;
        turnDamage.set(raider.userId, turnDamage.get(raider.userId) + finalDmg);
        if (boss.hp <= 0) break;
      }
      if (boss.hp <= 0) break;
      const targetRaider = raiders[Math.floor(Math.random() * raiders.length)];
      const f = targetRaider.fighter;
      const moveList = boss.attacks.filter(m => m && m.power > 0) || [];
      const move = moveList[Math.floor(Math.random() * moveList.length)] || {
        name: 'Raid Smash',
        power: 75,
        type: 'Normal'
      };
      const movePower = move.power || 75;
      const moveType = move.type || 'Normal';
      let typeMult = 1.0;
      for (const raiderType of f.types) {
        if (TYPE_CHART[moveType] && TYPE_CHART[moveType][raiderType] !== undefined) {
          typeMult *= TYPE_CHART[moveType][raiderType];
        }
      }
      const baseDmg = Math.floor(movePower * (boss.atk / 40) * (boss.level / 30) + 12);
      const critMult = Math.random() < 0.10 ? 1.8 : 1.0;
      const variance = Math.random() * 0.15 + 0.85;
      const beforeDef = Math.floor(baseDmg * critMult * typeMult * variance);
      const mitigationPct = Math.min(0.55, f.def / (f.def + 180));
      const finalDmg = Math.max(12, Math.floor(beforeDef * (1 - mitigationPct)));
      f.hp = Math.max(0, f.hp - finalDmg);
      if (f.hp <= 0) {
        targetRaider.tries += 1;
        f.hp = f.maxHp;
        turnFaints.set(targetRaider.userId, turnFaints.get(targetRaider.userId) + 1);
      }
    }
    if (boss.hp <= 0) {
      clearInterval(globalRaid.combatInterval);
      if (globalRaid.resolveTimer) clearTimeout(globalRaid.resolveTimer);
      await resolveRaid(client);
      return;
    }
    await saveActiveRaidToDb();
    const hpPct = Math.round(boss.hp / boss.maxHp * 100);
    const filledSize = Math.round(boss.hp / boss.maxHp * 10);
    const emptySize = 10 - filledSize;
    const hpBar = '█'.repeat(Math.max(0, filledSize)) + '░'.repeat(Math.max(0, emptySize));
    const totalDmgDealtThisTick = initialBossHp - boss.hp;
    let battleLogText = `🏟️  ▂ ▃ ▅ ▆ ▇ *GLOBAL RAID STATUS (5 MIN)* ▇ ▆ ▅ ▃ ▂  🏟️\n` + `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n` + `🔴 *Global Boss:* *${boss.name}* (Lv. ${boss.level})\n` + `📊 *HP Bar:* \`[${hpBar}]\` *${hpPct}%*\n` + `❤️ *HP Left:* ${boss.hp.toLocaleString()} / ${boss.maxHp.toLocaleString()} HP\n` + `⚡ *Rounds Fought:* Simulated **${roundsSimulated} turns** in background!\n` + `💥 *Total Damage Inflicted:* **${totalDmgDealtThisTick.toLocaleString()} dmg** this turn!\n\n` + `*👥 GLOBAL LEADERBOARD STATISTICS:*\n` + `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
    raiders.forEach(r => {
      const dmgInTick = turnDamage.get(r.userId) || 0;
      const faintsInTick = turnFaints.get(r.userId) || 0;
      battleLogText += `• *${r.senderName}* with *${r.pokemonName}*:\n` + `  ↳ ⚔️ *Total Dmg:* ${r.damageDealt.toLocaleString()} dmg _(+${dmgInTick.toLocaleString()})_\n` + `  ↳ 🔄 *Total Faints:* ${r.tries - 1} faints _(+${faintsInTick})_\n\n`;
    });
    battleLogText += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` + `👉 _Join the global fight: type_ \`-raid enter <your_pokemon>\`!\n` + `_~Check live stats anytime in any group by typing -raid status!~_`;
    for (const gid of globalRaid.groupIds) {
      try {
        const chat = await client.getChatById(gid);
        await chat.sendMessage(battleLogText);
      } catch (chatErr) {
        console.warn(`[Raid Auto Log] Failed to send update to group ${gid}:`, chatErr.message);
      }
    }
  }, 5 * 60 * 1000);
}
async function enterRaid(groupId, userId, senderName, pokemonChoice, msg, client) {
  const {
    resolveWhatsAppUserId
  } = require('../utils/dbHooks');
  userId = await resolveWhatsAppUserId(userId);
  await syncFromDb(client);
  if (globalRaid === null) {
    return msg.reply('❌ *There is no active Global Raid right now.*');
  }
  if (globalRaid.participants.has(userId)) {
    return msg.reply('❌ *You have already entered this Global Raid!*');
  }
  const inventory = await economyStore.getInventory(userId);
  const passItem = inventory.items.find(i => i.itemName === 'Raid Pass' && i.quantity > 0);
  if (!passItem) {
    return msg.reply(`❌ *You don't have a Raid Pass, ${senderName}!*\n\n` + `🛒 Buy one from the PokéMart:\n` + `\`-pokemart buy raid pass\` _(2,000 PokéCoins)_`);
  }
  const ownedPokemon = await PokemonEntry.findOne({
    userId: userId,
    pokemonName: {
      $regex: new RegExp(`^${pokemonChoice.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i')
    }
  }).sort({
    level: -1
  });
  if (!ownedPokemon) {
    return msg.reply(`❌ *You do not own a "${pokemonChoice}" in your Pokédex!*`);
  }
  if (ownedPokemon.pokemonName.toLowerCase() === '30th celebration zorua') {
    return msg.reply(`❌ *This exclusive Pokémon cannot be used in raids!*`);
  }
  const consumed = await economyStore.removeInventoryItem(userId, 'Raid Pass', 1);
  if (!consumed) {
    return msg.reply('❌ *Failed to consume your Raid Pass. Try again.*');
  }
  const pkmnData = POKEMON_LIST.find(p => p.name.toLowerCase() === ownedPokemon.pokemonName.toLowerCase()) || {
    hp: 70,
    baseStats: {
      atk: 60,
      def: 55,
      speed: 50
    },
    types: ["Normal"],
    attacks: [{
      name: 'Tackle',
      power: 40,
      type: 'Normal'
    }]
  };
  const scale = (base, lvl) => Math.floor(base * (1 + lvl / 50));
  const maxHp = scale(parseInt(pkmnData.hp || 70), ownedPokemon.level);
  const chat = await msg.getChat();
  const chatName = chat.name || 'Group';
  const globalName = `${senderName} [${chatName}]`;
  globalRaid.participants.set(userId, {
    userId,
    senderName: globalName,
    pokemonName: ownedPokemon.pokemonName,
    dbPokemon: ownedPokemon,
    fighter: {
      name: ownedPokemon.pokemonName,
      level: ownedPokemon.level,
      maxHp,
      hp: maxHp,
      atk: scale(pkmnData.baseStats?.atk || 60, ownedPokemon.level),
      def: scale(pkmnData.baseStats?.def || 55, ownedPokemon.level),
      speed: scale(pkmnData.baseStats?.speed || 50, ownedPokemon.level),
      types: pkmnData.types || ["Normal"],
      attacks: pkmnData.attacks || [{
        name: 'Tackle',
        power: 40,
        type: 'Normal'
      }]
    },
    damageDealt: 0,
    tries: 1,
    joinedAt: Date.now()
  });
  globalRaid.groupIds.add(groupId);
  await saveActiveRaidToDb();
  return msg.reply(`🎟️ *GLOBAL RAID ENTRY ACCEPTED!* 🎟️\n` + `━━━━━━━━━━━━━━━━━━━━━━━━━\n` + `👤 *Trainer:* ${senderName}\n` + `⚔️ *Pokémon:* ${ownedPokemon.pokemonName} (Lv. ${ownedPokemon.level})\n` + `❤️ *HP:* ${maxHp} HP\n\n` + `_You have entered the Global Co-op Raid Party! Background rapid turns are simulating against the global boss. Check live stats using \`-raid status\`._ ⏳`);
}
async function resolveRaid(client) {
  if (globalRaid === null) return;
  if (globalRaid.combatInterval) clearInterval(globalRaid.combatInterval);
  if (globalRaid.resolveTimer) clearTimeout(globalRaid.resolveTimer);
  const raid = globalRaid;
  globalRaid = null;
  await saveActiveRaidToDb();
  const raiders = Array.from(raid.participants.values());
  const boss = raid.boss;
  if (raiders.length === 0) {
    const failMsg = `💨 *The Global Raid Hour has ended.*\n*${boss.name}* got bored of waiting and fled into the wild! 🍃`;
    for (const gid of raid.groupIds) {
      try {
        const chat = await client.getChatById(gid);
        await chat.sendMessage(failMsg);
      } catch (err) {}
    }
    return;
  }
  if (boss.hp <= 0) {
    raiders.forEach(r => {
      const joinedMarginSeconds = Math.max(0, (r.joinedAt - raid.spawnedAt) / 1000);
      const joinPoints = Math.max(0, 1000 - Math.round(joinedMarginSeconds / 2.5));
      const damagePoints = Math.round(r.damageDealt / 10);
      const triesPoints = Math.max(0, 1000 - (r.tries - 1) * 150);
      r.score = joinPoints + damagePoints + triesPoints;
    });
    raiders.sort((a, b) => b.score - a.score);
    const top1 = raiders[0];
    const otherRaiders = raiders.slice(1);
    let topAwardResult = '';
    try {
      const matchingVariants = POKEMON_LIST.filter(p => p.name.toLowerCase().includes(boss.name.toLowerCase()));
      const premiumVariants = matchingVariants.filter(p => p.name.toLowerCase() !== boss.name.toLowerCase());
      const topCard = premiumVariants.length > 0 ? premiumVariants[Math.floor(Math.random() * premiumVariants.length)] : boss;
      const topWinnerLvl = Math.floor(Math.random() * 16) + 85;
      const wallet = await economyStore.getWallet(top1.userId);
      const levelCap = economyStore.getLevelCap(wallet);
      let finalLvl = topWinnerLvl;
      if (levelCap > 100) {
        finalLvl = Math.min(levelCap, Math.max(85, Math.round(topWinnerLvl / 100 * levelCap)));
      }
      const newCard = new PokemonEntry({
        userId: top1.userId,
        pokemonId: topCard.id,
        pokemonName: topCard.name,
        level: finalLvl,
        rarity: topCard.rarity || 'Promo',
        hp: topCard.hp || '120',
        attacks: topCard.attacks || [],
        weakness: topCard.weakness,
        resistance: topCard.resistance,
        retreatCost: topCard.retreatCost,
        cardImage: topCard.cardImage
      });
      await newCard.save();
      topAwardResult = `👑 *${top1.senderName}* has claimed the rare premium variant: **${topCard.name}** (Lv. ${finalLvl})! 🏆`;
    } catch (awardErr) {
      console.error('[Raid Reward] Failed to award Top 1:', awardErr);
      topAwardResult = `⚠️ _Failed to award Top 1 reward card due to server error._`;
    }
    const otherAwards = [];
    const baseName = getBasePokemonName(boss.name);
    const baseCandidates = POKEMON_LIST.filter(p => getBasePokemonName(p.name).toLowerCase() === baseName.toLowerCase());
    const baseCard = baseCandidates.find(p => p.name.toLowerCase() === baseName.toLowerCase()) || baseCandidates.find(p => getBasePokemonName(p.name) === p.name) || baseCandidates[0] || boss;
    const otherCount = otherRaiders.length;
    for (let idx = 0; idx < otherCount; idx++) {
      const r = otherRaiders[idx];
      try {
        let normalLvl;
        if (otherCount <= 1) {
          normalLvl = 75;
        } else {
          const step = (75 - 50) / (otherCount - 1);
          normalLvl = Math.max(50, Math.min(75, Math.round(75 - idx * step)));
        }
        const otherWallet = await economyStore.getWallet(r.userId);
        const otherLevelCap = economyStore.getLevelCap(otherWallet);
        let finalLvl = normalLvl;
        if (otherLevelCap > 100) {
          finalLvl = Math.min(otherLevelCap, Math.max(50, Math.round(normalLvl / 100 * otherLevelCap)));
        }
        const newCard = new PokemonEntry({
          userId: r.userId,
          pokemonId: baseCard.id,
          pokemonName: baseCard.name,
          level: finalLvl,
          rarity: baseCard.rarity || 'Common',
          hp: baseCard.hp || '70',
          attacks: baseCard.attacks || [],
          weakness: baseCard.weakness,
          resistance: baseCard.resistance,
          retreatCost: baseCard.retreatCost,
          cardImage: baseCard.cardImage
        });
        await newCard.save();
        otherAwards.push(`• *${r.senderName}* received base **${baseCard.name}** (Lv. ${finalLvl})`);
      } catch (awardErr) {
        console.error(`[Raid Reward] Failed to award raider ${r.senderName}:`, awardErr);
      }
    }
    let leaderboardText = `🏆  ▂ ▃ ▅ ▆ ▇ *GLOBAL RAID VICTORY!* ▇ ▆ ▅ ▃ ▂  🏆\n` + `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n` + `🎉 *Congratulations!* The global co-op party successfully defeated *${boss.name}* after an epic stadium brawl!\n\n` + `📊 *GLOBAL CO-OP LEADERBOARD:*\n` + `━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
    const partyTotalDmg = raiders.reduce((acc, curr) => acc + curr.damageDealt, 0) || 1;
    for (let idx = 0; idx < raiders.length; idx++) {
      const r = raiders[idx];
      const medal = idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : '🎗️';
      const dmgSharePct = r.damageDealt / partyTotalDmg;
      const dmgSharePctStr = (dmgSharePct * 100).toFixed(1);
      const effortCoins = Math.round(dmgSharePct * 3500) + Math.min(500, Math.round(r.score / 2));
      const coinsAwarded = Math.min(4000, Math.max(500, effortCoins));
      try {
        await economyStore.addCoins(r.userId, coinsAwarded);
      } catch (coinErr) {
        console.error(`[Raid Coin Reward] Failed to award coins to ${r.senderName}:`, coinErr);
      }
      try {
        await economyStore.addRadiantCrystals(r.userId, 480);
        await economyStore.addUserXP(r.userId, 25);
      } catch (crystalErr) {
        console.error(`[Raid Crystal / XP Reward] Failed to award crystals to ${r.senderName}:`, crystalErr);
      }
      leaderboardText += `${medal} *#${idx + 1} ${r.senderName}* with *${r.pokemonName}*\n` + `   ↳ 💥 *Damage Share:* **${dmgSharePctStr}%** (${r.damageDealt.toLocaleString()} dmg)\n` + `   ↳ 🔄 *Faints:* ${r.tries - 1} faints\n` + `   ↳ 🎖️ *Final Score:* ${r.score.toLocaleString()} pts\n` + `   ↳ 💰 *PokéCoins Earned:* **+${coinsAwarded.toLocaleString()} PokéCoins**\n` + `   ↳ 💎 *Radiant Crystals:* **+480 Crystals** (+25 XP)\n\n`;
    }
    leaderboardText += `━━━━━━━━━━━━━━━━━━━━━━━━━\n` + `🎁 *GLOBAL REWARDS DISTRIBUTED:* 🎁\n` + `━━━━━━━━━━━━━━━━━━━━━━━━━\n` + `${topAwardResult}\n\n` + `*Base cards awarded to other global raiders:*\n` + (otherAwards.length > 0 ? otherAwards.join('\n') : '_None_') + `\n\n` + `_~All card levels/stats received are standard values (the 100x raid scaling is over).~_ ✨`;
    for (const gid of raid.groupIds) {
      try {
        const chat = await client.getChatById(gid);
        await chat.sendMessage(leaderboardText);
      } catch (err) {}
    }
    setTimeout(async () => {
      try {
        const configs = await PokemonGroupConfig.find({
          isPokemonDisabled: {
            $ne: true
          }
        });
        if (configs.length > 0) {
          for (const cfg of configs) {
            try {
              const chat = await client.getChatById(cfg.groupId);
              await chat.sendMessage('🔄 *A new colossal global threat approaches all group stadiums... preparing next Raid Boss!* ⚡');
            } catch (err) {}
          }
          await spawnRaid(configs[0].groupId, client);
        }
      } catch (err) {
        console.error('[Raid Chain Spawn] Failed to spawn next global raid:', err.message);
      }
    }, 10000);
  } else {
    const pings = raiders.map(r => r.userId + '@c.us');
    let failText = `💀  ▂ ▃ ▅ ▆ ▇ *GLOBAL RAID DEFEAT!* ▇ ▆ ▅ ▃ ▂  💀\n` + `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n` + `💥 *Time Limit Expired!* The global boss *${boss.name}* proved too powerful and has fled the planet! 💥\n\n` + `📢 *GLOBAL PARTY RESULT:*\n` + `• *Boss Remaining HP:* ${boss.hp.toLocaleString()} / ${boss.maxHp.toLocaleString()} HP\n\n` + `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` + `⚠️ *Wasted Passes:* All participants' Raid Passes have been burned and wasted in vain. Better luck next hour! 😔\n` + `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
    for (const gid of raid.groupIds) {
      try {
        const chat = await client.getChatById(gid);
        await chat.sendMessage(failText, {
          mentions: pings
        });
      } catch (err) {}
    }
  }
}
async function triggerHourlyRaids(client) {
  console.log('[Raid Scheduler] Triggering hourly global spawn...');
  try {
    const configs = await PokemonGroupConfig.find({
      isPokemonDisabled: {
        $ne: true
      }
    });
    if (configs.length === 0) return;
    await spawnRaid(configs[0].groupId, client);
  } catch (dbErr) {
    console.error('[Raid Scheduler] Failed to fetch group configurations for global raid:', dbErr.message);
  }
}
async function saveActiveRaidToDb() {
  if (!globalRaid) {
    try {
      await ActiveRaid.deleteMany({});
    } catch (err) {
      console.error('[Raid DB] Failed to clear active raid from DB:', err.message);
    }
    return;
  }
  try {
    const doc = await ActiveRaid.findOne({});
    if (doc && doc.participants) {
      for (const p of doc.participants) {
        if (!globalRaid.participants.has(p.userId)) {
          globalRaid.participants.set(p.userId, {
            userId: p.userId,
            senderName: p.senderName,
            pokemonName: p.pokemonName,
            fighter: p.fighter,
            damageDealt: p.damageDealt || 0,
            tries: p.tries || 1,
            joinedAt: p.joinOrder
          });
        }
      }
    }
    const participantArray = Array.from(globalRaid.participants.values()).map(p => ({
      userId: p.userId,
      senderName: p.senderName,
      pokemonName: p.pokemonName,
      damageDealt: p.damageDealt,
      tries: p.tries,
      joinOrder: p.joinedAt || Date.now(),
      fighter: p.fighter
    }));
    await ActiveRaid.findOneAndUpdate({}, {
      boss: globalRaid.boss,
      participants: participantArray,
      groupIds: Array.from(globalRaid.groupIds),
      createdAt: new Date(globalRaid.spawnedAt)
    }, {
      upsert: true,
      returnDocument: 'after'
    });
  } catch (err) {
    console.error('[Raid DB] Failed to save active raid to DB:', err.message);
  }
}
async function loadActiveRaidFromDb(client) {
  try {
    const doc = await ActiveRaid.findOne({});
    if (!doc) return null;
    const elapsed = Date.now() - new Date(doc.createdAt).getTime();
    if (elapsed >= RAID_DURATION_MS) {
      console.log('[Raid DB] Found persisted raid but it was expired. Clearing...');
      await ActiveRaid.deleteMany({});
      return null;
    }
    const participantsMap = new Map();
    for (const p of doc.participants) {
      participantsMap.set(p.userId, {
        userId: p.userId,
        senderName: p.senderName,
        pokemonName: p.pokemonName,
        fighter: p.fighter,
        damageDealt: p.damageDealt,
        tries: p.tries,
        joinedAt: p.joinOrder
      });
    }
    globalRaid = {
      boss: doc.boss,
      spawnedAt: new Date(doc.createdAt).getTime(),
      participants: participantsMap,
      groupIds: new Set(doc.groupIds),
      combatInterval: null
    };
    startCombatLoop(client);
    const remaining = RAID_DURATION_MS - elapsed;
    globalRaid.resolveTimer = setTimeout(async () => {
      if (globalRaid) {
        await resolveRaid(client);
      }
    }, remaining);
    console.log(`[Raid DB] Successfully loaded and resumed global raid: ${globalRaid.boss.name} (${Math.round(remaining / 1000 / 60)} minutes remaining)`);
    return globalRaid;
  } catch (err) {
    console.error('[Raid DB] Failed to load active raid from DB:', err.message);
    return null;
  }
}
async function init(client) {
  await loadRaidSettings();
  await loadActiveRaidFromDb(client);
  if (globalRaid) {
    try {
      await _injectOwnerParticipant();
      await saveActiveRaidToDb();
    } catch (err) {}
  }
}
async function syncFromDb(client) {
  try {
    const doc = await ActiveRaid.findOne({});
    if (!doc) {
      globalRaid = null;
      return;
    }
    const elapsed = Date.now() - new Date(doc.createdAt).getTime();
    if (elapsed >= RAID_DURATION_MS) {
      globalRaid = null;
      return;
    }
    const docTime = new Date(doc.createdAt).getTime();
    if (!globalRaid || globalRaid.spawnedAt !== docTime) {
      if (globalRaid) {
        if (globalRaid.combatInterval) clearInterval(globalRaid.combatInterval);
        if (globalRaid.resolveTimer) clearTimeout(globalRaid.resolveTimer);
      }
      const participantsMap = new Map();
      if (doc.participants) {
        for (const p of doc.participants) {
          participantsMap.set(p.userId, {
            userId: p.userId,
            senderName: p.senderName,
            pokemonName: p.pokemonName,
            fighter: p.fighter,
            damageDealt: p.damageDealt || 0,
            tries: p.tries || 1,
            joinedAt: p.joinOrder
          });
        }
      }
      globalRaid = {
        boss: doc.boss,
        spawnedAt: docTime,
        participants: participantsMap,
        groupIds: new Set(doc.groupIds),
        combatInterval: null
      };
      if (client) {
        startCombatLoop(client);
        const remaining = RAID_DURATION_MS - elapsed;
        globalRaid.resolveTimer = setTimeout(async () => {
          if (globalRaid) {
            await resolveRaid(client);
          }
        }, remaining);
      }
    } else {
      if (doc.boss && doc.boss.hp !== undefined) {
        globalRaid.boss.hp = doc.boss.hp;
      }
      if (doc.participants) {
        for (const p of doc.participants) {
          if (!globalRaid.participants.has(p.userId)) {
            globalRaid.participants.set(p.userId, {
              userId: p.userId,
              senderName: p.senderName,
              pokemonName: p.pokemonName,
              fighter: p.fighter,
              damageDealt: p.damageDealt || 0,
              tries: p.tries || 1,
              joinedAt: p.joinOrder
            });
          } else {
            const existing = globalRaid.participants.get(p.userId);
            existing.damageDealt = p.damageDealt || 0;
            existing.tries = p.tries || 1;
            if (p.fighter) existing.fighter = p.fighter;
          }
        }
      }
    }
  } catch (err) {
    console.error('[Raid DB Sync] Error syncing manually:', err.message);
  }
}
async function _injectOwnerParticipant() {
  if (!globalRaid) return;
  if (!isAutoRaidEnabled) {
    console.log('[RaidStore] Father auto raid is disabled. Skipping injection.');
    return;
  }
  const { OWNER_NAME, 
    FATHER
  } = require('../config');
  let ownerId = null;
  let ownedPokemon = null;
  for (const fid of FATHER) {
    if (globalRaid.participants.has(fid)) return;
    const found = await PokemonEntry.findOne({
      userId: fid,
      pokemonName: {
        $regex: /^Dialga-GX$/i
      }
    }).sort({
      level: -1
    });
    if (found) {
      ownerId = fid;
      ownedPokemon = found;
      break;
    }
  }
  if (!ownerId || !ownedPokemon) return;
  const pkmnData = POKEMON_LIST.find(p => p.name.toLowerCase() === 'dialga-gx') || {
    hp: 180,
    baseStats: {
      atk: 120,
      def: 120,
      speed: 90
    },
    types: ['Metal'],
    attacks: [{
      name: 'Roar Of Time',
      power: 150,
      type: 'Dragon'
    }]
  };
  const scale = (base, lvl) => Math.floor(base * (1 + lvl / 50));
  const maxHp = scale(parseInt(pkmnData.hp || 180), ownedPokemon.level);
  globalRaid.participants.set(ownerId, {
    userId: ownerId,
    senderName: OWNER_NAME + ' [Discord]',
    pokemonName: ownedPokemon.pokemonName,
    fighter: {
      name: ownedPokemon.pokemonName,
      level: ownedPokemon.level,
      maxHp,
      hp: maxHp,
      atk: scale(pkmnData.baseStats?.atk || 120, ownedPokemon.level),
      def: scale(pkmnData.baseStats?.def || 120, ownedPokemon.level),
      speed: scale(pkmnData.baseStats?.speed || 90, ownedPokemon.level),
      types: pkmnData.types || ['Metal'],
      attacks: pkmnData.attacks || [{
        name: 'Roar Of Time',
        power: 150,
        type: 'Dragon'
      }]
    },
    damageDealt: 0,
    tries: 1,
    joinedAt: Date.now()
  });
}
module.exports = {
  init,
  registerGroup,
  spawnRaid,
  enterRaid,
  resolveRaid,
  triggerHourlyRaids,
  activeRaids,
  syncFromDb,
  setAutoRaidEnabled,
  getAutoRaidEnabled
};