require('dotenv').config();
const config = require('./config');
const vibe = require('vibe-rewards');
if (config.VIBE_REWARDS_API_KEY) {
    vibe.init(config.VIBE_REWARDS_API_KEY);
}

const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const connectDB = require('./db/connect');
const { loadCommands } = require('./handlers/commandHandler');
const { registerEvents } = require('./handlers/eventHandler');
const { startWaApiServer } = require('./wa_api_server');
const fs = require('fs');
const path = require('path');

const groupStore = require('./store/groupStore');
const banStore = require('./store/banStore');
const autoreactStore = require('./store/autoreactStore');
const knownUserStore = require('./store/knownUserStore');
const immuneStore = require('./store/immuneStore');
const ownerStore = require('./store/ownerStore');
const pokemonGroupStore = require('./store/pokemonGroupStore');
const tosStore = require('./store/tosStore');

console.log(`
║  ⋆｡‧˚ʚ🍓ɞ˚‧｡⋆  DB-LENRAH BOT  ⋆｡‧˚ʚ🍓ɞ˚‧｡⋆   ║
║          v2.0.0 — WhatsApp Web.js            ║
`);

const AUTH_PATH = process.env.WWEBJS_AUTH_PATH || './.wwebjs_auth';

async function start() {
    await connectDB();
    console.log('📂 Loading database stores...');
    await groupStore.loadAll();
    await banStore.loadAll();
    await autoreactStore.loadAll();
    await knownUserStore.loadAll();
    await immuneStore.loadAll();
    await ownerStore.loadAll();
    await pokemonGroupStore.loadAll();
    await tosStore.loadAll();
    console.log('✅ All stores loaded into memory.\n');

    const client = new Client({
        authStrategy: new LocalAuth({ dataPath: AUTH_PATH }),
        puppeteer: {
            headless: true,
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-dev-shm-usage',
                '--disable-accelerated-2d-canvas',
                '--no-first-run',
                '--no-zygote',
                '--disable-gpu'
            ]
        }
    });

    client.on('qr', (qr) => {
        console.log('\n📱 Scan this QR code with WhatsApp:\n');
        qrcode.generate(qr, { small: true });
        console.log('\nWaiting for scan...\n');
    });

    client.on('authenticated', () => {
        console.log('🔐 Authenticated successfully.');
    });

    client.on('auth_failure', (msg) => {
        console.error('❌ Authentication failure:', msg);
    });

    client.on('ready', async () => {
        global.BOT_ID = client.info?.wid?.user || '';
        console.log('═══════════════════════════════════════');
        console.log('  🌟 DB-Lenrah Bot is ONLINE and ready!');
        console.log(`  📞 Logged in as: ${client.info?.pushname || 'DB-Lenrah Bot'} (${client.info?.wid?.user || ''})`);
        console.log('═══════════════════════════════════════\n');

        global.botReadyTimestamp = Date.now();

        try {
            startWaApiServer(client, config.WA_API_PORT || 3300);
        } catch (e) {
            console.warn('⚠️ WA API Server failed to start:', e.message);
        }

        console.log('📂 Loading commands and event handlers...\n');
        loadCommands(client);
        registerEvents(client);
        pokemonGroupStore.initialize(client);
    });

    const shutdown = async signal => {
        console.log(`\n🛑 ${signal} received. Shutting down gracefully...`);
        try {
            await client.destroy();
            console.log('✅ WhatsApp client destroyed cleanly.');
        } catch (e) {
            console.warn('⚠️ Client destroy error:', e.message);
        }
        process.exit(0);
    };

    process.on('SIGINT', () => shutdown('SIGINT'));
    process.on('SIGTERM', () => shutdown('SIGTERM'));

    console.log('🔄 Initializing WhatsApp connection via whatsapp-web.js...\n');
    await client.initialize();
}

start();
