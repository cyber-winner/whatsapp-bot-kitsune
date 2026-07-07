const mongoose = require('mongoose');
const pokemonGroupConfigSchema = new mongoose.Schema({
  groupId: {
    type: String,
    required: true,
    unique: true
  },
  isPokemonDisabled: {
    type: Boolean,
    default: false
  },
  spawnMode: {
    type: String,
    default: 'msg'
  }
});
module.exports = mongoose.model('PokemonGroupConfig', pokemonGroupConfigSchema);