const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  userId: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  name: {
    type: String,
    default: ''
  },
  points: {
    type: Number,
    default: 0,
    index: true
  },
  managedGroups: {
    type: [String],
    default: [],
    validate: [val => val.length <= 2, '{PATH} exceeds the limit of 2 managed groups']
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model('User', userSchema);
