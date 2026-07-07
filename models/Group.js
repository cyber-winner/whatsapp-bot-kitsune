const mongoose = require('mongoose');
const groupSchema = new mongoose.Schema({
  groupId: {
    type: String,
    required: true,
    unique: true
  }
});
module.exports = mongoose.model('Group', groupSchema);