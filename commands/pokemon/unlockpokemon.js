const { OWNER_NAME } = require('../../config');
const {
  isBotOwner
} = require('../../utils/permissions');
const PlayerWallet = require('../../models/PlayerWallet');
const { getUserId } = require('../../utils/getUserId');
module.exports = {
  name: 'unlockpokemon',
  aliases: ['pokeunlock'],
  description: 'Unlock a user from using pokemon commands. Usage: -unlockpokemon @user',
  category: 'pokemon',
  adminOnly: false,
  async execute(msg, args, client) {
    if (!(await isBotOwner(msg, client))) {
      return msg.reply('❌ _Only ' + OWNER_NAME + ' (Bot Owner) can use this command._');
    }
    const chat = await msg.getChat();
    const mentions = await msg.getMentions();
    if (mentions.length === 0) {
      return msg.reply('❌ *You must mention a user to unlock them!*');
    }
    const target = mentions[0];
    const targetId = getUserId(target);
    let wallet = await PlayerWallet.findOne({
      userId: targetId
    });
    if (!wallet) {
      wallet = await PlayerWallet.create({
        userId: targetId,
        pokecoins: 0,
        pokeballs: 20,
        inventory: []
      });
    }
    if (!wallet.pokemonLocked) {
      return msg.reply(`⚠️ _User is not locked!_`);
    }
    wallet.pokemonLocked = false;
    wallet.pokemonLockReason = '';
    await wallet.save();
    return chat.sendMessage(`✅ *POKÉMON COMMANDS UNLOCKED!* ✅ ૮꒰ ˶• ༝ •˶꒱ა ♡\n` + `━━━━━━━━━━━━━━━━━━━━━━\n` + `_Father has shown mercy._ 🎀\n\n` + `👤 *User:* @${targetId} ᡣ𐭩\n\n` + `_They are now free to use Pokémon commands and catch wild Pokémon again._ 🌿 🫧`, {
      mentions: [target.id._serialized]
    });
  }
};