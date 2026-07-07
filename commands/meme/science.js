const {
  sendRedditMeme
} = require('../../utils/redditMemeHelper');
module.exports = {
  name: 'science',
  aliases: ['sciencememe', 'nerd'],
  description: 'Fetch a completely random science meme from r/sciencememes!',
  adminOnly: false,
  async execute(msg, args, client) {
    const chat = await msg.getChat();
    await sendRedditMeme(chat, msg, 'sciencememes', 'Science', 'MEME_SCIENCE');
  }
};