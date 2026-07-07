const mongoose = require('mongoose');
const immuneUserSchema = new mongoose.Schema({
  lid: {
    type: String,
    required: true,
    unique: true
  },
  name: {
    type: String,
    default: ''
  },
  grantedBy: {
    type: String,
    default: 'Cyber'
  }
});
module.exports = mongoose.model('ImmuneUser', immuneUserSchema);