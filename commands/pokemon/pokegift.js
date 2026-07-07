const {
  giftPokemon
} = require('../../store/pokemonStore');
const {
  getDisplayName
} = require('../../utils/contactHelper');
const { getUserId } = require('../../utils/getUserId');
module.exports = {
  name: 'pokegift',
  aliases: ['pgift', 'pokemongift'],
  description: 'Gift a Pokémon to another trainer. Usage: -pokegift @user <pokemon name>',
  adminOnly: false,
  async execute(msg, args, client) {
    const chat = await msg.getChat();
    if (!chat.isGroup) return msg.reply('❌ _This command only works in groups._');
    const mentions = await msg.getMentions();
    const pokemonName = args.filter(a => !a.startsWith('@')).join(' ').trim();
    if (mentions.length === 0 || !pokemonName) {
      return msg.reply(`❌ *Incomplete Command!* ❌\n` + `━━━━━━━━━━━━━━━━━━━━━━\n` + `📝 *Usage:* \`-pokegift @user <pokemon name>\`\n` + `📖 *Description:* Gift one of your caught Pokémon to another trainer in the group.\n\n` + `💡 *Example:* \`-pokegift @trainer Pikachu\``);
    }
    const target = mentions[0];
    const targetId = getUserId(target);
    const targetName = getDisplayName(target);
    const sender = await msg.getContact();
    const senderId = getUserId(sender);
    const senderName = getDisplayName(sender);
    if (senderId === targetId) {
      return chat.sendMessage(`❌ _You can't gift a Pokémon to yourself, ${senderName}!_ 😅`);
    }
    const result = await giftPokemon(senderId, targetId, pokemonName);
    if (result.success) {
      const inheritedPrestige = result.pokemon.inheritedPrestige || 0;
      const prestigeNote = inheritedPrestige > 0 ? `\n⭐ *Inherited Prestige:* ×${inheritedPrestige * 5} Stats Boost` : '';
      await chat.sendMessage(`\n` + `    🎁 *POKÉMON GIFTED!* 🎁 ૮꒰ ˶• ༝ •˶꒱ა ♡\n` + `\n\n` + `👤 *From:* ${senderName} 🎀\n` + `👤 *To:* ${targetName} ᡣ𐭩\n` + `🏷️ *Pokémon:* ${result.pokemon.name} 🫧\n` + `📊 *Level:* ${result.pokemon.level}${prestigeNote} ੈ✩‧₊˚\n\n` + `━━━━━━━━━━━━━━━━━━━━━━\n` + `_${targetName} received a ${result.pokemon.name}!_ ✨\n` + `_~Sharing is caring, trainer~_ 💫 𓆩♡𓆪`);
    } else {
      await chat.sendMessage(`❌ *${senderName}*, you don't have a *${pokemonName}* to gift!\n\n` + `_Check your Pokédex with_ \`-pokemon list\``);
    }
  }
};