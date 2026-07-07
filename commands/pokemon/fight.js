const PokemonEntry = require('../../models/Pokemon');
const POKEMON_LIST = require('../../data/pokemon.json');
const knownUserStore = require('../../store/knownUserStore');
const {
  getDisplayName
} = require('../../utils/contactHelper');
const axios = require('axios');
const {
  MessageMedia
} = require('whatsapp-web.js');
const battleStore = require('../../store/battleStore');
const { getUserId } = require('../../utils/getUserId');
const activeChallenges = new Map();
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
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
function getDamagingAttacks(pkmnData) {
  if (!pkmnData.attacks || !Array.isArray(pkmnData.attacks)) {
    return [{
      name: 'Tackle',
      power: 40,
      accuracy: 100,
      type: 'Normal',
      flavorText: 'A physical charge attack.'
    }];
  }
  const damaging = pkmnData.attacks.filter(m => m && typeof m.power === 'number' && m.power > 0);
  return damaging.length > 0 ? damaging : [{
    name: 'Tackle',
    power: 40,
    accuracy: 100,
    type: 'Normal',
    flavorText: 'A physical charge attack.'
  }];
}
function showFightHelp(msg, chat) {
  return chat.sendMessage(`\n` + `    ⚔️ *KITSUNE BATTLE ARENA* ⚔️ ૮꒰ ˶• ༝ •˶꒱ა ♡\n` + `\n\n` + `Welcome to the new turn-by-turn interactive battle system! Fight other trainers in group chats using your captured Pokémon. 🎀\n\n` + `📢 *COMMANDS:* 🫧\n` + `  ▸ \`-fight @user <pokemon>\`\n` + `    _Challenge a trainer to a standard duel._\n` + `    _Example:_ \`-fight @Trainer Pikachu\` ੈ✩‧₊˚\n\n` + `  ▸ \`-fightaccept @user <pokemon>\`\n` + `    _Accept a standard battle challenge._\n` + `    _Example:_ \`-fightaccept @Trainer Charizard\` ᡣ𐭩\n\n` + `🎮 *BATTLEPLAY CONTROLS:* 🎧ྀི\n` + `  • Randomly selected player goes first.\n` + `  • Use \`-attack <move name>\` to launch an attack when it's your turn.\n` + `  • Use \`-defence\` to prepare a shield or block an incoming attack completely.\n` + `  • If you select defence, it goes on cooldown for 2 turns.\n` + `  • Used moves go on a 1-turn cooldown (must rotate attacks next turn)! ⋆｡‧˚ʚ🍓ɞ˚‧｡⋆\n\n` + `━━━━━━━━━━━━━━━━━━━━━━━━━\n` + `⚠️ _Want to put your cards on the line? Use_ \`-wager help\` _for high-stakes card battles!_ ✨ 𓆩♡𓆪`);
}
function showWagerHelp(msg, chat) {
  return chat.sendMessage(`\n` + `    🚨 *HIGH-STAKES CARD WAGERS* 🚨 ૮ ˶ᵔ ᵕ ᵔ˶ ა\n` + `\n\n` + `Put your Pokémon cards on the line! The winner of the battle takes ownership of the loser's card forever. 🎀\n\n` + `📢 *COMMANDS:* 🫧\n` + `  ▸ \`-wager @user <pokemon>\`\n` + `    _Challenge a trainer to a wager battle with your card._\n` + `    _Example:_ \`-wager @Trainer Pikachu\` ੈ✩‧₊˚\n\n` + `  ▸ \`-wager accept @user <pokemon>\`\n` + `    _Accept a wager and lock-in your card for the fight._\n` + `    _Example:_ \`-wager accept @Trainer Blastoise\` ᡣ𐭩\n\n` + `⚠️ *IMPORTANT RULES:* 🎧ྀི\n` + `  • You must own the Pokémon card you are wagering.\n` + `  • Once accepted, the card database owner updates to the winner automatically!\n` + `  • standard turn-by-turn interactive battle mechanics apply. ⋆｡‧˚ʚ🍓ɞ˚‧｡⋆\n\n` + `━━━━━━━━━━━━━━━━━━━━━━━━━\n` + `⚔️ _Want a friendly duel with no risks? Use_ \`-fight help\`_!_ ✨ 𓆩♡𓆪`);
}
function handleStandardChallenge(msg, chat, senderId, senderName, targetId, targetName, ownedPokemon) {
  const key = `${targetId}:${senderId}:false`;
  activeChallenges.set(key, {
    senderId,
    senderName,
    senderPokemon: ownedPokemon.pokemonName,
    senderLevel: ownedPokemon.level,
    isWager: false,
    timestamp: Date.now()
  });
  setTimeout(() => {
    if (activeChallenges.has(key)) {
      activeChallenges.delete(key);
    }
  }, 5 * 60 * 1000);
  return chat.sendMessage(`\n` + `    ⚔️ *CHALLENGE INITIATED!* ⚔️ ૮꒰ ˶• ༝ •˶꒱ა ♡\n` + `\n\n` + `👤 *Challenger:* ${senderName} 🎀\n` + `🏷️ *Pokémon:* ${ownedPokemon.pokemonName} (Lv. ${ownedPokemon.level}) 🫧\n` + `🎯 *Opponent:* @${targetId} ᡣ𐭩\n\n` + `🛡️ *To Accept:* Type \`-fightaccept @${senderId} <your_pokemon>\` to start the battle! ੈ✩‧₊˚`, {
    mentions: [targetId + '@c.us']
  });
}
function handleWagerChallenge(msg, chat, senderId, senderName, targetId, targetName, ownedPokemon) {
  const key = `${targetId}:${senderId}:true`;
  activeChallenges.set(key, {
    senderId,
    senderName,
    senderPokemon: ownedPokemon.pokemonName,
    senderLevel: ownedPokemon.level,
    isWager: true,
    timestamp: Date.now()
  });
  setTimeout(() => {
    if (activeChallenges.has(key)) {
      activeChallenges.delete(key);
    }
  }, 5 * 60 * 1000);
  return chat.sendMessage(`\n` + `    🚨 *HIGH-STAKES WAGER CHALLENGE!* 🚨 ૮ ˶ᵔ ᵕ ᵔ˶ ა\n` + `\n\n` + `👤 *Challenger:* ${senderName} 🎀\n` + `🏷️ *Wagered Pokémon:* ${ownedPokemon.pokemonName} (Lv. ${ownedPokemon.level}) ⚠️ 🫧\n` + `🎯 *Opponent:* @${targetId} ᡣ𐭩\n\n` + `⚠️ *THE WINNER KEEPS THE LOSER'S CARD!* ⚠️ ੈ✩‧₊˚\n\n` + `🛡️ *To Accept Wager:* Type \`-wager accept @${senderId} <your_pokemon>\` 🎧ྀི`, {
    mentions: [targetId + '@c.us']
  });
}
async function handleWagerAccept(msg, chat, accepterId, accepterName, challengerId, challengerName, ownedAccepterPokemon, client) {
  const key = `${accepterId}:${challengerId}:true`;
  const challenge = activeChallenges.get(key);
  if (!challenge) {
    return msg.reply(`❌ _No active wager challenge found from @${challengerId}!_`);
  }
  activeChallenges.delete(key);
  return runBattle(msg, chat, challengerId, challenge.senderName, challenge.senderPokemon, challenge.senderLevel, accepterId, accepterName, ownedAccepterPokemon.pokemonName, ownedAccepterPokemon.level, true, client);
}
const fightCommand = {
  name: 'fight',
  aliases: ['pokefight'],
  description: 'Challenge another trainer to a turn-based Pokémon battle. Usage: -fight @user <pokemon>',
  adminOnly: false,
  async execute(msg, args, client) {
    const chat = await msg.getChat();
    if (!chat.isGroup) return msg.reply('❌ _This command only works in groups._');
    const groupId = chat.id._serialized;
    if (battleStore.getBattle(groupId)) {
      return msg.reply('❌ _There is already an active battle running in this group! Wait for it to finish._');
    }
    const argStr = args.join(' ').toLowerCase().trim();
    if (args.length === 0 || argStr === 'help') {
      return showFightHelp(msg, chat);
    }
    const mentions = await msg.getMentions();
    if (mentions.length === 0) {
      return msg.reply('❌ _Please mention a trainer to fight!_\n_Example: -fight @user Pikachu_');
    }
    const targetUser = mentions[0];
    const targetId = getUserId(targetUser);
    const targetName = getDisplayName(targetUser);
    const sender = await msg.getContact();
    const senderId = getUserId(sender);
    const senderName = getDisplayName(sender);
    if (senderId === targetId) {
      return msg.reply('❌ _You cannot fight yourself, trainer!_');
    }
    const cleanArgs = args.filter(arg => !arg.startsWith('@'));
    const pokemonName = cleanArgs.join(' ').replace(/['"“”]/g, '').trim();
    if (!pokemonName) {
      return msg.reply('❌ _Please specify which Pokémon you want to send to battle!_');
    }
    const ownedPokemon = await PokemonEntry.findOne({
      userId: senderId,
      pokemonName: {
        $regex: new RegExp(`^${pokemonName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i')
      }
    }).sort({
      level: -1
    });
    if (!ownedPokemon) {
      return msg.reply(`❌ _You do not own a "${pokemonName}" in your Pokédex!_`);
    }
    if (ownedPokemon.pokemonName.toLowerCase() === '30th celebration zorua') {
      return msg.reply(`❌ _This exclusive Pokémon cannot be used in battles!_`);
    }
    return handleStandardChallenge(msg, chat, senderId, senderName, targetId, targetName, ownedPokemon);
  }
};
const fightAcceptCommand = {
  name: 'fightaccept',
  aliases: ['faccept', 'acceptfight'],
  description: 'Accept an active Pokémon battle challenge. Usage: -fightaccept @user <pokemon>',
  adminOnly: false,
  async execute(msg, args, client) {
    const chat = await msg.getChat();
    if (!chat.isGroup) return msg.reply('❌ _This command only works in groups._');
    const groupId = chat.id._serialized;
    if (battleStore.getBattle(groupId)) {
      return msg.reply('❌ _There is already an active battle running in this group! Wait for it to finish._');
    }
    const sender = await msg.getContact();
    const accepterId = getUserId(sender);
    const accepterName = getDisplayName(sender);
    const mentions = await msg.getMentions();
    if (mentions.length === 0) {
      return msg.reply('❌ _Please mention the challenger whose fight you want to accept!_\n_Example: -fightaccept @user Pikachu_');
    }
    const challengerUser = mentions[0];
    const challengerId = getUserId(challengerUser);
    const cleanArgs = args.filter(arg => !arg.startsWith('@'));
    const pokemonName = cleanArgs.join(' ').replace(/['"“”]/g, '').trim();
    if (!pokemonName) {
      return msg.reply('❌ _Please specify which Pokémon you want to send to battle!_');
    }
    const ownedPokemon = await PokemonEntry.findOne({
      userId: accepterId,
      pokemonName: {
        $regex: new RegExp(`^${pokemonName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i')
      }
    }).sort({
      level: -1
    });
    if (!ownedPokemon) {
      return msg.reply(`❌ _You do not own a "${pokemonName}" in your Pokédex!_`);
    }
    if (ownedPokemon.pokemonName.toLowerCase() === '30th celebration zorua') {
      return msg.reply(`❌ _This exclusive Pokémon cannot be used in battles!_`);
    }
    const key = `${accepterId}:${challengerId}:false`;
    const challenge = activeChallenges.get(key);
    if (!challenge) {
      return msg.reply(`❌ _No active standard challenge found from @${challengerId}!_`);
    }
    activeChallenges.delete(key);
    return runBattle(msg, chat, challengerId, challenge.senderName, challenge.senderPokemon, challenge.senderLevel, accepterId, accepterName, ownedPokemon.pokemonName, ownedPokemon.level, false, client);
  }
};
const wagerCommand = {
  name: 'wager',
  aliases: ['wagerfight', 'fightwager'],
  description: 'Challenge a trainer to a high-stakes card wager battle. Usage: -wager @user <pokemon>',
  adminOnly: false,
  async execute(msg, args, client) {
    const chat = await msg.getChat();
    if (!chat.isGroup) return msg.reply('❌ _This command only works in groups._');
    const groupId = chat.id._serialized;
    if (battleStore.getBattle(groupId)) {
      return msg.reply('❌ _There is already an active battle running in this group! Wait for it to finish._');
    }
    const argStr = args.join(' ').toLowerCase().trim();
    if (args.length === 0 || argStr === 'help') {
      return showWagerHelp(msg, chat);
    }
    const mentions = await msg.getMentions();
    if (mentions.length === 0) {
      return msg.reply('❌ _Please mention a trainer to wager against!_\n_Example: -wager @user Pikachu_');
    }
    const targetUser = mentions[0];
    const targetId = getUserId(targetUser);
    const targetName = getDisplayName(targetUser);
    const sender = await msg.getContact();
    const senderId = getUserId(sender);
    const senderName = getDisplayName(sender);
    if (senderId === targetId) {
      return msg.reply('❌ _You cannot wager fight yourself, trainer!_');
    }
    const isWagerAccept = args.some(arg => arg.toLowerCase() === 'accept');
    const cleanArgs = args.filter(arg => !arg.startsWith('@') && arg.toLowerCase() !== 'accept');
    const pokemonName = cleanArgs.join(' ').replace(/['"“”]/g, '').trim();
    if (!pokemonName) {
      return msg.reply('❌ _Please specify which Pokémon you want to send to battle!_');
    }
    const ownedPokemon = await PokemonEntry.findOne({
      userId: senderId,
      pokemonName: {
        $regex: new RegExp(`^${pokemonName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i')
      }
    }).sort({
      level: -1
    });
    if (!ownedPokemon) {
      return msg.reply(`❌ _You do not own a "${pokemonName}" in your Pokédex!_`);
    }
    if (ownedPokemon.pokemonName.toLowerCase() === '30th celebration zorua') {
      return msg.reply(`❌ _This exclusive Pokémon cannot be used in battles!_`);
    }
    if (isWagerAccept) {
      return handleWagerAccept(msg, chat, senderId, senderName, targetId, targetName, ownedPokemon, client);
    } else {
      return handleWagerChallenge(msg, chat, senderId, senderName, targetId, targetName, ownedPokemon);
    }
  }
};
function calculateDamage(attacker, defender, move) {
  const movePower = move.power || 40;
  const moveType = move.type || 'Normal';
  let typeMult = 1.0;
  for (const defType of defender.types) {
    if (TYPE_CHART[moveType] && TYPE_CHART[moveType][defType] !== undefined) {
      typeMult *= TYPE_CHART[moveType][defType];
    }
  }
  const isCrit = Math.random() < 0.10;
  const critMult = isCrit ? 1.5 : 1.0;
  const variance = Math.random() * 0.15 + 0.85;
  const levelFactor = 2 * attacker.level / 5 + 2;
  const statRatio = attacker.atk / Math.max(10, defender.def);
  const baseDamage = Math.floor(levelFactor * movePower * statRatio / 25 + 8);
  const finalDamage = Math.floor(baseDamage * critMult * typeMult * variance);
  return {
    damage: Math.max(5, finalDamage),
    crit: isCrit,
    typeMult
  };
}
async function runBattle(msg, chat, p1Id, p1Name, p1PkmnName, p1Lvl, p2Id, p2Name, p2PkmnName, p2Lvl, isWager, client) {
  const groupId = chat.id._serialized;
  const p1Data = POKEMON_LIST.find(p => p.name.toLowerCase() === p1PkmnName.toLowerCase()) || {
    hp: 70,
    baseStats: {
      atk: 60,
      def: 55,
      speed: 50
    },
    types: ["Normal"],
    attacks: []
  };
  const p2Data = POKEMON_LIST.find(p => p.name.toLowerCase() === p2PkmnName.toLowerCase()) || {
    hp: 70,
    baseStats: {
      atk: 60,
      def: 55,
      speed: 50
    },
    types: ["Normal"],
    attacks: []
  };
  const economyStore = require('../../store/economyStore');
  const p1Wallet = await economyStore.getWallet(p1Id);
  const p2Wallet = await economyStore.getWallet(p2Id);
  const p1Entry = await PokemonEntry.findOne({
    userId: p1Id,
    pokemonName: {
      $regex: new RegExp(`^${p1PkmnName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i')
    }
  }).sort({
    level: -1
  });
  const p2Entry = await PokemonEntry.findOne({
    userId: p2Id,
    pokemonName: {
      $regex: new RegExp(`^${p2PkmnName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i')
    }
  }).sort({
    level: -1
  });
  const p1Prestige = economyStore.getEffectivePrestige(p1Wallet.prestigeLevel, p1Entry?.prestigeStamp);
  const p2Prestige = economyStore.getEffectivePrestige(p2Wallet.prestigeLevel, p2Entry?.prestigeStamp);
  const p1Mult = economyStore.getPrestigeMultiplier(p1Prestige);
  const p2Mult = economyStore.getPrestigeMultiplier(p2Prestige);
  let p1HpMult = 1;
  let p2HpMult = 1;
  let p1StatMult = 1;
  let p2StatMult = 1;
  let p1StatPrestigeForAttacks = 0;
  let p2StatPrestigeForAttacks = 0;
  let p1HpHalved = false;
  let p2HpHalved = false;
  if (p1Prestige > p2Prestige) {
    p1HpMult = p1Mult;
    p1HpHalved = true;
  } else if (p2Prestige > p1Prestige) {
    p2HpMult = p2Mult;
    p2HpHalved = true;
  }
  const scale = (base, lvl, mult) => Math.floor(base * (1 + lvl / 50) * mult);
  let p1MaxHp = scale(parseInt(p1Data.hp || 70), p1Lvl, p1HpMult);
  let p2MaxHp = scale(parseInt(p2Data.hp || 70), p2Lvl, p2HpMult);
  if (p1HpHalved) {
    p1MaxHp = Math.floor(p1MaxHp / 2);
  }
  if (p2HpHalved) {
    p2MaxHp = Math.floor(p2MaxHp / 2);
  }
  const p1Attacks = getDamagingAttacks({
    attacks: economyStore.applyPrestigeToAttacks(p1Data.attacks || [], p1StatPrestigeForAttacks)
  });
  const p2Attacks = getDamagingAttacks({
    attacks: economyStore.applyPrestigeToAttacks(p2Data.attacks || [], p2StatPrestigeForAttacks)
  });
  const fighter1 = {
    id: p1Id,
    trainerName: p1Name,
    name: p1PkmnName,
    level: p1Lvl,
    maxHp: p1MaxHp,
    hp: p1MaxHp,
    atk: scale(p1Data.baseStats?.atk || 60, p1Lvl, p1StatMult),
    def: scale(p1Data.baseStats?.def || 55, p1Lvl, p1StatMult),
    speed: scale(p1Data.baseStats?.speed || 50, p1Lvl, p1StatMult),
    types: p1Data.types || ["Normal"],
    attacks: p1Attacks,
    cardImage: p1Data.cardImage,
    defended: false,
    prestigeLevel: p1Prestige,
    prestigeMult: p1StatMult
  };
  const fighter2 = {
    id: p2Id,
    trainerName: p2Name,
    name: p2PkmnName,
    level: p2Lvl,
    maxHp: p2MaxHp,
    hp: p2MaxHp,
    atk: scale(p2Data.baseStats?.atk || 60, p2Lvl, p2StatMult),
    def: scale(p2Data.baseStats?.def || 55, p2Lvl, p2StatMult),
    speed: scale(p2Data.baseStats?.speed || 50, p2Lvl, p2StatMult),
    types: p2Data.types || ["Normal"],
    attacks: p2Attacks,
    cardImage: p2Data.cardImage,
    defended: false,
    prestigeLevel: p2Prestige,
    prestigeMult: p2StatMult
  };
  const battle = battleStore.createBattle(groupId, fighter1, fighter2);
  battle.isWager = isWager;
  const hpBar = char => {
    const pct = char.hp / char.maxHp;
    const filledSize = Math.round(pct * 10);
    const emptySize = 10 - filledSize;
    const bar = '█'.repeat(Math.max(0, filledSize)) + '░'.repeat(Math.max(0, emptySize));
    const pctText = Math.round(pct * 100);
    return `\`[${bar}]\` *${pctText}%* (${char.hp}/${char.maxHp} HP)`;
  };
  const prestigeBadge = lvl => lvl > 0 ? ` ⭐×${lvl}` : '';
  let p1BoostStr = p1Mult > 1 ? ` [×${p1Mult} Prestige Boost]` : '';
  if (p1HpHalved) {
    p1BoostStr = ` [×${p1HpMult} HP Boost (Halved) │ ×${p1StatMult} Stat Boost]`;
  }
  let p2BoostStr = p2Mult > 1 ? ` [×${p2Mult} Prestige Boost]` : '';
  if (p2HpHalved) {
    p2BoostStr = ` [×${p2HpMult} HP Boost (Halved) │ ×${p2StatMult} Stat Boost]`;
  }
  let introText = `\n` + `    🏟️ *KITSUNE COMBAT STADIUM* 🏟️ ૮꒰ ˶• ༝ •˶꒱ა ♡\n` + `\n\n` + `🔴 *Trainer:* ${p1Name} (@${p1Id})${prestigeBadge(p1Prestige)} 🎀\n` + `🏷️ *Pokémon:* *${p1PkmnName}* (Lv. ${p1Lvl})${p1BoostStr} 🫧\n` + `📊 *Stats:* ❤️ ${fighter1.maxHp} HP │ ⚔️ ${fighter1.atk} ATK │ 🛡️ ${fighter1.def} DEF ੈ✩‧₊˚\n` + `📖 *Moves:* ${fighter1.attacks.map(m => `*${m.name}*`).join(', ')} ᡣ𐭩\n\n` + `    🆚 *VERSUS* 🆚\n\n` + `🔵 *Trainer:* ${p2Name} (@${p2Id})${prestigeBadge(p2Prestige)} 🎧ྀི\n` + `🏷️ *Pokémon:* *${p2PkmnName}* (Lv. ${p2Lvl})${p2BoostStr} 𓍢ִ໋🌷͙֒\n` + `📊 *Stats:* ❤️ ${fighter2.maxHp} HP │ ⚔️ ${fighter2.atk} ATK │ 🛡️ ${fighter2.def} DEF ⋆｡‧˚ʚ🍓ɞ˚‧｡⋆\n` + `📖 *Moves:* ${fighter2.attacks.map(m => `*${m.name}*`).join(', ')} ୨୧\n\n` + `━━━━━━━━━━━━━━━━━━━━━━━━━\n` + `⚡ *First chance chosen randomly!* *${battle.turn === 1 ? fighter1.name : fighter2.name}* strikes first! ✨\n` + `🎮 *BATTLE READY!* Actions must be entered using \`-attack <move name>\` or \`-defence\`. 𓆩♡𓆪`;
  await chat.sendMessage(introText, {
    mentions: [p1Id + '@c.us', p2Id + '@c.us']
  });
  await sleep(2500);
  const roundSummary = [];
  let battleActive = true;
  while (fighter1.hp > 0 && fighter2.hp > 0 && battleActive) {
    const attacker = battle.turn === 1 ? fighter1 : fighter2;
    const defender = battle.turn === 1 ? fighter2 : fighter1;
    const attackerNum = battle.turn;
    const defenderNum = battle.turn === 1 ? 2 : 1;
    const optionsMsg = `🎮 *[ROUND ${battle.round}]* 🎮\n` + `🔴 *${fighter1.name}*: ${hpBar(fighter1)}\n` + `🔵 *${fighter2.name}*: ${hpBar(fighter2)}\n` + `━━━━━━━━━━━━━━━━━━━━━━━━━\n` + `👉 @${attacker.id}, it's your turn to act!\n\n` + `⚔️ *Available attacks:* ${attacker.attacks.map(m => {
      const cd = battle.moveCooldowns[attackerNum][m.name.toLowerCase()] || 0;
      return cd > 0 ? `~${m.name}~ (❌ Cooldown)` : `*${m.name}*`;
    }).join(', ')}\n` + `🛡️ *Defence Status:* ${battle.defenceCooldown[attackerNum] > 0 ? `❌ Cooldown (${battle.defenceCooldown[attackerNum]} turns)` : '✅ Ready'}\n\n` + `Reply with \`-attack <move name>\` to strike,\n` + `or \`-defence\` to prepare a defensive shield.\n\n` + `⏳ *Time Limit:* 60 seconds to choose!`;
    await chat.sendMessage(optionsMsg, {
      mentions: [attacker.id + '@c.us']
    });
    const responsePromise = new Promise(resolve => {
      battleStore.setPendingInput(groupId, attacker.id, resolve, 60000);
    });
    const input = await responsePromise;
    if (input.type === 'timeout') {
      await chat.sendMessage(`⏰ *Time's up!* @${attacker.id} took too long to make a move and forfeits the battle!`, {
        mentions: [attacker.id + '@c.us']
      });
      fighter1.hp = attackerNum === 1 ? 0 : fighter1.hp;
      fighter2.hp = attackerNum === 2 ? 0 : fighter2.hp;
      break;
    }
    if (input.type === 'defence') {
      if (battle.defenceCooldown[attackerNum] > 0) {
        await chat.sendMessage(`❌ *Defence is on cooldown!* You must attack instead, @${attacker.id}.`, {
          mentions: [attacker.id + '@c.us']
        });
        await sleep(1500);
        continue;
      }
      attacker.defended = true;
      battle.defenceCooldown[attackerNum] = 2;
      for (const key in battle.moveCooldowns[attackerNum]) {
        if (battle.moveCooldowns[attackerNum][key] > 0) {
          battle.moveCooldowns[attackerNum][key]--;
        }
      }
      await chat.sendMessage(`🛡️ *${attacker.name}* prepared a defensive shield! They will block the next incoming attack completely!`);
      battle.turn = defenderNum;
      battle.round++;
      await sleep(2000);
      continue;
    }
    if (input.type === 'attack') {
      const moveName = input.moveName;
      const move = attacker.attacks.find(m => m.name.toLowerCase() === moveName.toLowerCase());
      if (!move) {
        await chat.sendMessage(`❌ *Invalid Move!* Please choose a move from: ${attacker.attacks.map(m => `*${m.name}*`).join(', ')}`);
        await sleep(1500);
        continue;
      }
      const currentCd = battle.moveCooldowns[attackerNum][move.name.toLowerCase()] || 0;
      if (currentCd > 0 && attacker.attacks.length > 1) {
        await chat.sendMessage(`❌ *Move on Cooldown!* *${move.name}* cannot be used this turn. Choose another move.`);
        await sleep(1500);
        continue;
      }
      for (const key in battle.moveCooldowns[attackerNum]) {
        if (battle.moveCooldowns[attackerNum][key] > 0) {
          battle.moveCooldowns[attackerNum][key]--;
        }
      }
      if (attacker.attacks.length > 1) {
        battle.moveCooldowns[attackerNum][move.name.toLowerCase()] = 1;
      }
      if (defender.defended) {
        defender.defended = false;
        await chat.sendMessage(`🛡️ *${defender.name}*'s prepared shield completely blocked *${attacker.name}*'s *${move.name}*!`);
        battle.defenceCooldown[attackerNum] = Math.max(0, battle.defenceCooldown[attackerNum] - 1);
        battle.turn = defenderNum;
        battle.round++;
        await sleep(2000);
        continue;
      }
      let defenderActionResolved = false;
      let defMove = null;
      let defActionType = null;
      while (!defenderActionResolved) {
        const defenderPrompt = `⚔️ *${attacker.name}* used *${move.name}* against you!\n` + `👉 @${defender.id}, how will you respond?\n\n` + `🛡️ Reply \`-defence\` to completely block the attack (${battle.defenceCooldown[defenderNum] > 0 ? `❌ Cooldown (${battle.defenceCooldown[defenderNum]} turns)` : '✅ Ready'})\n` + `⚔️ Reply \`-attack <move name>\` to counter-attack (both deal damage!)\n` + `📋 *Your Moves:* ${defender.attacks.map(m => {
          const cd = battle.moveCooldowns[defenderNum][m.name.toLowerCase()] || 0;
          return cd > 0 ? `~${m.name}~ (❌ Cooldown)` : `*${m.name}*`;
        }).join(', ')}\n\n` + `⏳ *Time Limit:* 60 seconds to respond!`;
        await chat.sendMessage(defenderPrompt, {
          mentions: [defender.id + '@c.us']
        });
        const defenderPromise = new Promise(resolve => {
          battleStore.setPendingInput(groupId, defender.id, resolve, 60000);
        });
        const defInput = await defenderPromise;
        if (defInput.type === 'timeout') {
          await chat.sendMessage(`⏰ *Time's up!* @${defender.id} took too long to respond and forfeits the battle!`, {
            mentions: [defender.id + '@c.us']
          });
          fighter1.hp = defenderNum === 1 ? 0 : fighter1.hp;
          fighter2.hp = defenderNum === 2 ? 0 : fighter2.hp;
          battleActive = false;
          break;
        }
        if (defInput.type === 'defence') {
          defActionType = 'defence';
          defenderActionResolved = true;
        } else if (defInput.type === 'attack') {
          const defMoveName = defInput.moveName;
          const foundMove = defender.attacks.find(m => m.name.toLowerCase() === defMoveName.toLowerCase());
          if (!foundMove) {
            await chat.sendMessage(`❌ *Invalid Move!* Please choose a move from your list.`);
            await sleep(1500);
            continue;
          }
          const cd = battle.moveCooldowns[defenderNum][foundMove.name.toLowerCase()] || 0;
          if (cd > 0 && defender.attacks.length > 1) {
            await chat.sendMessage(`❌ *Move on Cooldown!* *${foundMove.name}* is on cooldown. Please choose another move.`);
            await sleep(1500);
            continue;
          }
          defMove = foundMove;
          defActionType = 'attack';
          defenderActionResolved = true;
        }
      }
      if (!battleActive) break;
      if (defActionType === 'defence') {
        if (battle.defenceCooldown[defenderNum] > 0) {
          const firstMove = defender.attacks.find(m => (battle.moveCooldowns[defenderNum][m.name.toLowerCase()] || 0) === 0) || defender.attacks[0];
          const dmgAttacker = calculateDamage(attacker, defender, move);
          defender.hp = Math.max(0, defender.hp - dmgAttacker.damage);
          for (const key in battle.moveCooldowns[defenderNum]) {
            if (battle.moveCooldowns[defenderNum][key] > 0) {
              battle.moveCooldowns[defenderNum][key]--;
            }
          }
          if (defender.attacks.length > 1) {
            battle.moveCooldowns[defenderNum][firstMove.name.toLowerCase()] = 1;
          }
          if (defender.hp <= 0) {
            await chat.sendMessage(`❌ *Defence was on cooldown!* @${defender.id} tried to defend but failed!\n` + `⚔️ *${attacker.name}* used *${move.name}* and dealt **${dmgAttacker.damage}** damage! ${dmgAttacker.crit ? '🎯 CRITICAL!' : ''}\n` + `💀 *${defender.name}* fainted and could not counter-attack!`, {
              mentions: [defender.id + '@c.us']
            });
            roundSummary.push(`*Rd ${battle.round}:* ${attacker.name} ${move.name} (${dmgAttacker.damage}) ➔ ${defender.name} Fainted`);
            battle.defenceCooldown[attackerNum] = Math.max(0, battle.defenceCooldown[attackerNum] - 1);
          } else {
            const dmgDefender = calculateDamage(defender, attacker, firstMove);
            attacker.hp = Math.max(0, attacker.hp - dmgDefender.damage);
            await chat.sendMessage(`❌ *Defence was on cooldown!* @${defender.id} was forced to counter-attack!\n\n` + `⚔️ *${attacker.name}* used *${move.name}* and dealt **${dmgAttacker.damage}** damage! ${dmgAttacker.crit ? '🎯 CRITICAL!' : ''}\n` + `⚡ *${defender.name}* counter-attacked with *${firstMove.name}* and dealt **${dmgDefender.damage}** damage! ${dmgDefender.crit ? '🎯 CRITICAL!' : ''}`, {
              mentions: [defender.id + '@c.us']
            });
            roundSummary.push(`*Rd ${battle.round}:* ${attacker.name} ${move.name} (${dmgAttacker.damage}) ➔ ${defender.name} ${firstMove.name} (${dmgDefender.damage})`);
            battle.defenceCooldown[attackerNum] = Math.max(0, battle.defenceCooldown[attackerNum] - 1);
            battle.defenceCooldown[defenderNum] = Math.max(0, battle.defenceCooldown[defenderNum] - 1);
          }
        } else {
          battle.defenceCooldown[defenderNum] = 2;
          battle.defenceCooldown[attackerNum] = Math.max(0, battle.defenceCooldown[attackerNum] - 1);
          for (const key in battle.moveCooldowns[defenderNum]) {
            if (battle.moveCooldowns[defenderNum][key] > 0) {
              battle.moveCooldowns[defenderNum][key]--;
            }
          }
          await chat.sendMessage(`🛡️ *${defender.name}* completely blocked the move *${move.name}*!`);
          roundSummary.push(`*Rd ${battle.round}:* ${attacker.name} ${move.name} ➔ Blocked by ${defender.name}`);
        }
      } else if (defActionType === 'attack') {
        const dmgAttacker = calculateDamage(attacker, defender, move);
        defender.hp = Math.max(0, defender.hp - dmgAttacker.damage);
        for (const key in battle.moveCooldowns[defenderNum]) {
          if (battle.moveCooldowns[defenderNum][key] > 0) {
            battle.moveCooldowns[defenderNum][key]--;
          }
        }
        if (defender.attacks.length > 1) {
          battle.moveCooldowns[defenderNum][defMove.name.toLowerCase()] = 1;
        }
        if (defender.hp <= 0) {
          await chat.sendMessage(`⚔️ *${attacker.name}* used *${move.name}* and dealt **${dmgAttacker.damage}** damage! ${dmgAttacker.crit ? '🎯 CRITICAL!' : ''}\n` + `💀 *${defender.name}* fainted and could not counter-attack!`);
          roundSummary.push(`*Rd ${battle.round}:* ${attacker.name} ${move.name} (${dmgAttacker.damage}) ➔ ${defender.name} Fainted`);
          battle.defenceCooldown[attackerNum] = Math.max(0, battle.defenceCooldown[attackerNum] - 1);
        } else {
          const dmgDefender = calculateDamage(defender, attacker, defMove);
          attacker.hp = Math.max(0, attacker.hp - dmgDefender.damage);
          await chat.sendMessage(`⚔️ *${attacker.name}* used *${move.name}* and dealt **${dmgAttacker.damage}** damage! ${dmgAttacker.crit ? '🎯 CRITICAL!' : ''}\n` + `⚡ *${defender.name}* counter-attacked with *${defMove.name}* and dealt **${dmgDefender.damage}** damage! ${dmgDefender.crit ? '🎯 CRITICAL!' : ''}`);
          roundSummary.push(`*Rd ${battle.round}:* ${attacker.name} ${move.name} (${dmgAttacker.damage}) ➔ ${defender.name} ${defMove.name} (${dmgDefender.damage})`);
          battle.defenceCooldown[attackerNum] = Math.max(0, battle.defenceCooldown[attackerNum] - 1);
          battle.defenceCooldown[defenderNum] = Math.max(0, battle.defenceCooldown[defenderNum] - 1);
        }
      }
      battle.turn = defenderNum;
      battle.round++;
      await sleep(2000);
    }
  }
  battleStore.deleteBattle(groupId);
  const winner = fighter1.hp > 0 ? fighter1 : fighter2;
  const loser = fighter1.hp > 0 ? fighter2 : fighter1;
  try {
    const economyStore = require('../../store/economyStore');
    await economyStore.addUserXP(winner.id, 10);
  } catch (xpErr) {
    console.error('[Fight XP Reward] Error:', xpErr);
  }
  let summaryText = `\n` + `    🏆 *POKÉMON BATTLE OVER!* 🏆 ૮ ˶ᵔ ᵕ ᵔ˶ ა\n` + `\n\n` + `🎉 *Winner:* ${winner.trainerName} with *${winner.name}*! 🎀\n\n` + `📋 *BATTLE ROUNDS SUMMARY:* 🫧\n` + roundSummary.slice(-8).join('\n') + `\n\n` + `━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
  if (isWager) {
    try {
      const loserCard = await PokemonEntry.findOne({
        userId: loser.id,
        pokemonName: loser.name,
        level: loser.level
      });
      if (loserCard) {
        const loserPrestige = loser.prestigeLevel || 0;
        loserCard.prestigeStamp = Math.max(loserCard.prestigeStamp || 0, loserPrestige);
        loserCard.userId = winner.id;
        await loserCard.save();
        summaryText += `🚨 *WAGER TRANSFER SUCCESSFUL!*\n` + `🎁 @${winner.id} has claimed the Level ${loser.level} *${loser.name}* from @${loser.id}! ⚠️ (+10 XP)`;
      } else {
        summaryText += `⚠️ _Wager transfer failed: card not found in database._`;
      }
    } catch (dbErr) {
      console.error('[Wager db transfer error]:', dbErr);
      summaryText += `⚠️ _Wager database transfer error!_`;
    }
  } else {
    summaryText += `🎉 _Congratulations to the winner! Great battle!_ (+10 XP)`;
  }
  await chat.sendMessage(summaryText, {
    mentions: [winner.id + '@c.us', loser.id + '@c.us']
  });
  if (winner.cardImage) {
    try {
      let media;
      if (winner.cardImage.startsWith('http')) {
        const imgRes = await axios.get(winner.cardImage, {
          responseType: 'arraybuffer',
          timeout: 15000
        });
        const base64 = Buffer.from(imgRes.data).toString('base64');
        media = new MessageMedia('image/png', base64, `${winner.name}.png`);
      } else {
        media = MessageMedia.fromFilePath(winner.cardImage);
      }
      await chat.sendMessage(media);
      await chat.sendMessage(`🏆 *Champion Card:* ${winner.name} (Lv. ${winner.level})`);
    } catch (imgErr) {
      console.warn('[Battle] Failed to fetch champion card image:', imgErr.message);
    }
  }
}
module.exports = [fightCommand, fightAcceptCommand, wagerCommand];