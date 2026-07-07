const {
  isGroupAdmin,
  isBotAdmin
} = require('../../utils/permissions');
const {
  banUser,
  isBanned
} = require('../../store/banStore');
module.exports = {
  name: 'ban',
  aliases: [],
  description: 'Ban a user — kicks them and auto-removes if they rejoin. Usage: -ban @user',
  adminOnly: true,
  async execute(msg, args, client) {
    const chat = await msg.getChat();
    if (!chat.isGroup) return msg.reply('❌ _This command only works in groups._');
    if (!(await isGroupAdmin(msg, client))) {
      return msg.reply('🔒 *Access Denied*\n\n_You need to be a group admin to use this command._');
    }
    if (!(await isBotAdmin(msg, client))) {
      return msg.reply('⚠️ *Missing Permissions*\n\n_I need to be a group admin to ban users.\nPlease promote me first._');
    }
    const mentions = await msg.getMentions();
    if (mentions.length === 0) {
      return msg.reply('❌ *Usage:* `-ban @user`\n\n_Mention the user you want to permanently ban._');
    }
    const target = mentions[0];
    const possibleIds = [target.id._serialized];
    if (target.number) possibleIds.push(`${target.number}@c.us`);
    const participant = chat.participants.find(p => possibleIds.includes(p.id._serialized));
    const groupId = msg.from;
    const targetIdToBan = participant ? participant.id._serialized : target.number ? `${target.number}@c.us` : target.id._serialized;
    if (targetIdToBan === client.info.wid._serialized) {
      return msg.reply('😅 _I can\'t ban myself, Master._');
    }
    if (participant && (participant.isAdmin || participant.isSuperAdmin)) {
      return msg.reply('🛡️ _Can\'t ban an admin. Demote them first._');
    }
    if (isBanned(groupId, targetIdToBan)) {
      return msg.reply('⚠️ _This user is already banned._');
    }
    try {
      banUser(groupId, targetIdToBan);
      if (participant) {
        await chat.removeParticipants([participant.id._serialized]);
      }
      const targetName = target.pushname || target.number;
      const senderName = (await msg.getContact()).pushname || 'Admin';
      await chat.sendMessage(`\n` + `   ⛔ *B A N N E D* ⛔    \n` + `\n\n` + `👤 *User:* _${targetName}_\n` + `👮 *Banned by:* _${senderName}_\n` + `━━━━━━━━━━━━━━━━━━━━\n\n` + `🔒 *Status:* _PERMANENT BAN_\n` + `🔄 *Auto-kick:* _ENABLED_\n\n` + `> _This user will be automatically\n` + `> removed if they try to rejoin._\n\n` + `_Use_ \`-unban @user\` _to lift the ban._`);
    } catch (err) {
      console.error('[Ban] Failed:', err.message);
      await msg.reply(`⚠️ *Ban Recorded*\n\n` + `_The kick failed, but the ban has been saved.\n` + `They will be auto-kicked if they rejoin._`);
    }
  }
};