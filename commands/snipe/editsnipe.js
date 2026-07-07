const {
  getLastEdited
} = require('../../store/snipeStore');
module.exports = {
  name: 'editsnipe',
  aliases: ['es'],
  description: 'Show the last edited message in this group.',
  adminOnly: false,
  async execute(msg, args, client) {
    const chat = await msg.getChat();
    if (!chat.isGroup) {
      return msg.reply('❌ _This command only works in groups._');
    }
    const snipe = getLastEdited(msg.from);
    if (!snipe) {
      return msg.reply(`🔍 *No edited messages found!*\n\n` + `_No one has edited any messages recently._`);
    }
    const timeSince = getTimeSince(snipe.timestamp);
    let response = `\n` + `  ✏️ *EDIT  SNIPED*  ✏️   \n` + `\n\n` + `👤 *Author:* _${snipe.authorName}_\n\n` + `━━━ *BEFORE* ━━━\n` + `> ~${snipe.oldBody}~\n\n` + `━━━ *AFTER* ━━━\n` + `> ${snipe.newBody}\n\n` + `🕐 *Edited:* _${timeSince} ago_\n\n` + `_✏️ Thought you could sneak that past Kitsune?_`;
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