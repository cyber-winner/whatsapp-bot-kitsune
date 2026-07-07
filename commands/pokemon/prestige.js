const economyStore = require('../../store/economyStore');
const {
  getDisplayName
} = require('../../utils/contactHelper');
const { getUserId } = require('../../utils/getUserId');
module.exports = {
  name: 'prestige',
  aliases: [],
  category: 'pokemon',
  description: 'Prestige to reset your Pokémon levels and unlock a higher level cap.',
  async execute(msg, args, client) {
    const chat = await msg.getChat();
    const sender = await msg.getContact();
    const senderId = getUserId(sender);
    const senderName = getDisplayName(sender);
    const eligibility = await economyStore.checkPrestigeEligibility(senderId);
    const reqs = eligibility.requirements;
    if (!eligibility.eligible) {
      let failMsg = '';
      switch (eligibility.reason) {
        case 'insufficient_dex':
          failMsg = `📖 *Total Pokémon:* ${eligibility.have}/${reqs.minDex}`;
          break;
        case 'insufficient_leveled':
          failMsg = `📊 *Lv.${reqs.minPokemonLevel}+ Pokémon:* ${eligibility.have}/${reqs.minLeveledPokemon}`;
          break;
        case 'insufficient_coins':
          failMsg = `💰 *PokéCoins:* ${eligibility.have.toLocaleString()}/${reqs.minCoins.toLocaleString()}`;
          break;
      }
      await chat.sendMessage(`\n` + `    ❌ *PRESTIGE — NOT ELIGIBLE* (╥﹏╥)\n` + `\n\n` + `👤 *Trainer:* ${senderName} 🎀\n\n` + `${failMsg}\n\n` + `━━━━━━━━━━━━━━━━━━━━━━━━━\n` + `📋 *Requirements:* 𓍢ִ໋🌷͙֒\n` + `• 📖 ${reqs.minDex} total Pokémon caught ੈ✩‧₊˚\n` + `• 📊 ${reqs.minLeveledPokemon} Pokémon at Lv.${reqs.minPokemonLevel}+ ᡣ𐭩\n` + `• 💰 ${reqs.minCoins.toLocaleString()} PokéCoins ⋆｡‧˚ʚ🍓ɞ˚‧｡⋆\n` + `━━━━━━━━━━━━━━━━━━━━━━━━━\n\n` + `_~Keep grinding, Trainer!~_ 💪 𓆩♡𓆪`);
      return;
    }
    if (!args[0] || args[0].toLowerCase() !== 'confirm') {
      const currentPrestige = eligibility.wallet?.prestigeLevel || 0;
      const nextPrestige = currentPrestige + 1;
      const nextMult = nextPrestige * 5;
      await chat.sendMessage(`\n` + `    ⚡ *PRESTIGE — CONFIRMATION* ⚡ ૮꒰ ˶• ༝ •˶꒱ა ♡\n` + `\n\n` + `👤 *Trainer:* ${senderName} 🎀\n\n` + `⚠️ *This action will:* 🫧\n` + `• Reset ALL Pokémon levels to Lv.1\n` + `• Deduct 💰 ${reqs.minCoins.toLocaleString()} PokéCoins ⋆｡‧˚ʚ🍓ɞ˚‧｡⋆\n` + `• Boost all Pokémon stats to ×${nextMult} (Prestige ${nextPrestige}) ੈ✩‧₊˚\n` + `• Unlock Lv.${100 + nextPrestige * 100} cap ᡣ𐭩\n` + `• Reset all cooldowns 🎧ྀི\n\n` + `━━━━━━━━━━━━━━━━━━━━━━━━━\n` + `_Type_ \`-prestige confirm\` _to proceed._ ୨୧\n` + `━━━━━━━━━━━━━━━━━━━━━━━━━\n\n` + `_⚠️ This cannot be undone!_ ૮₍ ˃ ⤙ ˂ ₎ა`);
      return;
    }
    const result = await economyStore.performPrestige(senderId);
    if (!result.success) {
      await chat.sendMessage(`❌ *Prestige failed!* _${result.reason}_`);
      return;
    }
    await chat.sendMessage(`\n` + `    ✨ *PRESTIGE COMPLETE!* ✨ ૮ ˶ᵔ ᵕ ᵔ˶ ა\n` + `\n\n` + `👤 *Trainer:* ${senderName} 🎀\n\n` + `🌟 *Prestige Level:* ${result.newPrestige} 𓍢ִ໋🌷͙֒\n` + `🔓 *New Level Cap:* Lv.${result.newLevelCap} ੈ✩‧₊˚\n` + `💰 *Coins Spent:* ${result.coinsDeducted.toLocaleString()} ⋆｡‧˚ʚ🍓ɞ˚‧｡⋆\n` + `📊 *All Pokémon:* Reset to Lv.1 🫧\n` + `⚡ *Stats Multiplier:* ×${result.newPrestige * 5} (all stats & moves) ᡣ𐭩\n\n` + `━━━━━━━━━━━━━━━━━━━━━━━━━\n` + `✅ All cooldowns have been reset! 🎧ྀི\n` + `━━━━━━━━━━━━━━━━━━━━━━━━━\n\n` + `_~A new chapter begins!~_ 🔥 𓆩♡𓆪`);
  }
};