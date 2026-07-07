const axios = require('axios');
const {
  sendImage,
  sendAnimatedGif
} = require('./mediaHelper');
async function sendRedditMeme(chat, msg, subreddit, categoryName, label) {
  let meme = null;
  let attempts = 0;
  const maxAttempts = 5;
  while (attempts < maxAttempts) {
    attempts++;
    try {
      const url = subreddit ? `https://meme-api.com/gimme/${subreddit}` : 'https://meme-api.com/gimme';
      const response = await axios.get(url, {
        timeout: 8000
      });
      if (response.data && response.data.url) {
        const data = response.data;
        if (data.nsfw) {
          continue;
        }
        meme = data;
        break;
      }
    } catch (err) {
      console.error(`[Meme Utility - ${label}] Fetch attempt ${attempts} failed:`, err.message);
      if (err.response && err.response.status === 404 && subreddit) {
        console.log(`[Meme Utility - ${label}] Subreddit r/${subreddit} not found/accessible. Falling back to r/dankmemes...`);
        subreddit = 'dankmemes';
      }
    }
  }
  if (!meme) {
    return msg.reply('❌ _Failed to fetch a meme. The Reddit vaults are currently locked, try again in a bit!_ 🔐');
  }
  const caption = `🎭 *${categoryName.toUpperCase()} MEME* 🎭\n\n` + `⚡ *Title:* ${meme.title}\n` + `👤 *Author:* u/${meme.author}\n` + `📂 *Subreddit:* r/${meme.subreddit}\n` + `👍 *Upvotes:* ${meme.ups.toLocaleString()} 🔺\n\n` + `━━━━━━━━━━━━━━━━━━━━━━\n` + `_~Kitsune Meme Delivery~_ 📦`;
  const isGif = meme.url.toLowerCase().endsWith('.gif') || meme.url.toLowerCase().includes('.gif?');
  let sent = false;
  if (isGif) {
    sent = await sendAnimatedGif({
      chat,
      gifUrl: meme.url,
      caption,
      label
    });
  } else {
    sent = await sendImage({
      chat,
      imageUrl: meme.url,
      caption,
      label
    });
  }
  if (!sent) {
    await chat.sendMessage(caption + `\n\n🔗 *Meme Link:* ${meme.url}`);
  }
}
module.exports = {
  sendRedditMeme
};