const mongoose = require('mongoose');
const activeRaidSchema = new mongoose.Schema({
  boss: {
    id: Number,
    name: String,
    hp: Number,
    maxHp: Number,
    level: Number,
    def: Number,
    atk: Number,
    types: [String],
    attacks: [mongoose.Schema.Types.Mixed],
    cardImage: String
  },
  participants: [{
    userId: String,
    senderName: String,
    pokemonName: String,
    groupName: String,
    damageDealt: Number,
    tries: Number,
    joinOrder: Number,
    fighter: mongoose.Schema.Types.Mixed
  }],
  groupIds: [String],
  createdAt: {
    type: Date,
    default: Date.now
  }
});
module.exports = mongoose.model('ActiveRaid', activeRaidSchema);