const { pendingVerifications } = require('./linkState');
const { getUserId } = require('../../utils/getUserId');
const fs = require('fs');
const path = require('path');

module.exports = {
    name: 'verify',
    description: 'Verify your OTP to link your account.',
    category: 'utility',
    async execute(message, args, client) {
        if (args.length === 0) {
            return message.reply('Please provide the 6-digit verification code.');
        }

        const isGroup = message.from && message.from.endsWith('@g.us');
        if (!isGroup) {
            return message.reply('For security, you must run this command in the GROUP CHAT where you requested it.');
        }

        const codeInput = args[0].trim();
        const lid = message.author || message.from;
        
        const matchedData = pendingVerifications.get(lid);

        if (!matchedData || matchedData.code !== codeInput || matchedData.expires < Date.now()) {
            return message.reply('Invalid or expired verification code.');
        }

        // OTP is valid!
        const rawLid = lid.split('@')[0].split(':')[0];
        
        try {
            // Write directly to the mapping file so other processes pick it up
            const mappingsFile = path.join(__dirname, '..', '..', 'store-data-for-use', 'lid_mappings.json');
            let mappings = {};
            if (fs.existsSync(mappingsFile)) {
                mappings = JSON.parse(fs.readFileSync(mappingsFile, 'utf8'));
            }
            
            mappings[rawLid] = matchedData.phone;
            fs.writeFileSync(mappingsFile, JSON.stringify(mappings, null, 2));

            pendingVerifications.delete(lid);
            await message.reply(`✅ Successfully linked your account to phone number *${matchedData.phone}*!\n\nYou can now use your Pokémon/Family commands!`);
            
        } catch (e) {
            console.error('[Verify] Failed to write mappings:', e);
            await message.reply('❌ An internal error occurred while saving your link.');
        }
    }
};
