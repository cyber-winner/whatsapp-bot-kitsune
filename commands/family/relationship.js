const familyStore = require('../../store/familyStore');
const { getUserId } = require('../../utils/getUserId');
module.exports = {
  name: 'relationship',
  description: 'Shows you the relationship between the two given users (or the first user and yourself).',
  async execute(msg, args, client) {
    const chat = await msg.getChat();
    if (!chat.isGroup) return msg.reply('❌ _This command only works in groups._');
    const mentions = await msg.getMentions();
    if (mentions.length === 0) return msg.reply('❌ _You must mention at least one person!_');
    let user1Id, user2Id;
    if (mentions.length === 1) {
      const sender = await msg.getContact();
      user1Id = getUserId(sender);
      user2Id = (mentions[0].id?._serialized || '').split('@')[0];
    } else {
      user1Id = (mentions[0].id?._serialized || '').split('@')[0];
      user2Id = (mentions[1].id?._serialized || '').split('@')[0];
    }
    const f1 = await familyStore.getFamily(user1Id);
    const f2 = await familyStore.getFamily(user2Id);
    let relationship = [];
    if (f1.partners && f1.partners.includes(user2Id)) relationship.push('Partners 💍');
    if (f1.parents.includes(user2Id)) relationship.push('Parent & Child 👨‍👩‍👦 (User 2 is parent)');
    if (f1.children.includes(user2Id)) relationship.push('Parent & Child 👨‍👩‍👦 (User 1 is parent)');
    if (relationship.length === 0) {
      const sharedParents = f1.parents.filter(p => f2.parents.includes(p));
      if (sharedParents.length > 0) {
        relationship.push('Siblings 👯');
      }
    }
    if (relationship.length === 0) {
      return msg.reply(`*@${user1Id}* and *@${user2Id}* are not directly related.`);
    } else {
      return msg.reply(`*@${user1Id}* and *@${user2Id}* are: **${relationship.join(', ')}**`);
    }
  }
};