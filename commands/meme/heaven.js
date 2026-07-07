const {
  sendRedditMeme
} = require('../../utils/redditMemeHelper');
module.exports = {
  name: 'heaven',
  aliases: ['shitpost', 'comedyheaven'],
  description: 'Fetch a completely random high-tier shitpost from r/comedyheaven!',
  adminOnly: false,
  async execute(msg, args, client) {
    const chat = await msg.getChat();
    await sendRedditMeme(chat, msg, 'comedyheaven', 'ComedyHeaven', 'MEME_HEAVEN');
  }
};