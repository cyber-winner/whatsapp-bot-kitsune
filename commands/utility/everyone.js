const {
  isGroupAdmin
} = require('../../utils/permissions');
module.exports = {
  name: 'everyone',
  aliases: ['tagall', 'all'],
  description: 'Tag all members in the group. Admin only.',
  adminOnly: true,
  async execute(msg, args, client) {
    const chat = await msg.getChat();
    if (!chat.isGroup) return msg.reply('❌ _This command only works in groups._ (╥﹏╥)');
    if (!(await isGroupAdmin(msg, client))) {
      return msg.reply('🔒 *Access Denied*\n\n_You need to be a group admin to use this command._ ૮₍ ˃ ⤙ ˂ ₎ა');
    }
    const customMessage = args.length > 0 ? args.join(' ') : '';
    try {
      const participants = chat.participants;
      const mentions = [];
      let text = `\n` + `   📢 *A T T E N T I O N* ᯓ★ \n` + `\n\n`;
      if (customMessage) {
        text += `💬 *Message:*\n> _${customMessage}_\n\n`;
      }
      text += `━━━━━━━━━━━━━━━━━━━━\n`;
      for (const participant of participants) {
        const contact = await client.getContactById(participant.id._serialized);
        mentions.push(contact);
        text += `@${participant.id.user} `;
      }
      text += `\n━━━━━━━━━━━━━━━━━━━━`;
      await chat.sendMessage(text, {
        mentions
      });
    } catch (err) {
      console.error('[Everyone] Failed:', err.message);
      await msg.reply('❌ _Failed to tag everyone._');
    }
  }
};