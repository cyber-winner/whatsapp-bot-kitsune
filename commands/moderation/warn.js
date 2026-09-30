/**
 * warn.js - Group moderation warning command
 */

const Warning = require('../../models/Warning');
const Group = require('../../models/Group');
const { isBotAdmin } = require('../../utils/permissions');
const { getUserId } = require('../../utils/getUserId');

module.exports = {
  name: 'warn',
  aliases: ['warning'],
  description: 'Issues a warning to a group member.',
  usage: '-warn @user [reason]',
  category: 'moderation',
  groupOnly: true,
  adminOnly: true,

  async execute(msg, args, client) {
    const chat = await msg.getChat();
    if (!chat.isGroup) {
      return msg.reply('❌ _This command can only be used in group chats._');
    }

    const isAdmin = await isBotAdmin(msg, client);
    if (!isAdmin) {
      return msg.reply('❌ _You must be an admin to issue warnings._');
    }

    const mentions = await msg.getMentions();
    if (mentions.length === 0) {
      return msg.reply('❌ _Please mention the user you want to warn: `-warn @user [reason]`_');
    }

    const targetContact = mentions[0];
    const targetId = getUserId(targetContact);
    const reason = args.slice(1).join(' ') || 'No reason provided';

    const groupConfig = await Group.findOne({ groupId: chat.id._serialized }) || { maxWarnings: 3, actionOnMaxWarnings: 'kick' };

    const newWarning = await Warning.create({
      groupId: chat.id._serialized,
      userId: targetId,
      reason,
      warnedBy: msg.author || msg.from
    });

    const userWarningsCount = await Warning.countDocuments({ groupId: chat.id._serialized, userId: targetId });

    let warnMsg = `⚠️ *WARNING ISSUED* ⚠️\n\n`;
    warnMsg += `👤 *User:* @${targetId}\n`;
    warnMsg += `📝 *Reason:* ${reason}\n`;
    warnMsg += `📊 *Warnings:* ${userWarningsCount} / ${groupConfig.maxWarnings}\n`;

    if (userWarningsCount >= groupConfig.maxWarnings) {
      warnMsg += `\n🚨 *Warning threshold reached (${groupConfig.maxWarnings})!*\n`;
      if (groupConfig.actionOnMaxWarnings === 'kick') {
        try {
          await chat.removeParticipants([targetContact.id._serialized]);
          warnMsg += `🛑 *Action Taken:* User has been kicked from the group.`;
        } catch (e) {
          warnMsg += `⚠️ *Action Failed:* Could not kick user (${e.message}). Ensure bot is admin.`;
        }
      }
    }

    return chat.sendMessage(warnMsg, { mentions: [targetContact.id._serialized] });
  }
};
