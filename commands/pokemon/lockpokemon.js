const { OWNER_NAME } = require('../../config');
const {
  isBotOwner
} = require('../../utils/permissions');
const PlayerWallet = require('../../models/PlayerWallet');
const { getUserId } = require('../../utils/getUserId');
module.exports = {
  name: 'lockpokemon',
  aliases: ['pokelock'],
  description: 'Lock a user from using pokemon commands. Usage: -lockpokemon @user [reason]',
  category: 'pokemon',
  adminOnly: false,
  async execute(msg, args, client) {
    if (!(await isBotOwner(msg, client))) {
      return msg.reply('❌ _Only ' + OWNER_NAME + ' (Bot Owner) can use this command._');
    }
    const chat = await msg.getChat();
    const mentions = await msg.getMentions();
    if (mentions.length === 0) {
      return msg.reply('❌ *You must mention a user to lock them!*');
    }
    const target = mentions[0];
    const targetId = getUserId(target);
    const cleanArgs = args.filter(a => !a.startsWith('@'));
    const reason = cleanArgs.length > 0 ? cleanArgs.join(' ') : 'No reason provided';
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
    if (wallet.pokemonLocked) {
      return msg.reply(`⚠️ _User is already locked!_\n_Current Reason: ${wallet.pokemonLockReason}_`);
    }
    wallet.pokemonLocked = true;
    wallet.pokemonLockReason = reason;
    await wallet.save();
    return chat.sendMessage(`🔒 *POKÉMON COMMANDS LOCKED!* 🔒 (╥﹏╥)\n` + `━━━━━━━━━━━━━━━━━━━━━━\n` + `_The user has been barred from the Pokémon world by Father._ 𖦹\n\n` + `👤 *User:* @${targetId} 🎀\n` + `📝 *Reason:* ${reason} ૮₍ ˃ ⤙ ˂ ₎ა\n\n` + `_They will not be able to use any Pokémon commands or catch wild Pokémon until unlocked._ 🚫 🫧`, {
      mentions: [target.id._serialized]
    });
  }
};