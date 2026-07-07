const mongoose = require('mongoose');
const autoreactSchema = new mongoose.Schema({
  groupId: {
    type: String,
    required: true
  },
  userId: {
    type: String,
    required: true
  },
  emoji: {
    type: String,
    required: true
  }
});
autoreactSchema.index({
  groupId: 1,
  userId: 1
}, {
  unique: true
});
module.exports = mongoose.model('Autoreact', autoreactSchema);