const Group = require('../models/Group');
let activatedGroups = [];
async function loadAll() {
  try {
    const groups = await Group.find({});
    activatedGroups = groups.map(g => g.groupId);
    console.log(`[GroupStore] Loaded ${activatedGroups.length} groups from DB.`);
  } catch (err) {
    console.error('[GroupStore] Failed to load:', err.message);
    activatedGroups = [];
  }
}
function activateGroup(groupId) {
  if (!activatedGroups.includes(groupId)) {
    activatedGroups.push(groupId);
    Group.create({
      groupId
    }).catch(err => console.error('[GroupStore] DB Save Error:', err.message));
    return true;
  }
  return false;
}
function deactivateGroup(groupId) {
  const idx = activatedGroups.indexOf(groupId);
  if (idx === -1) return false;
  activatedGroups.splice(idx, 1);
  Group.deleteOne({
    groupId
  }).catch(err => console.error('[GroupStore] DB Delete Error:', err.message));
  return true;
}
function isActivated(groupId) {
  return activatedGroups.includes(groupId);
}
module.exports = {
  activateGroup,
  deactivateGroup,
  isActivated,
  loadAll
};