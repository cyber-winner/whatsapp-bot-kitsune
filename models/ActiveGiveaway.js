const mongoose = require('mongoose');
const activeGiveawaySchema = new mongoose.Schema({
  groupId: {
    type: String,
    required: true,
    unique: true
  },
  prize: {
    type: mongoose.Schema.Types.Mixed,
    required: true
  },
  endTime: {
    type: Number,
    required: true
  },
  participants: [{
    userId: {
      type: String,
      required: true
    },
    userName: {
      type: String,
      required: true
    }
  }],
  createdAt: {
    type: Date,
    default: Date.now
  }
});
module.exports = mongoose.model('ActiveGiveaway', activeGiveawaySchema);