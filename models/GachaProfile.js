const mongoose = require('mongoose');
const {
  registerUnifiedIdHooks
} = require('../utils/dbHooks');
const gachaProfileSchema = new mongoose.Schema({
  userId: {
    type: String,
    required: true,
    unique: true
  },
  pity5: {
    type: Number,
    default: 0
  },
  pity4: {
    type: Number,
    default: 0
  },
  guaranteed5: {
    type: Boolean,
    default: false
  },
  totalWishes: {
    type: Number,
    default: 0
  },
  total5Stars: {
    type: Number,
    default: 0
  },
  total4Stars: {
    type: Number,
    default: 0
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});
registerUnifiedIdHooks(gachaProfileSchema);
module.exports = mongoose.model('GachaProfile', gachaProfileSchema);