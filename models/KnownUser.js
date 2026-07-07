const mongoose = require('mongoose');
const knownUserSchema = new mongoose.Schema({
  lid: {
    type: String,
    required: true,
    unique: true
  },
  name: {
    type: String,
    required: true
  }
});
module.exports = mongoose.model('KnownUser', knownUserSchema);