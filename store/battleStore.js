const activeBattles = new Map();
const pendingInputs = new Map();
function createBattle(groupId, fighter1, fighter2) {
  const firstTurn = Math.random() < 0.5 ? 1 : 2;
  const battle = {
    groupId,
    fighter1,
    fighter2,
    turn: firstTurn,
    phase: 'attack',
    round: 1,
    lastAction: null,
    defenceCooldown: {
      1: false,
      2: false
    },
    moveCooldowns: {
      1: {},
      2: {}
    },
    isWager: false,
    startedAt: Date.now()
  };
  activeBattles.set(groupId, battle);
  return battle;
}
function getBattle(groupId) {
  return activeBattles.get(groupId) || null;
}
function deleteBattle(groupId) {
  activeBattles.delete(groupId);
  clearPendingInput(groupId);
}
function setPendingInput(groupId, expectedUserId, resolve, timeoutMs = 60000) {
  clearPendingInput(groupId);
  const timer = setTimeout(() => {
    const pending = pendingInputs.get(groupId);
    if (pending) {
      pendingInputs.delete(groupId);
      pending.resolve({
        type: 'timeout'
      });
    }
  }, timeoutMs);
  pendingInputs.set(groupId, {
    resolve,
    expectedUserId,
    timer
  });
}
function clearPendingInput(groupId) {
  const pending = pendingInputs.get(groupId);
  if (pending) {
    clearTimeout(pending.timer);
    pendingInputs.delete(groupId);
  }
}
function handleBattleInput(groupId, userId, body) {
  const battle = activeBattles.get(groupId);
  if (!battle) return false;
  const pending = pendingInputs.get(groupId);
  if (!pending) return false;
  if (pending.expectedUserId !== userId) return false;
  const lower = body.toLowerCase().trim();
  if (lower.startsWith('-attack')) {
    const moveName = lower.slice(7).trim();
    pendingInputs.delete(groupId);
    clearTimeout(pending.timer);
    pending.resolve({
      type: 'attack',
      moveName
    });
    return true;
  }
  if (lower === '-defence' || lower === '-defense') {
    pendingInputs.delete(groupId);
    clearTimeout(pending.timer);
    pending.resolve({
      type: 'defence'
    });
    return true;
  }
  return false;
}
module.exports = {
  createBattle,
  getBattle,
  deleteBattle,
  setPendingInput,
  clearPendingInput,
  handleBattleInput,
  activeBattles
};