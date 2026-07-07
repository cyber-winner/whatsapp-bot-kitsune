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
  name: 'marry',
  aliases: ['propose'],
  description: 'Propose to another user to marry them. Costs 10% of your PokéCoins.',
  async execute(msg, args, client) {
    const chat = await msg.getChat();
    if (!chat.isGroup) return msg.reply('❌ _This command only works in groups._');
    const mentions = await msg.getMentions();
    if (mentions.length === 0) return msg.reply('❌ _You must mention someone to marry!_');
    const target = mentions[0];
    const sender = await msg.getContact();
    const senderId = getUserId(sender);
    const targetId = getUserId(target);
    if (senderId === targetId) return msg.reply('❌ _You cannot marry yourself!_');
    const botId = client.info?.wid?.user || '';
    if (targetId === botId) {
      const {
        FATHER
      } = require('../../config');
      const fatherId = FATHER[0];
      familyStore.setCelestiaMarryRequest(chat.id._serialized, senderId);
      return msg.reply(`💍 *@${fatherId}*, Father! *@${senderId}* is trying to marry me!\n\nDo I have your blessing? 🥺\n_(Reply with \`kitsune yes\` or \`kitsune no\`)_`, null, {
        mentions: [sender.id._serialized, `${fatherId}@c.us`]
      });
    }
    const validation = await familyStore.validateMarriage(senderId, targetId);
    if (!validation.allowed) {
      const reasons = {
        'already_married': '❌ _You are already married to this person!_',
        'already_married_other': `❌ _You are already married! Divorce your current spouse first using \`-divorce @spouse\`._`,
        'target_married': `❌ _*${getDisplayName(target)}* is already married to someone else!_`,
        'siblings': '❌ _You cannot marry your sibling!_',
        'parent_child': '❌ _You cannot marry your parent or child!_',
        'grandparent': '❌ _You cannot marry your grandparent or grandchild!_'
      };
      return msg.reply(reasons[validation.reason] || '❌ _Marriage not allowed._');
    }
    const result = await familyStore.marry(senderId, targetId);
    if (result.status === 'proposed') {
      return msg.reply(`💍 *@${senderId}* has proposed to *@${targetId}*!\n\nTo accept, *@${targetId}* must reply with \`-marry @${senderId}\`.`, null, {
        mentions: [sender.id._serialized, target.id._serialized]
      });
    } else if (result.status === 'married') {
      const proposerId = result.proposer;
      const spouseId = proposerId === senderId ? targetId : senderId;
      const proposerBalance = await economyStore.getBalance(proposerId);
      const dowry = Math.floor(proposerBalance.pokecoins * 0.10);
      if (dowry > 0) {
        await economyStore.deductCoins(proposerId, dowry);
        await economyStore.addCoins(spouseId, dowry);
      }
      const phrases = require('../../data/phrases.json').family['marry'];
      let phrase = phrases[Math.floor(Math.random() * phrases.length)];
      phrase = phrase.replace(/\{s\}/g, senderId).replace(/\{t\}/g, targetId);
      const dowryText = dowry > 0 ? `\n\n💰 *Dowry:* @${proposerId} gifted ${dowry.toLocaleString()} PokéCoins (10%) to @${spouseId}!` : '';
      const taxText = `\n🏛️ _@${proposerId} will now pay @${spouseId}'s 18% tax on all purchases._`;
      const mediaData = await fetchGif('kiss');
      const caption = phrase + dowryText + taxText + (mediaData ? `\n\n_Anime: ${mediaData.anime_name}_` : '');
      if (mediaData) {
        const sent = await sendAnimatedGif({
          chat,
          gifUrl: mediaData.url,
          caption,
          mentions: [sender.id._serialized, target.id._serialized],
          label: 'MARRY'
        });
        if (sent) return;
      }
      return msg.reply(caption, null, {
        mentions: [sender.id._serialized, target.id._serialized]
      });
    }
  }
};