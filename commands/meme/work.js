const {
  sendRedditMeme
} = require('../../utils/redditMemeHelper');
module.exports = {
  name: 'work',
  aliases: ['workmeme', 'office'],
  description: 'Fetch a completely random workplace/office meme from r/officememes!',
  adminOnly: false,
  async execute(msg, args, client) {
    const chat = await msg.getChat();
    await sendRedditMeme(chat, msg, 'officememes', 'Work', 'MEME_WORK');
  }
};