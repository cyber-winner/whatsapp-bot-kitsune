const PokemonEntry = require('../../models/Pokemon');
const PlayerWallet = require('../../models/PlayerWallet');
const GachaProfile = require('../../models/GachaProfile');
const PokemonListing = require('../../models/PokemonListing');
const crypto = require('crypto');
let LinkedAccountModel;
try {
  LinkedAccountModel = require('mongoose').model('LinkedAccount');
} catch {
  const mongoose = require('mongoose');
const { getUserId } = require('../../utils/getUserId');
  const schema = new mongoose.Schema({
    discordId: {
      type: String,
      sparse: true,
      unique: true
    },
    whatsappId: {
      type: String,
      sparse: true,
      unique: true
    },
    unifiedId: {
      type: String,
      required: true,
      unique: true
    },
    displayName: {
      type: String,
      required: true
    },
    originPlatform: {
      type: String,
      enum: ['discord', 'whatsapp'],
      required: true
    },
    otp: {
      type: String,
      default: null
    },
    otpExpiry: {
      type: Date,
      default: null
    },
    linkedAt: {
      type: Date,
      default: null
    },
    createdAt: {
      type: Date,
      default: Date.now
    }
  });
  schema.index({
    otp: 1
  });
  LinkedAccountModel = mongoose.model('LinkedAccount', schema);
}
function generateOTP() {
  return crypto.randomInt(100000, 999999).toString();
}
async function migrateGameData(fromUserId, toUserId) {
  if (fromUserId === toUserId) return;
  await PokemonEntry.updateMany({
    userId: fromUserId
  }, {
    userId: toUserId
  });
  const fromWallet = await PlayerWallet.findOne({
    userId: fromUserId
  });
  const toWallet = await PlayerWallet.findOne({
    userId: toUserId
  });
  if (fromWallet && toWallet) {
    toWallet.pokecoins += fromWallet.pokecoins;
    toWallet.pokeballs += fromWallet.pokeballs;
    toWallet.radiantCrystals = (toWallet.radiantCrystals || 0) + (fromWallet.radiantCrystals || 0);
    for (const item of fromWallet.inventory) {
      const existing = toWallet.inventory.find(i => i.itemName === item.itemName);
      if (existing) existing.quantity += item.quantity;else toWallet.inventory.push(item);
    }
    if (fromWallet.lastDaily && (!toWallet.lastDaily || fromWallet.lastDaily > toWallet.lastDaily)) toWallet.lastDaily = fromWallet.lastDaily;
    if (fromWallet.lastWeekly && (!toWallet.lastWeekly || fromWallet.lastWeekly > toWallet.lastWeekly)) toWallet.lastWeekly = fromWallet.lastWeekly;
    if (fromWallet.lastSummon && (!toWallet.lastSummon || fromWallet.lastSummon > toWallet.lastSummon)) toWallet.lastSummon = fromWallet.lastSummon;
    await toWallet.save();
    await PlayerWallet.deleteOne({
      userId: fromUserId
    });
  } else if (fromWallet && !toWallet) {
    fromWallet.userId = toUserId;
    await fromWallet.save();
  }
  const fromGacha = await GachaProfile.findOne({
    userId: fromUserId
  });
  const toGacha = await GachaProfile.findOne({
    userId: toUserId
  });
  if (fromGacha && toGacha) {
    toGacha.pity5 = Math.min(90, toGacha.pity5 + fromGacha.pity5);
    toGacha.pity4 = Math.min(10, toGacha.pity4 + fromGacha.pity4);
    toGacha.guaranteed5 = toGacha.guaranteed5 || fromGacha.guaranteed5;
    toGacha.totalWishes += fromGacha.totalWishes;
    toGacha.total5Stars += fromGacha.total5Stars;
    toGacha.total4Stars += fromGacha.total4Stars;
    await toGacha.save();
    await GachaProfile.deleteOne({
      userId: fromUserId
    });
  } else if (fromGacha && !toGacha) {
    fromGacha.userId = toUserId;
    await fromGacha.save();
  }
  await PokemonListing.updateMany({
    sellerId: fromUserId
  }, {
    sellerId: toUserId
  });
}
const connectCommand = {
  name: 'connect',
  aliases: [],
  category: 'pokemon',
  description: 'Link your Discord account using an OTP from Discord.',
  usage: '-connect <OTP>',
  async execute(msg, args, client) {
    const otp = args[0];
    if (!otp) {
      return msg.reply(`🔗 *Cross-Platform Account Linking* 🔗 ૮꒰ ˶• ༝ •˶꒱ა ♡\n\n` + `To link your Discord account:\n` + `1. Go to Discord and use \`/connect whatsapp\` 🎀\n` + `2. Copy the OTP you receive ᡣ𐭩\n` + `3. Come back here and type \`-connect <OTP>\` 🫧\n\n` + `_Already have an OTP?_ Type \`-connect <your_otp>\` ⋆.˚`);
    }
    const cleanOtp = String(otp || '').trim();
    const account = await LinkedAccountModel.findOne({
      otp: cleanOtp,
      $expr: {
        $gt: ["$otpExpiry", "$$NOW"]
      }
    });
    if (!account) {
      return msg.reply('❌ *Invalid or expired OTP.*\n\n_Generate a new one in Discord with_ `/connect whatsapp`');
    }
    const sender = await msg.getContact();
    const whatsappId = getUserId(sender);
    const unifiedId = account.unifiedId;
    const existing = await LinkedAccountModel.findOne({
      whatsappId
    });
    if (existing) {
      await migrateGameData(existing.unifiedId, unifiedId);
      await LinkedAccountModel.deleteOne({
        _id: existing._id
      });
    } else {
      await migrateGameData(whatsappId, unifiedId);
    }
    const senderName = sender.pushname || sender.name || 'Trainer';
    if (senderName && account.displayName && !account.displayName.includes(senderName)) {
      account.displayName = `${account.displayName} / ${senderName}`;
    }
    account.whatsappId = whatsappId;
    account.otp = null;
    account.otpExpiry = null;
    account.linkedAt = new Date();
    await account.save();
    return msg.reply(`\n` + `    🔗 *ACCOUNT LINKED!* 🔗 ૮ ˶ᵔ ᵕ ᵔ˶ ა\n` + `\n\n` + `✅ *Successfully linked!* 🎀\n\n` + `📱 *WhatsApp:* Connected 🫧\n` + `🎮 *Discord:* Connected 𓍢ִ໋🌷͙֒\n` + `🏷️ *Display Name:* ${account.displayName} ੈ✩‧₊˚\n\n` + `_Your progress is now synced across both platforms!_ 🎧ྀི\n` + `_Cooldowns, inventory, and Pokémon are shared._ ✨ 𓆩♡𓆪`);
  }
};
const discordConnectCommand = {
  name: 'discord',
  aliases: [],
  category: 'pokemon',
  description: 'Generate an OTP to link your Discord account.',
  usage: '-discord connect',
  async execute(msg, args, client) {
    if (args[0]?.toLowerCase() !== 'connect') {
      return msg.reply('_Usage:_ `-discord connect`');
    }
    const sender = await msg.getContact();
    const whatsappId = getUserId(sender);
    const senderName = sender.pushname || sender.name || 'Trainer';
    const existing = await LinkedAccountModel.findOne({
      whatsappId
    });
    if (existing && existing.discordId) {
      return msg.reply('🔗 *Your account is already linked to Discord!*');
    }
    const otp = generateOTP();
    const otpExpiry = new Date(Date.now() + 15 * 60 * 1000);
    if (existing) {
      existing.otp = otp;
      existing.otpExpiry = otpExpiry;
      await existing.save();
    } else {
      await LinkedAccountModel.findOneAndUpdate({
        whatsappId
      }, {
        whatsappId,
        unifiedId: whatsappId,
        displayName: senderName,
        originPlatform: 'whatsapp',
        otp,
        otpExpiry
      }, {
        upsert: true,
        new: true
      });
    }
    return msg.reply(`\n` + `    🔗 *CONNECT TO DISCORD* 🔗 ૮꒰ ˶• ༝ •˶꒱ა ♡\n` + `\n\n` + `📱 *Your OTP:* \`${otp}\` 🎀\n\n` + `*Steps to link:* ᡣ𐭩\n` + `1. Open Discord 🫧\n` + `2. Type: \`/connect whatsapp otp:${otp}\` 𓍢ִ໋🌷͙֒\n` + `3. Done! Your accounts will be synced. ੈ✩‧₊˚\n\n` + `⏰ *Expires in 15 minutes.* 🎧ྀི\n\n` + `_After linking, your Pokémon, coins, and progress_ ⋆.˚\n` + `_will be shared across both platforms!_ ✨ 𓆩♡𓆪`);
  }
};
module.exports = [connectCommand, discordConnectCommand];