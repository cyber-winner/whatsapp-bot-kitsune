const {
  sendRedditMeme
} = require('../../utils/redditMemeHelper');
module.exports = {
  name: 'gaming',
  aliases: ['gamingmeme', 'gamer'],
  description: 'Fetch a completely random gaming meme from r/gamingmemes!',
  adminOnly: false,
  async execute(msg, args, client) {
    const chat = await msg.getChat();
    await sendRedditMeme(chat, msg, 'gamingmemes', 'Gaming', 'MEME_GAMING');
  }
};