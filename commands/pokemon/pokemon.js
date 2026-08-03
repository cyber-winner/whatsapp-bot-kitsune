const { OWNER_NAME } = require('../../config');
const axios = require('axios');
const {
  MessageMedia
} = require('../../utils/baileysCompat');
const {
  getUserPokedex,
  getPokemonDetails,
  getUserStats,
  pokemonMetaMap
} = require('../../store/pokemonStore');
const {
  getDisplayName
} = require('../../utils/contactHelper');
const { getUserId } = require('../../utils/getUserId');
const TYPE_EMOJI = {
  Grass: '🌿',
  Fire: '🔥',
  Water: '💧',
  Lightning: '⚡',
  Psychic: '🔮',
  Fighting: '🥊',
  Darkness: '🌑',
  Metal: '⚙️',
  Dragon: '🐉',
  Fairy: '🧚',
  Colorless: '⬜',
  Normal: '⬜'
};
function typeEmoji(t) {
  return TYPE_EMOJI[t] || '❓';
}
module.exports = {
  name: 'pokemon',
  aliases: ['pkmn', 'pk'],
  description: 'Pokemon commands. Usage: -pokemon list | -pokemon details <name> [@user]',
  adminOnly: false,
  async execute(msg, args, client) {
    const chat = await msg.getChat();
    if (!chat.isGroup) return msg.reply('❌ _This command only works in groups._');
    const subcommand = (args[0] || '').toLowerCase();
    if (subcommand === 'list') {
      return handleList(msg, args.slice(1), client, chat);
    } else if (subcommand === 'details' || subcommand === 'detail' || subcommand === 'info') {
      return handleDetails(msg, args.slice(1), client, chat);
    } else if (subcommand === 'sell') {
      return handleSell(msg, args.slice(1), client, chat);
    } else if (subcommand === 'buy') {
      return handleBuy(msg, args.slice(1), client, chat);
    } else {
      return chat.sendMessage(`⚡ *POKÉMON COMMAND SYSTEM* ⚡\n\n` + `📝 *Usages & Descriptions:*\n\n` + `  ▸ \`-pokemon list [tag] [page]\`\n` + `    _View your caught Pokémon. Filter by 'legendary', 'mythical', or name._\n\n` + `  ▸ \`-pokemon details <name> [@user]\`\n` + `    _View RPG stats, types, moves, abilities, and card image of a Pokémon._\n\n` + `  ▸ \`-pokemon sell <cost> <pokemon name>\`\n` + `    _List a Pokémon for sale in the marketplace._\n\n` + `  ▸ \`-pokemon buy @user <pokemon name>\`\n` + `    _Buy another trainer's listed Pokémon._\n\n` + `  ▸ \`-pokedex inspect @user [tag] [page]\`\n` + `    _Inspect another trainer's Pokémon collection._\n\n` + `━━━━━━━━━━━━━━━━━━━━━━\n` + `_~Gotta catch 'em all!~_ ✨`);
    }
  }
};
async function handleList(msg, args, client, chat) {
  const sender = await msg.getContact();
  const senderId = getUserId(sender);
  const senderName = getDisplayName(sender);
  const dex = await getUserPokedex(senderId);
  const stats = await getUserStats(senderId);
  if (dex.length === 0) {
    return chat.sendMessage(`📭 *${senderName}*, your Pokédex is empty!\n\n` + `_Wild Pokémon spawn every 25 messages._\n` + `_When one appears, type:_\n` + `\`kitsune catch <pokémon name>\`\n\n` + `_~Start your journey, trainer!~_ ✨`);
  }
  let page = 1;
  let tag = '';
  if (args.length > 0) {
    const lastArg = args[args.length - 1];
    if (!isNaN(parseInt(lastArg))) {
      page = parseInt(lastArg) || 1;
      tag = args.slice(0, args.length - 1).join(' ').trim();
    } else {
      tag = args.join(' ').trim();
    }
  }
  let filteredDex = dex;
  if (tag) {
    const tagLower = tag.toLowerCase();
    if (tagLower === 'legendary') {
      filteredDex = dex.filter(p => pokemonMetaMap[p.name.toLowerCase()]?.isLeg);
    } else if (tagLower === 'mythical' || tagLower === 'mythiccal') {
      filteredDex = dex.filter(p => pokemonMetaMap[p.name.toLowerCase()]?.isMyth);
    } else {
      filteredDex = dex.filter(p => p.name.toLowerCase().includes(tagLower));
    }
  }
  if (filteredDex.length === 0) {
    return chat.sendMessage(`🔍 *${senderName}*, no Pokémon matching *"${tag}"* found in your Pokédex!\n\n` + `💡 _Try checking your spelling or filtering by legendary or mythical._`);
  }
  const perPage = 15;
  const totalPages = Math.ceil(filteredDex.length / perPage);
  if (page < 1) page = 1;
  if (page > totalPages) page = totalPages;
  const startIdx = (page - 1) * perPage;
  const pageItems = filteredDex.slice(startIdx, startIdx + perPage);
  let list = `\n` + `    📖 *${senderName.toUpperCase()}'S POKÉDEX* 📖 ૮ ˶ᵔ ᵕ ᵔ˶ ა\n` + `\n\n` + `🏆 *Total Caught:* ${stats.total} | *Unique:* ${stats.unique} 🎀\n`;
  if (tag) {
    list += `🔍 *Filter:* "${tag}" (Matches: ${filteredDex.length}) ᡣ𐭩\n`;
  }
  list += `━━━━━━━━━━━━━━━━━━━━━━\n`;
  for (let i = 0; i < pageItems.length; i++) {
    const p = pageItems[i];
    const rank = startIdx + i + 1;
    const lvlBadge = p.bestLevel >= 91 ? '🔥' : p.bestLevel >= 81 ? '⭐' : p.bestLevel >= 71 ? '🟢' : p.bestLevel >= 61 ? '🔵' : p.bestLevel >= 51 ? '🟣' : '⬜';
    list += `${lvlBadge} *#${rank}* │ *${p.name}* — Lv.${p.bestLevel} (×${p.count}) 🫧\n`;
  }
  list += `━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
  if (totalPages > 1) {
    const nextPrompt = page < totalPages ? ` — \`-pokemon list ${tag ? tag + ' ' : ''}${page + 1}\`` : '';
    list += `📄 _Page ${page}/${totalPages}_${nextPrompt} ੈ✩‧₊˚\n`;
  }
  list += `💡 _Use_ \`-pokemon details <name>\` _for card info._ 🎧ྀི\n`;
  list += `_~Gotta catch 'em all!~_ ✨ 𓆩♡𓆪`;
  await chat.sendMessage(list);
}
async function handleDetails(msg, args, client, chat) {
  const mentions = await msg.getMentions();
  let targetUser = null;
  let targetName = '';
  let targetId = '';
  if (mentions.length > 0) {
    targetUser = mentions[0];
    targetId = getUserId(targetUser);
    targetName = getDisplayName(targetUser);
    args = args.filter(a => !a.startsWith('@'));
  } else {
    const sender = await msg.getContact();
    targetId = getUserId(sender);
    targetName = getDisplayName(sender);
  }
  const pokemonName = args.join(' ').trim();
  if (!pokemonName) {
    return msg.reply(`❌ *Incomplete Command!* ❌\n` + `━━━━━━━━━━━━━━━━━━━━━━\n` + `📝 *Usage:* \`-pokemon details <pokemon name> [@user]\`\n` + `📖 *Description:* View detailed RPG stats, types, rarity, abilities, battle moves, and card image of a caught Pokémon.\n\n` + `💡 *Examples:*\n` + `  ▸ \`-pokemon details Charizard\` (View your Charizard)\n` + `  ▸ \`-pokemon details Pikachu @trainer\` (View another trainer's Pikachu)`);
  }
  const details = await getPokemonDetails(targetId, pokemonName);
  if (!details) {
    return chat.sendMessage(`❌ *${targetName}* doesn't have a *${pokemonName}* in their Pokédex!\n\n` + `_Catch one first when it spawns!_ 🎯`);
  }
  const typeStr = details.types.map(t => `${typeEmoji(t)} ${t}`).join(' | ');
  const prestigeMult = details.prestigeMultiplier || 1;
  const inheritedPrestige = details.inheritedPrestige || 0;
  const isInherited = inheritedPrestige > 0 && prestigeMult > 1;
  const prestigeLabel = isInherited ? 'INHERITED PRESTIGE BOOST' : 'PRESTIGE BOOST';
  const prestigeStr = prestigeMult > 1 ? `\n  🌟 *${prestigeLabel}:* ×${prestigeMult} applied to all stats!\n` : '';
  let bst = 0;
  let statsBlock = '';
  if (details.baseStats) {
    const bs = details.baseStats;
    bst = (bs.hp || 0) + (bs.atk || 0) + (bs.def || 0) + (bs.spAtk || 0) + (bs.spDef || 0) + (bs.speed || 0);
    statsBlock = `📊 *${prestigeMult > 1 ? 'BOOSTED ' : ''}STATS:*${prestigeStr}` + `  ❤️ *HP:* ${bs.hp || '??'}  │  ⚔️ *ATK:* ${bs.atk || '??'}  │  🛡️ *DEF:* ${bs.def || '??'}\n` + `  🔮 *SP.ATK:* ${bs.spAtk || '??'}  │  ⚡ *SPEED:* ${bs.speed || '??'}\n` + `  📈 *BST:* ${bst}${prestigeMult > 1 ? ` (×${prestigeMult})` : ''}\n\n`;
  }
  let rarityBadge = '⬜ Common';
  if (details.rarity) rarityBadge = `💎 *${details.rarity.toUpperCase()}*`;else if (details.isLegendary) rarityBadge = '👑 *LEGENDARY*';else if (details.isMythical) rarityBadge = '✨ *MYTHICAL*';
  let cardText = '';
  if (details.name.toLowerCase() === '30th celebration zorua' || details.name.toLowerCase() === '30th celebration hisuian zorua') {
    cardText = `⠀⠀⠀ ✧･ﾟ: *✧･ﾟ:*  👑  *:･ﾟ✧*:･ﾟ✧\n` + `⠀⠀⠀ *${details.name.toUpperCase()}*\n` + `⠀⠀⠀ ✧･ﾟ: *✧･ﾟ:*  💎  *:･ﾟ✧*:･ﾟ✧\n\n` + `ꕥ 𝗧𝗥𝗔𝗜𝗡𝗘𝗥 »  *${targetName}*\n` + `ꕥ 𝗥𝗔𝗥𝗜𝗧𝗬  »  ${rarityBadge}\n` + `ꕥ 𝗟𝗘𝗩𝗘𝗟   »  *${details.bestLevel}* 🌟\n\n` + `⠀⠀ ✦ ━━━ 𝗘𝗫𝗖𝗟𝗨𝗦𝗜𝗩𝗘 𝗥𝗘𝗟𝗜𝗖 ━━━ ✦\n` + `_"An endgame phenomenon existing outside of space and time. This unobtainable trinket is a divine gift, directly awarded by ${OWNER_NAME} himself."_\n` + `⠀⠀ ✦ ━━━━━━━━━━━━━━━━━━━ ✦\n\n` + `⠀⠀⠀⠀ ⚜️ _Celestia Masterpiece_ ⚜️`;
  } else if (details.name.toLowerCase() === 'sabrina carpenter') {
    cardText = `🎤 ✧･ﾟ: *✧･ﾟ:*  ⭐  *:･ﾟ✧*:･ﾟ✧ 🎤\n` +
               `      *${details.name.toUpperCase()}*\n` +
               `🎤 ✧･ﾟ: *✧･ﾟ:*  ⭐  *:･ﾟ✧*:･ﾟ✧ 🎤\n\n` +
               `🎵 𝗙𝗔𝗡    » *${targetName}*\n` +
               `✨ 𝗥𝗔𝗥𝗜𝗧𝗬 » 💿 *PLATINUM RECORD* 💿\n` +
               `📈 𝗟𝗘𝗩𝗘𝗟  » *${details.bestLevel}* 🌟\n\n` +
               `🎼 ━━━ 𝗩𝗜𝗣 𝗣𝗔𝗦𝗦 ━━━ 🎼\n` +
               `_"A rising pop sensation. Her voice alone can paralyze the audience with awe."_\n` +
               `━━━━━━━━━━━━━━━━━━━━━\n\n` + statsBlock;
    if (details.attacks && details.attacks.length > 0) {
      cardText += `\n🎶 *PERFORMANCES:*\n`;
      for (const atk of details.attacks) {
        cardText += `  ▸ *${atk.name}*\n    _Power: ${atk.power || '--'} | Acc: ${atk.accuracy || '--'}_\n    _${atk.flavorText || ''}_\n`;
      }
      cardText += `\n`;
    }
    cardText += `    📻 _Chart Topper_ 📻`;
  } else if (details.name.toLowerCase() === 'ai hoshino') {
    cardText = `🐰 ⋆⁺₊⋆ ☀︎ ⋆⁺₊⋆ 💖 ⋆⁺₊⋆ ☀︎ ⋆⁺₊⋆ 🐰\n` +
               `       *${details.name.toUpperCase()}*\n` +
               `🐰 ⋆⁺₊⋆ ☀︎ ⋆⁺₊⋆ 💖 ⋆⁺₊⋆ ☀︎ ⋆⁺₊⋆ 🐰\n\n` +
               `💌 𝗠𝗔𝗡𝗔𝗚𝗘𝗥 » *${targetName}*\n` +
               `🎀 𝗥𝗔𝗥𝗜𝗧𝗬  » 🌟 *PERFECT IDOL* 🌟\n` +
               `💖 𝗟𝗘𝗩𝗘𝗟   » *${details.bestLevel}* 🌟\n\n` +
               `🎭 ━━━ 𝗦𝗧𝗔𝗥𝗟𝗜𝗚𝗛𝗧 ━━━ 🎭\n` +
               `_"The ultimate idol. Her lies are her weapon, but her love for her fans is true."_\n` +
               `━━━━━━━━━━━━━━━━━━━━━\n\n` + statsBlock;
    if (details.attacks && details.attacks.length > 0) {
      cardText += `\n🌟 *ABILITIES:*\n`;
      for (const atk of details.attacks) {
        cardText += `  ✨ *${atk.name}*\n    _Power: ${atk.power || '--'} | Acc: ${atk.accuracy || '--'}_\n    _${atk.flavorText || ''}_\n`;
      }
      cardText += `\n`;
    }
    cardText += `    🎤 _B-Komachi Center_ 🎤`;
  } else if (details.name.toLowerCase() === 'ai hoshino ex') {
    cardText = `🌌 ☄. *. ⋆ 👑 ⋆. .* .☄ 🌌\n` +
               `     *${details.name.toUpperCase()}*\n` +
               `🌌 ☄. *. ⋆ 👑 ⋆. .* .☄ 🌌\n\n` +
               `💖 𝗠𝗔𝗡𝗔𝗚𝗘𝗥 » *${targetName}*\n` +
               `🌠 𝗥𝗔𝗥𝗜𝗧𝗬  » 🏆 *LEGENDARY IDOL EX* 🏆\n` +
               `📈 𝗟𝗘𝗩𝗘𝗟   » *${details.bestLevel}* 🌟\n\n` +
               `✨ ━━━ 𝗘𝗧𝗘𝗥𝗡𝗔𝗟 𝗦𝗧𝗔𝗥 ━━━ ✨\n` +
               `_"An existence that surpasses the sky. Her starlight will shine on forever."_\n` +
               `━━━━━━━━━━━━━━━━━━━━━\n\n` + statsBlock;
    if (details.attacks && details.attacks.length > 0) {
      cardText += `\n🌠 *ULTIMATE MOVES:*\n`;
      for (const atk of details.attacks) {
        cardText += `  🌟 *${atk.name}*\n    _Power: ${atk.power || '--'} | Acc: ${atk.accuracy || '--'}_\n    _${atk.flavorText || ''}_\n`;
      }
      cardText += `\n`;
    }
    cardText += `    👑 _The Eternal Center_ 👑`;
  } else if (details.rarity === 'easter egg') {
    cardText = `⠀⠀⠀ ✧･ﾟ: *✧･ﾟ:*  💎  *:･ﾟ✧*:･ﾟ✧\n` + `⠀⠀⠀ *${details.name.toUpperCase()}*\n` + `⠀⠀⠀ ✧･ﾟ: *✧･ﾟ:*  💎  *:･ﾟ✧*:･ﾟ✧\n\n` + `ꕥ 𝗧𝗥𝗔𝗜𝗡𝗘𝗥 »  *${targetName}*\n` + `ꕥ 𝗥𝗔𝗥𝗜𝗧𝗬  »  🚨 *EASTER EGG* 🚨\n` + `ꕥ 𝗟𝗘𝗩𝗘𝗟   »  *${details.bestLevel}* 🌟\n\n` + `⠀⠀ ✦ ━━━ 𝗠𝗬𝗦𝗧𝗜𝗖 𝗔𝗥𝗧𝗜𝗙𝗔𝗖𝗧 ━━━ ✦\n` + `_"${details.description || 'A mysterious easter egg card.'}"_\n` + `⠀⠀ ✦ ━━━━━━━━━━━━━━━━━━━ ✦\n\n` + statsBlock;
    if (details.attacks && details.attacks.length > 0) {
      cardText += `\n⚔️ *ATTACKS:*\n`;
      for (const atk of details.attacks) {
        cardText += `  ▸ *${atk.name}* [${atk.type}]\n    _Power: ${atk.power || '--'} | Acc: ${atk.accuracy || '--'}_\n    _${atk.flavorText || ''}_\n`;
      }
      cardText += `\n`;
    }
    cardText += `⠀⠀⠀⠀ ⚜️ _Celestia Collectibles_ ⚜️`;
  } else {
    const genusStr = details.genus ? `│ 🏷️ _${details.genus}_` : '';
    const weightStr = details.weight ? `│ ⚖️ ${details.weight} kg` : '';
    const heightStr = details.height ? `│ 📏 ${details.height} m` : '';
    cardText = `\n` + `    🔎 *POKÉDEX DETAILS: ${details.name.toUpperCase()}* 🔎 ૮꒰ ˶• ༝ •˶꒱ა ♡\n` + `\n\n` + `👤 *Trainer:* ${targetName} 🎀\n` + `🆔 *National Dex:* #${details.dexId} ᡣ𐭩\n` + `⭐ *Rarity:* ${rarityBadge} ੈ✩‧₊˚\n` + `🔖 *Type:* ${typeStr} 🫧\n` + `📈 *Pokedex Rank:* Level ${details.bestLevel} Best ୨୧\n` + `📦 *Copies Owned:* ×${details.count} 🎧ྀི\n` + `🧬 *Biology:* ${genusStr.replace('│ ', '')} ${weightStr} ${heightStr} ⋆.˚\n\n` + `━━━━━━━━━━━━━━━━━━━━━━━━━\n` + statsBlock;
    if (details.abilities && details.abilities.length > 0) {
      cardText += `✨ *ABILITIES:*\n`;
      for (const ab of details.abilities) {
        const hiddenBadge = ab.isHidden ? ' _(Hidden)_' : '';
        cardText += `  ▸ *${ab.name}*${hiddenBadge}\n    _${ab.effect || ab.shortEffect || 'No details.'}_\n`;
      }
      cardText += `\n`;
    }
    const damagingAttacks = details.attacks.filter(a => a && typeof a.power === 'number' && a.power > 0);
    if (damagingAttacks.length > 0) {
      cardText += `⚔️ *RPG MOVESET${prestigeMult > 1 ? ' (PRESTIGE BOOSTED)' : ' (BATTLE OFFENSIVE)'}:*\n`;
      for (const atk of damagingAttacks.slice(0, 4)) {
        const accStr = atk.accuracy ? ` │ ACC: ${atk.accuracy}%` : '';
        cardText += `  ▸ *${atk.name}* (${atk.type}) │ PWR: ${atk.power}${accStr}\n`;
        if (atk.flavorText || atk.effect) {
          cardText += `    _${atk.flavorText || atk.effect}_\n`;
        }
      }
      cardText += `\n`;
    }
    cardText += `📜 *Pokédex Entry:*\n_"${details.description}"_\n\n`;
    if (details.entries.length > 1) {
      cardText += `📋 *All Owned Copies:*\n`;
      const levels = details.entries.slice(0, 10).map(e => {
        const lvlBadge = e.level >= 91 ? '🔥' : e.level >= 81 ? '⭐' : e.level >= 71 ? '🟢' : e.level >= 61 ? '🔵' : e.level >= 51 ? '🟣' : '⬜';
        return `${lvlBadge} Lv.${e.level}`;
      });
      cardText += `  ` + levels.join(', ');
      if (details.entries.length > 10) {
        cardText += ` ...and ${details.entries.length - 10} more`;
      }
      cardText += `\n\n`;
    }
    cardText += `━━━━━━━━━━━━━━━━━━━━━━━━━\n` + `_~Kitsune Pokédex System~_ ✨ 𓆩♡𓆪`;
  }
  if (details.cardImage) {
    try {
      let media;
      if (details.cardImage.startsWith('http')) {
        const response = await axios.get(details.cardImage, {
          responseType: 'arraybuffer',
          timeout: 15000
        });
        const base64 = Buffer.from(response.data).toString('base64');
        media = new MessageMedia('image/png', base64, `${details.name}.png`);
      } else {
        media = MessageMedia.fromFilePath(details.cardImage);
      }
      await chat.sendMessage(media);
    } catch (err) {
      console.warn('[Pokemon] Card image send failed:', err.message);
    }
  }
  await chat.sendMessage(cardText);
}
async function handleSell(msg, args, client, chat) {
  if (args.length < 2) {
    return msg.reply(`❌ *Incomplete Command!* ❌\n` + `━━━━━━━━━━━━━━━━━━━━━━\n` + `📝 *Usage:* \`-pokemon sell <cost> <pokemon name>\`\n` + `📖 *Description:* List one of your Pokémon for sale in the marketplace. While listed, the Pokémon cannot be traded, used, or gifted.\n\n` + `💡 *Example:* \`-pokemon sell 5000 Charizard\``);
  }
  const costStr = args[0];
  const cost = parseInt(costStr);
  if (isNaN(cost) || cost <= 0) {
    return msg.reply(`❌ *Invalid Price!* ❌\n` + `━━━━━━━━━━━━━━━━━━━━━━\n` + `📝 *Usage:* \`-pokemon sell <cost> <pokemon name>\`\n` + `💡 *Example:* \`-pokemon sell 5000 Charizard\`\n\n` + `⚠️ _The cost must be a positive number._`);
  }
  let pokemonName = args.slice(1).join(' ').trim();
  if (pokemonName.startsWith('"') && pokemonName.endsWith('"')) {
    pokemonName = pokemonName.slice(1, -1).trim();
  } else if (pokemonName.startsWith("'") && pokemonName.endsWith("'")) {
    pokemonName = pokemonName.slice(1, -1).trim();
  }
  if (!pokemonName) {
    return msg.reply(`❌ *Incomplete Command!* ❌\n` + `━━━━━━━━━━━━━━━━━━━━━━\n` + `📝 *Usage:* \`-pokemon sell <cost> <pokemon name>\`\n` + `💡 *Example:* \`-pokemon sell 5000 Charizard\``);
  }
  const sender = await msg.getContact();
  const senderId = getUserId(sender);
  const {
    sellPokemon
  } = require('../../store/pokemonStore');
  const result = await sellPokemon(senderId, cost, pokemonName);
  if (!result.success) {
    if (result.reason === 'not_owned') {
      return msg.reply(`❌ *Error:* You do not own a *${pokemonName}*!`);
    }
    if (result.reason === 'invalid_price') {
      return msg.reply(`❌ *Error:* The listing price must be a positive amount!`);
    }
    return msg.reply(`❌ *Error:* Could not list the Pokémon for sale.`);
  }
  const taxOnListing = Math.ceil(result.price * 0.18);
  return chat.sendMessage(`🏪 *MARKETPLACE LISTING* 🏪\n` + `━━━━━━━━━━━━━━━━━━━━━━\n` + `✅ Successfully listed *${result.pokemonName}* (Lv.${result.level}) for sale!\n` + `💰 *Your Price:* ${result.price.toLocaleString()} PokéCoins\n` + `🏛️ *Buyer's Tax (18%):* +${taxOnListing.toLocaleString()} PokéCoins\n` + `💲 *Buyer's Total:* ${(result.price + taxOnListing).toLocaleString()} PokéCoins\n` + `📢 _Other players can now buy it using:_\n` + `\`-pokemon buy @${sender.id.user} ${result.pokemonName}\``);
}
async function handleBuy(msg, args, client, chat) {
  const mentions = await msg.getMentions();
  const cleanedArgs = args.filter(a => !a.startsWith('@'));
  let pokemonName = cleanedArgs.join(' ').trim();
  if (pokemonName.startsWith('"') && pokemonName.endsWith('"')) {
    pokemonName = pokemonName.slice(1, -1).trim();
  } else if (pokemonName.startsWith("'") && pokemonName.endsWith("'")) {
    pokemonName = pokemonName.slice(1, -1).trim();
  }
  if (mentions.length === 0 || !pokemonName) {
    return msg.reply(`❌ *Incomplete Command!* ❌\n` + `━━━━━━━━━━━━━━━━━━━━━━\n` + `📝 *Usage:* \`-pokemon buy @user <pokemon name>\`\n` + `📖 *Description:* Buy a Pokémon that another trainer has listed on the marketplace.\n\n` + `💡 *Example:* \`-pokemon buy @trainer Charizard\``);
  }
  const seller = mentions[0];
  const sellerId = getUserId(seller);
  const sellerName = getDisplayName(seller);
  const sender = await msg.getContact();
  const buyerId = getUserId(sender);
  const {
    buyPokemon
  } = require('../../store/pokemonStore');
  const result = await buyPokemon(buyerId, sellerId, pokemonName);
  if (!result.success) {
    if (result.reason === 'buy_self') {
      return msg.reply(`❌ *Error:* You cannot buy your own Pokémon!`);
    }
    if (result.reason === 'listing_not_found') {
      return msg.reply(`❌ *Error:* *${sellerName}* does not have a listing for *${pokemonName}*!`);
    }
    if (result.reason === 'insufficient_coins') {
      const taxLine = result.taxAmount > 0 ? `🏛️ *Tax (18%):* +${result.taxAmount.toLocaleString()} PokéCoins\n` : '';
      return msg.reply(`❌ *Error:* Insufficient PokéCoins!\n` + `💰 *Listing Price:* ${result.basePrice.toLocaleString()} PokéCoins\n` + taxLine + `💰 *Total Cost:* ${result.needed.toLocaleString()} PokéCoins\n` + `👛 *You Have:* ${result.have.toLocaleString()} PokéCoins`);
    }
    if (result.reason === 'pokemon_not_found') {
      return msg.reply(`❌ *Error:* The Pokémon entry is no longer available.`);
    }
    return msg.reply(`❌ *Error:* Transaction failed.`);
  }
  const taxLine = result.taxAmount > 0 ? `🏛️ *Tax (18%):* +${result.taxAmount.toLocaleString()} PokéCoins\n` : '';
  return chat.sendMessage(`💸 *MARKETPLACE PURCHASE* 💸\n` + `━━━━━━━━━━━━━━━━━━━━━━\n` + `🎉 Successfully bought *${result.pokemonName}* (Lv.${result.level}) from *${sellerName}*!\n` + `💰 *Listing Price:* ${result.basePrice.toLocaleString()} PokéCoins\n` + taxLine + `💰 *Total Paid:* ${result.totalCost.toLocaleString()} PokéCoins\n` + `✨ _It has been added to your collection!_`);
}