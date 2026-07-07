const familyStore = require('../../store/familyStore');
const { getUserId } = require('../../utils/getUserId');
const {
  fetchGif
} = require('../../utils/gifApi');
const {
  sendAnimatedGif
} = require('../../utils/mediaHelper');
module.exports = {
  name: 'makeparent',
  description: 'Ask a user to be your parent.',
  async execute(msg, args, client) {
    const chat = await msg.getChat();
    if (!chat.isGroup) return msg.reply('❌ _This command only works in groups._');
    const mentions = await msg.getMentions();
    if (mentions.length === 0) return msg.reply('❌ _You must mention someone to make them your parent!_');
    const target = mentions[0];
    const sender = await msg.getContact();
    const senderId = getUserId(sender);
    const targetId = getUserId(target);
    if (senderId === targetId) return msg.reply('❌ _You cannot be your own parent!_');
    const result = await familyStore.makeparent(senderId, targetId);
    if (result.status === 'is_parent') {
      return msg.reply('❌ _They are already your child! You cannot be your child\'s child!_');
    } else if (result.status === 'already_adopted_by_others') {
      return msg.reply('❌ _You already have parents! You cannot be adopted by someone else._');
    } else if (result.status === 'already_adopted') {
      return msg.reply('❌ _They are already your parent!_');
    } else if (result.status === 'proposed') {
      return msg.reply(`🍼 *@${senderId}* wants *@${targetId}* to be their parent!\n\nTo accept, *@${targetId}* must reply with \`-adopt @${senderId}\`.`, null, {
        mentions: [sender.id._serialized, target.id._serialized]
      });
    } else if (result.status === 'waiting_spouse') {
      return msg.reply(`🍼 *@${targetId}* has accepted *@${senderId}* as their child!\n\nSince *@${targetId}* is married, their spouse *@${result.spouse}* must also approve the adoption by sending \`-adopt @${senderId}\`!`, null, {
        mentions: [sender.id._serialized, target.id._serialized, `${result.spouse}@c.us`]
      });
    } else if (result.status === 'adopted') {
      const phrases = require('../../data/phrases.json').family['adopt'];
      let phrase = phrases[Math.floor(Math.random() * phrases.length)];
      phrase = phrase.replace(/\{s\}/g, targetId).replace(/\{t\}/g, senderId);
      const mediaData = await fetchGif('pat');
      const caption = phrase + (mediaData ? `\n\n_Anime: ${mediaData.anime_name}_` : '');
      if (mediaData) {
        const sent = await sendAnimatedGif({
          chat,
          gifUrl: mediaData.url,
          caption,
          mentions: [sender.id._serialized, target.id._serialized],
          label: 'MAKEPARENT'
        });
        if (sent) return;
      }
      return msg.reply(caption, null, {
        mentions: [sender.id._serialized, target.id._serialized]
      });
    }
  }
};