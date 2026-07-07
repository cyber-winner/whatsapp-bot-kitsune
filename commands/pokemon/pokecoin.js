const economyStore = require('../../store/economyStore');
const {
  getDisplayName
} = require('../../utils/contactHelper');
const {
  parseAmount
} = require('../../utils/amountParser');
const { getUserId } = require('../../utils/getUserId');
module.exports = {
  name: 'pokecoin',
  aliases: ['pokecoins', 'pc'],
  description: 'PokéCoin commands. Usage: -pokecoin share @user <amount>',
  adminOnly: false,
  async execute(msg, args, client) {
    const chat = await msg.getChat();
    if (!chat.isGroup) return msg.reply('❌ _This command only works in groups._');
    const subcommand = (args[0] || '').toLowerCase();
    if (subcommand === 'share' || subcommand === 'send' || subcommand === 'transfer') {
      return handleShare(msg, args.slice(1), chat, client);
    } else {
      return chat.sendMessage(`💰 *POKÉCOIN COMMANDS* 💰\n\n` + `  ▸ \`-pokecoin share @user <amount>\`\n` + `    _Share PokéCoins with another trainer_\n\n` + `  ▸ \`-balance\`\n` + `    _Check your PokéCoin balance_\n\n` + `━━━━━━━━━━━━━━━━━━━━━━\n` + `_~Kitsune Economy System~_ ✨`);
    }
  }
};
async function handleShare(msg, args, chat, client) {
  const sender = await msg.getContact();
  const senderId = getUserId(sender);
  const senderName = getDisplayName(sender);
  const mentions = await msg.getMentions();
  const amountStr = args.find(a => !a.startsWith('@'));
  const amount = parseAmount(amountStr);
  if (mentions.length === 0 || isNaN(amount) || amount <= 0) {
    return msg.reply(`❌ *Incomplete Command!* ❌\n` + `━━━━━━━━━━━━━━━━━━━━━━\n` + `📝 *Usage:* \`-pokecoin share @user <amount>\`\n` + `📖 *Description:* Share/transfer PokéCoins from your wallet balance to another trainer in the group.\n\n` + `💡 *Example:* \`-pokecoin share @trainer 500\``);
  }
  const target = mentions[0];
  const targetId = getUserId(target);
  const targetName = getDisplayName(target);
  if (senderId === targetId) {
    return chat.sendMessage(`❌ _You can't share PokéCoins with yourself, ${senderName}!_ 😅`);
  }
  const result = await economyStore.transferCoins(senderId, targetId, amount);
  if (result.success) {
    await chat.sendMessage(`\n` + `    💸 *POKÉCOINS TRANSFERRED!* 💸 ૮꒰ ˶• ༝ •˶꒱ა ♡\n` + `\n\n` + `👤 *From:* ${senderName} 🎀\n` + `👤 *To:* ${targetName} ᡣ𐭩\n` + `💰 *Amount:* ${amount.toLocaleString()} PokéCoins ⋆｡‧˚ʚ🍓ɞ˚‧｡⋆\n\n` + `━━━━━━━━━━━━━━━━━━━━━━━━━\n` + `💼 *${senderName}'s Balance:* ${result.fromBalance.toLocaleString()} ੈ✩‧₊˚\n` + `💼 *${targetName}'s Balance:* ${result.toBalance.toLocaleString()} 🫧\n` + `━━━━━━━━━━━━━━━━━━━━━━━━━\n\n` + `_~Sharing is caring, trainer!~_ ✨ 𓆩♡𓆪`);
  } else if (result.reason === 'insufficient') {
    await chat.sendMessage(`❌ *Not enough PokéCoins, ${senderName}!*\n\n` + `💰 *You have:* ${result.balance.toLocaleString()} PokéCoins\n` + `💸 *Trying to send:* ${amount.toLocaleString()} PokéCoins\n\n` + `_Catch more Pokémon to earn PokéCoins!_ 💫`);
  } else {
    await chat.sendMessage(`❌ _Invalid transfer amount._`);
  }
}