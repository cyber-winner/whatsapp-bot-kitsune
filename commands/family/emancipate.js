const { OWNER_NAME } = require('../../config');
const familyStore = require('../../store/familyStore');
const { getUserId } = require('../../utils/getUserId');
const {
  getDisplayName
} = require('../../utils/contactHelper');
module.exports = {
  name: 'emancipate',
  aliases: ['runaway'],
  description: 'Run away from home. You lose pocket money and tax benefits from your parent.',
  async execute(msg, args, client) {
    const chat = await msg.getChat();
    if (!chat.isGroup) return msg.reply('❌ _This command only works in groups._');
    const mentions = await msg.getMentions();
    if (mentions.length === 0) return msg.reply('❌ _You must mention a parent to run away from!_');
    const target = mentions[0];
    const sender = await msg.getContact();
    const senderId = getUserId(sender);
    const targetId = getUserId(target);
    const senderName = getDisplayName(sender);
    const parentName = getDisplayName(target);
    const result = await familyStore.emancipate(senderId, targetId);
    if (result === 'forced_relationship') {
      return msg.reply('❌ _This is a forced relationship! Only ' + OWNER_NAME + ' can emancipate you._');
    }
    if (result) {
      const phrases = require('../../data/phrases.json').family['emancipate'];
      let phrase = phrases[Math.floor(Math.random() * phrases.length)];
      phrase = phrase.replace(/\{s\}/g, senderId).replace(/\{t\}/g, targetId);
      const economicWarning = `\n\n⚠️ *ECONOMIC CONSEQUENCES:*\n` + `━━━━━━━━━━━━━━━━━━━━━━\n` + `❌ *Pocket Money:* You no longer receive 1% from *${parentName}*\n` + `❌ *Tax Benefits:* You must now pay your own 18% tax\n` + `_~There's no going back easily, kid.~_ 💨`;
      return msg.reply(phrase + economicWarning, null, {
        mentions: [sender, target]
      });
    } else {
      return msg.reply('❌ _That person is not your parent._');
    }
  }
};