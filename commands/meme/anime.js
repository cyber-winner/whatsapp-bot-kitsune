const {
  sendRedditMeme
} = require('../../utils/redditMemeHelper');
module.exports = {
  name: 'anime',
  aliases: ['animeme', 'animeirl'],
  description: 'Fetch a completely random anime meme from r/animemes!',
  adminOnly: false,
  async execute(msg, args, client) {
    const chat = await msg.getChat();
    await sendRedditMeme(chat, msg, 'animemes', 'Anime', 'MEME_ANIME');
  }
};