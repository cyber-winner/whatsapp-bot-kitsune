const {
  getTrainerLeaderboard
} = require('../../store/pokemonStore');
const knownUserStore = require('../../store/knownUserStore');
const {
  getDisplayName
} = require('../../utils/contactHelper');
module.exports = {
  name: 'pokeboard',
  aliases: ['pokeleaderboard', 'toptrainers', 'catchboard'],
  description: 'View the top Pokémon catchers leaderboard. Usage: -pokeboard',
  category: 'pokemon',
  adminOnly: false,
  async execute(msg, args, client) {
    const chat = await msg.getChat();
    if (!chat.isGroup) return msg.reply('❌ _This command only works in groups._');
    try {
      const leaderboard = await getTrainerLeaderboard();
      if (leaderboard.length === 0) {
        return chat.sendMessage('📭 _No Pokémon have been caught yet! Be the first trainer to fill the board!_');
      }
      let text = `\n` + `    🏆 *KITSUNE TRAINER LEADERBOARD* 🏆 ૮꒰ ˶• ༝ •˶꒱ა ♡\n` + `\n\n` + `*Ranked by Trainer Power Score (PTS)* 🔮 🎀\n` + `━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
      const rankEmojis = ['🥇', '🥈', '🥉', '⭐', '⭐', '⭐', '⭐', '⭐', '⭐', '⭐'];
      for (let i = 0; i < leaderboard.length; i++) {
        const entry = leaderboard[i];
        const emoji = rankEmojis[i] || '⭐';
        const userId = entry.userId;
        const {
          resolveLeaderboardName
        } = require('../../utils/contactHelper');
        const name = await resolveLeaderboardName(userId, client);
        text += `  ${emoji} *#${i + 1}* │ *${name}*\n`;
        text += `     🔮 *${entry.score.toLocaleString()} PTS* ੈ✩‧₊˚\n`;
        text += `     🎯 *${entry.totalCaught}* caught │ 📖 *${entry.uniqueCount}* unique │ 👑 Best: Lv.*${entry.bestLevel}* 🫧\n\n`;
      }
      text += `━━━━━━━━━━━━━━━━━━━━━━━━━\n` + `🔮 *PTS Formula:* 𓍢ִ໋🌷͙֒\n` + `  _(Unique * 150) + (Caught * 35) + (Best Lv * 10) + Avg Lv_\n\n` + `📖 _Use_ \`-pokemon list\` _to view your collection._ ᡣ𐭩\n` + `_~Kitsune Trainer Rankings~_ ✨ 𓆩♡𓆪`;
      await chat.sendMessage(text);
    } catch (err) {
      console.error('[Pokeboard] Error:', err);
      await chat.sendMessage('❌ _Failed to retrieve the Pokémon leaderboard._');
    }
  }
};