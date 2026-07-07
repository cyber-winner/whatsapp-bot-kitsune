const {
  sendRedditMeme
} = require('../../utils/redditMemeHelper');
module.exports = {
  name: 'crypto',
  aliases: ['cryptomeme', 'bitcoin'],
  description: 'Fetch a completely random crypto meme from r/cryptocurrencymemes!',
  adminOnly: false,
  async execute(msg, args, client) {
    const chat = await msg.getChat();
    await sendRedditMeme(chat, msg, 'cryptocurrencymemes', 'Crypto', 'MEME_CRYPTO');
  }
};