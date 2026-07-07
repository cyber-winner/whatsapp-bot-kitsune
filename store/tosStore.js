const PlayerWallet = require('../models/PlayerWallet');
const {
  TOS_VERSION,
  TOS_TEXT,
  TOS_LOCKED_MSG
} = require('../data/tos');
const {
  FATHER
} = require('../config');
const acceptedUsers = new Set();
async function loadAll() {
  try {
    const wallets = await PlayerWallet.find({
      tosVersion: {
        $gte: TOS_VERSION
      }
    }, {
      userId: 1
    });
    for (const w of wallets) {
      acceptedUsers.add(w.userId);
    }
    for (const fatherId of FATHER) {
      acceptedUsers.add(fatherId);
    }
    console.log(`[ToSStore] Loaded ${acceptedUsers.size} accepted users (v${TOS_VERSION}).`);
  } catch (err) {
    console.error('[ToSStore] Failed to load:', err.message);
  }
}
function hasAcceptedToS(userId) {
  if (FATHER.includes(userId)) return true;
  return acceptedUsers.has(userId);
}
async function acceptToS(userId) {
  if (acceptedUsers.has(userId)) return false;
  acceptedUsers.add(userId);
  try {
    await PlayerWallet.updateOne({
      userId
    }, {
      $set: {
        tosVersion: TOS_VERSION
      }
    }, {
      upsert: true
    });
  } catch (err) {
    console.error('[ToSStore] Failed to save acceptance:', err.message);
  }
  return true;
}
module.exports = {
  loadAll,
  hasAcceptedToS,
  acceptToS,
  TOS_VERSION,
  TOS_TEXT,
  TOS_LOCKED_MSG
};