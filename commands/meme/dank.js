const {
  sendRedditMeme
} = require('../../utils/redditMemeHelper');
module.exports = {
  name: 'dank',
  aliases: ['dankmeme', 'dankness'],
  description: 'Fetch a completely random dank meme from r/dankmemes!',
  adminOnly: false,
  async execute(msg, args, client) {
    const chat = await msg.getChat();
    await sendRedditMeme(chat, msg, 'dankmemes', 'Dank', 'MEME_DANK');
  }
};