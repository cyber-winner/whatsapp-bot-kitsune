const economyStore = require('../../store/economyStore');
const {
  getDisplayName
} = require('../../utils/contactHelper');
const {
  parseAmount,
  formatAmount
} = require('../../utils/amountParser');
const { getUserId } = require('../../utils/getUserId');
module.exports = {
  name: 'exchange',
  aliases: ['ex', 'swap', 'convert'],
  description: 'Exchange currencies and items. Usage: -exchange crystal/pokecoins/item <amount>',
  category: 'pokemon',
  adminOnly: false,
  async execute(msg, args, client) {
    const chat = await msg.getChat();
    if (!chat.isGroup) return msg.reply('❌ _This command only works in groups._');
    const sender = await msg.getContact();
    const senderId = getUserId(sender);
    const senderName = getDisplayName(sender);
    if (args.length === 0) {
      return showExchangeGuide(chat, senderId, senderName);
    }
    
    const fullArgs = args.join(' ').toLowerCase();
    const specialCardsPrices = {
      'sabrina carpenter': 750000,
      'ai hoshino': 1500000,
      'ai hoshino ex': 2000000
    };
    if (specialCardsPrices[fullArgs]) {
      return handleCardExchange(msg, fullArgs, specialCardsPrices[fullArgs], chat, senderId, senderName);
    }

    const subcommand = args[0].toLowerCase();
    if (subcommand === 'crystal' || subcommand === 'crystals' || subcommand === 'rc') {
      return handleCrystalExchange(msg, args.slice(1), chat, senderId, senderName);
    }
    if (subcommand === 'pokecoins' || subcommand === 'pokecoin' || subcommand === 'coins' || subcommand === 'coin' || subcommand === 'pc') {
      return handleCoinExchange(msg, args.slice(1), chat, senderId, senderName);
    }
    if (subcommand === 'item' || subcommand === 'items') {
      return handleItemExchange(msg, args.slice(1), chat, senderId, senderName);
    }
    return showExchangeGuide(chat, senderId, senderName);
  }
};
async function showExchangeGuide(chat, senderId, senderName) {
  const balance = await economyStore.getBalance(senderId);
  const crystals = balance.radiantCrystals || 0;
  const coins = balance.pokecoins || 0;
  const text = `\n` + `    🔄 *KITSUNE EXCHANGE* 🔄 ૮꒰ ˶• ༝ •˶꒱ა ♡\n` + `\n\n` + `👤 *Trainer:* ${senderName} 🎀\n` + `💰 *PokéCoins:* ${coins.toLocaleString()} ⋆｡‧˚ʚ🍓ɞ˚‧｡⋆\n` + `💎 *Radiant Crystals:* ${crystals.toLocaleString()} ੈ✩‧₊˚\n\n` + `━━━━━━━━━━━━━━━━━━━━━━━━━\n` + `📊 *EXCHANGE RATES* 𓍢ִ໋🌷͙֒\n` + `━━━━━━━━━━━━━━━━━━━━━━━━━\n\n` + `💎 → 💰 *Crystals → PokéCoins* 🎧ྀི\n` + `   ↳ 1 Crystal = *25 PokéCoins*\n` + `   ↳ _Sell your crystals for quick cash!_\n\n` + `💰 → 💎 *PokéCoins → Crystals* ୨୧\n` + `   ↳ 30 PokéCoins = *1 Crystal*\n` + `   ↳ _Convert your wealth into rare crystals!_\n\n` + `📦 → 💰 *Items → PokéCoins* 📦\n` + `   ↳ *90% of market price* per item\n` + `   ↳ _Liquidate items you don't need!_\n\n` + `━━━━━━━━━━━━━━━━━━━━━━━━━\n` + `📝 *HOW TO EXCHANGE* ᡣ𐭩\n` + `━━━━━━━━━━━━━━━━━━━━━━━━━\n\n` + `💎 *Exchange Crystals:*\n` + `   \`-exchange crystal <amount>\`\n` + `   _Example:_ \`-exchange crystal 100\`\n` + `   _→ You receive 2,500 PokéCoins_\n\n` + `💰 *Exchange PokéCoins:*\n` + `   \`-exchange pokecoins <amount>\`\n` + `   _Example:_ \`-exchange pokecoins 3000\`\n` + `   _→ You receive 100 Radiant Crystals_\n\n` + `📦 *Exchange Items:*\n` + `   \`-exchange item <item_name> <amount>\`\n` + `   _Example:_ \`-exchange item level orb 5\`\n` + `   _→ You receive 90% of market price_\n\n` + `━━━━━━━━━━━━━━━━━━━━━━━━━\n` + `💡 *AMOUNT TIPS* 🫧\n` + `━━━━━━━━━━━━━━━━━━━━━━━━━\n\n` + `   ▸ Use *k*, *m*, *b* suffixes: \`10k\` = 10,000\n` + `   ▸ Use math operators: \`70*5\` = 350\n` + `   ▸ Use scientific notation: \`1e6\` = 1,000,000\n` + `   ▸ Combine them: \`2k+500\` = 2,500\n\n` + `━━━━━━━━━━━━━━━━━━━━━━━━━\n` + `> _All exchanges are processed through the Kitsune Treasury. Items and currencies you exchange are recycled back into the economy._ ⋆.˚\n\n` + `_~Kitsune Exchange System~_ ✨ 𓆩♡𓆪`;
  await chat.sendMessage(text);
}
async function handleCrystalExchange(msg, args, chat, senderId, senderName) {
  if (args.length === 0) {
    return msg.reply(`❌ *Specify an amount!*\n\n` + `📝 *Usage:* \`-exchange crystal <amount>\`\n` + `💡 *Example:* \`-exchange crystal 100\`\n` + `   ↳ _100 Crystals = ${(100 * economyStore.CRYSTAL_TO_COINS_RATE).toLocaleString()} PokéCoins_`);
  }
  const amountStr = args.join('');
  const amount = parseAmount(amountStr);
  if (isNaN(amount) || amount <= 0) {
    return msg.reply(`❌ *Invalid amount:* "${args.join(' ')}"\n\n` + `_Use numbers, k/m/b, math (70*5), or scientific notation (1e6)._`);
  }
  const result = await economyStore.exchangeCrystalsForCoins(senderId, amount);
  if (result.success) {
    await chat.sendMessage(`\n` + `    🔄 *EXCHANGE SUCCESSFUL!* 🔄 ૮ ˶ᵔ ᵕ ᵔ˶ ა\n` + `\n\n` + `👤 *Trainer:* ${senderName} 🎀\n\n` + `━━━━━━━━━━━━━━━━━━━━━━━━━\n` + `💎 *Sold:* ${result.exchanged.toLocaleString()} Radiant Crystals ੈ✩‧₊˚\n` + `💰 *Received:* ${result.received.toLocaleString()} PokéCoins ⋆｡‧˚ʚ🍓ɞ˚‧｡⋆\n` + `📈 *Rate:* 1 Crystal = ${economyStore.CRYSTAL_TO_COINS_RATE} PokéCoins ᡣ𐭩\n` + `━━━━━━━━━━━━━━━━━━━━━━━━━\n\n` + `💼 *New Balance:* ୨୧\n` + `   💎 ${result.newCrystals.toLocaleString()} Radiant Crystals\n` + `   💰 ${result.newCoins.toLocaleString()} PokéCoins\n\n` + `_~Exchange processed by Kitsune Treasury~_ ✨ 𓆩♡𓆪`);
  } else if (result.reason === 'insufficient_crystals') {
    await chat.sendMessage(`❌ *Not enough Radiant Crystals, ${senderName}!*\n\n` + `💎 *You have:* ${result.have.toLocaleString()} Crystals\n` + `💎 *Need:* ${result.need.toLocaleString()} Crystals\n` + `📉 *Short by:* ${(result.need - result.have).toLocaleString()} Crystals\n\n` + `_Catch Legendary/Mythical Pokémon or win Raids to earn crystals!_ 💫`);
  } else {
    await msg.reply(`❌ _Invalid exchange amount._`);
  }
}
async function handleCoinExchange(msg, args, chat, senderId, senderName) {
  if (args.length === 0) {
    return msg.reply(`❌ *Specify an amount!*\n\n` + `📝 *Usage:* \`-exchange pokecoins <amount>\`\n` + `💡 *Example:* \`-exchange pokecoins 3000\`\n` + `   ↳ _3,000 PokéCoins = ${Math.floor(3000 / economyStore.COINS_TO_CRYSTAL_RATE).toLocaleString()} Crystals_`);
  }
  const amountStr = args.join('');
  const amount = parseAmount(amountStr);
  if (isNaN(amount) || amount <= 0) {
    return msg.reply(`❌ *Invalid amount:* "${args.join(' ')}"\n\n` + `_Use numbers, k/m/b, math (70*5), or scientific notation (1e6)._`);
  }
  const result = await economyStore.exchangeCoinsForCrystals(senderId, amount);
  if (result.success) {
    await chat.sendMessage(`\n` + `    🔄 *EXCHANGE SUCCESSFUL!* 🔄 ૮ ˶ᵔ ᵕ ᵔ˶ ა\n` + `\n\n` + `👤 *Trainer:* ${senderName} 🎀\n\n` + `━━━━━━━━━━━━━━━━━━━━━━━━━\n` + `💰 *Spent:* ${result.exchanged.toLocaleString()} PokéCoins ⋆｡‧˚ʚ🍓ɞ˚‧｡⋆\n` + `💎 *Received:* ${result.received.toLocaleString()} Radiant Crystals ੈ✩‧₊˚\n` + `📈 *Rate:* ${economyStore.COINS_TO_CRYSTAL_RATE} PokéCoins = 1 Crystal ᡣ𐭩\n` + `━━━━━━━━━━━━━━━━━━━━━━━━━\n\n` + `💼 *New Balance:* ୨୧\n` + `   💰 ${result.newCoins.toLocaleString()} PokéCoins\n` + `   💎 ${result.newCrystals.toLocaleString()} Radiant Crystals\n\n` + `_~Exchange processed by Kitsune Treasury~_ ✨ 𓆩♡𓆪`);
  } else if (result.reason === 'insufficient_coins') {
    await chat.sendMessage(`❌ *Not enough PokéCoins, ${senderName}!*\n\n` + `💰 *You have:* ${result.have.toLocaleString()} PokéCoins\n` + `💰 *Need:* ${result.need.toLocaleString()} PokéCoins\n` + `📉 *Short by:* ${(result.need - result.have).toLocaleString()} PokéCoins\n\n` + `_Catch more Pokémon to earn PokéCoins!_ 💫`);
  } else if (result.reason === 'too_few_coins') {
    await chat.sendMessage(`❌ *Amount too small, ${senderName}!*\n\n` + `_You need at least *${result.minimum.toLocaleString()} PokéCoins* to get 1 Radiant Crystal._`);
  } else {
    await msg.reply(`❌ _Invalid exchange amount._`);
  }
}
async function handleItemExchange(msg, args, chat, senderId, senderName) {
  if (args.length === 0) {
    return msg.reply(`❌ *Specify an item and amount!*\n\n` + `📝 *Usage:* \`-exchange item <item_name> <amount>\`\n` + `💡 *Example:* \`-exchange item level orb 5\`\n` + `   ↳ _Items sold at 90% of market price_`);
  }
  let quantity = 1;
  const lastArg = args[args.length - 1];
  const parsedQty = parseAmount(lastArg);
  if (!isNaN(parsedQty) && parsedQty > 0 && args.length > 1) {
    quantity = parsedQty;
    args = args.slice(0, -1);
  }
  const itemNameInput = args.join(' ').trim().toLowerCase();
  if (!itemNameInput) {
    return msg.reply(`❌ *Specify an item name!*\n\n` + `📝 *Usage:* \`-exchange item <item_name> <amount>\`\n` + `💡 *Example:* \`-exchange item level orb 5\``);
  }
  const result = await economyStore.exchangeItemForCoins(senderId, itemNameInput, quantity);
  if (result.success) {
    const penaltyStr = `${Math.round(economyStore.ITEM_EXCHANGE_PENALTY * 100)}%`;
    await chat.sendMessage(`\n` + `    🔄 *ITEM EXCHANGE SUCCESSFUL!* 🔄 ૮꒰ ˶• ༝ •˶꒱ა ♡\n` + `\n\n` + `👤 *Trainer:* ${senderName} 🎀\n\n` + `━━━━━━━━━━━━━━━━━━━━━━━━━\n` + `${result.itemEmoji} *Item Sold:* ${result.quantity}× ${result.itemName} 𓍢ִ໋🌷͙֒\n` + `🏷️ *Market Price:* ${result.marketPrice.toLocaleString()} PokéCoins/unit ੈ✩‧₊˚\n` + `📉 *Exchange Rate:* ${result.payoutPerUnit.toLocaleString()} PokéCoins/unit _(${penaltyStr} fee)_ 🫧\n` + `💰 *Total Received:* ${result.totalPayout.toLocaleString()} PokéCoins ⋆｡‧˚ʚ🍓ɞ˚‧｡⋆\n` + `━━━━━━━━━━━━━━━━━━━━━━━━━\n\n` + `💼 *New PokéCoin Balance:* ${result.newCoins.toLocaleString()} ୨୧\n\n` + `_~Exchange processed by Kitsune Treasury~_ ✨ 𓆩♡𓆪`);
  } else if (result.reason === 'item_not_found') {
    await chat.sendMessage(`❌ *Item not found:* "${itemNameInput}"\n\n` + `_Use_ \`-pokemart\` _or_ \`-inventory\` _to see valid item names._`);
  } else if (result.reason === 'insufficient_items') {
    await chat.sendMessage(`❌ *Not enough items, ${senderName}!*\n\n` + `📦 *Item:* ${result.itemName}\n` + `🎒 *You have:* ${result.have} units\n` + `🔄 *Trying to exchange:* ${result.need} units\n\n` + `_Check your inventory with_ \`-inventory\``);
  } else if (result.reason === 'no_value') {
    await chat.sendMessage(`❌ _This item has no market value and cannot be exchanged._`);
  } else {
    await msg.reply(`❌ _Invalid exchange request._`);
  }
}

async function handleCardExchange(msg, cardName, price, chat, senderId, senderName) {
  const PokemonEntry = require('../../models/Pokemon');
  const entry = await PokemonEntry.findOne({ userId: senderId, pokemonName: { $regex: new RegExp(`^${cardName}$`, 'i') } });
  if (!entry) {
    return msg.reply(`❌ *You do not own the ${cardName} card!*`);
  }
  
  entry.userId = 'exchanged';
  await entry.save();
  await economyStore.addCoins(senderId, price);
  await chat.sendMessage(`🎉 *EASTER EGG EXCHANGE SUCCESSFUL!* 🎉\n\n👤 *Trainer:* ${senderName}\n━━━━━━━━━━━━━━━━━━━━━━━━━\n💳 *Exchanged:* ${cardName.toUpperCase()}\n💰 *Received:* ${price.toLocaleString()} PokéCoins\n━━━━━━━━━━━━━━━━━━━━━━━━━\n_Enjoy your wealth!_ ✨`);
}