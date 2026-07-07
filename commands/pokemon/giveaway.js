const { OWNER_NAME } = require('../../config');
const {
  startGiveaway,
  hasActiveGiveaway
} = require('../../store/giveawayStore');
const {
  isFather
} = require('../../utils/permissions');
module.exports = {
  name: 'giveaway',
  aliases: ['gstart', 'giveawaystart'],
  description: 'Start a customizable Pokecoins, Crystals, or Items Giveaway (Father Only).',
  adminOnly: false,
  localOnly: true,
  async execute(msg, args, client) {
    const chat = await msg.getChat();
    if (!chat.isGroup) {
      return msg.reply('❌ _This command only works in group chats._');
    }
    const isFatherUser = await isFather(msg, client);
    if (!isFatherUser) {
      return msg.reply('❌ *ACCESS DENIED* ❌\n\n_Only ' + OWNER_NAME + ' can command a Kitsune Giveaway!_ 👑');
    }
    const groupId = chat.id._serialized;
    if (hasActiveGiveaway(groupId)) {
      return msg.reply('⚠️ _A giveaway is already running in this group chat!_');
    }
    if (!args || args.length < 3) {
      return msg.reply(`⚠️ *KITSUNE GIVEAWAY SYNTAX* ⚠️\n\n` + `• *PokéCoins:* \`-gstart pokecoins <amount> <time_in_minutes>\`\n` + `• *Crystals:* \`-gstart crystal <amount> <time_in_minutes>\`\n` + `• *Items:* \`-gstart item <item_name> <amount> <time_in_minutes>\`\n\n` + `_Example: -gstart item Master Ball 10 5_`);
    }
    const type = args[0].toLowerCase();
    let prize = null;
    let timeMinutes = 0;
    if (type === 'pokecoins' || type === 'coins') {
      const amount = parseInt(args[1]);
      timeMinutes = parseInt(args[2]);
      if (isNaN(amount) || amount <= 0 || isNaN(timeMinutes) || timeMinutes <= 0) {
        return msg.reply('⚠️ _Invalid PokéCoins amount or time duration. Both must be positive integers!_');
      }
      prize = {
        type: 'pokecoins',
        amount
      };
    } else if (type === 'crystal' || type === 'crystals') {
      const amount = parseInt(args[1]);
      timeMinutes = parseInt(args[2]);
      if (isNaN(amount) || amount <= 0 || isNaN(timeMinutes) || timeMinutes <= 0) {
        return msg.reply('⚠️ _Invalid Radiant Crystals amount or time duration. Both must be positive integers!_');
      }
      prize = {
        type: 'crystal',
        amount
      };
    } else if (type === 'item') {
      if (args.length < 4) {
        return msg.reply('⚠️ _Syntax: -gstart item <name> <amount> <time_in_minutes>_');
      }
      timeMinutes = parseInt(args[args.length - 1]);
      const amount = parseInt(args[args.length - 2]);
      const itemName = args.slice(1, args.length - 2).join(' ');
      if (isNaN(amount) || amount <= 0 || isNaN(timeMinutes) || timeMinutes <= 0 || !itemName) {
        return msg.reply('⚠️ _Invalid item details. Please check item name, amount, and time values!_');
      }
      prize = {
        type: 'item',
        amount,
        itemName
      };
    } else {
      return msg.reply('⚠️ _Unknown giveaway type. Use "pokecoins", "crystal", or "item"!_');
    }
    const startResult = await startGiveaway(groupId, prize, timeMinutes, msg, client);
    if (startResult.success) {
      let prizeDescription = '';
      if (prize.type === 'pokecoins') {
        prizeDescription = `🪙 **${prize.amount.toLocaleString()} PokéCoins**`;
      } else if (prize.type === 'crystal') {
        prizeDescription = `💎 **${prize.amount.toLocaleString()} Radiant Crystals**`;
      } else if (prize.type === 'item') {
        prizeDescription = `🎁 **${prize.amount}x ${prize.itemName}**`;
      }
      const startMsg = `\n` + `    🎉 *SUPREME KITSUNE GIVEAWAY* 🎉 ૮ ˶ᵔ ᵕ ᵔ˶ ა\n` + `\n\n` + `✨ *The Divine ${OWNER_NAME} has declared a Giveaway!* ✨ 🎀\n\n` + `👑 *Host:* ${OWNER_NAME} ᯓ★\n` + `🎁 *GRAND PRIZE:* ${prizeDescription} 𓍢ִ໋🌷͙֒\n\n` + `📝 *How to Enter:* Type *kitsune giveaway enter* in this group chat! ੈ✩‧₊˚\n\n` + `⏳ *Duration:* **${timeMinutes} Minute(s)** 🫧\n\n` + `━━━━━━━━━━━━━━━━━━━━━━━━━\n` + `_~Hurry and enter before the portal closes!~_ 💫 𓆩♡𓆪`;
      await chat.sendMessage(startMsg);
    } else {
      await msg.reply(`❌ _Failed to start giveaway: ${startResult.reason}_`);
    }
  }
};