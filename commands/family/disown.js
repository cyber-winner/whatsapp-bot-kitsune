const { OWNER_NAME } = require('../../config');
const familyStore = require('../../store/familyStore');
const { getUserId } = require('../../utils/getUserId');
const economyStore = require('../../store/economyStore');
const {
  fetchGif
} = require('../../utils/gifApi');
const {
  sendAnimatedGif
} = require('../../utils/mediaHelper');
module.exports = {
  name: 'disown',
  description: 'Disown one of your children. You must pay them 25% of your PokéCoins as a severance.',
  async execute(msg, args, client) {
    const chat = await msg.getChat();
    if (!chat.isGroup) return msg.reply('❌ _This command only works in groups._');
    const mentions = await msg.getMentions();
    if (mentions.length === 0) return msg.reply('❌ _You must mention a child to disown!_');
    const target = mentions[0];
    const sender = await msg.getContact();
    const senderId = getUserId(sender);
    const targetId = getUserId(target);
    const result = await familyStore.disown(senderId, targetId);
    if (result === 'forced_relationship') {
      return msg.reply('❌ _This is a forced relationship! Only ' + OWNER_NAME + ' can disown your child._');
    }
    if (result) {
      const senderBalance = await economyStore.getBalance(senderId);
      const penalty = Math.floor(senderBalance.pokecoins * 0.25);
      if (penalty > 0) {
        await economyStore.deductCoins(senderId, penalty);
        await economyStore.addCoins(targetId, penalty);
      }
      const phrases = require('../../data/phrases.json').family['disown'];
      let phrase = phrases[Math.floor(Math.random() * phrases.length)];
      phrase = phrase.replace(/\{s\}/g, senderId).replace(/\{t\}/g, targetId);
      const penaltyText = penalty > 0 ? `\n\n💸 *Severance Paid:* @${senderId} was forced to pay 25% of their savings (${penalty.toLocaleString()} PokéCoins) to @${targetId}!` : `\n\n💸 *Severance:* @${senderId} had no PokéCoins to give to @${targetId}.`;
      const mediaData = await fetchGif('kick');
      const caption = phrase + penaltyText + (mediaData ? `\n\n_Anime: ${mediaData.anime_name}_` : '');
      if (mediaData) {
        const sent = await sendAnimatedGif({
          chat,
          gifUrl: mediaData.url,
          caption,
          mentions: [sender.id._serialized, target.id._serialized],
          label: 'DISOWN'
        });
        if (sent) return;
      }
      return msg.reply(caption, null, {
        mentions: [sender.id._serialized, target.id._serialized]
      });
    } else {
      return msg.reply('❌ _That person is not your child._');
    }
  }
};