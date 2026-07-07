const economyStore = require('../../store/economyStore');
const {
  getDisplayName
} = require('../../utils/contactHelper');
const {
  parseAmount
} = require('../../utils/amountParser');
const { getUserId } = require('../../utils/getUserId');
module.exports = {
  name: 'pokemart',
  aliases: ['mart', 'shop', 'pokeshop'],
  description: 'Browse and buy items from the PokéMart. Usage: -pokemart | -pokemart buy <item>',
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
  const catalog = economyStore.getMarketCatalog();
  const balance = await economyStore.getBalance(senderId);
  const categories = {};
  for (const [key, item] of Object.entries(catalog)) {
    const cat = item.category || 'General';
    if (!categories[cat]) categories[cat] = [];
    categories[cat].push({
      key,
      ...item
    });
  }
  let text = `🏪  ▂ ▃ ▅ ▆ ▇ *KITSUNE POKÉMART* ▇ ▆ ▅ ▃ ▂  🏪\n` + `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` + `  👤 *Trainer:* ${senderName}\n` + `  🪙 *Wallet:* ${balance.pokecoins.toLocaleString()} PokéCoins\n` + `  🔴 *Pokéballs:* ${balance.pokeballs} Balls\n` + `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` + `  🏛️ _All purchases are subject to *18% Kitsune Tax*._\n\n`;
  for (const [categoryName, items] of Object.entries(categories)) {
    text += `🛍️ *DEPARTMENT: ${categoryName.toUpperCase()}*\n`;
    text += `─────────────────────────\n`;
    for (const item of items) {
      const currencyLabel = item.key === 'wishing compass' ? 'Radiant Crystals 💎' : 'PokéCoins';
      text += `${item.emoji} *${item.displayName}* (×${item.quantity})\n` + `   ↳ 🪙 *Price:* ${item.price.toLocaleString()} ${currencyLabel}\n` + `   ↳ ℹ️ _${item.description}_\n\n`;
    }
  }
  text += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` + `🛍️ *QUICK ORDER MANUAL:*\n` + `━━━━━━━━━━━━━━━━━━━━━━━━━\n` + `👉 Type \`-pokemart buy <item_name>\` to make a purchase!\n` + `   • _Example:_ \`-pokemart buy pokeball\`\n` + `   • _Example:_ \`-pokemart buy summoning candle\`\n\n` + `ℹ️ Type \`-pokeuse <item_name>\` to use items from your bag.\n` + `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` + `✨ *Thank you for shopping at Kitsune PokéMart!* ✨`;
  await chat.sendMessage(text);
}
async function handleBuy(msg, args, chat, senderId, senderName) {
  if (args.length === 0) {
    return msg.reply(`❌ *Incomplete Command!* ❌ (╥﹏╥)\n` + `━━━━━━━━━━━━━━━━━━━━━━\n` + `📝 *Usage:* \`-pokemart buy <item name> [--quantity]\` 🎀\n` + `📖 *Description:* Buy items such as Pokéballs, Wishing Compasses, or other tools from the Kitsune PokéMart. ⋆.˚\n\n` + `💡 *Examples:* ੈ✩‧₊˚\n` + `  ▸ \`-pokemart buy pokeball --5\`\n` + `  ▸ \`-pokemart buy wishing compass 10\` 🫧`);
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
    return msg.reply(`❌ *Incomplete Command!* ❌ (╥﹏╥)\n` + `━━━━━━━━━━━━━━━━━━━━━━\n` + `📝 *Usage:* \`-pokemart buy <item name> [--quantity]\` 🎀\n` + `📖 *Description:* Buy items such as Pokéballs, Wishing Compasses, or other tools from the Kitsune PokéMart. ⋆.˚\n\n` + `💡 *Examples:* ੈ✩‧₊˚\n` + `  ▸ \`-pokemart buy pokeball --5\`\n` + `  ▸ \`-pokemart buy wishing compass 10\` 🫧`);
  }
  const itemDetails = economyStore.getItemDetails(itemName);
  if (!itemDetails) {
    return chat.sendMessage(`❌ *Item not found:* "${itemName}" (╥﹏╥)\n\n` + `_Use_ \`-pokemart\` _to see available items._ 🫧`);
  }
  const matchedKey = itemDetails.id;
  const result = await economyStore.buyItem(senderId, matchedKey, quantity);
  if (result.success) {
    const item = economyStore.MARKET_ITEMS[matchedKey];
    const currencyName = result.currency || 'PokéCoins';
    const currencyEmoji = result.currency === 'Radiant Crystals' ? '💎' : '💰';
    const taxLine = result.taxAmount > 0 ? `🏛️ *Tax (18%):* +${result.taxAmount.toLocaleString()} ${currencyName}\n` : '';
    await chat.sendMessage(`🛒 *PURCHASE SUCCESSFUL!* 🛒\n\n` + `👤 *Trainer:* ${senderName}\n` + `${item.emoji} *Item:* ${result.item}\n` + `📦 *Quantity Purchased:* ×${result.quantity}\n` + `💲 *Base Price:* ${result.basePrice.toLocaleString()} ${currencyName}\n` + taxLine + `💲 *Total Paid:* ${result.spent.toLocaleString()} ${currencyName}\n` + `${currencyEmoji} *Wallet Balance:* ${result.newBalance.toLocaleString()} ${currencyName}\n\n` + `━━━━━━━━━━━━━━━━━━━━━━━━━\n` + `_~Thank you for shopping at PokéMart!~_ ✨`);
  } else if (result.reason === 'insufficient_crystals') {
    await chat.sendMessage(`❌ *Not enough Radiant Crystals, ${senderName}!* 💎 (╥﹏╥)\n\n` + `💎 *Price:* ${result.needed.toLocaleString()} Radiant Crystals 𖦹\n` + `💎 *You have:* ${result.have.toLocaleString()} Radiant Crystals 🫧\n` + `📉 *Short by:* ${(result.needed - result.have).toLocaleString()} Radiant Crystals ૮₍ ˃ ⤙ ˂ ₎ა\n\n` + `_Earn Radiant Crystals by:_ ⋆.˚\n` + `  • Catching Legendary Pokémon (+80 💎)\n` + `  • Catching Mythical Pokémon (+160 💎)\n` + `  • Winning Raids (+480 💎 per player) 🎧ྀི`);
  } else if (result.reason === 'insufficient_coins') {
    await chat.sendMessage(`❌ *Not enough PokéCoins, ${senderName}!* (╥﹏╥)\n\n` + `💲 *Price:* ${result.needed.toLocaleString()} PokéCoins 𖦹\n` + `💰 *You have:* ${result.have.toLocaleString()} PokéCoins 🫧\n` + `📉 *Short by:* ${(result.needed - result.have).toLocaleString()} PokéCoins ૮₍ ˃ ⤙ ˂ ₎ა\n\n` + `_Catch more Pokémon to earn PokéCoins!_ 💫`);
  } else {
    await chat.sendMessage(`❌ *Item not found.* Use \`-pokemart\` to see available items. 🫧`);
  }
}