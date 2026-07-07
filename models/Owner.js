const mongoose = require('mongoose');
const ownerSchema = new mongoose.Schema({
  lid: {
    type: String,
    required: true,
    unique: true
  },
  aliases: [{
    type: String
  }],
  name: {
    type: String,
    default: ''
  },
  addedBy: {
    type: String,
    default: ''
  }
});
module.exports = mongoose.model('Owner', ownerSchema);