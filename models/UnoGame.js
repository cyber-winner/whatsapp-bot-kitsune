const mongoose = require('mongoose');

const playerSchema = new mongoose.Schema({
    id: { type: String, required: true }, // The WhatsApp JID or 'bot_<id>'
    name: { type: String, required: true },
    cards: { type: [String], default: [] },
    isBot: { type: Boolean, default: false }
}, { _id: false });

const unoGameSchema = new mongoose.Schema({
    guildID: { type: String, required: true, unique: true }, // The Group ID (JID)
    status: { type: String, enum: ['waiting', 'playing'], default: 'waiting' },
    gameCreatorID: { type: String, required: true }, // JID of the creator
    players: { type: Map, of: playerSchema, default: {} }, // Map of player objects indexed by ID
    playerOrder: { type: [String], default: [] }, // Array of player IDs representing the turn order
    currentPosition: { type: Number, default: 0 },
    direction: { type: Number, enum: [1, -1], default: 1 },
    deck: { type: [String], default: [] },
    discardPile: { type: [String], default: [] },
    currentCard: { type: String, default: null }, // The active top card
    currentColor: { type: String, default: null }, // R, G, B, Y (for tracking wild card colors)
    stackedCards: { type: Number, default: 0 }, // For draw stacking rules
    gameSettings: {
        StackCards: { type: Boolean, default: false },
        DrawUntilMatch: { type: Boolean, default: false },
        UnoCallout: { type: Boolean, default: true } // Auto call UNO
    }
}, { timestamps: true });

module.exports = mongoose.model('UnoGame', unoGameSchema);
