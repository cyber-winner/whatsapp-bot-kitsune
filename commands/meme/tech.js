const {
  sendRedditMeme
} = require('../../utils/redditMemeHelper');
module.exports = {
  name: 'tech',
  aliases: ['techmeme', 'programmer', 'code'],
  description: 'Fetch a completely random programming/tech meme from r/programmerhumor!',
  adminOnly: false,
  async execute(msg, args, client) {
    const chat = await msg.getChat();
    await sendRedditMeme(chat, msg, 'programmerhumor', 'Tech', 'MEME_TECH');
  }
};