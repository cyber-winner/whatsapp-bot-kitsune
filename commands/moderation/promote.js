const {
  isGroupAdmin,
  isBotAdmin
} = require('../../utils/permissions');
module.exports = {
  name: 'promote',
  aliases: [],
  description: 'Promote a user to group admin. Usage: -promote @user',
  adminOnly: true,
  async execute(msg, args, client) {
    const chat = await msg.getChat();
    if (!chat.isGroup) return msg.reply('❌ _This command only works in groups._');
    if (!(await isGroupAdmin(msg, client))) {
      return msg.reply('🔒 *Access Denied*\n\n_You need to be a group admin to use this command._');
    }
    if (!(await isBotAdmin(msg, client))) {
      return msg.reply('⚠️ *Missing Permissions*\n\n_I need to be a group admin to promote users.\nPlease promote me first._');
    }
    const mentions = await msg.getMentions();
    if (mentions.length === 0) {
      return msg.reply('❌ *Usage:* `-promote @user`\n\n_Mention the user to promote._');
    }
    const target = mentions[0];
    const possibleIds = [target.id._serialized];
    if (target.number) possibleIds.push(`${target.number}@c.us`);
    const participant = chat.participants.find(p => possibleIds.includes(p.id._serialized));
    if (!participant) {
      return msg.reply('⚠️ _User not found in this group._');
    }
    if (participant.isAdmin || participant.isSuperAdmin) {
      return msg.reply('⚠️ _This user is already an admin._');
    }
    try {
      await chat.promoteParticipants([participant.id._serialized]);
      const targetName = target.pushname || target.number;
      await chat.sendMessage(`\n` + `  👑 *P R O M O T E D*   \n` + `\n\n` + `👤 *User:* _${targetName}_\n` + `🎖️ *New Role:* _Group Admin_\n\n` + `_With great power comes great responsibility._ 👑`);
    } catch (err) {
      console.error('[Promote] Failed:', err.message);
      await msg.reply('❌ _Failed to promote the user. Check my permissions._');
    }
  }
};