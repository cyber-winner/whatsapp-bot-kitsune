const {
  getLastDeleted
} = require('../../store/snipeStore');
module.exports = {
  name: 'snipe',
  aliases: ['s'],
  description: 'Recover the last deleted message in this group.',
  adminOnly: false,
  async execute(msg, args, client) {
    const chat = await msg.getChat();
    if (!chat.isGroup) {
      return msg.reply('❌ _This command only works in groups._');
    }
    const snipe = getLastDeleted(msg.from);
    if (!snipe) {
      return msg.reply(`🔍 *Nothing to snipe!*\n\n` + `_No recently deleted messages found._\n` + `_Messages are stored for 24 hours._`);
    }
    const timeSince = getTimeSince(snipe.timestamp);
    let response = `\n` + `   🔫 *S N I P E D*   \n` + `\n\n` + `👤 *Author:* _${snipe.authorName}_\n` + `━━━━━━━━━━━━━━━━━━━━\n` + `💬 *Message:*\n` + `> ${snipe.body || '_(media / no text)_'}\n` + `━━━━━━━━━━━━━━━━━━━━\n` + `🕐 *Deleted:* _${timeSince} ago_\n\n` + `_🔫 Got 'em. Nothing escapes Kitsune._`;
    await chat.sendMessage(response);
  }
};
function getTimeSince(timestamp) {
  const diff = Date.now() - timestamp;
  const seconds = Math.floor(diff / 1000);
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  return `${hours}h ${minutes % 60}m`;
}