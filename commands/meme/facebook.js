const {
  sendRedditMeme
} = require('../../utils/redditMemeHelper');
module.exports = {
  name: 'facebook',
  aliases: ['terriblefacebook', 'boomer'],
  description: 'Fetch a completely random terrible boomer/facebook meme from r/terriblefacebookmemes!',
  adminOnly: false,
  async execute(msg, args, client) {
    const chat = await msg.getChat();
    await sendRedditMeme(chat, msg, 'terriblefacebookmemes', 'Facebook', 'MEME_FACEBOOK');
  }
};