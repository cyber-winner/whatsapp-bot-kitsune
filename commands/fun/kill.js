const {
  fetchGif
} = require('../../utils/gifApi');
const {
  getDisplayName
} = require('../../utils/contactHelper');
const {
  sendAnimatedGif
} = require('../../utils/mediaHelper');
const KILL_MESSAGES = ['*%sender%* _obliterated_ *%target%* _from existence!_ 💀', '*%sender%* _sent_ *%target%* _to the shadow realm!_ ⚰️', '*%target%* _was eliminated by_ *%sender%*! 🗡️', '*%sender%* _used_ *FATALITY* _on_ *%target%*! 💥', '*%target%* _was no match for_ *%sender%*! ☠️', '*%sender%* _deleted_ *%target%* _from the server!_ 🔫', '*%target%* _got absolutely destroyed by_ *%sender%*! 💣', '*%sender%* _ended_ *%target%*\'s _whole career!_ 🪦', '*%target%* _was sent to meet their ancestors by_ *%sender%*! ⚔️', '*%sender%* _used kamehameha on_ *%target%*! 🌊'];
module.exports = {
  name: 'kill',
  aliases: ['murder', 'eliminate'],
  description: 'Eliminate someone! Usage: -kill @user',
  adminOnly: false,
  async execute(msg, args, client) {
    const chat = await msg.getChat();
    if (!chat.isGroup) return msg.reply('❌ _This command only works in groups._');
    const mentions = await msg.getMentions();
    if (mentions.length === 0) {
      return msg.reply('❌ *Usage:* `-kill @user`\n\n_Mention someone to eliminate!_');
    }
    const target = mentions[0];
    const sender = await msg.getContact();
    const senderName = getDisplayName(sender);
    const targetName = getDisplayName(target);
    let killMsg = KILL_MESSAGES[Math.floor(Math.random() * KILL_MESSAGES.length)].replace(/%sender%/g, senderName).replace(/%target%/g, targetName);
    if (sender.id._serialized === target.id._serialized) {
      killMsg = `☠️ *${senderName}* _eliminated themselves!_ 💀`;
    }
    const gif = await fetchGif('kick');
    const caption = `☠️ ${killMsg}\n\n` + `━━━━━━━━━━━━━━━━━━━━\n` + (gif ? `_Anime: ${gif.anime_name}_` : '');
    if (gif) {
      const sent = await sendAnimatedGif({
        chat,
        gifUrl: gif.url,
        caption,
        mentions: [sender.id._serialized, target.id._serialized],
        label: 'Kill'
      });
      if (sent) return;
    }
    await chat.sendMessage(caption, {
      mentions: [sender.id._serialized, target.id._serialized]
    });
  }
};