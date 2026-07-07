const economyStore = require('../../store/economyStore');
const {
  getDisplayName
} = require('../../utils/contactHelper');
const { getUserId } = require('../../utils/getUserId');
module.exports = {
  name: 'balance',
  aliases: ['bal', 'coins', 'wallet'],
  description: 'Check your PokéCoin balance or another trainer\'s balance. Usage: -balance [@user]',
  adminOnly: false,
  async execute(msg, args, client) {
    const chat = await msg.getChat();
    if (!chat.isGroup) return msg.reply('❌ _This command only works in groups._');
    const mentions = await msg.getMentions();
    let targetId = '';
    let targetName = '';
    if (mentions.length > 0) {
      const target = mentions[0];
      targetId = getUserId(target);
      targetName = getDisplayName(target);
    } else {
      const sender = await msg.getContact();
      targetId = getUserId(sender);
      targetName = getDisplayName(sender);
    }
    const balance = await economyStore.getBalance(targetId);
    const text = `\n` + `    💰 *TRAINER BALANCE* 💰 ૮꒰ ˶• ༝ •˶꒱ა ♡\n` + `\n\n` + `👤 *Trainer:* ${targetName} 🎀\n\n` + `━━━━━━━━━━━━━━━━━━━━━━━━━\n` + `  💰 *PokéCoins:* ${balance.pokecoins.toLocaleString()} ⋆｡‧˚ʚ🍓ɞ˚‧｡⋆\n` + `  🔴 *Pokéballs:* ${balance.pokeballs} ૮ ˶ᵔ ᵕ ᵔ˶ ა\n` + `  💎 *Radiant Crystals:* ${(balance.radiantCrystals || 0).toLocaleString()} ੈ✩‧₊˚\n` + `━━━━━━━━━━━━━━━━━━━━━━━━━\n\n` + `🏪 _Buy items:_ \`-pokemart\` 🛒 ᡣ𐭩\n` + `🎒 _Full inventory:_ \`-inventory\` 🎒 ୨୧\n` + `💸 _Share coins:_ \`-pokecoin share @user <amount>\` 💸 𓍢ִ໋🌷͙֒\n` + `🏆 _Leaderboard:_ \`-baltop\` 🏆 ✧.*\n` + `🎰 _Gacha info:_ \`-wish info\` 🎰 🫧\n\n` + `_~Kitsune Economy System~_ ✨ 𓆩♡𓆪`;
    await chat.sendMessage(text);
  }
};