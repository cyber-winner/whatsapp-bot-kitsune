const Owner = require('../models/Owner');
let ownerIds = new Set();
let ownerNames = {};
async function loadAll() {
  try {
    const docs = await Owner.find({});
    ownerIds = new Set();
    ownerNames = {};
    for (const doc of docs) {
      ownerIds.add(doc.lid);
      ownerNames[doc.lid] = doc.name;
      if (doc.aliases) {
        for (const alias of doc.aliases) {
          ownerIds.add(alias);
        }
      }
    }
    console.log(`[OwnerStore] Loaded ${docs.length} dynamic owners from DB (${ownerIds.size} identifiers).`);
  } catch (err) {
    console.error('[OwnerStore] Failed to load:', err.message);
    ownerIds = new Set();
    ownerNames = {};
  }
}
async function addOwner(primaryId, name, extraIds = []) {
  if (ownerIds.has(primaryId)) return false;
  const allIds = [primaryId, ...extraIds].filter(Boolean);
  for (const id of allIds) {
    ownerIds.add(id);
  }
  ownerNames[primaryId] = name;
  try {
    await Owner.create({
      lid: primaryId,
      aliases: extraIds.filter(id => id !== primaryId),
      name: name || ''
    });
  } catch (err) {
    if (err.code !== 11000) console.error('[OwnerStore] DB Save Error:', err.message);
  }
  return true;
}
async function removeOwner(primaryId) {
  if (!ownerIds.has(primaryId)) return false;
  try {
    const doc = await Owner.findOne({
      $or: [{
        lid: primaryId
      }, {
        aliases: primaryId
      }]
    });
    if (doc) {
      ownerIds.delete(doc.lid);
      delete ownerNames[doc.lid];
      if (doc.aliases) {
        for (const alias of doc.aliases) {
          ownerIds.delete(alias);
        }
      }
      await Owner.deleteOne({
        _id: doc._id
      });
    } else {
      ownerIds.delete(primaryId);
      delete ownerNames[primaryId];
    }
  } catch (err) {
    console.error('[OwnerStore] DB Delete Error:', err.message);
    ownerIds.delete(primaryId);
  }
  return true;
}
function isOwner(id) {
  return ownerIds.has(id);
}
function getAll() {
  return Object.keys(ownerNames);
}
module.exports = {
  loadAll,
  addOwner,
  removeOwner,
  isOwner,
  getAll
};