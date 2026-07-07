const mongoose = require('mongoose');
const familySchema = new mongoose.Schema({
  userId: {
    type: String,
    required: true,
    unique: true
  },
  spouse: {
    type: String,
    default: null
  },
  proposedBy: {
    type: String,
    default: null
  },
  marriedAt: {
    type: Date,
    default: null
  },
  marriedToCelestia: {
    type: Boolean,
    default: false
  },
  ex_partners: {
    type: [String],
    default: []
  },
  parents: {
    type: [String],
    default: []
  },
  children: {
    type: [String],
    default: []
  },
  adoptionDates: {
    type: Map,
    of: Date,
    default: {}
  },
  disowned: {
    type: [String],
    default: []
  },
  ranAway: {
    type: [String],
    default: []
  },
  forcedSpouse: {
    type: Boolean,
    default: false
  },
  forcedParents: {
    type: [String],
    default: []
  },
  forcedChildren: {
    type: [String],
    default: []
  },
  partner: {
    type: String,
    default: null
  },
  partners: {
    type: [String],
    default: []
  },
  forcedPartners: {
    type: [String],
    default: []
  }
});
module.exports = mongoose.model('Family', familySchema);