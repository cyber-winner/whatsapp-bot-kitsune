const { OWNER_NAME } = require('../../config');
const PlayerWallet = require('../../models/PlayerWallet');
const { getUserId } = require('../../utils/getUserId');

module.exports = {
  name: 'awardtitle',
  aliases: ['settitle'],
  description: 'Admin command to award a custom Master Title to a player',
  adminOnly: true,
  async execute(msg, args, client) {
    const mentions = await msg.getMentions();
    if (mentions.length === 0) {
      return msg.reply('❌ _Please mention a user to award the title to._\n*Usage:* `!awardtitle @user <Title Here>`');
    }

    // Extract title text from args, removing the mention
    // Mentions are usually the first argument if typed like !awardtitle @user Title
    const targetContact = mentions[0];
    const targetId = getUserId(targetContact);

    // Args might be: ['@1234567890', 'The', 'First', '1000']
    // We just want everything after the first arg that starts with @ or matches the mention
    let titleParts = [];
    let foundMention = false;
    for (const arg of args) {
      if (!foundMention && arg.startsWith('@')) {
        foundMention = true;
        continue;
      }
      titleParts.push(arg);
    }
    
    if (!foundMention && titleParts.length > 0) {
      // If mention wasn't parsed as arg starting with @, just remove first element
      titleParts.shift();
    }

    const customTitle = titleParts.join(' ').trim();
    if (!customTitle) {
      return msg.reply('❌ _Please provide the title text._\n*Usage:* `!awardtitle @user The First 1000`');
    }

    try {
      let wallet = await PlayerWallet.findOne({ userId: targetId });
      if (!wallet) {
        wallet = await PlayerWallet.create({ userId: targetId });
      }

      wallet.customTitle = customTitle;
      await wallet.save();

      const { getDisplayName } = require('../../utils/contactHelper');
      const targetName = getDisplayName(targetContact);

      const epicPhrases = [
        `\n    👑 *A NEW LEGEND IS FORGED!* 👑\n\n_Hear ye, mortals and trainers alike!_\n_By the absolute decree of ${OWNER_NAME}, a new monarch rises today._\n\n*Target:* @${targetContact.id.user} (${targetName})\n*Bestowed Title:* ⚜️ *[ ${customTitle} ]* ⚜️\n\n_Their name shall be etched into the very code of this universe. From this day forward, they walk with the privileges of a Master. Bow your heads as they pass, for they have achieved what others only dream of!_\n\n> _The heavens tremble at this new coronation!_ ✨ 𓆩♡𓆪`,
        `\n    🌟 *THE HEAVENS PART FOR A MASTER!* 🌟\n\n_Silence in the realm! Father has spoken._\n_A title of unfathomable prestige has been granted to a chosen soul._\n\n*Target:* @${targetContact.id.user} (${targetName})\n*Bestowed Title:* ⚜️ *[ ${customTitle} ]* ⚜️\n\n_The winds whisper their name, and the Pokémon bow in reverence. They are no longer a mere trainer—they are a Master of this domain. Their legacy is now absolute and their rule begins now!_\n\n> _A monumental day in history!_ ⚡ ૮꒰ ˶• ༝ •˶꒱ა ♡`,
        `\n    ⚡ *A MYTHICAL CORONATION!* ⚡\n\n_The stars align as ${OWNER_NAME} bestows the ultimate honor._\n_Behold the rise of a true titan!_\n\n*Target:* @${targetContact.id.user} (${targetName})\n*Bestowed Title:* ⚜️ *[ ${customTitle} ]* ⚜️\n\n_With this title comes boundless power: tax exemptions, mart discounts, and the eternal respect of the community. They have broken through the ceiling of greatness. Rejoice and witness their glory!_\n\n> _The era of the Master has arrived!_ 🎀 ⋆.˚`
      ];
      
      const selectedMessage = epicPhrases[Math.floor(Math.random() * epicPhrases.length)];

      return msg.reply(selectedMessage, {
        mentions: [targetContact]
      });
    } catch (err) {
      console.error('[Award Title Error]', err);
      return msg.reply('❌ _Failed to award title due to database error._');
    }
  }
};
