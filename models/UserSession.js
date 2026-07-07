const mongoose = require('mongoose');

const userSessionSchema = new mongoose.Schema({
    token:     { type: String, required: true, unique: true, index: true },
    lid:       { type: String, required: true, index: true },
    expiresAt: { type: Date,   required: true, index: { expires: 0 } }, 
}, { timestamps: false });

module.exports = mongoose.models.UserSession || mongoose.model('UserSession', userSessionSchema);
