const {
  setAutoreact,
  removeAutoreact,
  getAutoreactEmoji
} = require('../../store/autoreactStore');
const {
  getSenderId
} = require('../../utils/permissions');
const { getUserId } = require('../../utils/getUserId');
module.exports = {
  name: 'autoreact',
  aliases: ['ar', 'react'],
  description: 'Auto-react when someone @mentions you. Usage: -autoreact 😂 / -autoreact off',
  adminOnly: false,
  async execute(msg, args, client) {
    const chat = await msg.getChat();
    if (!chat.isGroup) {
      return msg.reply('❌ _This command only works in groups._');
    }
    const groupId = msg.from;
    const contact = await msg.getContact();
    const senderId = getUserId(contact);
    if (args.length === 0) {
      const current = getAutoreactEmoji(groupId, senderId);
      if (current) {
        return msg.reply(`💫 *Your Autoreact*\n\n` + `Current emoji: ${current}\n\n` + `_Whenever someone @mentions you, I'll react with ${current}_\n\n` + `━━━━━━━━━━━━━━━━━━━━\n` + `_Use_ \`-autoreact off\` _to disable._`);
      }
      return msg.reply(`💫 *Autoreact — Usage*\n\n` + `\`-autoreact 😂\` — _React when someone pings you_\n` + `\`-autoreact off\` — _Disable autoreact_\n\n` + `_When enabled, any message that @mentions you\nwill get an automatic emoji reaction!_`);
    }
    if (args[0].toLowerCase() === 'off' || args[0].toLowerCase() === 'disable') {
      const wasSet = removeAutoreact(groupId, senderId);
      if (wasSet) {
        return msg.reply(`✅ *Autoreact disabled!*\n\n_I won't react when people mention you anymore._`);
      }
      return msg.reply(`❌ _You don't have autoreact enabled._`);
    }
    const emoji = args[0];
    setAutoreact(groupId, senderId, emoji);
    return msg.reply(`✅ *Autoreact enabled!* ${emoji}\n\n` + `_Whenever someone @mentions you in this group,\nI'll react to their message with ${emoji}_\n\n` + `_Use_ \`-autoreact off\` _to disable._`);
  }
};