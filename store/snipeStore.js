const {
  SNIPE_LIMIT,
  SNIPE_EXPIRY_MS
} = require('../config');
const deletedMessages = new Map();
const editedMessages = new Map();
const recentMediaCache = new Map();
function cacheMedia(messageId, media) {
  recentMediaCache.set(messageId, media);
  if (recentMediaCache.size > 100) {
    const firstKey = recentMediaCache.keys().next().value;
    recentMediaCache.delete(firstKey);
  }
}
function getCachedMedia(messageId) {
  return recentMediaCache.get(messageId) || null;
}
function purgeStale(arr) {
  const now = Date.now();
  return arr.filter(entry => now - entry.timestamp < SNIPE_EXPIRY_MS);
}
function addDeletedMessage(groupId, data) {
  if (!deletedMessages.has(groupId)) {
    deletedMessages.set(groupId, []);
  }
  const arr = purgeStale(deletedMessages.get(groupId));
  arr.push({
    ...data,
    timestamp: Date.now()
  });
  if (arr.length > SNIPE_LIMIT) {
    arr.splice(0, arr.length - SNIPE_LIMIT);
  }
  deletedMessages.set(groupId, arr);
}
function getLastDeleted(groupId) {
  if (!deletedMessages.has(groupId)) return null;
  const arr = purgeStale(deletedMessages.get(groupId));
  deletedMessages.set(groupId, arr);
  return arr.length > 0 ? arr[arr.length - 1] : null;
}
function getLastDeletedMedia(groupId) {
  if (!deletedMessages.has(groupId)) return null;
  const arr = purgeStale(deletedMessages.get(groupId));
  deletedMessages.set(groupId, arr);
  for (let i = arr.length - 1; i >= 0; i--) {
    if (arr[i].media) return arr[i];
  }
  return null;
}
function addEditedMessage(groupId, data) {
  if (!editedMessages.has(groupId)) {
    editedMessages.set(groupId, []);
  }
  const arr = purgeStale(editedMessages.get(groupId));
  arr.push({
    ...data,
    timestamp: Date.now()
  });
  if (arr.length > SNIPE_LIMIT) {
    arr.splice(0, arr.length - SNIPE_LIMIT);
  }
  editedMessages.set(groupId, arr);
}
function getLastEdited(groupId) {
  if (!editedMessages.has(groupId)) return null;
  const arr = purgeStale(editedMessages.get(groupId));
  editedMessages.set(groupId, arr);
  return arr.length > 0 ? arr[arr.length - 1] : null;
}
module.exports = {
  addDeletedMessage,
  getLastDeleted,
  getLastDeletedMedia,
  addEditedMessage,
  getLastEdited,
  cacheMedia,
  getCachedMedia
};