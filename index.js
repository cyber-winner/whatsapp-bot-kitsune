require('dotenv').config();
const config = require('./config');
const vibe = require('vibe-rewards');
if (config.VIBE_REWARDS_API_KEY) {
    vibe.init(config.VIBE_REWARDS_API_KEY);
}
console.log("Hello World");
const {
    default: makeWASocket,
    useMultiFileAuthState,
    DisconnectReason,
    makeCacheableSignalKeyStore,
    fetchLatestBaileysVersion,
} = require('@whiskeysockets/baileys');
const pino = require('pino');
const mongoose = require('mongoose');
const qrcode = require('qrcode-terminal');
const connectDB = require('./db/connect');
const {
    loadCommands
} = require('./handlers/commandHandler');
const {
    registerEvents
} = require('./handlers/eventHandler');
const { startWaApiServer } = require('./wa_api_server');
const { wrapSocket, wrapMessage } = require('./utils/baileysCompat');
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

║  ⋆｡‧˚ʚ🍓ɞ˚‧｡⋆  KITSUNE  ⋆｡‧˚ʚ🍓ɞ˚‧｡⋆   ║
║         v2.0.0 — Baileys Edition           ║

`);

const AUTH_DIR = path.resolve(__dirname, 'baileys_auth');

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

    const { state, saveCreds } = await useMultiFileAuthState(AUTH_DIR);
    const { version } = await fetchLatestBaileysVersion();

    const logger = pino({ level: 'silent' });

    const sock = makeWASocket({
        version,
        auth: {
            creds: state.creds,
            keys: makeCacheableSignalKeyStore(state.keys, logger),
        },
        printQRInTerminal: false,
        logger,
        generateHighQualityLinkPreview: false,
        syncFullHistory: false,
        markOnlineOnConnect: true,
    });

    // Simple in-memory contact store
    const store = { contacts: {} };

    // Save credentials whenever they update
    sock.ev.on('creds.update', saveCreds);

    // Track contacts
    sock.ev.on('contacts.upsert', (contacts) => {
        for (const c of contacts) {
            store.contacts[c.id] = c;
        }
    });
    sock.ev.on('contacts.update', (updates) => {
        for (const u of updates) {
            if (store.contacts[u.id]) {
                Object.assign(store.contacts[u.id], u);
            } else {
                store.contacts[u.id] = u;
            }
        }
    });

    // Connection handling
    let clientWrapper = null;
    let eventsRegistered = false;

    sock.ev.on('connection.update', async (update) => {
        const { connection, lastDisconnect, qr } = update;

        if (qr) {
            console.log('\n📱 Scan this QR code with WhatsApp:\n');
            qrcode.generate(qr, { small: true });
            console.log('\nWaiting for scan...\n');
        }

        if (connection === 'close') {
            const statusCode = lastDisconnect?.error?.output?.statusCode;
            const shouldReconnect = statusCode !== DisconnectReason.loggedOut;

            if (statusCode === DisconnectReason.loggedOut) {
                console.error('❌ Logged out. Clearing auth and exiting...');
                try {
                    fs.rmSync(AUTH_DIR, { recursive: true, force: true });
                } catch (e) {}
                process.exit(1);
            }

            if (shouldReconnect) {
                console.warn(`⚠️ Connection closed (code: ${statusCode}). Reconnecting...`);
                // Restart the connection
                start();
            }
        }

        if (connection === 'open') {
            console.log('🔐 Authenticated successfully.');

            // Create the wwebjs-compatible client wrapper
            const { client, emitter } = wrapSocket(sock, store);
            clientWrapper = client;

            global.BOT_ID = client.info.wid.user;
            console.log('═══════════════════════════════════════');
            console.log('  🌟 Kitsune is ONLINE and ready! 🎀 ⋆ ˚｡⋆୨୧˚');
            console.log(`  📞 Logged in as: ${client.info.pushname} (${client.info.wid.user})`);
            console.log('  💡 Say "Kitsune activate" in a group to enable. ૮ ˶ᵔ ᵕ ᵔ˶ ა');
            console.log('═══════════════════════════════════════\n');

            global.botReadyTimestamp = Date.now();
            console.log('⏳ Chat store warming up (10s grace period)...');

            startWaApiServer(client, config.WA_API_PORT);

            // Build LID↔Phone mappings from contacts
            try {
                const { registerMapping } = require('./utils/getUserId');
                console.log('🔄 Building LID↔Phone mapping from contacts...');
                let mappingCount = 0;
                for (const [jid, contact] of Object.entries(store.contacts)) {
                    const rawId = jid.split('@')[0].split(':')[0];
                    const isLid = jid.endsWith('@lid');
                    const phoneNumber = contact.number || null;
                    if (isLid && phoneNumber && rawId !== phoneNumber) {
                        registerMapping(rawId, phoneNumber);
                        mappingCount++;
                    }
                }
                console.log(`✅ Built ${mappingCount} LID↔Phone mappings from contacts.`);
            } catch (mapErr) {
                console.warn('⚠️  LID mapping build failed:', mapErr.message);
            }

            // Check Kitsune Brain API
            try {
                const personaClient = require('./store/personaClient');
                const alive = await personaClient.isAlive();
                if (alive) {
                    console.log(`🧠 Kitsune Brain API connected at ${personaClient.BRAIN_URL}`);
                } else {
                    console.warn('⚠️  Kitsune Brain API is NOT running! Start it with: pm2 start ecosystem.config.js --only kitsune-brain');
                }
            } catch (peErr) {
                console.warn('⚠️  Could not reach Kitsune Brain API:', peErr.message);
            }

            // Register commands and events (only once)
            if (!eventsRegistered) {
                console.log('📂 Loading commands...\n');
                loadCommands(client);
                registerEvents(client);
                pokemonGroupStore.initialize(client);
                eventsRegistered = true;
            }
        }
    });

    // ── Bridge Baileys events to wwebjs-style events ──

    // messages.upsert → message_create
    sock.ev.on('messages.upsert', ({ messages, type }) => {
        if (!clientWrapper) return;
        for (const rawMsg of messages) {
            // Skip protocol messages (status updates, reactions, etc.)
            if (!rawMsg.message) continue;

            // Skip status broadcasts
            if (rawMsg.key.remoteJid === 'status@broadcast') continue;

            const msg = wrapMessage(rawMsg, sock, store);
            clientWrapper.emit('message_create', msg);
        }
    });

    // messages.update → detect edits and deletes
    sock.ev.on('messages.update', (updates) => {
        if (!clientWrapper) return;
        for (const update of updates) {
            // Message edit detection
            if (update.update?.message) {
                const rawMsg = { ...update, message: update.update.message, key: update.key };
                const msg = wrapMessage(rawMsg, sock, store);
                // Try to get old body from the original message
                const oldBody = ''; // We don't have the old body in Baileys directly
                clientWrapper.emit('message_edit', msg, oldBody);
            }

            // Message delete (revoke) detection
            if (update.update?.messageStubType === 1) {
                // Message was deleted
                // We need the old message content, which we may not have
                // The snipe store caches media proactively, so this should still work
                const revokedMsg = wrapMessage({ key: update.key, message: {} }, sock, store);
                clientWrapper.emit('message_revoke_everyone', revokedMsg, null);
            }
        }
    });

    // group-participants.update → group_join / group_leave
    sock.ev.on('group-participants.update', async (update) => {
        if (!clientWrapper) return;
        const { id: groupJid, participants, action } = update;

        if (action === 'add') {
            const notification = {
                chatId: jidToSerialized(groupJid),
                recipientIds: participants.map(p => jidToSerialized(p)),
            };
            clientWrapper.emit('group_join', notification);
        }
    });

    // Import jidToSerialized for the group event
    const { jidToSerialized } = require('./utils/baileysCompat');

    const shutdown = async signal => {
        console.log(`\n🛑 ${signal} received. Shutting down gracefully...`);
        try {
            sock.end(undefined);
            console.log('✅ WhatsApp client destroyed cleanly.');
        } catch (e) {
            console.warn('⚠️ Client destroy error:', e.message);
        }
        process.exit(0);
    };
    process.on('SIGINT', () => shutdown('SIGINT'));
    process.on('SIGTERM', () => shutdown('SIGTERM'));

    console.log('🔄 Initializing WhatsApp connection...\n');
}
start();