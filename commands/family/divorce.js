const { OWNER_NAME } = require('../../config');
const familyStore = require('../../store/familyStore');
const { getUserId } = require('../../utils/getUserId');
const economyStore = require('../../store/economyStore');
const {
  getDisplayName
} = require('../../utils/contactHelper');
const {
  fetchGif
} = require('../../utils/gifApi');
const {
  sendAnimatedGif
} = require('../../utils/mediaHelper');
module.exports = {
  name: 'divorce',
  description: 'Divorce your current spouse. Both parties must agree. PokéCoins are split 50/50.',
  async execute(msg, args, client) {
    const chat = await msg.getChat();
    if (!chat.isGroup) return msg.reply('❌ _This command only works in groups._');
    const mentions = await msg.getMentions();
    if (mentions.length === 0) return msg.reply('❌ _You must mention your spouse to divorce!_');
    const target = mentions[0];
    const sender = await msg.getContact();
    const senderId = getUserId(sender);
    const targetId = getUserId(target);
    const senderName = getDisplayName(sender);
    const targetName = getDisplayName(target);
    const result = await familyStore.divorce(senderId, targetId);
    if (result.status === 'forced_relationship') {
      return msg.reply('❌ _This is a forced relationship! Only ' + OWNER_NAME + ' can divorce you._');
    }
    if (result.status === 'not_married') {
      return msg.reply('❌ _You are not married to that person._');
    }
    if (result.status === 'requested') {
      return msg.reply(`📋 *DIVORCE REQUEST* 📋\n` + `━━━━━━━━━━━━━━━━━━━━━━\n` + `*@${senderId}* has requested a divorce from *@${targetId}*.\n\n` + `⚠️ _Both parties must agree to finalize the divorce._\n` + `💰 _All PokéCoins will be merged and split. If you adopted a child during your marriage, the person who didn't ask for the divorce will get custody and 75% of the coins!_\n\n` + `👉 *@${targetId}*, reply with \`-divorce @${senderId}\` to confirm.\n` + `⏳ _This request expires in 2 minutes._`, null, {
        mentions: [sender.id._serialized, target.id._serialized]
      });
    }
    if (result.status === 'divorced') {
      const senderBalance = await economyStore.getBalance(senderId);
      const targetBalance = await economyStore.getBalance(targetId);
      const totalCoins = senderBalance.pokecoins + targetBalance.pokecoins;
      const senderWallet = await economyStore.getWallet(senderId);
      const targetWallet = await economyStore.getWallet(targetId);
      let assetText = `\n\n💔 *DIVORCE FINALIZED* 💔\n` + `━━━━━━━━━━━━━━━━━━━━━━\n` + `💰 *Combined PokéCoins:* ${totalCoins.toLocaleString()}\n`;
      if (result.hasChildAdoptedDuringMarriage) {
        const senderShare = Math.floor(totalCoins * 0.75);
        const targetShare = totalCoins - senderShare;
        senderWallet.pokecoins = senderShare;
        targetWallet.pokecoins = targetShare;
        assetText += `📊 *Split (Custody Settlement):*\n` + `📈 75% (${senderShare.toLocaleString()}) to *@${senderId}*\n` + `📉 25% (${targetShare.toLocaleString()}) to *@${targetId}*\n` + `🧸 _@${senderId} keeps custody of the children adopted during the marriage._\n`;
      } else {
        const splitAmount = Math.floor(totalCoins / 2);
        senderWallet.pokecoins = splitAmount;
        targetWallet.pokecoins = totalCoins - splitAmount;
        assetText += `📊 *Split:* ${splitAmount.toLocaleString()} each\n`;
      }
      assetText += `🏛️ _Tax benefits have been removed._`;
      await senderWallet.save();
      await targetWallet.save();
      const phrases = require('../../data/phrases.json').family['divorce'];
      let phrase = phrases[Math.floor(Math.random() * phrases.length)];
      phrase = phrase.replace(/\{s\}/g, senderId).replace(/\{t\}/g, targetId);
      const mediaData = await fetchGif('slap');
      const caption = phrase + assetText + (mediaData ? `\n\n_Anime: ${mediaData.anime_name}_` : '');
      if (mediaData) {
        const sent = await sendAnimatedGif({
          chat,
          gifUrl: mediaData.url,
          caption,
          mentions: [sender.id._serialized, target.id._serialized],
          label: 'DIVORCE'
        });
        if (sent) return;
      }
      return msg.reply(caption, null, {
        mentions: [sender.id._serialized, target.id._serialized]
      });
    }
  }
};