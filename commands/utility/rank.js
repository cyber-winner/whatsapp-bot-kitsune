/**
 * rank.js - Check user points and rank (Private & Group)
 */

const User = require('../../models/User');
const { getRank, formatRank } = require('../../utils/rankUtil');
const { getUserId } = require('../../utils/getUserId');

module.exports = {
  name: 'rank',
  aliases: ['points', 'level'],
  description: 'Displays user points and rank calculated using rankUtil.',
  usage: '-rank [@user]',
  category: 'utility',

  async execute(msg, args, client) {
    const mentions = await msg.getMentions();
    const contact = mentions.length > 0 ? mentions[0] : await msg.getContact();
    const userId = getUserId(contact);

    let user = await User.findOne({ userId });
    if (!user) {
      user = await User.create({ userId, name: contact.pushname || contact.name || 'User', points: 1 });
    }

    const rankInfo = getRank(user.points);

    let text = `🏆 *RANK PROFILE* 🏆\n\n`;
    text += `👤 *User:* @${userId}\n`;
    text += `⭐ *Rank:* ${formatRank(user.points)}\n`;
    text += `📊 *Points:* ${rankInfo.points.toLocaleString()}\n`;

    if (rankInfo.nextRank) {
      text += `📈 *Next Tier:* ${rankInfo.nextRank.name} (${rankInfo.nextRank.pointsNeeded} pts needed)\n`;
      text += `🎯 *Progress:* [${'█'.repeat(Math.floor(rankInfo.progressToNext / 10))}${'░'.repeat(10 - Math.floor(rankInfo.progressToNext / 10))}] ${rankInfo.progressToNext}%\n`;
    } else {
      text += `👑 *Status:* Maximum Rank Achieved!\n`;
    }

    return msg.reply(text, { mentions: [contact.id._serialized] });
  }
};
