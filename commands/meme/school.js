const {
  sendRedditMeme
} = require('../../utils/redditMemeHelper');
module.exports = {
  name: 'school',
  aliases: ['schoolmeme', 'student', 'college'],
  description: 'Fetch a completely random school/student meme from r/schoolmemes!',
  adminOnly: false,
  async execute(msg, args, client) {
    const chat = await msg.getChat();
    await sendRedditMeme(chat, msg, 'schoolmemes', 'School', 'MEME_SCHOOL');
  }
};