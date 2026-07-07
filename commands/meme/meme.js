const {
  sendRedditMeme
} = require('../../utils/redditMemeHelper');
const SUBREDDITS = {
  dank: 'dankmemes',
  wholesome: 'wholesomememes',
  anime: 'animemes',
  tech: 'programmerhumor',
  history: 'historymemes',
  gaming: 'gamingmemes',
  meirl: 'me_irl',
  facebook: 'terriblefacebookmemes',
  heaven: 'comedyheaven',
  dog: 'dogmemes',
  cat: 'catmemes',
  science: 'sciencememes',
  school: 'schoolmemes',
  crypto: 'cryptocurrencymemes',
  work: 'officememes'
};
module.exports = {
  name: 'meme',
  aliases: ['m', 'randommeme'],
  description: 'Fetch a completely random, fresh meme! Usage: -meme [category]',
  adminOnly: false,
  async execute(msg, args, client) {
    const chat = await msg.getChat();
    let subreddit = '';
    let categoryName = 'Random';
    if (args.length > 0) {
      const requested = args[0].toLowerCase();
      if (SUBREDDITS[requested]) {
        subreddit = SUBREDDITS[requested];
        categoryName = requested.charAt(0).toUpperCase() + requested.slice(1);
      } else {
        return msg.reply(`❌ *Invalid meme category!* 🤷‍♂️\n\n` + `*Available categories:* \`dank\`, \`wholesome\`, \`anime\`, \`tech\`, \`history\`, \`gaming\`, \`meirl\`, \`facebook\`, \`heaven\`, \`dog\`, \`cat\`, \`science\`, \`school\`, \`crypto\`, \`work\`\n\n` + `_Or just type_ \`-meme\` _for a completely random one!_`);
      }
    }
    await sendRedditMeme(chat, msg, subreddit, categoryName, 'MEME_RANDOM');
  }
};