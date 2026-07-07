const knownUserStore = require('../store/knownUserStore');
const mongoose = require('mongoose');
function getDisplayName(contact) {
  const serialized = contact.id?._serialized || '';
  const lidUser = serialized.split('@')[0];
  const knownName = knownUserStore.getName(lidUser);
  if (knownName) return knownName;
  if (contact.pushname) return contact.pushname;
  if (contact.name) return contact.name;
  if (contact.shortName) return contact.shortName;
  if (contact.verifiedName) return contact.verifiedName;
  const num = contact.number;
  if (num && num.length >= 10 && !serialized.endsWith('@lid')) {
    return num;
  }
  if (serialized.endsWith('@c.us')) {
    return serialized.split('@')[0];
  }
  return 'Someone';
}
async function resolveLeaderboardName(userId, client) {
  if (!userId) return 'Trainer';
  try {
    const LinkedAccount = mongoose.model('LinkedAccount');
    const linked = await LinkedAccount.findOne({
      unifiedId: userId
    });
    if (linked) {
      if (linked.whatsappId) {
        const knownName = knownUserStore.getName(linked.whatsappId);
        if (knownName) return knownName;
      }
      return linked.displayName;
    }
  } catch (e) {}
  const knownName = knownUserStore.getName(userId);
  if (knownName) return knownName;
  if (userId.startsWith('discord_')) {
    return `Discord:${userId.replace('discord_', '').slice(-4)}`;
  }
  for (const suffix of ['@c.us', '@lid']) {
    try {
      const contact = await client.getContactById(userId + suffix);
      if (contact) {
        const resolved = getDisplayName(contact);
        if (resolved && resolved !== userId) {
          return resolved;
        }
      }
    } catch (e) {}
  }
  return `WA:${userId.slice(-4)}`;
}
module.exports = {
  getDisplayName,
  resolveLeaderboardName
};