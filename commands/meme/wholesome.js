const {
  sendRedditMeme
} = require('../../utils/redditMemeHelper');
module.exports = {
  name: 'wholesome',
  aliases: ['wholesomememe', 'wholesomepost'],
  description: 'Fetch a completely random wholesome meme from r/wholesomememes!',
  adminOnly: false,
  async execute(msg, args, client) {
    const chat = await msg.getChat();
    await sendRedditMeme(chat, msg, 'wholesomememes', 'Wholesome', 'MEME_WHOLESOME');
  }
};