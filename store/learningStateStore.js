const fs = require('fs');
const path = require('path');
const dataDir = path.join(__dirname, '../store-data-for-use');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, {
    recursive: true
  });
}
const file = path.join(dataDir, 'learning_state.json');
let disabledGroups = [];
function load() {
  if (fs.existsSync(file)) {
    try {
      disabledGroups = JSON.parse(fs.readFileSync(file, 'utf8'));
    } catch (e) {
      console.error('[LearningStateStore] Failed to parse learning state', e);
    }
  }
}
function save() {
  fs.writeFileSync(file, JSON.stringify(disabledGroups, null, 2));
}
function stopLearning(groupId) {
  if (!disabledGroups.includes(groupId)) {
    disabledGroups.push(groupId);
    save();
    return true;
  }
  return false;
}
function startLearning(groupId) {
  if (disabledGroups.includes(groupId)) {
    disabledGroups = disabledGroups.filter(id => id !== groupId);
    save();
    return true;
  }
  return false;
}
function isLearningDisabled(groupId) {
  return disabledGroups.includes(groupId);
}
load();
module.exports = {
  stopLearning,
  startLearning,
  isLearningDisabled
};