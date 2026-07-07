const economyStore = require('../../store/economyStore');
const knownUserStore = require('../../store/knownUserStore');
const {
  getDisplayName
} = require('../../utils/contactHelper');
module.exports = {
  name: 'baltop',
  aliases: ['balancetop', 'rich', 'richest', 'crystaltop'],
  description: 'Check the PokéCoin and Radiant Crystal leaderboards. Usage: -baltop',
  adminOnly: false,
  async execute(msg, args, client) {
    const chat = await msg.getChat();
    if (!chat.isGroup) return msg.reply('❌ _This command only works in groups._');
    const firstArg = (args[0] || '').toLowerCase();
    if (firstArg === 'help' || firstArg === '--help' || firstArg === '-h') {
      return chat.sendMessage(`🏆 *LEADERBOARD HELP* 🏆\n` + `━━━━━━━━━━━━━━━━━━━━━━\n` + `📝 *Usage:* \`-baltop\`\n` + `📖 *Description:* Displays the top 10 trainers ranked by PokéCoins wealth and Radiant Crystals (gacha currency) ownership.\n\n` + `💡 *Example:* \`-baltop\``);
    }
    const {
      resolveLeaderboardName
    } = require('../../utils/contactHelper');
    try {
      const topCoins = await economyStore.getBalTop(10);
      const topCrystals = await economyStore.getCrystalTop(10);
      if (topCoins.length === 0 && topCrystals.length === 0) {
        return chat.sendMessage('📭 _No active trainer accounts found yet._');
      }
      const resolveName = async userId => {
        return await resolveLeaderboardName(userId, client);
      };
      let text = `\n` + `    🏆 *KITSUNE LEADERBOARD* 🏆 ૮꒰ ˶• ༝ •˶꒱ა ♡\n` + `\n\n`;
      text += `💰 *TOP POKÉCOINS TRAINERS* ⋆｡‧˚ʚ🍓ɞ˚‧｡⋆\n`;
      text += `━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
      const rankEmojis = ['🥇', '🥈', '🥉', '🪙', '🪙', '🪙', '🪙', '🪙', '🪙', '🪙'];
      for (let i = 0; i < topCoins.length; i++) {
        const wallet = topCoins[i];
        const emoji = rankEmojis[i] || '🪙';
        const name = await resolveName(wallet.userId);
        text += `  ${emoji} *#${i + 1}* │ *${name}* — **${wallet.pokecoins.toLocaleString()}** PokéCoins ୨୧\n`;
      }
      text += `\n`;
      text += `💎 *TOP RADIANT CRYSTALS TRAINERS* ੈ✩‧₊˚\n`;
      text += `━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
      const crystalRankEmojis = ['🥇', '🥈', '🥉', '💎', '💎', '💎', '💎', '💎', '💎', '💎'];
      for (let i = 0; i < topCrystals.length; i++) {
        const wallet = topCrystals[i];
        const emoji = crystalRankEmojis[i] || '💎';
        const name = await resolveName(wallet.userId);
        const crystals = wallet.radiantCrystals || 0;
        text += `  ${emoji} *#${i + 1}* │ *${name}* — **${crystals.toLocaleString()}** Crystals 🫧\n`;
      }
      text += `\n━━━━━━━━━━━━━━━━━━━━━━━━━\n` + `🏪 _Visit the_ \`-pokemart\` _to buy items!_ 🛒\n` + `_~Kitsune Leaderboard System~_ ✨ 𓆩♡𓆪`;
      await chat.sendMessage(text);
    } catch (err) {
      console.error('[Baltop] Error:', err);
      await chat.sendMessage('❌ _Failed to retrieve balance leaderboard._ (╥﹏╥)');
    }
  }
};