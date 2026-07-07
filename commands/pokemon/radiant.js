const economyStore = require('../../store/economyStore');
const {
  getDisplayName
} = require('../../utils/contactHelper');
const {
  parseAmount
} = require('../../utils/amountParser');
const { getUserId } = require('../../utils/getUserId');
module.exports = {
  name: 'radiant',
  aliases: ['radiantcrystals', 'crystal', 'crystals', 'rc'],
  description: 'Radiant Crystal commands. Usage: -radiant share @user <amount>',
  adminOnly: false,
  async execute(msg, args, client) {
    const chat = await msg.getChat();
    if (!chat.isGroup) return msg.reply('❌ _This command only works in groups._');
    const subcommand = (args[0] || '').toLowerCase();
    if (subcommand === 'share' || subcommand === 'send' || subcommand === 'transfer') {
      return handleShare(msg, args.slice(1), chat, client);
    } else {
      return chat.sendMessage(`💎 *RADIANT CRYSTAL COMMANDS* 💎\n\n` + `  ▸ \`-radiant share @user <amount>\`\n` + `    _Share Radiant Crystals with another trainer_\n\n` + `  ▸ \`-balance\`\n` + `    _Check your Radiant Crystal balance_\n\n` + `━━━━━━━━━━━━━━━━━━━━━━\n` + `_~Kitsune Economy System~_ ✨`);
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
    return msg.reply(`❌ *Incomplete Command!* ❌\n` + `━━━━━━━━━━━━━━━━━━━━━━\n` + `📝 *Usage:* \`-radiant share @user <amount>\`\n` + `📖 *Description:* Share/transfer Radiant Crystals from your wallet balance to another trainer in the group.\n\n` + `💡 *Example:* \`-radiant share @trainer 50\``);
  }
  const target = mentions[0];
  const targetId = getUserId(target);
  const targetName = getDisplayName(target);
  if (senderId === targetId) {
    return chat.sendMessage(`❌ _You can't share Radiant Crystals with yourself, ${senderName}!_ 😅`);
  }
  const result = await economyStore.transferRadiantCrystals(senderId, targetId, amount);
  if (result.success) {
    await chat.sendMessage(`\n` + `    💎 *CRYSTALS TRANSFERRED!* 💎 ૮꒰ ˶• ༝ •˶꒱ა ♡\n` + `\n\n` + `👤 *From:* ${senderName} 🎀\n` + `👤 *To:* ${targetName} ᡣ𐭩\n` + `💎 *Amount:* ${amount.toLocaleString()} Radiant Crystals ੈ✩‧₊˚\n\n` + `━━━━━━━━━━━━━━━━━━━━━━━━━\n` + `💼 *${senderName}'s Balance:* ${result.fromBalance.toLocaleString()} 💎 🫧\n` + `💼 *${targetName}'s Balance:* ${result.toBalance.toLocaleString()} 💎 🎧ྀི\n` + `━━━━━━━━━━━━━━━━━━━━━━━━━\n\n` + `_~Sharing is caring, trainer!~_ ✨ 𓆩♡𓆪`);
  } else if (result.reason === 'insufficient') {
    await chat.sendMessage(`❌ *Not enough Radiant Crystals, ${senderName}!*\n\n` + `💎 *You have:* ${result.balance.toLocaleString()} Radiant Crystals\n` + `💸 *Trying to send:* ${amount.toLocaleString()} Radiant Crystals\n\n` + `_Catch Mythical/Legendary Pokémon or win events to get Radiant Crystals!_ 💫`);
  } else {
    await chat.sendMessage(`❌ _Invalid transfer amount._`);
  }
}