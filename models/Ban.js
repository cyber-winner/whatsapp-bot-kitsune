const mongoose = require('mongoose');
const banSchema = new mongoose.Schema({
  groupId: {
    type: String,
    required: true
  },
  userId: {
    type: String,
    required: true
  }
});
banSchema.index({
  groupId: 1,
  userId: 1
}, {
  unique: true
});
module.exports = mongoose.model('Ban', banSchema);