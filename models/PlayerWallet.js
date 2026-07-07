const mongoose = require('mongoose');
const {
  registerUnifiedIdHooks
} = require('../utils/dbHooks');
const inventoryItemSchema = new mongoose.Schema({
  itemName: {
    type: String,
    required: true
  },
  quantity: {
    type: Number,
    default: 1
  }
});
const playerWalletSchema = new mongoose.Schema({
  userId: {
    type: String,
    required: true,
    unique: true
  },
  pokecoins: {
    type: Number,
    default: 0
  },
  pokeballs: {
    type: Number,
    default: 20
  },
  radiantCrystals: {
    type: Number,
    default: 0
  },
  inventory: {
    type: [inventoryItemSchema],
    default: []
  },
  lastDaily: {
    type: Date,
    default: null
  },
  lastWeekly: {
    type: Date,
    default: null
  },
  lastSummon: {
    type: Date,
    default: null
  },
  lastMonthly: {
    type: Date,
    default: null
  },
  cdBypass: {
    type: Boolean,
    default: false
  },
  wandBlockSpawns: {
    type: Number,
    default: 0
  },
  diaperModeSpawns: {
    type: Number,
    default: 0
  },
  karenExpiry: {
    type: Date,
    default: null
  },
  lastOmegaDiaperBuy: {
    type: Date,
    default: null
  },
  prestigeLevel: {
    type: Number,
    default: 0
  },
  omegaLevel: {
    type: Number,
    default: 0
  },
  userXP: {
    type: Number,
    default: 0
  },
  totalPrestigeCount: {
    type: Number,
    default: 0
  },
  totalOmegaCount: {
    type: Number,
    default: 0
  },
  tosVersion: {
    type: Number,
    default: 0
  },
  pokemonLocked: {
    type: Boolean,
    default: false
  },
  pokemonLockReason: {
    type: String,
    default: ''
  },
  customTitle: {
    type: String,
    default: null
  },
  titleEmoji: {
    type: String,
    default: '⚜️'
  },
  lastTitleEntrance: {
    type: Date,
    default: null
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});
registerUnifiedIdHooks(playerWalletSchema);
module.exports = mongoose.model('PlayerWallet', playerWalletSchema);