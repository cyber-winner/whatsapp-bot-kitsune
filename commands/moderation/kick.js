const {
  isGroupAdmin,
  isBotAdmin
} = require('../../utils/permissions');
module.exports = {
  name: 'kick',
  aliases: ['remove'],
  description: 'Kick a user from the group. Usage: -kick @user',
  adminOnly: true,
  async execute(msg, args, client) {
    const chat = await msg.getChat();
    if (!chat.isGroup) return msg.reply('❌ _This command only works in groups._');
    if (!(await isGroupAdmin(msg, client))) {
      return msg.reply('🔒 *Access Denied*\n\n_You need to be a group admin to use this command._');
    }
    if (!(await isBotAdmin(msg, client))) {
      return msg.reply('⚠️ *Missing Permissions*\n\n_I need to be a group admin to kick users.\nPlease promote me first._');
    }
    const mentions = await msg.getMentions();
    if (mentions.length === 0) {
      return msg.reply('❌ *Usage:* `-kick @user`\n\n_Mention the user you want to remove._');
    }
    const target = mentions[0];
    const possibleIds = [target.id._serialized];
    if (target.number) possibleIds.push(`${target.number}@c.us`);
    const participant = chat.participants.find(p => possibleIds.includes(p.id._serialized));
    if (!participant) {
      return msg.reply('⚠️ _User not found in this group._');
    }
    if (participant.id._serialized === client.info.wid._serialized) {
      return msg.reply('😅 _I can\'t kick myself, Master._');
    }
    if (participant.isAdmin || participant.isSuperAdmin) {
      return msg.reply('🛡️ _Can\'t kick an admin. Demote them first._');
    }
    try {
      await chat.removeParticipants([participant.id._serialized]);
      const targetName = target.pushname || target.number;
      await chat.sendMessage(`\n` + `    🚪 *K I C K E D*    \n` + `\n\n` + `👤 *User:* _${targetName}_\n` + `👮 *By:* _${(await msg.getContact()).pushname || 'Admin'}_\n\n` + `_The door has been shown. Goodbye._ 👋`);
    } catch (err) {
      console.error('[Kick] Failed:', err.message);
      await msg.reply('❌ _Failed to kick the user. Check my permissions._');
    }
  }
};