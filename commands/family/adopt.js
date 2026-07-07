const familyStore = require('../../store/familyStore');
const { getUserId } = require('../../utils/getUserId');
const {
  fetchGif
} = require('../../utils/gifApi');
const {
  sendAnimatedGif
} = require('../../utils/mediaHelper');
module.exports = {
  name: 'adopt',
  description: 'Adopt a user as your child.',
  async execute(msg, args, client) {
    const chat = await msg.getChat();
    if (!chat.isGroup) return msg.reply('❌ _This command only works in groups._');
    const mentions = await msg.getMentions();
    if (mentions.length === 0) return msg.reply('❌ _You must mention someone to adopt!_');
    const target = mentions[0];
    const sender = await msg.getContact();
    const senderId = getUserId(sender);
    const targetId = getUserId(target);
    if (senderId === targetId) return msg.reply('❌ _You cannot adopt yourself!_');
    const result = await familyStore.adopt(senderId, targetId);
    if (result.status === 'is_parent') {
      return msg.reply('❌ _You cannot adopt your own parent!_');
    } else if (result.status === 'already_adopted_by_others') {
      return msg.reply('❌ _This person is already adopted by someone else!_');
    } else if (result.status === 'already_adopted') {
      return msg.reply('❌ _They are already your child!_');
    } else if (result.status === 'proposed') {
      return msg.reply(`🍼 *@${senderId}* wants to adopt *@${targetId}*!\n\nTo accept, *@${targetId}* must reply with \`-makeparent @${senderId}\`.`, null, {
        mentions: [sender.id._serialized, target.id._serialized]
      });
    } else if (result.status === 'waiting_spouse') {
      return msg.reply(`🍼 *@${senderId}* has initiated the adoption of *@${targetId}*!\n\nSince *@${senderId}* is married, their spouse *@${result.spouse}* must also approve the adoption by sending \`-adopt @${targetId}\`!`, null, {
        mentions: [sender.id._serialized, target.id._serialized, `${result.spouse}@c.us`]
      });
    } else if (result.status === 'adopted' || result.status === 'adopted_by_couple') {
      const phrases = require('../../data/phrases.json').family['adopt'];
      let phrase = phrases[Math.floor(Math.random() * phrases.length)];
      let caption = '';
      let mentionsList = [target.id._serialized];
      if (result.status === 'adopted_by_couple') {
        phrase = phrase.replace(/\{s\}/g, `${result.parent1} and ${result.parent2}`).replace(/\{t\}/g, targetId);
        caption = `🎉 *@${result.parent1}* and *@${result.parent2}* have successfully adopted *@${targetId}* together!\n\n${phrase}`;
        mentionsList.push(`${result.parent1}@c.us`, `${result.parent2}@c.us`);
      } else {
        phrase = phrase.replace(/\{s\}/g, senderId).replace(/\{t\}/g, targetId);
        caption = phrase;
        mentionsList.push(sender.id._serialized);
      }
      const mediaData = await fetchGif('pat');
      caption += mediaData ? `\n\n_Anime: ${mediaData.anime_name}_` : '';
      if (mediaData) {
        const sent = await sendAnimatedGif({
          chat,
          gifUrl: mediaData.url,
          caption,
          mentions: mentionsList,
          label: 'ADOPT'
        });
        if (sent) return;
      }
      return msg.reply(caption, null, {
        mentions: mentionsList
      });
    }
  }
};