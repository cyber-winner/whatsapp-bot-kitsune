const {
  FATHER
} = require('../config');
const ownerStore = require('../store/ownerStore');
function getSenderId(msg, client) {
  if (msg.fromMe && client && client.info) {
    return client.info.wid._serialized;
  }
  return msg.author || msg.from;
}
async function isGroupAdmin(msg, client) {
  const chat = await msg.getChat();
  if (!chat.isGroup) return false;
  const senderId = getSenderId(msg, client);
  const possibleIds = [senderId];
  try {
    const contact = await msg.getContact();
    if (contact) {
      if (contact.id && contact.id._serialized) possibleIds.push(contact.id._serialized);
      if (contact.number) possibleIds.push(`${contact.number}@c.us`);
    }
  } catch (err) {}
  const participant = chat.participants.find(p => possibleIds.includes(p.id._serialized));
  if (!participant) return false;
  return participant.isAdmin || participant.isSuperAdmin;
}
async function isBotAdmin(msg, client) {
  const chat = await msg.getChat();
  if (!chat.isGroup) return false;
  const botId = client.info.wid._serialized;
  const botPhone = client.info.wid.user;
  const possibleIds = [botId, `${botPhone}@c.us`];
  const participant = chat.participants.find(p => possibleIds.includes(p.id._serialized));
  if (!participant) return false;
  return participant.isAdmin || participant.isSuperAdmin;
}
async function resolveSenderIds(msg, client) {
  const ids = [];
  if (msg.fromMe && client && client.info) {
    ids.push(client.info.wid.user);
    ids.push(client.info.wid._serialized.split('@')[0]);
    return ids;
  }
  const senderId = msg.author || msg.from;
  const rawId = senderId.split('@')[0];
  ids.push(rawId);
  if (senderId.endsWith('@lid')) {
    try {
      const contact = await msg.getContact();
      const number = contact.number || contact.id?.user;
      if (number) ids.push(number);
    } catch (err) {
      console.error('[Permissions] Failed to resolve LID:', err.message);
    }
  }
  return ids;
}
async function isFather(msg, client) {
  const senderIds = await resolveSenderIds(msg, client);
  return senderIds.some(id => FATHER.includes(id));
}
async function isBotOwner(msg, client) {
  const senderIds = await resolveSenderIds(msg, client);
  if (senderIds.some(id => FATHER.includes(id))) return true;
  if (senderIds.some(id => ownerStore.isOwner(id))) return true;
  return false;
}
module.exports = {
  getSenderId,
  isGroupAdmin,
  isBotAdmin,
  isFather,
  isBotOwner
};