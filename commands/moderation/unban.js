const {
  isGroupAdmin
} = require('../../utils/permissions');
const {
  unbanUser
} = require('../../store/banStore');
module.exports = {
  name: 'unban',
  aliases: [],
  description: 'Unban a user. Usage: -unban @user or -unban 91xxxxxxxxxx',
  adminOnly: true,
  async execute(msg, args, client) {
    const chat = await msg.getChat();
    if (!chat.isGroup) return msg.reply('❌ _This command only works in groups._');
    if (!(await isGroupAdmin(msg, client))) {
      return msg.reply('🔒 *Access Denied*\n\n_You need to be a group admin to use this command._');
    }
    const groupId = msg.from;
    let targetId = null;
    const mentions = await msg.getMentions();
    if (mentions.length > 0) {
      targetId = mentions[0].id._serialized;
    } else if (args.length > 0) {
      const phone = args[0].replace(/[^0-9]/g, '');
      if (phone.length >= 10) {
        targetId = `${phone}@c.us`;
      }
    }
    if (!targetId) {
      return msg.reply('❌ *Usage:* `-unban @user` or `-unban 91xxxxxxxxxx`\n\n_Mention or provide the phone number._');
    }
    const success = unbanUser(groupId, targetId);
    if (success) {
      const phone = targetId.split('@')[0];
      await chat.sendMessage(`\n` + `   ✅ *U N B A N N E D*   \n` + `\n\n` + `👤 *User:* _${phone}_\n` + `🔓 *Status:* _Ban lifted_\n\n` + `_They can now rejoin the group._`);
    } else {
      await msg.reply('⚠️ _This user is not in the ban list._');
    }
  }
};