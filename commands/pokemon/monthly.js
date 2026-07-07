const economyStore = require('../../store/economyStore');
const {
  getDisplayName
} = require('../../utils/contactHelper');
const { getUserId } = require('../../utils/getUserId');
module.exports = {
  name: 'monthly',
  aliases: ['monthlyreward'],
  description: 'Claim your monthly reward! Usage: -monthly',
  category: 'pokemon',
  adminOnly: false,
  async execute(msg, args, client) {
    const chat = await msg.getChat();
    if (!chat.isGroup) return msg.reply('❌ _This command only works in groups._');
    const sender = await msg.getContact();
    const senderId = getUserId(sender);
    const senderName = getDisplayName(sender);
    const result = await economyStore.claimMonthly(senderId);
    if (result.success) {
      const text = `\n` + `    🎁 *MONTHLY REWARD CLAIMED!* 🎁 ૮ ˶ᵔ ᵕ ᵔ˶ ა\n` + `\n\n` + `👤 *Trainer:* ${senderName} 🎀\n\n` + `━━━━━━━━━━━━━━━━━━━━━━━━━\n` + `  💰 *+${result.coinsAwarded.toLocaleString()} PokéCoins* ⋆｡‧˚ʚ🍓ɞ˚‧｡⋆\n` + `  🔴 *+${result.ballsAwarded} Pokéballs* ૮꒰ ˶• ༝ •˶꒱ა ♡\n` + `  🔮 *+${result.orbsAwarded} Level Orbs* ᡣ𐭩\n` + `  🎫 *+${result.raidPassAwarded} Raid Pass* ✧.*\n` + `  🧭 *+${result.compassAwarded} Wishing Compass* ੈ✩‧₊˚\n` + `━━━━━━━━━━━━━━━━━━━━━━━━━\n\n` + `💼 *Wallet:* ${result.totalCoins.toLocaleString()} PokéCoins ୨୧\n` + `🔴 *Pokéballs:* ${result.totalBalls} 🫧\n\n` + `⏳ _Come back in 30 days for more!_ 🎧ྀི\n\n` + `_~Kitsune rewards the legendary~_ ✨ 𓆩♡𓆪`;
      await chat.sendMessage(text);
    } else if (result.reason === 'cooldown') {
      let timeStr = '';
      if (result.days > 0) timeStr += `*${result.days}d* `;
      if (result.hours > 0) timeStr += `*${result.hours}h* `;
      timeStr += `*${result.minutes}m*`;
      await chat.sendMessage(`\n` + `    ⏳ *MONTHLY COOLDOWN ACTIVE* ⏳ (╥﹏╥)\n` + `\n\n` + `👤 *Trainer:* ${senderName} 🎀\n\n` + `_You've already claimed your monthly reward!_ 𖦹\n\n` + `⏰ *Time remaining:* ${timeStr.trim()} ૮₍ ˃ ⤙ ˂ ₎ა\n\n` + `_~Patience, trainer! Come back later~_ 🕐 ⋆.˚`);
    }
  }
};