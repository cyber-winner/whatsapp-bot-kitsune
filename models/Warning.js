const mongoose = require('mongoose');

const warningSchema = new mongoose.Schema({
  groupId: {
    type: String,
    required: true,
    index: true
  },
  userId: {
    type: String,
    required: true,
    index: true
  },
  reason: {
    type: String,
    default: 'No reason provided'
  },
  warnedBy: {
    type: String,
    default: 'System'
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

warningSchema.index({ groupId: 1, userId: 1 });

module.exports = mongoose.model('Warning', warningSchema);
