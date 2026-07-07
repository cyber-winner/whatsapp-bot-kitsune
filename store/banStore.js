const Ban = require('../models/Ban');
let bans = {};
async function loadAll() {
  try {
    const banDocs = await Ban.find({});
    bans = {};
    for (const doc of banDocs) {
      if (!bans[doc.groupId]) bans[doc.groupId] = [];
      bans[doc.groupId].push(doc.userId);
    }
    console.log(`[BanStore] Loaded ${banDocs.length} bans from DB.`);
  } catch (err) {
    console.error('[BanStore] Failed to load:', err.message);
    bans = {};
  }
}
function banUser(groupId, userId) {
  if (!bans[groupId]) bans[groupId] = [];
  if (!bans[groupId].includes(userId)) {
    bans[groupId].push(userId);
    Ban.create({
      groupId,
      userId
    }).catch(err => {
      if (err.code !== 11000) console.error('[BanStore] DB Save Error:', err.message);
    });
  }
}
function unbanUser(groupId, userId) {
  if (!bans[groupId]) return false;
  const idx = bans[groupId].indexOf(userId);
  if (idx === -1) return false;
  bans[groupId].splice(idx, 1);
  Ban.deleteOne({
    groupId,
    userId
  }).catch(err => console.error('[BanStore] DB Delete Error:', err.message));
  return true;
}
function isBanned(groupId, userId) {
  if (!bans[groupId]) return false;
  return bans[groupId].includes(userId);
}
function getBannedUsers(groupId) {
  return bans[groupId] || [];
}
module.exports = {
  banUser,
  unbanUser,
  isBanned,
  getBannedUsers,
  loadAll
};