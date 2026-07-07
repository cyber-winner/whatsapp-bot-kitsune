const {
  sendRedditMeme
} = require('../../utils/redditMemeHelper');
module.exports = {
  name: 'catmeme',
  aliases: ['cat', 'meow'],
  description: 'Fetch a completely random cat meme from r/catmemes!',
  adminOnly: false,
  async execute(msg, args, client) {
    const chat = await msg.getChat();
    await sendRedditMeme(chat, msg, 'catmemes', 'Cat', 'MEME_CATMEME');
  }
};