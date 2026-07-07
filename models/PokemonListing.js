const mongoose = require('mongoose');
const {
  registerUnifiedIdHooks
} = require('../utils/dbHooks');
const pokemonListingSchema = new mongoose.Schema({
  sellerId: {
    type: String,
    required: true
  },
  pokemonEntryId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'PokemonEntry',
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
  price: {
    type: Number,
    required: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});
pokemonListingSchema.index({
  sellerId: 1,
  pokemonName: 1
});
pokemonListingSchema.index({
  pokemonEntryId: 1
});
registerUnifiedIdHooks(pokemonListingSchema);
module.exports = mongoose.model('PokemonListing', pokemonListingSchema);