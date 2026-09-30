/**
 * warnings.js - View or clear user warnings
 */

const Warning = require('../../models/Warning');
const { getUserId } = require('../../utils/getUserId');

module.exports = {
  name: 'warnings',
  aliases: ['clearwarnings'],
  description: 'Views or clears user warnings in the group.',
  usage: '-warnings [@user] [clear]',
  category: 'moderation',
  groupOnly: true,

  async execute(msg, args, client) {
    const chat = await msg.getChat();
    if (!chat.isGroup) {
      return msg.reply('❌ _This command can only be used in group chats._');
    }

    const mentions = await msg.getMentions();
    const isClear = args.includes('clear');

    if (isClear) {
      if (mentions.length === 0) {
        return msg.reply('❌ _Specify a user to clear warnings: `-warnings @user clear`_');
      }
      const targetId = getUserId(mentions[0]);
      await Warning.deleteMany({ groupId: chat.id._serialized, userId: targetId });
      return msg.reply(`✅ *Warnings Cleared:* All warnings for @${targetId} have been removed.`, { mentions: [mentions[0].id._serialized] });
    }

    const targetId = mentions.length > 0 ? getUserId(mentions[0]) : getUserId(await msg.getContact());
    const userWarnings = await Warning.find({ groupId: chat.id._serialized, userId: targetId });

    if (userWarnings.length === 0) {
      return msg.reply(`✅ *@${targetId} has 0 active warnings.*`, { mentions: [mentions[0]?.id._serialized].filter(Boolean) });
    }

    let text = `📊 *WARNING HISTORY FOR @${targetId}* (${userWarnings.length} total)\n\n`;
    userWarnings.forEach((w, idx) => {
      text += `${idx + 1}. *Reason:* ${w.reason} _(Warned on ${new Date(w.createdAt).toLocaleDateString()})_\n`;
    });

    return msg.reply(text, { mentions: [mentions[0]?.id._serialized].filter(Boolean) });
  }
};
