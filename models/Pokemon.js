const mongoose = require('mongoose');
const {
  registerUnifiedIdHooks
} = require('../utils/dbHooks');
const pokemonEntrySchema = new mongoose.Schema({
  userId: {
    type: String,
    required: true
  },
  pokemonName: {
    type: String,
    required: true
  },
  level: {
    type: Number,
    required: true
  },
  dexId: {
    type: Number
  },
  caughtAt: {
    type: Date,
    default: Date.now
  },
  prestigeStamp: {
    type: Number,
    default: 0
  }
});
pokemonEntrySchema.index({
  userId: 1,
  pokemonName: 1,
  level: 1,
  dexId: 1
});
registerUnifiedIdHooks(pokemonEntrySchema);
module.exports = mongoose.model('PokemonEntry', pokemonEntrySchema);