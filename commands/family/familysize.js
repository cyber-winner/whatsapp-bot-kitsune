const familyStore = require('../../store/familyStore');
const { getUserId } = require('../../utils/getUserId');
module.exports = {
  name: 'familysize',
  description: 'Gives you the amount of people in your family tree.',
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
    const size = await familyStore.getFamilySize(targetId);
    return msg.reply(`🌳 *@${targetId}*'s family tree has **${size}** members!`, null, {
      mentions: [targetContact]
    });
  }
};