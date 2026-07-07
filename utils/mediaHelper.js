const {
  MessageMedia
} = require('whatsapp-web.js');
const {
  gifToMp4Base64
} = require('./gifApi');
async function sendAnimatedGif({
  chat,
  gifUrl,
  caption,
  mentions = [],
  label = 'GIF'
}) {
  try {
    const mp4Base64 = await gifToMp4Base64(gifUrl);
    if (mp4Base64) {
      const media = new MessageMedia('video/mp4', mp4Base64, 'animation.mp4');
      await chat.sendMessage(media, {
        caption,
        mentions,
        sendVideoAsGif: true
      });
      return true;
    }
  } catch (err) {
    console.error(`[${label}] Animated GIF send failed:`, err.message);
  }
  return false;
}
async function sendImage({
  chat,
  imageUrl,
  caption,
  mentions = [],
  label = 'Image'
}) {
  try {
    const media = await MessageMedia.fromUrl(imageUrl);
    await chat.sendMessage(media, {
      caption,
      mentions
    });
    return true;
  } catch (err) {
    console.error(`[${label}] Image send failed:`, err.message);
  }
  return false;
}
module.exports = {
  sendAnimatedGif,
  sendImage
};