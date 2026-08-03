const fs = require('fs');
const path = require('path');
const { isFather } = require('../../utils/permissions');
const { OWNER_NAME } = require('../../config');
const { getUserId, registerMapping } = require('../../utils/getUserId');

module.exports = {
    name: 'forcelink',
    description: 'Admin command to forcefully link a user LID to a phone number. Usage: -forcelink @user 919876543210',
    category: 'utility',
    async execute(message, args, client) {
        const isFatherUser = await isFather(message, client);
        if (!isFatherUser) {
            return message.reply(`❌ _Only ${OWNER_NAME} can use this command._`);
        }

        if (args.length < 2) {
            return message.reply('❌ Usage: `-forcelink @user [PhoneNumber]`');
        }

        const mentions = await message.getMentions();
        if (mentions.length === 0) {
            return message.reply('❌ You must mention a user to link.');
        }

        let phone = args[args.length - 1].replace(/[^0-9]/g, '');
        if (!phone || phone.length < 10) {
            return message.reply('❌ Could not parse a valid phone number. Make sure to provide it at the end (e.g., `-forcelink @user 919876543210`).');
        }

        const targetContact = mentions[0];
        const rawLid = getUserId(targetContact).split('@')[0].split(':')[0];

        try {
            const mappingsFile = path.join(__dirname, '..', '..', 'store-data-for-use', 'lid_mappings.json');
            let mappings = {};
            if (fs.existsSync(mappingsFile)) {
                mappings = JSON.parse(fs.readFileSync(mappingsFile, 'utf8'));
            }
            
            mappings[rawLid] = phone;
            fs.writeFileSync(mappingsFile, JSON.stringify(mappings, null, 2));

            // Also update the in-memory cache in getUserId if applicable
            registerMapping(rawLid, phone);

            await message.reply(`✅ Successfully force-linked @${rawLid} to *${phone}*!`);
        } catch (e) {
            console.error('[Forcelink] Failed:', e);
            await message.reply('❌ An internal error occurred while saving the link.');
        }
    }
};
