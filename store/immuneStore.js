const { OWNER_NAME } = require('../config');
const ImmuneUser = require('../models/ImmuneUser');
let immuneUsers = {};
async function loadAll() {
  try {
    const users = await ImmuneUser.find({});
    immuneUsers = {};
    for (const u of users) {
      immuneUsers[u.lid] = {
        name: u.name,
        grantedBy: u.grantedBy || OWNER_NAME
      };
    }
    console.log(`[ImmuneStore] Loaded ${Object.keys(immuneUsers).length} immune users from DB.`);
  } catch (err) {
    console.error('[ImmuneStore] Failed to load:', err.message);
    immuneUsers = {};
  }
}
async function grantImmune(lid, name, grantedBy) {
  if (immuneUsers[lid]) return false;
  immuneUsers[lid] = {
    name,
    grantedBy: grantedBy || OWNER_NAME
  };
  try {
    await ImmuneUser.create({
      lid,
      name: name || '',
      grantedBy: grantedBy || OWNER_NAME
    });
  } catch (err) {
    if (err.code !== 11000) console.error('[ImmuneStore] DB Save Error:', err.message);
  }
  return true;
}
async function removeImmune(lid) {
  if (!immuneUsers[lid]) return false;
  delete immuneUsers[lid];
  try {
    await ImmuneUser.deleteOne({
      lid
    });
  } catch (err) {
    console.error('[ImmuneStore] DB Delete Error:', err.message);
  }
  return true;
}
async function toggleImmune(lid, name, grantedBy) {
  if (immuneUsers[lid]) {
    return {
      immune: false,
      removed: await removeImmune(lid)
    };
  } else {
    return {
      immune: true,
      added: await grantImmune(lid, name, grantedBy)
    };
  }
}
function isImmune(lid) {
  return !!immuneUsers[lid];
}
function getGrantedBy(lid) {
  return immuneUsers[lid]?.grantedBy || OWNER_NAME;
}
module.exports = {
  loadAll,
  grantImmune,
  removeImmune,
  toggleImmune,
  isImmune,
  getGrantedBy
};