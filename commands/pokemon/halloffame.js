const economyStore = require('../../store/economyStore');
const { getDisplayName } = require('../../utils/contactHelper');

module.exports = {
  name: 'halloffame',
  aliases: ['hof', 'masters'],
  description: 'View the most legendary trainers in the Hall of Fame',
  adminOnly: false,
  async execute(msg, args, client) {
    const chat = await msg.getChat();
    
    try {
      const wallets = await economyStore.getHallOfFame();
      
      if (wallets.length === 0) {
        return chat.sendMessage('✨ _The Hall of Fame is currently empty. Who will be the first?_');
      }

      let hofText = `\n    🏛️ *THE GRAND HALL OF FAME* 🏛️\n\n_Beyond the clouds, at the peak of the Pokémon world, lies a sanctuary where only the absolute greatest are remembered. These are the immortals—the trainers who shattered the limits, conquered the Omega realm, and were officially recognized as Masters of the Universe. Their names are permanently etched into the code of reality._\n\n━━━━━━━━━━━━━━━━━━━━━━━━━\n\n`;
      
      let rank = 1;
      for (const w of wallets) {
        let name;
        try {
          const { resolveLeaderboardName } = require('../../utils/contactHelper');
          name = await resolveLeaderboardName(w.userId, client);
        } catch (e) {
          name = 'Unknown Master';
        }
        
        const titleEmoji = w.titleEmoji || '⚜️';
        const titleStr = w.customTitle ? `\n    ↳ ${titleEmoji} *[ ${w.customTitle} ]*` : '';
        const omegaStr = w.omegaLevel > 0 ? ` [Omega Lv. ${w.omegaLevel}]` : '';
        
        hofText += `*#${rank}* - 👤 *${name}*${omegaStr}${titleStr}\n\n`;
        rank++;
      }
      
      hofText += `━━━━━━━━━━━━━━━━━━━━━━━━━\n✨ _"Legends are never forgotten."_`;
      
      return chat.sendMessage(hofText);
    } catch (err) {
      console.error('[Hall of Fame] Error:', err);
      return msg.reply('❌ _Failed to retrieve the Hall of Fame._');
    }
  }
};
