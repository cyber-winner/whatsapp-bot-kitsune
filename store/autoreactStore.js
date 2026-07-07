const Autoreact = require('../models/Autoreact');
let autoreactMap = {};
function normalizeId(id) {
  if (!id) return '';
  return id.split('@')[0];
}
async function loadAll() {
  try {
    const docs = await Autoreact.find({});
    autoreactMap = {};
    for (const doc of docs) {
      if (!autoreactMap[doc.groupId]) {
        autoreactMap[doc.groupId] = {};
      }
      autoreactMap[doc.groupId][doc.userId] = doc.emoji;
    }
    console.log(`[AutoreactStore] Loaded ${docs.length} autoreacts from DB.`);
  } catch (err) {
    console.error('[AutoreactStore] Failed to load:', err.message);
    autoreactMap = {};
  }
}
function setAutoreact(groupId, userId, emoji) {
  if (!autoreactMap[groupId]) {
    autoreactMap[groupId] = {};
  }
  const normId = normalizeId(userId);
  autoreactMap[groupId][normId] = emoji;
  Autoreact.findOneAndUpdate({
    groupId,
    userId: normId
  }, {
    emoji
  }, {
    upsert: true,
    returnDocument: 'after'
  }).catch(err => console.error('[AutoreactStore] DB Save Error:', err.message));
}
function removeAutoreact(groupId, userId) {
  const normId = normalizeId(userId);
  if (!autoreactMap[groupId] || !autoreactMap[groupId][normId]) {
    return false;
  }
  delete autoreactMap[groupId][normId];
  Autoreact.deleteOne({
    groupId,
    userId: normId
  }).catch(err => console.error('[AutoreactStore] DB Delete Error:', err.message));
  return true;
}
function getAutoreactEmoji(groupId, userId) {
  if (!autoreactMap[groupId]) return null;
  const normId = normalizeId(userId);
  return autoreactMap[groupId][normId] || null;
}
function getGroupAutoreacts(groupId) {
  return autoreactMap[groupId] || {};
}
module.exports = {
  setAutoreact,
  removeAutoreact,
  getAutoreactEmoji,
  getGroupAutoreacts,
  loadAll
};