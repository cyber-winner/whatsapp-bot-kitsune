const economyStore = require('../../store/economyStore');
const {
  getDisplayName
} = require('../../utils/contactHelper');
const { getUserId } = require('../../utils/getUserId');
module.exports = {
  name: 'daily',
  aliases: ['sailyy', 'dailyreward'],
  description: 'Claim your daily reward of 10 Pokéballs and 800 PokéCoins! Usage: -daily',
  category: 'pokemon',
  adminOnly: false,
  async execute(msg, args, client) {
    const chat = await msg.getChat();
    if (!chat.isGroup) return msg.reply('❌ _This command only works in groups._');
    const sender = await msg.getContact();
    const senderId = getUserId(sender);
    const senderName = getDisplayName(sender);
    const result = await economyStore.claimDaily(senderId);
    if (result.success) {
      const text = `\n` + `    🎁 *DAILY REWARD CLAIMED!* 🎁 ૮ ˶ᵔ ᵕ ᵔ˶ ა\n` + `\n\n` + `👤 *Trainer:* ${senderName} 🎀\n\n` + `━━━━━━━━━━━━━━━━━━━━━━━━━\n` + `  💰 *+${result.coinsAwarded} PokéCoins* ⋆｡‧˚ʚ🍓ɞ˚‧｡⋆\n` + `  🔴 *+${result.ballsAwarded} Pokéballs* ૮꒰ ˶• ༝ •˶꒱ა ♡\n` + `━━━━━━━━━━━━━━━━━━━━━━━━━\n\n` + `💼 *Wallet:* ${result.totalCoins.toLocaleString()} PokéCoins ୨୧\n` + `🔴 *Pokéballs:* ${result.totalBalls} ੈ✩‧₊˚\n\n` + `⏳ _Come back in 24 hours for more!_ 🫧\n\n` + `_~Kitsune rewards the faithful~_ ✨ 𓆩♡𓆪`;
      await chat.sendMessage(text);
    } else if (result.reason === 'cooldown') {
      const timeStr = result.hours > 0 ? `*${result.hours}h ${result.minutes}m*` : `*${result.minutes}m*`;
      await chat.sendMessage(`\n` + `    ⏳ *DAILY COOLDOWN ACTIVE* ⏳ (╥﹏╥)\n` + `\n\n` + `👤 *Trainer:* ${senderName} 🎀\n\n` + `_You've already claimed your daily reward!_ 𖦹\n\n` + `⏰ *Time remaining:* ${timeStr} ૮₍ ˃ ⤙ ˂ ₎ა\n\n` + `_~Patience, trainer! Come back later~_ 🕐 ⋆.˚`);
    }
  }
};