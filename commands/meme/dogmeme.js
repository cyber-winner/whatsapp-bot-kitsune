const {
  sendRedditMeme
} = require('../../utils/redditMemeHelper');
module.exports = {
  name: 'dogmeme',
  aliases: ['doge', 'doggo'],
  description: 'Fetch a completely random dog meme from r/dogmemes!',
  adminOnly: false,
  async execute(msg, args, client) {
    const chat = await msg.getChat();
    await sendRedditMeme(chat, msg, 'dogmemes', 'Dog', 'MEME_DOGMEME');
  }
};