const familyStore = require('../../store/familyStore');
const { getUserId } = require('../../utils/getUserId');
module.exports = {
  name: 'parent',
  aliases: ['parents'],
  description: 'Shows who someone\'s parents are. Defaults to yourself.',
  async execute(msg, args, client) {
    const chat = await msg.getChat();
    if (!chat.isGroup) return msg.reply('❌ _This command only works in groups._');
    const mentions = await msg.getMentions();
    let targetId = '';
    let targetContact = null;
    if (mentions.length > 0) {
      targetContact = mentions[0];
      targetId = getUserId(targetContact);
    } else {
      targetContact = await msg.getContact();
      targetId = getUserId(targetContact);
    }
    const family = await familyStore.getFamily(targetId);
    if (family.parents && family.parents.length > 0) {
      const parents = family.parents.map(p => `@${p}`).join(' and ');
      return msg.reply(`👨‍👩‍👦 *@${targetId}*'s parents are ${parents}!`, null, {
        mentions: [targetContact]
      });
    } else {
      return msg.reply(`👤 *@${targetId}* currently has no parents.`, null, {
        mentions: [targetContact]
      });
    }
  }
};