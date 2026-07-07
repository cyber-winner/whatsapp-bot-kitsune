const {
  isGroupAdmin,
  isBotAdmin
} = require('../../utils/permissions');
const {
  getDisplayName
} = require('../../utils/contactHelper');
module.exports = {
  name: 'demote',
  aliases: [],
  description: 'Demote a user from group admin. Usage: -demote @user',
  adminOnly: true,
  async execute(msg, args, client) {
    const chat = await msg.getChat();
    if (!chat.isGroup) return msg.reply('❌ _This command only works in groups._');
    if (!(await isGroupAdmin(msg, client))) {
      return msg.reply('🔒 *Access Denied*\n\n_You need to be a group admin to use this command._');
    }
    if (!(await isBotAdmin(msg, client))) {
      return msg.reply('⚠️ *Missing Permissions*\n\n_I need to be a group admin to demote users.\nPlease promote me first._');
    }
    const mentions = await msg.getMentions();
    if (mentions.length === 0) {
      return msg.reply('❌ *Usage:* `-demote @user`\n\n_Mention the admin to demote._');
    }
    const target = mentions[0];
    const possibleIds = [target.id._serialized];
    if (target.number) possibleIds.push(`${target.number}@c.us`);
    const participant = chat.participants.find(p => possibleIds.includes(p.id._serialized));
    if (!participant) {
      return msg.reply('⚠️ _User not found in this group._');
    }
    if (!participant.isAdmin && !participant.isSuperAdmin) {
      return msg.reply('⚠️ _This user is not an admin._');
    }
    if (participant.isSuperAdmin) {
      return msg.reply('⚠️ _You cannot demote the group creator._');
    }
    try {
      await chat.demoteParticipants([participant.id._serialized]);
      const targetName = getDisplayName(target);
      await chat.sendMessage(`\n` + `   📉 *D E M O T E D*   \n` + `\n\n` + `👤 *User:* _${targetName}_\n` + `🎖️ *New Role:* _Member_\n\n` + `_Your admin privileges have been revoked._ 📉`);
    } catch (err) {
      console.error('[Demote] Failed:', err.message);
      await msg.reply('❌ _Failed to demote the user. Check my permissions._');
    }
  }
};