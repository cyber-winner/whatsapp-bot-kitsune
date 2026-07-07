const axios = require('axios');
const {
  getDisplayName
} = require('../../utils/contactHelper');
const {
  sendAnimatedGif,
  sendImage
} = require('../../utils/mediaHelper');
async function fetchTenorSonMemes() {
  try {
    const response = await axios.get('https://tenor.com/search/son-gifs', {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8'
      },
      timeout: 8000
    });
    const html = response.data;
    const regex = /https:\/\/media\.tenor\.com\/[a-zA-Z0-9_\-]+\/([a-zA-Z0-9_\-]+)\.gif/g;
    const matches = [];
    let match;
    while ((match = regex.exec(html)) !== null) {
      const url = match[0];
      const rawName = match[1];
      const nameLower = rawName.toLowerCase();
      if (nameLower.includes('son')) {
        matches.push({
          url,
          rawName
        });
      }
    }
    const unique = [];
    const seen = new Set();
    for (const item of matches) {
      if (!seen.has(item.url)) {
        seen.add(item.url);
        unique.push(item);
      }
    }
    return unique;
  } catch (err) {
    console.error('[Tenor Scrape Error]', err.message);
    return [];
  }
}
function formatMemeName(rawName) {
  const capitalized = rawName.split('-').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
  if (capitalized.toLowerCase().includes('onion')) {
    return `${capitalized} 🧅💔😭😭😭😭`;
  }
  return `${capitalized} 💔😭😭😭😭`;
}
module.exports = {
  name: 'son',
  aliases: ['winning', 'brainrot'],
  description: 'Summon dynamic Tenor "Son 💔😭😭😭😭" and "Sonion" brainrot memes!',
  adminOnly: false,
  async execute(msg, args, client) {
    const chat = await msg.getChat();
    const sender = await msg.getContact();
    const senderName = getDisplayName(sender);
    const liveMemes = await fetchTenorSonMemes();
    if (!liveMemes || liveMemes.length === 0) {
      return msg.reply('❌ _Failed to fetch a live Son meme from Tenor. The brainrot vault is temporarily locked, try again!_ 💔😭😭😭😭');
    }
    const chosen = liveMemes[Math.floor(Math.random() * liveMemes.length)];
    const memeUrl = chosen.url;
    const memeName = formatMemeName(chosen.rawName);
    const caption = `🎬 *Format:* ${memeName}\n\n` + `━━━━━━━━━━━━━━━━━━━━━━\n` + `_Requested by *${senderName}*_ 👨‍👦`;
    const sent = await sendAnimatedGif({
      chat,
      gifUrl: memeUrl,
      caption,
      mentions: [sender],
      label: 'SON_MEME_GIF'
    });
    if (!sent) {
      await chat.sendMessage(caption, {
        mentions: [sender]
      });
    }
  }
};