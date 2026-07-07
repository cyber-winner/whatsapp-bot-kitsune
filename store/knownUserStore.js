const KnownUser = require('../models/KnownUser');
let knownUsers = {};
async function loadAll() {
  try {
    const users = await KnownUser.find({});
    knownUsers = {};
    for (const u of users) {
      knownUsers[u.lid] = u.name;
    }
    console.log(`[KnownUserStore] Loaded ${Object.keys(knownUsers).length} known users from DB.`);
  } catch (err) {
    console.error('[KnownUserStore] Failed to load:', err.message);
    knownUsers = {};
  }
}
async function setUser(lid, name) {
  const isNew = !knownUsers[lid];
  knownUsers[lid] = name;
  try {
    await KnownUser.findOneAndUpdate({
      lid
    }, {
      lid,
      name
    }, {
      upsert: true,
      returnDocument: 'after'
    });
  } catch (err) {
    console.error('[KnownUserStore] DB Save Error:', err.message);
  }
  return isNew;
}
function getName(lid) {
  return knownUsers[lid] || null;
}
function getAll() {
  return {
    ...knownUsers
  };
}
module.exports = {
  loadAll,
  setUser,
  getName,
  getAll
};