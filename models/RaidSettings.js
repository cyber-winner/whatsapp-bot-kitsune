const mongoose = require('mongoose');
const raidSettingsSchema = new mongoose.Schema({
  key: {
    type: String,
    required: true,
    unique: true
  },
  value: mongoose.Schema.Types.Mixed
});
module.exports = mongoose.model('RaidSettings', raidSettingsSchema);