const familyStore = require('../../store/familyStore');
const { getUserId } = require('../../utils/getUserId');
module.exports = {
  name: 'partner',
  description: 'Shows who someone\'s partner is. Defaults to yourself.',
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
    if (family.partners && family.partners.length > 0) {
      const partnerMentions = family.partners.map(p => `*@${p}*`).join(', ');
      const word = family.partners.length === 1 ? 'partner is' : 'partners are';
      return msg.reply(`💍 *@${targetId}*'s ${word} ${partnerMentions}!`, null, {
        mentions: [targetContact.id._serialized]
      });
    } else {
      return msg.reply(`💔 *@${targetId}* is currently single.`, null, {
        mentions: [targetContact.id._serialized]
      });
    }
  }
};