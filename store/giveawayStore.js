const PokemonEntry = require('../models/Pokemon');
const PlayerWallet = require('../models/PlayerWallet');
const ActiveGiveaway = require('../models/ActiveGiveaway');
const { OWNER_NAME, 
  FATHER
} = require('../config');
const {
  getDisplayName
} = require('../utils/contactHelper');
const activeGiveaways = new Map();
function hasActiveGiveaway(groupId) {
  return activeGiveaways.has(groupId);
}
function getGiveaway(groupId) {
  return activeGiveaways.get(groupId);
}
async function startGiveaway(groupId, prize, durationMinutes, msg, client) {
  if (activeGiveaways.has(groupId)) {
    return {
      success: false,
      reason: 'already_running'
    };
  }
  const fatherId = FATHER[0];
  const fatherWallet = await PlayerWallet.findOne({
    userId: fatherId
  });
  if (!fatherWallet) {
    return {
      success: false,
      reason: 'Father does not have a registered profile wallet!'
    };
  }
  if (prize.type === 'pokecoins') {
    if ((fatherWallet.pokecoins || 0) < prize.amount) {
      return {
        success: false,
        reason: `Father only has ${fatherWallet.pokecoins || 0} PokéCoins (requested ${prize.amount}).`
      };
    }
    fatherWallet.pokecoins -= prize.amount;
  } else if (prize.type === 'crystal') {
    if ((fatherWallet.radiantCrystals || 0) < prize.amount) {
      return {
        success: false,
        reason: `Father only has ${fatherWallet.radiantCrystals || 0} Radiant Crystals (requested ${prize.amount}).`
      };
    }
    fatherWallet.radiantCrystals -= prize.amount;
  } else if (prize.type === 'item') {
    const itemLower = prize.itemName.toLowerCase();
    const existingItem = fatherWallet.inventory.find(i => i.itemName.toLowerCase() === itemLower);
    if (!existingItem || existingItem.quantity < prize.amount) {
      const hasQty = existingItem ? existingItem.quantity : 0;
      return {
        success: false,
        reason: `Father only has ${hasQty}x ${prize.itemName} (requested ${prize.amount}).`
      };
    }
    existingItem.quantity -= prize.amount;
    fatherWallet.inventory = fatherWallet.inventory.filter(i => i.quantity > 0);
  }
  await fatherWallet.save();
  const durationMs = durationMinutes * 60 * 1000;
  const endTime = Date.now() + durationMs;
  const timer = setTimeout(async () => {
    await rollGiveaway(groupId, client);
  }, durationMs);
  activeGiveaways.set(groupId, {
    participants: new Map(),
    endTime,
    timer,
    groupId,
    prize
  });
  try {
    await ActiveGiveaway.create({
      groupId,
      prize,
      endTime,
      participants: []
    });
  } catch (err) {
    console.error('[GiveawayStore] Failed to save active giveaway to DB:', err);
  }
  return {
    success: true,
    durationMs
  };
}
function enterParticipant(groupId, userId, userName) {
  const giveaway = activeGiveaways.get(groupId);
  if (!giveaway) return {
    success: false,
    reason: 'no_giveaway'
  };
  if (giveaway.participants.has(userId)) {
    return {
      success: false,
      reason: 'already_entered'
    };
  }
  giveaway.participants.set(userId, userName);
  ActiveGiveaway.findOneAndUpdate({
    groupId
  }, {
    $push: {
      participants: {
        userId,
        userName
      }
    }
  }).catch(err => console.error('[GiveawayStore] DB Enter Participant Error:', err));
  return {
    success: true,
    count: giveaway.participants.size
  };
}
async function rollGiveaway(groupId, client) {
  const giveaway = activeGiveaways.get(groupId);
  if (!giveaway) return;
  activeGiveaways.delete(groupId);
  try {
    await ActiveGiveaway.deleteOne({
      groupId
    });
  } catch (err) {
    console.error('[GiveawayStore] Failed to delete active giveaway from DB:', err);
  }
  const chat = await client.getChatById(groupId);
  const {
    prize
  } = giveaway;
  if (giveaway.participants.size === 0) {
    const fatherId = FATHER[0];
    const fatherWallet = await PlayerWallet.findOne({
      userId: fatherId
    });
    if (fatherWallet) {
      if (prize.type === 'pokecoins') {
        fatherWallet.pokecoins = (fatherWallet.pokecoins || 0) + prize.amount;
      } else if (prize.type === 'crystal') {
        fatherWallet.radiantCrystals = (fatherWallet.radiantCrystals || 0) + prize.amount;
      } else if (prize.type === 'item') {
        const existing = fatherWallet.inventory.find(i => i.itemName.toLowerCase() === prize.itemName.toLowerCase());
        if (existing) {
          existing.quantity += prize.amount;
        } else {
          fatherWallet.inventory.push({
            itemName: prize.itemName,
            quantity: prize.amount
          });
        }
      }
      await fatherWallet.save();
    }
    await chat.sendMessage(`💨 *GIVEAWAY ENDED* 💨\n` + `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n` + `😢 No one entered the giveaway, so the prize has been returned to Father's vault!\n\n` + `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    return;
  }
  const participantList = Array.from(giveaway.participants.entries()).map(([id, name]) => ({
    id,
    name
  }));
  const winner = participantList[Math.floor(Math.random() * participantList.length)];
  try {
    const economyStore = require('./economyStore');
    const winnerWallet = await economyStore.getWallet(winner.id);
    let prizeText = '';
    if (prize.type === 'pokecoins') {
      winnerWallet.pokecoins = (winnerWallet.pokecoins || 0) + prize.amount;
      prizeText = `🪙 **${prize.amount.toLocaleString()} PokéCoins**`;
    } else if (prize.type === 'crystal') {
      winnerWallet.radiantCrystals = (winnerWallet.radiantCrystals || 0) + prize.amount;
      prizeText = `💎 **${prize.amount.toLocaleString()} Radiant Crystals**`;
    } else if (prize.type === 'item') {
      const existing = winnerWallet.inventory.find(i => i.itemName.toLowerCase() === prize.itemName.toLowerCase());
      if (existing) {
        existing.quantity += prize.amount;
      } else {
        winnerWallet.inventory.push({
          itemName: prize.itemName,
          quantity: prize.amount
        });
      }
      prizeText = `🎁 **${prize.amount}x ${prize.itemName}**`;
    }
    await winnerWallet.save();
    await chat.sendMessage(`🏆 *GIVEAWAY WINNER CHOSEN!* 🏆\n` + `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n` + `🎉 Congratulations to *@${winner.id}* (${winner.name})!\n\n` + `👑 *Host:* ${OWNER_NAME}\n` + `🎁 *Prize Won:* ${prizeText}\n\n` + `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n` + `📦 _The prize has been successfully delivered and added to your profile inventory!_\n` + `_~Praise the Supreme ${OWNER_NAME}!~_ 🙏`, {
      mentions: [`${winner.id}@c.us`]
    });
  } catch (err) {
    console.error('[Giveaway Roll Error]:', err);
    await chat.sendMessage(`❌ _An error occurred while processing the giveaway transfer:_ \`${err.message}\``);
  }
}
async function init(client) {
  try {
    const giveaways = await ActiveGiveaway.find({});
    console.log(`[GiveawayStore] Found ${giveaways.length} active giveaways in DB to resume.`);
    const now = Date.now();
    for (const doc of giveaways) {
      const remainingMs = doc.endTime - now;
      const participantsMap = new Map();
      if (doc.participants && doc.participants.length > 0) {
        for (const p of doc.participants) {
          participantsMap.set(p.userId, p.userName);
        }
      }
      if (remainingMs <= 0) {
        console.log(`[GiveawayStore] Giveaway in group ${doc.groupId} expired while offline. Rolling now...`);
        activeGiveaways.set(doc.groupId, {
          participants: participantsMap,
          endTime: doc.endTime,
          groupId: doc.groupId,
          prize: doc.prize,
          timer: null
        });
        await rollGiveaway(doc.groupId, client);
      } else {
        console.log(`[GiveawayStore] Resuming giveaway in group ${doc.groupId} with ${Math.round(remainingMs / 1000 / 60)} minutes remaining.`);
        const timer = setTimeout(async () => {
          await rollGiveaway(doc.groupId, client);
        }, remainingMs);
        activeGiveaways.set(doc.groupId, {
          participants: participantsMap,
          endTime: doc.endTime,
          timer,
          groupId: doc.groupId,
          prize: doc.prize
        });
      }
    }
  } catch (err) {
    console.error('[GiveawayStore] Failed to initialize / resume active giveaways:', err);
  }
}
module.exports = {
  init,
  hasActiveGiveaway,
  getGiveaway,
  startGiveaway,
  enterParticipant,
  rollGiveaway
};