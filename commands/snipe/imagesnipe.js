const {
  MessageMedia
} = require('whatsapp-web.js');
const {
  getLastDeletedMedia
} = require('../../store/snipeStore');
module.exports = {
  name: 'imagesnipe',
  aliases: ['imgsnipe', 'is'],
  description: 'Recover the last deleted image/media in this group.',
  adminOnly: false,
  async execute(msg, args, client) {
    const chat = await msg.getChat();
    if (!chat.isGroup) {
      return msg.reply('❌ _This command only works in groups._');
    }
    const snipe = getLastDeletedMedia(msg.from);
    if (!snipe) {
      return msg.reply(`🔍 *No deleted media found!*\n\n` + `_No images or videos were deleted recently._`);
    }
    const timeSince = getTimeSince(snipe.timestamp);
    let caption = `\n` + `  📸 *IMAGE  SNIPED*  📸  \n` + `\n\n` + `👤 *Author:* _${snipe.authorName}_\n`;
    if (snipe.body) caption += `💬 *Caption:* _${snipe.body}_\n`;
    caption += `🕐 *Deleted:* _${timeSince} ago_\n\n`;
    caption += `_📸 Caught red-handed by Kitsune._`;
    if (snipe.media) {
      try {
        await chat.sendMessage(snipe.media, {
          caption
        });
        return;
      } catch (e) {
        console.error('[ImageSnipe] Failed to send media:', e.message);
      }
    }
    await chat.sendMessage(caption + '\n\n⚠️ _Media could not be recovered._');
  }
};
function getTimeSince(timestamp) {
  const diff = Date.now() - timestamp;
  const seconds = Math.floor(diff / 1000);
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  return `${hours}h ${minutes % 60}m`;
}