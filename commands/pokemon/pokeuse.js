const economyStore = require('../../store/economyStore');
const pokemonStore = require('../../store/pokemonStore');
const {
  getDisplayName
} = require('../../utils/contactHelper');
const axios = require('axios');
const {
  MessageMedia
} = require('whatsapp-web.js');
const { getUserId } = require('../../utils/getUserId');
module.exports = {
  name: 'pokeuse',
  aliases: ['use', 'itemuse', 'baguse'],
  description: 'Use items from your inventory. Usage: -pokeuse <item> <target>',
  category: 'pokemon',
  adminOnly: false,
  localOnly: true,
  async execute(msg, args, client) {
    const chat = await msg.getChat();
    if (!chat.isGroup) return msg.reply('❌ _This command only works in groups._');
    const sender = await msg.getContact();
    const senderId = getUserId(sender);
    const senderName = getDisplayName(sender);
    const groupId = msg.from;
    const argStr = args.join(' ');
    if (!argStr) {
      return msg.reply(`❌ *Incomplete Command!* ❌\n` + `━━━━━━━━━━━━━━━━━━━━━━\n` + `📝 *Usage:* \`-pokeuse <item name> [target]\`\n` + `📖 *Description:* Use items from your bag inventory such as Level Orbs (increases/rolls Pokémon level) or Summoning Candles (summons a specific Pokémon spawn).\n\n` + `💡 *Examples:*\n` + `  ▸ \`-pokeuse level orb Pikachu\`\n` + `  ▸ \`-pokeuse summoning candle Mewtwo\``);
    }
    let matchedItem = null;
    let targetName = '';
    const lowerArgStr = argStr.toLowerCase().trim();
    let longestMatchLength = 0;
    const allItems = [...Object.entries(economyStore.MARKET_ITEMS), ...Object.entries(economyStore.OMEGA_MARKET_ITEMS || {})];
    for (const [id, details] of allItems) {
      const aliases = details.aliases || [];
      const candidates = [id, details.displayName, ...aliases].map(c => c.toLowerCase());
      for (const cand of candidates) {
        if (lowerArgStr === cand) {
          if (cand.length > longestMatchLength) {
            longestMatchLength = cand.length;
            matchedItem = {
              id,
              ...details
            };
            targetName = '';
          }
        } else if (lowerArgStr.startsWith(cand + ' ')) {
          if (cand.length > longestMatchLength) {
            longestMatchLength = cand.length;
            matchedItem = {
              id,
              ...details
            };
            targetName = argStr.substring(cand.length).trim();
          }
        }
      }
    }
    if (!matchedItem) {
      return msg.reply(`❌ *Invalid item name or format!*\n\n` + `_Usage:_ \`-pokeuse <item> <target>\`\n` + `_Example:_ \`-pokeuse level orb Pikachu\`\n` + `_Example:_ \`-pokeuse summoning candle Mewtwo\``);
    }
    const noTargetNeeded = ['literally karen', 'dirty diaper'];
    if (!targetName && !noTargetNeeded.includes(matchedItem.id)) {
      if (matchedItem.guide) {
        return msg.reply(matchedItem.guide);
      }
      return msg.reply(`❌ *Specify a target to use this item on!*\n\n_Usage:_ \`-pokeuse ${matchedItem.displayName.toLowerCase()} <target>\``);
    }
    if (matchedItem.id === 'summoning candle') {
      const existingSummon = pokemonStore.getSummonedSpawn(groupId);
      if (existingSummon) {
        return msg.reply(`❌ *A summoned Pokémon is already active in this group!*\n\n` + `🕯️ *${existingSummon.name}* is still waiting to be caught by the summoner.\n` + `_Tries remaining: ${existingSummon.triesLeft}/3_`);
      }
      const inventory = await economyStore.getInventory(senderId);
      const hasCandle = inventory.items.find(i => i.itemName === 'Summoning Candle' && i.quantity > 0);
      if (!hasCandle) {
        return msg.reply(`❌ *You don't have a Summoning Candle, ${senderName}!*\n\n` + `_Buy one from the PokéMart:_\n` + `\`-pokemart buy summoning candle\` _(4,000 PokéCoins)_`);
      }
      const cooldownCheck = await economyStore.checkSummonCooldown(senderId);
      if (!cooldownCheck.allowed) {
        const timeStr = cooldownCheck.hours > 0 ? `*${cooldownCheck.hours}h ${cooldownCheck.minutes}m*` : `*${cooldownCheck.minutes}m*`;
        return msg.reply(`⏳ *SUMMONING COOLDOWN ACTIVE* ⏳\n\n` + `👤 *Trainer:* ${senderName}\n` + `_You can only summon a Pokémon once per day!_\n\n` + `⏰ *Time remaining:* ${timeStr}\n\n` + `_~Patience, trainer! Your summoning energies need time to recharge~_ 🕯️`);
      }
      const staticData = pokemonStore.getStaticData(targetName);
      if (!staticData) {
        return msg.reply(`❌ *"${targetName}" is not a valid Pokémon name!*\n\n` + `_Make sure you're using the correct base name (e.g. Pikachu, Charizard, Mewtwo)._`);
      }
      const removed = await economyStore.removeInventoryItem(senderId, 'Summoning Candle', 1);
      if (!removed) {
        return msg.reply(`❌ _Failed to consume your Summoning Candle. Try again!_`);
      }
      const summon = pokemonStore.summonPokemon(groupId, senderId, targetName);
      if (!summon) {
        await economyStore.addInventoryItem(senderId, 'Summoning Candle', 1);
        return msg.reply(`❌ _Failed to summon that Pokémon. Summoning Candle has been refunded._`);
      }
      await economyStore.recordSummonUsage(senderId);
      const typeStr = (summon.types || []).join(' / ');
      let rarityTag = '⬜ Common';
      if (summon.isLegendary) rarityTag = '👑 *LEGENDARY*';else if (summon.isMythical) rarityTag = '✨ *MYTHICAL*';
      const summonText = `\n` + `    🕯️ *SUMMONING CANDLE LIT!* 🕯️ ૮ ˶ᵔ ᵕ ᵔ˶ ა\n` + `\n\n` + `👤 *Summoner:* ${senderName} 🎀\n\n` + `━━━━━━━━━━━━━━━━━━━━━━━━━\n` + `🏷️ *Pokémon:* ${summon.name} 𓍢ִ໋🌷͙֒\n` + `📊 *Level:* ${summon.level} ੈ✩‧₊˚\n` + `⭐ *Rarity:* ${rarityTag} ᡣ𐭩\n` + `🔖 *Type:* ${typeStr} 🫧\n` + `━━━━━━━━━━━━━━━━━━━━━━━━━\n\n` + `🎯 *Tries:* 3/3 🎧ྀི\n` + `🎲 *Catch Rate:* 50% → 65% → 75% ⋆｡‧˚ʚ🍓ɞ˚‧｡⋆\n` + `🔴 *Cost:* 2 Pokéballs per try ୨୧\n` + `🔒 *Only ${senderName} can catch this Pokémon!*\n\n` + `Type \`kitsune catch ${summon.name}\` to attempt capture!\n\n` + `_~The ancient flame flickers with power~_ ✨ 𓆩♡𓆪`;
      if (summon.cardImage) {
        try {
          let media;
          if (summon.cardImage.startsWith('http')) {
            const imgRes = await axios.get(summon.cardImage, {
              responseType: 'arraybuffer',
              timeout: 15000
            });
            const base64 = Buffer.from(imgRes.data).toString('base64');
            media = new MessageMedia('image/png', base64, 'summoned_pokemon.png');
          } else {
            media = MessageMedia.fromFilePath(summon.cardImage);
          }
          await chat.sendMessage(media);
        } catch (imgErr) {
          console.warn('[Summon] Card image failed:', imgErr.message);
        }
      }
      await chat.sendMessage(summonText);
      return;
    }
    if (matchedItem.id === 'level orb') {
      const result = await economyStore.useLevelOrb(senderId, targetName);
      if (result.success) {
        const lvlBadge = result.newLevel >= 91 ? '🔥' : result.newLevel >= 81 ? '⭐' : result.newLevel >= 71 ? '🟢' : result.newLevel >= 61 ? '🔵' : result.newLevel >= 51 ? '🟣' : '⬜';
        await chat.sendMessage(`\n` + `    🔮 *LEVEL ORB — SUCCESS!* 🔮 ૮꒰ ˶• ༝ •˶꒱ა ♡\n` + `\n\n` + `👤 *Trainer:* ${senderName} 🎀\n` + `🏷️ *Pokémon:* ${result.pokemonName} ᡣ𐭩\n` + `📊 *Level:* ${result.oldLevel} → ${result.newLevel} ${lvlBadge} 🫧\n` + `⬆️ *Gained:* +${result.levelsGained} levels! ੈ✩‧₊˚\n\n` + `━━━━━━━━━━━━━━━━━━━━━━━━━\n` + `_~Your Pokémon grew stronger!~_ ✨ 𓆩♡𓆪`);
      } else if (result.reason === 'failed') {
        await chat.sendMessage(`\n` + `    💔 *LEVEL ORB — FAILED!* 💔 (╥﹏╥)\n` + `\n\n` + `👤 *Trainer:* ${senderName} 🎀\n` + `🏷️ *Pokémon:* ${result.pokemonName} ᡣ𐭩\n` + `📊 *Level:* ${result.level} _(unchanged)_ 🫧\n\n` + `_The Level Orb shattered before it could work!_ 💥\n` + `_Your orb has been consumed._ ૮₍ ˃ ⤙ ˂ ₎ა\n\n` + `━━━━━━━━━━━━━━━━━━━━━━━━━\n` + `_~Better luck next time, trainer...~_ 😔 𓆩♡𓆪`);
      } else if (result.reason === 'no_orbs') {
        await chat.sendMessage(`❌ *You don't have any Level Orbs, ${senderName}!*\n\n` + `_Buy one from the PokéMart:_\n` + `\`-pokemart buy level orb\` _(800 PokéCoins)_`);
      } else if (result.reason === 'no_pokemon') {
        await chat.sendMessage(`❌ *You don't have a "${targetName}" in your Pokédex!*`);
      } else if (result.reason === 'max_level') {
        await chat.sendMessage(`✅ *${targetName}* is already at *Level ${result.cap}*! Can't go higher! 🏆`);
      }
      return;
    }
    if (matchedItem.id === 'enchanted stardust') {
      const result = await economyStore.useEnchantedStardust(senderId, targetName);
      if (result.success) {
        const lvlBadge = result.newLevel >= 91 ? '🔥' : result.newLevel >= 81 ? '⭐' : result.newLevel >= 71 ? '🟢' : result.newLevel >= 61 ? '🔵' : result.newLevel >= 51 ? '🟣' : '⬜';
        await chat.sendMessage(`\n` + `    ✨ *ENCHANTED STARDUST — SUCCESS!* ✨ ૮ ˶ᵔ ᵕ ᵔ˶ ა\n` + `\n\n` + `👤 *Trainer:* ${senderName} 🎀\n` + `🏷️ *Pokémon:* ${result.pokemonName} 𓍢ִ໋🌷͙֒\n` + `📊 *Level:* ${result.oldLevel} → ${result.newLevel} ${lvlBadge} 🫧\n` + `⬆️ *Gained:* +${result.levelsGained} levels! ੈ✩‧₊˚\n\n` + `━━━━━━━━━━━━━━━━━━━━━━━━━\n` + `_~Your Pokémon grew immensely stronger!~_ ✨ 𓆩♡𓆪`);
      } else {
        const msgs = {
          no_stardust: `❌ *You don't have any Enchanted Stardust, ${senderName}!*`,
          no_pokemon: `❌ *You don't own "${targetName}"!*`,
          too_close_to_cap: `❌ *${targetName}* is within 10 levels of its level cap (*Lv. ${result.cap}*)! (Current: Lv. ${result.level})`
        };
        await chat.sendMessage(msgs[result.reason] || '❌ _Stardust usage failed._');
      }
      return;
    }
    if (matchedItem.id === 'enchanted wand') {
      const mentions = await msg.getMentions();
      if (mentions.length === 0) {
        return msg.reply('❌ _Please mention the user you want to hex!_\n_Example: -pokeuse enchanted wand @user_');
      }
      const targetUser = mentions[0];
      const targetId = targetUser.id.user;
      const targetName = getDisplayName(targetUser);
      const result = await economyStore.useEnchantedWand(senderId, targetId);
      if (result.success) {
        if (result.backfired) {
          await chat.sendMessage(`\n` + `    🪄 *WAND BACKFIRED!* 🪄 (╥﹏╥)\n` + `\n\n` + `👤 *Trainer:* ${senderName} tried to hex *${targetName}* but the spell backfired! 𖦹\n\n` + `💀 You are locked out of catching Pokémon for the next *5* global spawns! ૮₍ ˃ ⤙ ˂ ₎ა`);
        } else {
          await chat.sendMessage(`\n` + `    🪄 *HEX SUCCESSFUL!* 🪄 ૮꒰ ˶• ༝ •˶꒱ა ♡\n` + `\n\n` + `👤 *Trainer:* ${senderName} successfully hexed *${targetName}*! 🎀\n\n` + `🔒 *${targetName}* cannot catch Pokémon for the next *5* global spawns! 🫧`);
        }
      } else {
        const msgs = {
          no_wand: `❌ *You don't have an Enchanted Wand, ${senderName}!*`,
          invalid_target: `❌ *You cannot hex yourself!*`,
          target_not_found: `❌ *Target wallet not found.*`
        };
        await chat.sendMessage(msgs[result.reason] || '❌ _Wand usage failed._');
      }
      return;
    }
    if (matchedItem.id === 'dirty diaper') {
      const result = await economyStore.useDirtyDiaper(senderId);
      if (result.success) {
        await chat.sendMessage(`\n` + `    💩 *DIAPER MODE ACTIVATED!* 💩 ૮ ˶ᵔ ᵕ ᵔ˶ ა\n` + `\n\n` + `👤 *Trainer:* ${senderName} put on a Dirty Diaper! 🎀\n\n` + `💩 *Diaper Mode* is active! You can now type just \`kitsune catch\` to catch any Pokémon — no need to spell the name! 🫧\n\n` + `🔋 *Charges:* ${result.totalCharges} catches remaining ੈ✩‧₊˚\n\n` + `_~Stinky but effective!~_ 💨 𓆩♡𓆪`);
      } else {
        const msgs = {
          no_diaper: `❌ *You don't have a Dirty Diaper, ${senderName}!*\n\n_Buy one from the Omega Shop:_\n\`-omegamart buy dirty diaper\` _(10,000 PokéCoins)_`
        };
        await chat.sendMessage(msgs[result.reason] || '❌ _Diaper usage failed._');
      }
      return;
    }
    if (matchedItem.id === 'literally karen') {
      const result = await economyStore.useLiterallyKaren(senderId);
      if (result.success) {
        await chat.sendMessage(`\n` + `    🗣️ *LITERALLY KAREN ACTIVE!* 🗣️ ૮꒰ ˶• ༝ •˶꒱ა ♡\n` + `\n\n` + `👤 *Trainer:* ${senderName} 🎀\n` + `📢 You will completely bypass catch cooldowns for the next *30 minutes*! 🫧`);
      } else {
        const msgs = {
          no_karen: `❌ *You don't have a Literally Karen, ${senderName}!*`
        };
        await chat.sendMessage(msgs[result.reason] || '❌ _Karen usage failed._');
      }
      return;
    }
    return msg.reply(`❌ _This item (${matchedItem.displayName}) cannot be used this way._`);
  }
};