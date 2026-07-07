const {
  sendRedditMeme
} = require('../../utils/redditMemeHelper');
module.exports = {
  name: 'history',
  aliases: ['historymeme', 'historypost'],
  description: 'Fetch a completely random history meme from r/historymemes!',
  adminOnly: false,
  async execute(msg, args, client) {
    const chat = await msg.getChat();
    await sendRedditMeme(chat, msg, 'historymemes', 'History', 'MEME_HISTORY');
  }
};