const {
  isBotOwner
} = require('../../utils/permissions');
const learningStateStore = require('../../store/learningStateStore');
module.exports = {
  name: 'stop',
  category: 'utility',
  description: 'Stop certain bot features. Usage: -stop learn',
  async execute(msg, args, client) {
    if (args[0] && args[0].toLowerCase() === 'learn') {
      const chat = await msg.getChat();
      if (!chat.isGroup) {
        return msg.reply('❌ This command can only be used in groups.');
      }
      const isOwner = await isBotOwner(msg, client);
      if (!isOwner) {
        return msg.reply('❌ Only my Master can disable my learning module.');
      }
      const groupId = chat.id._serialized;
      const stopped = learningStateStore.stopLearning(groupId);
      if (stopped) {
        await chat.sendMessage(`🛑 *Learning Module Disabled*\n\n_I have stopped analyzing messages and recording memories in this group._`);
      } else {
        await chat.sendMessage(`⚠️ _My learning module is already disabled in this group._`);
      }
      return;
    }
    return msg.reply('❌ Unknown stop command. Did you mean `-stop learn`?');
  }
};