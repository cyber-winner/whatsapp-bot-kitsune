const {
  isBotOwner
} = require('../../utils/permissions');
const learningStateStore = require('../../store/learningStateStore');
module.exports = {
  name: 'start',
  category: 'utility',
  description: 'Start certain bot features. Usage: -start learn',
  async execute(msg, args, client) {
    if (args[0] && args[0].toLowerCase() === 'learn') {
      const chat = await msg.getChat();
      if (!chat.isGroup) {
        return msg.reply('❌ This command can only be used in groups.');
      }
      const isOwner = await isBotOwner(msg, client);
      if (!isOwner) {
        return msg.reply('❌ Only my Master can enable my learning module.');
      }
      const groupId = chat.id._serialized;
      const started = learningStateStore.startLearning(groupId);
      if (started) {
        await chat.sendMessage(`✅ *Learning Module Enabled*\n\n_I am now analyzing messages and recording memories in this group again._`);
      } else {
        await chat.sendMessage(`⚠️ _My learning module is already enabled in this group._`);
      }
      return;
    }
    return msg.reply('❌ Unknown start command. Did you mean `-start learn`?');
  }
};