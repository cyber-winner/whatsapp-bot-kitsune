const gachaStore = require('../../store/gachaStore');
const economyStore = require('../../store/economyStore');
const {
  getDisplayName
} = require('../../utils/contactHelper');
const axios = require('axios');
const {
  MessageMedia
} = require('whatsapp-web.js');
const { getUserId } = require('../../utils/getUserId');
module.exports = {
  name: 'wish',
  aliases: ['pull', 'summon10'],
  description: 'Make wishes on the Kitsune Radiant Banner. Usage: -wish [1-10] | -wish info',
  category: 'pokemon',
  adminOnly: false,
  async execute(msg, args, client) {
    const chat = await msg.getChat();
    if (!chat.isGroup) return msg.reply('❌ _This command only works in groups._');
    const sender = await msg.getContact();
    const senderId = getUserId(sender);
    const senderName = getDisplayName(sender);
    const subcommand = (args[0] || '1').toLowerCase();
    if (subcommand === 'info' || subcommand === 'banner' || subcommand === 'pity') {
      return handleInfo(chat, senderId, senderName);
    }
    if (subcommand === 'help' || isNaN(parseInt(subcommand)) && !['info', 'banner', 'pity'].includes(subcommand)) {
      return chat.sendMessage(`🧭 *KITSUNE GACHA WISHING SYSTEM* 🧭\n` + `━━━━━━━━━━━━━━━━━━━━━━\n` + `📝 *Usage:* \`-wish [1-10]\` or \`-wish info\`\n` + `📖 *Description:* Perform wishes on the limited-time banner using Wishing Compasses (🧭). Uses a piece-wise probability system with guaranteed pity drops for 4★ and 5★ Pokémon.\n\n` + `💡 *Examples:*\n` + `  ▸ \`-wish info\` (Check rates and pity status)\n` + `  ▸ \`-wish 1\` (Perform single wish)\n` + `  ▸ \`-wish 10\` (Perform ten wishes)`);
    }
    const wishCount = parseInt(subcommand);
    if (isNaN(wishCount) || wishCount < 1 || wishCount > 10) {
      return chat.sendMessage(`❌ *Invalid Wish Amount!* ❌\n` + `━━━━━━━━━━━━━━━━━━━━━━\n` + `📝 *Usage:* \`-wish [1-10]\`\n` + `📖 *Description:* Perform between 1 and 10 wishes. Each wish costs 1 Wishing Compass.\n\n` + `💡 *Example:* \`-wish 10\``);
    }
    const inventory = await economyStore.getInventory(senderId);
    const compassItem = inventory.items.find(i => i.itemName === 'Wishing Compass');
    const compassesOwned = compassItem ? compassItem.quantity : 0;
    if (compassesOwned < wishCount) {
      return chat.sendMessage(`❌ *Not enough Wishing Compasses, ${senderName}!* 🧭\n\n` + `🧭 *You have:* ${compassesOwned} Wishing Compasses\n` + `🧭 *Need:* ${wishCount} Wishing Compasses\n` + `📉 *Short by:* ${wishCount - compassesOwned}\n\n` + `🏪 _Buy more:_ \`-pokemart buy wishing compass\`\n` + `_Each Wishing Compass costs 160 Radiant Crystals!_ 💎`);
    }
    const consumed = await economyStore.removeInventoryItem(senderId, 'Wishing Compass', wishCount);
    if (!consumed) {
      return chat.sendMessage(`❌ *Failed to consume Wishing Compasses. Try again.*`);
    }
    const {
      results,
      profile
    } = await gachaStore.executeWishes(senderId, wishCount, economyStore);
    const notablePulls = results.filter(r => r.rarity >= 4);
    const threeStarPulls = results.filter(r => r.rarity === 3);
    const threeStarCounts = {};
    for (const p of threeStarPulls) {
      threeStarCounts[p.item] = (threeStarCounts[p.item] || 0) + p.quantity;
    }
    const headerText = `\n` + `    🧭 *KITSUNE RADIANT BANNER* 🧭 ૮ ˶ᵔ ᵕ ᵔ˶ ა\n` + `\n\n` + `🌟 *${senderName}* made *${wishCount}* wish${wishCount > 1 ? 'es' : ''}! 🎀\n` + `━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
    await chat.sendMessage(headerText);
    if (threeStarPulls.length > 0) {
      const itemsText = Object.entries(threeStarCounts).map(([name, qty]) => `${name} ×${qty}`).join(', ');
      await chat.sendMessage(`🔮 *3★ Results:* ${itemsText} added to your bag! 🎒`);
    }
    for (const pull of notablePulls) {
      if (pull.rarity === 5) {
        const variantTag = pull.isVariant ? '🏆 *FEATURED VARIANT*' : '🔹 *STANDARD BASE FORM*';
        const stats = pull.doubledStats;
        let fiveStarText = `\n` + `🌠🌠🌠🌠🌠🌠🌠🌠🌠🌠🌠🌠🌠🌠🌠\n\n` + `⭐⭐⭐⭐⭐ *5-STAR PULL!* ⭐⭐⭐⭐⭐ ૮꒰ ˶• ༝ •˶꒱ა ♡\n\n` + `🏷️ *Pokémon:* *${pull.pokemonName}* 🎀\n` + `${variantTag}\n` + `📊 *Level:* ✨ ${pull.level} (MAX) ੈ✩‧₊˚\n` + `🔖 *Type:* ${(pull.types || []).join(' / ')} 🫧\n\n` + `⚔️ *GACHA BOOSTED STATS (2× MAX):* 𓍢ִ໋🌷͙֒\n` + `━━━━━━━━━━━━━━━━━━━━━━━━━\n` + `  ❤️ HP: ${stats.hp}\n` + `  ⚔️ ATK: ${stats.atk}\n` + `  🛡️ DEF: ${stats.def}\n` + `  🔮 SP.ATK: ${stats.spAtk}\n` + `  🔰 SP.DEF: ${stats.spDef}\n` + `  💨 SPEED: ${stats.speed}\n` + `━━━━━━━━━━━━━━━━━━━━━━━━━\n\n` + `🎯 *Pity Count:* Pull #${pull.pityCount} 🎧ྀི\n`;
        if (pull.isFeatured) {
          fiveStarText += `🏆 _You won the 50/50 and pulled the Variant Pokémon! Next 5★ is a coin flip again._ ᡣ𐭩\n`;
        } else {
          fiveStarText += `🔄 _Lost the 50/50 and pulled the Standard Base Pokémon! Next 5★ is GUARANTEED to be a Variant Pokémon next time!_ 🎯\n`;
        }
        fiveStarText += `\n🌠🌠🌠🌠🌠🌠🌠🌠🌠🌠🌠🌠🌠🌠🌠\n` + `_~A legendary being descends from the stars!~_ ✨ 𓆩♡𓆪`;
        if (pull.cardImage) {
          try {
            let media;
            if (pull.cardImage.startsWith('http')) {
              const imgRes = await axios.get(pull.cardImage, {
                responseType: 'arraybuffer',
                timeout: 15000
              });
              const base64 = Buffer.from(imgRes.data).toString('base64');
              media = new MessageMedia('image/png', base64, `${pull.pokemonName}.png`);
            } else {
              media = MessageMedia.fromFilePath(pull.cardImage);
            }
            await chat.sendMessage(media);
          } catch (imgErr) {
            console.warn('[Gacha] 5★ card image failed:', imgErr.message);
          }
        }
        await chat.sendMessage(fiveStarText);
      } else if (pull.rarity === 4) {
        const variantTag = pull.isVariant ? '✨ *VARIANT FORM*' : '🔹 *BASE FORM*';
        const stats = pull.doubledStats;
        let fourStarText = `\n` + `💜💜💜💜💜💜💜💜💜💜💜💜💜💜💜\n\n` + `⭐⭐⭐⭐ *4-STAR PULL!* ⭐⭐⭐⭐ ૮ ˶ᵔ ᵕ ᵔ˶ ა\n\n` + `🏷️ *Pokémon:* *${pull.pokemonName}* 🎀\n` + `${variantTag}\n` + `📊 *Level:* ✨ ${pull.level} (MAX) ੈ✩‧₊˚\n` + `🔖 *Type:* ${(pull.types || []).join(' / ')} 🫧\n\n` + `⚔️ *GACHA BOOSTED STATS (2× MAX):* 𓍢ִ໋🌷͙֒\n` + `━━━━━━━━━━━━━━━━━━━━━━━━━\n` + `  ❤️ HP: ${stats.hp}\n` + `  ⚔️ ATK: ${stats.atk}\n` + `  🛡️ DEF: ${stats.def}\n` + `  🔮 SP.ATK: ${stats.spAtk}\n` + `  🔰 SP.DEF: ${stats.spDef}\n` + `  💨 SPEED: ${stats.speed}\n` + `━━━━━━━━━━━━━━━━━━━━━━━━━\n\n` + `🎯 *Pity Count:* Pull #${pull.pityCount} 🎧ྀི\n\n` + `💜💜💜💜💜💜💜💜💜💜💜💜💜💜💜\n` + `_~A powerful warrior emerges from the rift!~_ 🔥 𓆩♡𓆪`;
        if (pull.cardImage) {
          try {
            let media;
            if (pull.cardImage.startsWith('http')) {
              const imgRes = await axios.get(pull.cardImage, {
                responseType: 'arraybuffer',
                timeout: 15000
              });
              const base64 = Buffer.from(imgRes.data).toString('base64');
              media = new MessageMedia('image/png', base64, `${pull.pokemonName}.png`);
            } else {
              media = MessageMedia.fromFilePath(pull.cardImage);
            }
            await chat.sendMessage(media);
          } catch (imgErr) {
            console.warn('[Gacha] 4★ card image failed:', imgErr.message);
          }
        }
        await chat.sendMessage(fourStarText);
      }
    }
    const summaryText = `\n━━━━━━━━━━━━━━━━━━━━━━━━━\n` + `📊 *WISH SESSION SUMMARY* ૮꒰ ˶• ༝ •˶꒱ა ♡\n` + `━━━━━━━━━━━━━━━━━━━━━━━━━\n` + `👤 *Trainer:* ${senderName} 🎀\n` + `💎 *Wishes Used:* ${wishCount} 🫧\n` + `⭐ *5★ Pulled:* ${results.filter(r => r.rarity === 5).length} ੈ✩‧₊˚\n` + `💜 *4★ Pulled:* ${results.filter(r => r.rarity === 4).length} ᡣ𐭩\n` + `🔮 *3★ Items:* ${Object.entries(threeStarCounts).map(([name, qty]) => `${qty}× ${name}`).join(', ') || 'None'} 🎧ྀི\n\n` + `📈 *PITY STATUS:* ୨୧\n` + `  ⭐ 5★ Pity: ${profile.pity5}/90\n` + `  💜 4★ Pity: ${profile.pity4}/10\n` + `  🎯 Next 5★: ${profile.guaranteed5 ? '✅ *GUARANTEED VARIANT*' : '🎲 50/50 Coin Flip'}\n\n` + `📊 *LIFETIME STATS:* ⋆｡‧˚ʚ🍓ɞ˚‧｡⋆\n` + `  🎰 Total Wishes: ${profile.totalWishes}\n` + `  ⭐ Total 5★: ${profile.total5Stars}\n` + `  💜 Total 4★: ${profile.total4Stars}\n` + `━━━━━━━━━━━━━━━━━━━━━━━━━\n` + `_~May the stars guide your next wish!~_ 💫 𓆩♡𓆪`;
    await chat.sendMessage(summaryText);
  }
};
async function handleInfo(chat, senderId, senderName) {
  const profile = await gachaStore.getProfileStats(senderId);
  const banner = gachaStore.getBannerInfo();
  const current5Rate = gachaStore.get5StarRate(profile.pity5 + 1);
  const current4Rate = gachaStore.get4StarRate(profile.pity4 + 1);
  const text = `\n` + `    🧭 *KITSUNE RADIANT BANNER* 🧭 ૮ ˶ᵔ ᵕ ᵔ˶ ა\n` + `\n\n` + `✨ *${banner.name}* 🎀\n\n` + `━━━━━━━━━━━━━━━━━━━━━━━━━\n` + `⭐⭐⭐⭐⭐ *5-STAR POOL:* ੈ✩‧₊˚\n` + `  👑 *${banner.featured5Star}* — Legendary Ruler of Space ᯓ★\n` + `  (Standard Base Form or premium Variant Form)\n\n` + `⭐⭐⭐⭐ *4-STAR POOL:* 𓍢ִ໋🌷͙֒\n` + `  🔥 ${banner.pool4Star.join(' | ')}\n\n` + `⭐⭐⭐ *3-STAR REWARDS & CHANCES:* 🫧\n` + `  🔮 Level Orb (50%)\n` + `  🎟️ Raid Pass (30%)\n` + `  ✨ Enchanted Stardust (19%)\n` + `  💩 Dirty Diaper (1%)\n` + `━━━━━━━━━━━━━━━━━━━━━━━━━\n\n` + `📈 *YOUR PITY STATUS — ${senderName}:* 🎧ྀི\n` + `━━━━━━━━━━━━━━━━━━━━━━━━━\n` + `  ⭐ 5★ Pity Counter: *${profile.pity5}/90*\n` + `  💜 4★ Pity Counter: *${profile.pity4}/10*\n` + `  🎯 Next 5★: ${profile.guaranteed5 ? '✅ *GUARANTEED VARIANT*' : '🎲 50/50 Coin Flip'}\n\n` + `📊 *CURRENT RATES (Next Pull):* ⋆.˚\n` + `  ⭐ 5★ Rate: *${(current5Rate * 100).toFixed(1)}%*${profile.pity5 >= 73 ? ' 🔥 SOFT PITY!' : ''}\n` + `  💜 4★ Rate: *${(current4Rate * 100).toFixed(1)}%*${profile.pity4 >= 8 ? ' 🔥 SOFT PITY!' : ''}\n\n` + `📊 *LIFETIME STATS:* ୨୧\n` + `  🎰 Total Wishes: ${profile.totalWishes}\n` + `  ⭐ Total 5★ Won: ${profile.total5Stars}\n` + `  💜 Total 4★ Won: ${profile.total4Stars}\n\n` + `━━━━━━━━━━━━━━━━━━━━━━━━━\n` + `🧭 *HOW TO WISH:* ᡣ𐭩\n` + `  ▸ \`-wish 1\` — Single pull\n` + `  ▸ \`-wish 10\` — 10-pull session\n\n` + `🧭 *Wishing Compass Cost:* 160 Radiant Crystals each 💎\n` + `🏪 _Buy at:_ \`-pokemart buy wishing compass\` 🛒\n` + `━━━━━━━━━━━━━━━━━━━━━━━━━\n` + `_~50% chance for base form, 50% for a variant!~_ ✨\n` + `_~All gacha Pokémon are pulled at your MAX level cap with 2× boosted stats!~_ 🔥 𓆩♡𓆪`;
  await chat.sendMessage(text);
}