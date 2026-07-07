const economyStore = require('../../store/economyStore');
const {
  getDisplayName
} = require('../../utils/contactHelper');
const { getUserId } = require('../../utils/getUserId');
module.exports = {
  name: 'inventory',
  aliases: ['inv', 'bag', 'items'],
  description: 'View your inventory, Pokéballs, and PokéCoins. Usage: -inventory',
  adminOnly: false,
  async execute(msg, args, client) {
    const chat = await msg.getChat();
    if (!chat.isGroup) return msg.reply('❌ _This command only works in groups._');
    const sender = await msg.getContact();
    const senderId = getUserId(sender);
    const senderName = getDisplayName(sender);
    const inv = await economyStore.getInventory(senderId);
    let text = `\n` + `    🎒 *${senderName.toUpperCase()}'S INVENTORY* 🎒 ૮ ˶ᵔ ᵕ ᵔ˶ ა\n` + `\n\n` + `💰 *PokéCoins:* ${inv.pokecoins.toLocaleString()} 🎀\n` + `🔴 *Pokéballs:* ${inv.pokeballs} ૮꒰ ˶• ༝ •˶꒱ა ♡\n` + `💎 *Radiant Crystals:* ${(inv.radiantCrystals || 0).toLocaleString()} ੈ✩‧₊˚\n\n`;
    const activeItems = (inv.items || []).filter(item => item.quantity > 0);
    if (activeItems.length > 0) {
      text += `━━━━━━━━━━━━━━━━━━━━━━━━━\n` + `📦 *ITEMS:* 𓍢ִ໋🌷͙֒\n` + `━━━━━━━━━━━━━━━━━━━━━━━━━\n\n`;
      for (const item of activeItems) {
        const details = economyStore.getItemDetails(item.itemName);
        const emoji = details ? details.emoji : '📦';
        text += `  ${emoji} *${item.itemName}* — ×${item.quantity} ⋆.˚\n`;
      }
      text += `\n`;
    } else {
      text += `📦 _No special items in your bag._ (╥﹏╥) 🫧\n\n`;
    }
    text += `━━━━━━━━━━━━━━━━━━━━━━━━━\n` + `🏪 _Visit_ \`-pokemart\` _to buy items!_ 🛒 ୨୧\n` + `_~Kitsune Inventory System~_ ✨ ᡣ𐭩`;
    await chat.sendMessage(text);
  }
};