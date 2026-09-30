const mongoose = require('mongoose');

const groupSchema = new mongoose.Schema({
  groupId: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  activated: {
    type: Boolean,
    default: true
  },
  antiLink: {
    type: Boolean,
    default: false
  },
  maxWarnings: {
    type: Number,
    default: 3
  },
  actionOnMaxWarnings: {
    type: String,
    enum: ['kick', 'ban', 'warn_only'],
    default: 'kick'
  },
  aiEnabled: {
    type: Boolean,
    default: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model('Group', groupSchema);
