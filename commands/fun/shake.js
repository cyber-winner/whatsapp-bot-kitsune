const {
  fetchGif
} = require('../../utils/gifApi');
const {
  getDisplayName
} = require('../../utils/contactHelper');
const {
  sendAnimatedGif,
  sendImage
} = require('../../utils/mediaHelper');
module.exports = {
  name: 'shake',
  aliases: [],
  description: 'Express yourself! Usage: -shake',
  adminOnly: false,
  async execute(msg, args, client) {
    const chat = await msg.getChat();
    if (!chat.isGroup) return msg.reply('❌ _This command only works in groups._');
    const sender = await msg.getContact();
    const senderName = getDisplayName(sender);
    let targetName = '';
    let target = null;
    let mentions = [sender];
    const msgMentions = await msg.getMentions();
    if (msgMentions.length > 0) {
      target = msgMentions[0];
      targetName = getDisplayName(target);
      mentions.push(target);
    }
    const phrases = require('../../data/phrases.json').fun['shake'];
    let selectedPhrase = phrases[Math.floor(Math.random() * phrases.length)];
    selectedPhrase = selectedPhrase.replace(/\{s\}/g, '*' + senderName + '*');
    if (targetName) {
      selectedPhrase = selectedPhrase.replace(/\{t\}/g, '*' + targetName + '*');
    }
    const mediaData = await fetchGif('shake');
    const caption = selectedPhrase + '\n\n' + '━━━━━━━━━━━━━━━━━━━━\n' + (mediaData ? '_Anime: ' + mediaData.anime_name + '_' : '');
    if (mediaData) {
      const sent = await sendAnimatedGif({
        chat,
        gifUrl: mediaData.url,
        caption,
        mentions,
        label: 'SHAKE'
      });
      if (sent) return;
    }
    await chat.sendMessage(caption, {
      mentions
    });
  }
};