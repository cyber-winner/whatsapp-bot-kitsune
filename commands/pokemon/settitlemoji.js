const PlayerWallet = require('../../models/PlayerWallet');
const { getUserId } = require('../../utils/getUserId');

module.exports = {
  name: 'settitlemoji',
  aliases: ['titleemoji'],
  description: 'Set a custom emoji for your Master Title',
  adminOnly: false,
  async execute(msg, args, client) {
    const contact = await msg.getContact();
    const userId = getUserId(contact);

    if (args.length === 0) {
      return msg.reply('❌ _Please provide an emoji._\n*Usage:* `!settitlemoji 🏆`');
    }

    const emoji = args[0];

    try {
      let wallet = await PlayerWallet.findOne({ userId });
      if (!wallet || !wallet.customTitle) {
        return msg.reply('❌ _You do not have a Master Title to customize._');
      }

      wallet.titleEmoji = emoji;
      await wallet.save();

      const epicEmojiPhrases = [
        `\n    ✨ *ROYAL EMBLEM UPDATED!* ✨\n\n_The grand artisans of the Pokémon world have forged a new crest for your Master Title!_\n\n*Your new emblem is:* ${emoji}\n\n_Whenever your name is spoken, whenever your profile is viewed, and whenever you make your grand entrance, this sacred symbol will precede you. Wear it with pride, Master, for it reflects your true legendary spirit!_ 🌟`,
        `\n    🛡️ *A NEW CREST FOR THE MASTER!* 🛡️\n\n_Your decree has been heard! The archives have been altered and your official seal has been transmuted._\n\n*Your new emblem is:* ${emoji}\n\n_Let the entire server recognize this mark of absolute dominance. Let it shine brightly across the leaderboards and strike awe into the hearts of beginners!_ 👑`,
        `\n    🎨 *THE MASTER'S SEAL IS SET!* 🎨\n\n_You have chosen a new sigil to represent your overwhelming prestige._\n\n*Your new emblem is:* ${emoji}\n\n_It has been permanently woven into the fabric of your identity. A tiny icon, yet carrying the weight of a thousand victories. Your legacy continues to evolve beautifully!_ 🎀`
      ];

      const selectedEmojiMessage = epicEmojiPhrases[Math.floor(Math.random() * epicEmojiPhrases.length)];

      return msg.reply(selectedEmojiMessage);
    } catch (err) {
      console.error('[Set Title Emoji Error]', err);
      return msg.reply('❌ _Failed to update emoji due to database error._');
    }
  }
};
