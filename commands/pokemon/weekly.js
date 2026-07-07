const economyStore = require('../../store/economyStore');
const {
  getDisplayName
} = require('../../utils/contactHelper');
const { getUserId } = require('../../utils/getUserId');
module.exports = {
  name: 'weekly',
  aliases: ['weeklyreward'],
  description: 'Claim your weekly reward of 10,000 PokéCoins, 50 Pokéballs and 3 Level Orbs! Usage: -weekly',
  category: 'pokemon',
  adminOnly: false,
  async execute(msg, args, client) {
    const chat = await msg.getChat();
    if (!chat.isGroup) return msg.reply('❌ _This command only works in groups._');
    const sender = await msg.getContact();
    const senderId = getUserId(sender);
    const senderName = getDisplayName(sender);
    const result = await economyStore.claimWeekly(senderId);
    if (result.success) {
      const text = `\n` + `    🎁 *WEEKLY REWARD CLAIMED!* 🎁 ૮ ˶ᵔ ᵕ ᵔ˶ ა\n` + `\n\n` + `👤 *Trainer:* ${senderName} 🎀\n\n` + `━━━━━━━━━━━━━━━━━━━━━━━━━\n` + `  💰 *+${result.coinsAwarded.toLocaleString()} PokéCoins* ⋆｡‧˚ʚ🍓ɞ˚‧｡⋆\n` + `  🔴 *+${result.ballsAwarded} Pokéballs* ૮꒰ ˶• ༝ •˶꒱ა ♡\n` + `  🔮 *+${result.orbsAwarded} Level Orbs* ᡣ𐭩\n` + `━━━━━━━━━━━━━━━━━━━━━━━━━\n\n` + `💼 *Wallet:* ${result.totalCoins.toLocaleString()} PokéCoins ୨୧\n` + `🔴 *Pokéballs:* ${result.totalBalls} 🫧\n\n` + `⏳ _Come back in 7 days for more!_ 🎧ྀི\n\n` + `_~Kitsune rewards the dedicated~_ ✨ 𓆩♡𓆪`;
      await chat.sendMessage(text);
    } else if (result.reason === 'cooldown') {
      let timeStr = '';
      if (result.days > 0) timeStr += `*${result.days}d* `;
      if (result.hours > 0) timeStr += `*${result.hours}h* `;
      timeStr += `*${result.minutes}m*`;
      await chat.sendMessage(`\n` + `    ⏳ *WEEKLY COOLDOWN ACTIVE* ⏳ (╥﹏╥)\n` + `\n\n` + `👤 *Trainer:* ${senderName} 🎀\n\n` + `_You've already claimed your weekly reward!_ 𖦹\n\n` + `⏰ *Time remaining:* ${timeStr.trim()} ૮₍ ˃ ⤙ ˂ ₎ა\n\n` + `_~Patience, trainer! Come back later~_ 🕐 ⋆.˚`);
    }
  }
};