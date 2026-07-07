const economyStore = require('../../store/economyStore');
const {
  getDisplayName
} = require('../../utils/contactHelper');
const {
  parseAmount
} = require('../../utils/amountParser');
const { getUserId } = require('../../utils/getUserId');
module.exports = {
  name: 'itemgift',
  aliases: ['itemshare', 'giftitem', 'ig'],
  description: 'Gift items to another trainer. Usage: -itemgift @user <item_name> [quantity]',
  category: 'pokemon',
  adminOnly: false,
  async execute(msg, args, client) {
    const chat = await msg.getChat();
    if (!chat.isGroup) return msg.reply('❌ _This command only works in groups._');
    const sender = await msg.getContact();
    const senderId = getUserId(sender);
    const senderName = getDisplayName(sender);
    const mentions = await msg.getMentions();
    const cleanArgs = args.filter(a => !a.startsWith('@'));
    if (mentions.length === 0 || cleanArgs.length === 0) {
      return msg.reply(`❌ *Incomplete Command!* ❌\n` + `━━━━━━━━━━━━━━━━━━━━━━\n` + `📝 *Usage:* \`-itemgift @user <item_name> [quantity]\`\n` + `📖 *Description:* Gift items from your inventory to another trainer.\n\n` + `💡 *Examples:*\n` + `  ▸ \`-itemgift @trainer Raid Pass 2\`\n` + `  ▸ \`-itemgift @trainer level orb 1\``);
    }
    const target = mentions[0];
    const targetId = getUserId(target);
    const targetName = getDisplayName(target);
    if (senderId === targetId) {
      return msg.reply(`❌ _You cannot gift items to yourself, ${senderName}!_ 😅`);
    }
    let quantity = 1;
    const lastArg = cleanArgs[cleanArgs.length - 1];
    if (lastArg) {
      const parsed = parseAmount(lastArg);
      if (!isNaN(parsed) && parsed > 0) {
        quantity = parsed;
        cleanArgs.pop();
      }
    }
    if (quantity <= 0) {
      return msg.reply('❌ *Quantity must be a positive number!*');
    }
    const itemNameInput = cleanArgs.join(' ').replace(/['"“”]/g, '').trim();
    const itemDetails = economyStore.getItemDetails(itemNameInput);
    if (!itemDetails) {
      return msg.reply(`❌ *Could not find any item matching "${itemNameInput}" in the database.*`);
    }
    const senderInv = await economyStore.getInventory(senderId);
    const senderItem = senderInv.items.find(i => i.itemName.toLowerCase() === itemDetails.displayName.toLowerCase());
    if (!senderItem || senderItem.quantity < quantity) {
      const ownedQty = senderItem ? senderItem.quantity : 0;
      return msg.reply(`❌ *Insufficient inventory, ${senderName}!*\n\n` + `📦 *Item:* ${itemDetails.emoji} ${itemDetails.displayName}\n` + `🎒 *You have:* ${ownedQty} units\n` + `🎁 *Trying to gift:* ${quantity} units`);
    }
    const removed = await economyStore.removeInventoryItem(senderId, itemDetails.displayName, quantity);
    if (!removed) {
      return msg.reply('❌ *Failed to deduct item from your inventory. Try again.*');
    }
    await economyStore.addInventoryItem(targetId, itemDetails.displayName, quantity);
    return chat.sendMessage(`\n` + `    🎁 *ITEM GIFT SENT!* 🎁 ૮ ˶ᵔ ᵕ ᵔ˶ ა\n` + `\n\n` + `👤 *From:* ${senderName} 🎀\n` + `👤 *To:* ${targetName} ᡣ𐭩\n\n` + `✨ *Gilded Gift:* **${quantity}x ${itemDetails.emoji} ${itemDetails.displayName}** 𓍢ִ໋🌷͙֒\n\n` + `━━━━━━━━━━━━━━━━━━━━━━━━━\n` + `_~Sharing items strengthens our bond, trainers!~_ 🤝 𓆩♡𓆪`);
  }
};