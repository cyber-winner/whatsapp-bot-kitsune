const economyStore = require('../../store/economyStore');
const {
  getDisplayName
} = require('../../utils/contactHelper');
const {
  parseAmount
} = require('../../utils/amountParser');
const { getUserId } = require('../../utils/getUserId');
module.exports = {
  name: 'omegamart',
  aliases: ['omegashop', 'oshop', 'omegastore'],
  description: 'Browse and buy items from the Omega Shop. Usage: -omegamart | -omegamart buy <item>',
  adminOnly: false,
  async execute(msg, args, client) {
    const chat = await msg.getChat();
    if (!chat.isGroup) return msg.reply('❌ _This command only works in groups._');
    const sender = await msg.getContact();
    const senderId = getUserId(sender);
    const senderName = getDisplayName(sender);
    const subcommand = (args[0] || '').toLowerCase();
    if (subcommand === 'buy') {
      return handleBuy(msg, args.slice(1), chat, senderId, senderName);
    } else {
      return handleList(msg, chat, senderId, senderName);
    }
  }
};
async function handleList(msg, chat, senderId, senderName) {
  const catalog = economyStore.getOmegaMarketCatalog();
  const balance = await economyStore.getBalance(senderId);
  const wallet = await economyStore.getWallet(senderId);
  const prestigeLevel = wallet.prestigeLevel || 0;
  const categories = {};
  for (const [key, item] of Object.entries(catalog)) {
    const cat = item.category || 'General';
    if (!categories[cat]) categories[cat] = [];
    categories[cat].push({
      key,
      ...item
    });
  }
  let text = `\n` + `    🔮 *KITSUNE OMEGA SHOP* 🔮 ૮꒰ ˶• ༝ •˶꒱ა ♡\n` + `\n\n` + `  👤 *Trainer:* ${senderName} 🎀\n` + `  🪙 *Wallet:* ${balance.pokecoins.toLocaleString()} PokéCoins ⋆｡‧˚ʚ🍓ɞ˚‧｡⋆\n` + `  🌟 *Prestige:* Level ${prestigeLevel} ੈ✩‧₊˚\n` + `━━━━━━━━━━━━━━━━━━━━━━━━━\n` + `  🏛️ _All purchases are subject to *18% Kitsune Tax*._ 𖦹\n\n` + `⚠️ _All items require *Prestige 1* or above to purchase._ 🫧\n\n`;
  for (const [categoryName, items] of Object.entries(categories)) {
    text += `🛍️ *DEPARTMENT: ${categoryName.toUpperCase()}*\n`;
    text += `─────────────────────────\n`;
    for (const item of items) {
      const locked = prestigeLevel < (item.requiresPrestige || 0);
      const lockIcon = locked ? '🔒' : '🔓';
      const dailyTag = item.dailyLimit > 0 ? ' _(1/day)_' : '';
      text += `${item.emoji} *${item.displayName}* ${lockIcon}${dailyTag}\n` + `   ↳ 🪙 *Price:* ${item.price.toLocaleString()} PokéCoins\n` + `   ↳ ℹ️ _${item.description}_\n\n`;
    }
  }
  text += `━━━━━━━━━━━━━━━━━━━━━━━━━\n` + `🛍️ *QUICK ORDER MANUAL:* 🎧ྀི\n` + `━━━━━━━━━━━━━━━━━━━━━━━━━\n` + `👉 Type \`-omegamart buy <item_name>\` to make a purchase! ୨୧\n` + `   • _Example:_ \`-omegamart buy enchanted stardust\`\n` + `   • _Example:_ \`-omegamart buy literally karen\`\n\n` + `ℹ️ Type \`-pokeuse <item_name>\` to use items from your bag. ᡣ𐭩\n` + `━━━━━━━━━━━━━━━━━━━━━━━━━\n` + `✨ *Thank you for shopping at Kitsune Omega Shop!* ✨ 𓆩♡𓆪`;
  await chat.sendMessage(text);
}
async function handleBuy(msg, args, chat, senderId, senderName) {
  if (args.length === 0) {
    return msg.reply(`❌ *Incomplete Command!* ❌\n` + `━━━━━━━━━━━━━━━━━━━━━━\n` + `📝 *Usage:* \`-omegamart buy <item name> [--quantity]\`\n` + `📖 *Description:* Buy items from the Omega Shop. Requires Prestige 1+.\n\n` + `💡 *Examples:*\n` + `  ▸ \`-omegamart buy enchanted stardust\`\n` + `  ▸ \`-omegamart buy literally karen --2\``);
  }
  let quantity = 1;
  if (args.length > 1) {
    const lastArg = args[args.length - 1];
    if (lastArg.startsWith('--')) {
      const parsed = parseAmount(lastArg.slice(2));
      if (!isNaN(parsed) && parsed > 0) {
        quantity = parsed;
        args.pop();
      }
    } else {
      const parsed = parseAmount(lastArg);
      if (!isNaN(parsed) && parsed > 0) {
        quantity = parsed;
        args.pop();
      }
    }
  }
  const itemName = args.join(' ').trim().toLowerCase();
  if (!itemName) {
    return msg.reply(`❌ *Incomplete Command!* ❌\n` + `━━━━━━━━━━━━━━━━━━━━━━\n` + `📝 *Usage:* \`-omegamart buy <item name> [--quantity]\`\n\n` + `💡 *Examples:*\n` + `  ▸ \`-omegamart buy enchanted stardust\`\n` + `  ▸ \`-omegamart buy dirty diaper\``);
  }
  const itemDetails = economyStore.getOmegaItemDetails(itemName);
  if (!itemDetails) {
    return chat.sendMessage(`❌ *Item not found:* "${itemName}"\n\n` + `_Use_ \`-omegamart\` _to see available Omega Shop items._`);
  }
  const matchedKey = itemDetails.id;
  const result = await economyStore.buyOmegaItem(senderId, matchedKey, quantity);
  if (result.success) {
    const item = economyStore.OMEGA_MARKET_ITEMS[matchedKey];
    const taxLine = result.taxAmount > 0 ? `🏛️ *Tax (18%):* +${result.taxAmount.toLocaleString()} PokéCoins\n` : '';
    await chat.sendMessage(`\n` + `    🛒 *OMEGA PURCHASE SUCCESSFUL!* 🛒 ૮ ˶ᵔ ᵕ ᵔ˶ ა\n` + `\n\n` + `👤 *Trainer:* ${senderName} 🎀\n` + `${item.emoji} *Item:* ${result.item} 𓍢ִ໋🌷͙֒\n` + `📦 *Quantity Purchased:* ×${result.quantity} ੈ✩‧₊˚\n` + `💲 *Base Price:* ${result.basePrice.toLocaleString()} PokéCoins 🫧\n` + taxLine + `💲 *Total Paid:* ${result.spent.toLocaleString()} PokéCoins ⋆｡‧˚ʚ🍓ɞ˚‧｡⋆\n` + `💰 *Wallet Balance:* ${result.newBalance.toLocaleString()} PokéCoins ୨୧\n\n` + `━━━━━━━━━━━━━━━━━━━━━━━━━\n` + `_~Thank you for shopping at Omega Shop!~_ 🔮 𓆩♡𓆪`);
  } else if (result.reason === 'insufficient_prestige') {
    await chat.sendMessage(`🔒 *Prestige Required, ${senderName}!* 🔒\n\n` + `🌟 *Required:* Prestige Level ${result.needed}\n` + `🌟 *You have:* Prestige Level ${result.have}\n\n` + `_Prestige your account first using_ \`-prestige\`!`);
  } else if (result.reason === 'insufficient_coins') {
    await chat.sendMessage(`❌ *Not enough PokéCoins, ${senderName}!*\n\n` + `💲 *Price:* ${result.needed.toLocaleString()} PokéCoins\n` + `💰 *You have:* ${result.have.toLocaleString()} PokéCoins\n` + `📉 *Short by:* ${(result.needed - result.have).toLocaleString()} PokéCoins\n\n` + `_Catch more Pokémon to earn PokéCoins!_ 💫`);
  } else if (result.reason === 'daily_limit') {
    await chat.sendMessage(`📅 *Daily Limit Reached, ${senderName}!* 📅\n\n` + `This item can only be bought *once per day*.\n` + `⏳ *Try again in:* ${result.hours}h ${result.minutes}m\n\n` + `_~Come back tomorrow, trainer!~_ 🌙`);
  } else {
    await chat.sendMessage(`❌ *Item not found.* Use \`-omegamart\` to see available items.`);
  }
}