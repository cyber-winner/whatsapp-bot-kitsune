const {
  sendRedditMeme
} = require('../../utils/redditMemeHelper');
module.exports = {
  name: 'meirl',
  aliases: ['me_irl', 'relatable'],
  description: 'Fetch a completely random me-irl meme from r/me_irl!',
  adminOnly: false,
  async execute(msg, args, client) {
    const chat = await msg.getChat();
    await sendRedditMeme(chat, msg, 'me_irl', 'Me_irl', 'MEME_MEIRL');
  }
};