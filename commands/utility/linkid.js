const { pendingVerifications } = require('./linkState');

module.exports = {
    name: 'linkid',
    description: 'Link your current group LID to your old phone number.',
    category: 'utility',
    async execute(message, args, client) {
        const isGroup = message.from && message.from.endsWith('@g.us');
        if (!isGroup) {
            return message.reply('This command can only be used in a group to link your Group ID to your true phone number.');
        }

        if (args.length === 0) {
            return message.reply('Please provide your phone number. Example: `-linkid 919876543210`');
        }

        let phone = args[0].replace(/[^0-9]/g, '');
        if (!phone) {
            return message.reply('Invalid phone number format.');
        }

        const lid = message.author || message.from; 

        // Generate a 6-digit OTP
        const otp = Math.floor(100000 + Math.random() * 900000).toString();

        pendingVerifications.set(lid, {
            phone: phone,
            code: otp,
            expires: Date.now() + 10 * 60 * 1000 // 10 mins
        });

        const targetJid = `${phone}@s.whatsapp.net`;
        const maskedPhone = phone.slice(0, 4) + '****' + phone.slice(-4);
        
        try {
            await client.sendMessage(targetJid, `Your Kitsune Verification Code is: *${otp}*\n\nPlease go back to the *GROUP CHAT* and type:\n\`-verify ${otp}\`\n\nto link your account.`);
            await message.reply(`Verification started!\n\nI have sent a 6-digit OTP code to the number ${maskedPhone} via Direct Message.\n\nPlease check your DMs with the bot, then come back to THIS GROUP and reply with:\n\`-verify [CODE]\``);
        } catch (e) {
            console.error('[LinkID] Failed to send DM:', e);
            await message.reply('Failed to send a DM to that number. Please send a quick "hi" to the bot in DM first to open the channel, then try again!');
            pendingVerifications.delete(lid);
        }
    }
};
