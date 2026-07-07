const PokemonEntry = require('../../models/Pokemon');
const economyStore = require('../../store/economyStore');
const pokemonStore = require('../../store/pokemonStore');
const {
  getDisplayName
} = require('../../utils/contactHelper');
const { getUserId } = require('../../utils/getUserId');
module.exports = {
  name: 'compare',
  aliases: ['comp', 'pokecompare', 'diff'],
  description: 'Compare your stats side-by-side with another trainer. Usage: -compare @user',
  category: 'pokemon',
  adminOnly: false,
  async execute(msg, args, client) {
    const chat = await msg.getChat();
    if (!chat.isGroup) return msg.reply('❌ _This command only works in groups._');
    const mentions = await msg.getMentions();
    if (mentions.length === 0) {
      return msg.reply(`❌ *Incomplete Command!* ❌\n` + `━━━━━━━━━━━━━━━━━━━━━━\n` + `📝 *Usage:* \`-compare @user\`\n` + `📖 *Description:* Compare your Pokémon capture records and economy balances side-by-side with another trainer in the group.\n\n` + `💡 *Example:* \`-compare @rival_trainer\``);
    }
    try {
      const sender = await msg.getContact();
      const senderId = getUserId(sender);
      const senderName = getDisplayName(sender);
      const target = mentions[0];
      const targetId = getUserId(target);
      const targetName = getDisplayName(target);
      if (senderId === targetId) {
        return msg.reply('❌ _You cannot compare yourself to... yourself! Try comparing with a rival trainer!_ 😉');
      }
      const senderEntries = await PokemonEntry.find({
        userId: senderId
      });
      const senderBalance = await economyStore.getBalance(senderId);
      const senderInventory = await economyStore.getInventory(senderId);
      const targetEntries = await PokemonEntry.find({
        userId: targetId
      });
      const targetBalance = await economyStore.getBalance(targetId);
      const targetInventory = await economyStore.getInventory(targetId);
      const getUniqueCount = entries => {
        const uniqueIds = new Set(entries.map(e => e.dexId || pokemonStore.getDexId(e.pokemonName)));
        uniqueIds.delete(0);
        uniqueIds.delete(undefined);
        return uniqueIds.size;
      };
      const senderTotal = senderEntries.length;
      const targetTotal = targetEntries.length;
      const senderUnique = getUniqueCount(senderEntries);
      const targetUnique = getUniqueCount(targetEntries);
      const senderBestLevel = senderTotal > 0 ? Math.max(...senderEntries.map(e => e.level)) : 0;
      const targetBestLevel = targetTotal > 0 ? Math.max(...targetEntries.map(e => e.level)) : 0;
      const getAvgLevel = entries => {
        if (entries.length === 0) return 0;
        const sum = entries.reduce((s, e) => s + e.level, 0);
        return Math.round(sum / entries.length);
      };
      const senderAvg = getAvgLevel(senderEntries);
      const targetAvg = getAvgLevel(targetEntries);
      const senderCoins = senderBalance.pokecoins || 0;
      const targetCoins = targetBalance.pokecoins || 0;
      const senderBalls = senderBalance.pokeballs || 0;
      const targetBalls = targetBalance.pokeballs || 0;
      const getTotalItems = inv => {
        return (inv.items || []).reduce((sum, item) => sum + (item.quantity || 0), 0);
      };
      const senderTotalItems = getTotalItems(senderInventory);
      const targetTotalItems = getTotalItems(targetInventory);
      const win = (valA, valB) => {
        if (valA > valB) return {
          a: ' 👑',
          b: ''
        };
        if (valB > valA) return {
          a: '',
          b: ' 👑'
        };
        return {
          a: '',
          b: ''
        };
      };
      const cTotal = win(senderTotal, targetTotal);
      const cUnique = win(senderUnique, targetUnique);
      const cBest = win(senderBestLevel, targetBestLevel);
      const cAvg = win(senderAvg, targetAvg);
      const cCoins = win(senderCoins, targetCoins);
      const cBalls = win(senderBalls, targetBalls);
      const cItems = win(senderTotalItems, targetTotalItems);
      let text = `\n` + `    ⚔️ *TRAINER COMPARISON* ⚔️ ૮꒰ ˶• ༝ •˶꒱ა ♡\n` + `\n\n` + `🔥 *${senderName}*  _vs_  ❄️ *${targetName}* 🎀\n` + `━━━━━━━━━━━━━━━━━━━━━━━━━\n\n` + `📖 *POKÉMON STATS* 𓍢ִ໋🌷͙֒\n` + `━━━━━━━━━━━━━━━━━━━━━━━━━\n` + `🎯 *Total Caught:* ⋆.˚\n` + `  • ${senderName}: *${senderTotal}*${cTotal.a}\n` + `  • ${targetName}: *${targetTotal}*${cTotal.b}\n\n` + `📚 *Unique Species:* ੈ✩‧₊˚\n` + `  • ${senderName}: *${senderUnique}*${cUnique.a}\n` + `  • ${targetName}: *${targetUnique}*${cUnique.b}\n\n` + `👑 *Best Pokémon Level:* ᡣ𐭩\n` + `  • ${senderName}: Lv.*${senderBestLevel}*${cBest.a}\n` + `  • ${targetName}: Lv.*${targetBestLevel}*${cBest.b}\n\n` + `📈 *Average Level:* 𖦹\n` + `  • ${senderName}: Lv.*${senderAvg}*${cAvg.a}\n` + `  • ${targetName}: Lv.*${targetAvg}*${cAvg.b}\n\n` + `💰 *ECONOMY STATS* ⋆｡‧˚ʚ🍓ɞ˚‧｡⋆\n` + `━━━━━━━━━━━━━━━━━━━━━━━━━\n` + `🪙 *PokéCoins Balance:* ୨୧\n` + `  • ${senderName}: *${senderCoins.toLocaleString()}*${cCoins.a}\n` + `  • ${targetName}: *${targetCoins.toLocaleString()}*${cCoins.b}\n\n` + `🔴 *Pokéballs Count:* 🫧\n` + `  • ${senderName}: *${senderBalls}*${cBalls.a}\n` + `  • ${targetName}: *${targetBalls}*${cBalls.b}\n\n` + `🎒 *Total Items in Bag:* 🎧ྀི\n` + `  • ${senderName}: *${senderTotalItems}*${cItems.a}\n` + `  • ${targetName}: *${targetTotalItems}*${cItems.b}\n` + `━━━━━━━━━━━━━━━━━━━━━━━━━\n\n` + `_~Let the battle of stats begin!~_ ✨ 𓆩♡𓆪`;
      await chat.sendMessage(text);
    } catch (err) {
      console.error('[Compare Command] Error:', err);
      await msg.reply('❌ _Failed to compare trainer stats. Please try again!_');
    }
  }
};