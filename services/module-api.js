
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const express = require('express');
const path = require('path');
const axios = require('axios');
const http = require('http');
const https = require('https');
const fs = require('fs');
const connectDB = require('../db/connect');
const { internalAuthHeaders, requireInternalAuth } = require('../utils/internalAuth');
const config = require('../config');

const CATEGORY = process.argv[2];
const PORT = parseInt(process.argv[3]);

if (!CATEGORY || !PORT) {
    console.error('Usage: node services/module-api.js <category> <port>');
    process.exit(1);
}

const waApiClient = axios.create({
    baseURL: `http://${config.API_HOST}:${config.WA_API_PORT}`,
    headers: internalAuthHeaders(),
    httpAgent: new http.Agent({ keepAlive: true, maxSockets: Infinity, keepAliveMsecs: 1000 }),
    httpsAgent: new https.Agent({ keepAlive: true, maxSockets: Infinity, keepAliveMsecs: 1000 })
});

waApiClient.interceptors.response.use(undefined, async (err) => {
    const config = err.config;
    if (!config || !config.retry) return Promise.reject(err);
    config.__retryCount = config.__retryCount || 0;
    if (config.__retryCount >= config.retry) return Promise.reject(err);
    config.__retryCount += 1;
    await new Promise(r => setTimeout(r, config.retryDelay || 200));
    return waApiClient(config);
});

const mockClient = {
    commands: new Map(),
    categories: new Map(),
    info: {
        wid: { user: 'BOT_ID_PLACEHOLDER' },
        pushname: 'Kitsune'
    },
    sendMessage: async (chatId, text, options = {}) => {
        try {
            const res = await waApiClient.post('/api/send', { chatId, text, options }, { retry: 3, retryDelay: 500 });
            return { id: { _serialized: res.data.id } };
        } catch (e) {
            console.error(`[${CATEGORY}-API] sendMessage error:`, e.message);
            throw e;
        }
    },
    getChatById: async (chatId) => {
        try {
            const res = await waApiClient.post('/api/getChat', { chatId }, { retry: 3, retryDelay: 500 });
            return new MockChat(res.data.chat);
        } catch (e) {
            console.error(`[${CATEGORY}-API] getChatById error:`, e.message);
            return null;
        }
    },
    getContactById: async (contactId) => {
        try {
            const res = await waApiClient.post('/api/getContact', { contactId }, { retry: 3, retryDelay: 500 });
            const contact = res.data.contact;
            if (contact && contact.lid && contact.number) {
                const { registerMapping } = require('../utils/getUserId');
                registerMapping(contact.lid, contact.number);
            }
            return contact;
        } catch (e) {
            console.error(`[${CATEGORY}-API] getContactById error:`, e.message);
            return null;
        }
    }
};

class MockChat {
    constructor(data) { Object.assign(this, data); }
    async sendMessage(text, options = {}) {
        const chatId = this.id && this.id._serialized ? this.id._serialized : this.id;
        return mockClient.sendMessage(chatId, text, options);
    }
}

class MockMessage {
    constructor(data) {
        Object.assign(this, data);
        if (!this.id) this.id = { _serialized: data.messageId || 'unknown' };
    }
    async reply(text, chatId, options = {}) {
        try {
            const res = await waApiClient.post('/api/reply', {
                chatId: this.from, messageId: this.id._serialized, text, options
            }, { retry: 3, retryDelay: 500 });
            return { id: { _serialized: res.data.id } };
        } catch (e) {
            console.error(`[${CATEGORY}-API] reply error:`, e.message);
            throw e;
        }
    }
    async react(emoji) {
        try {
            await waApiClient.post('/api/react', { messageId: this.id._serialized, emoji }, { retry: 3, retryDelay: 500 });
            return true;
        } catch (e) {
            console.error(`[${CATEGORY}-API] react error:`, e.message);
        }
    }
    async getChat() { return mockClient.getChatById(this.from); }
    async getContact() { return mockClient.getContactById(this.author || this.from); }
    async getMentions() {
        if (!this.mentionedIds || !Array.isArray(this.mentionedIds)) return [];
        const mentions = [];
        for (const id of this.mentionedIds) {
            const contactId = typeof id === 'object' ? id._serialized : id;
            const contact = await mockClient.getContactById(contactId);
            if (contact) mentions.push(contact);
        }
        return mentions;
    }
    async getQuotedMessage() {
        console.warn(`[${CATEGORY}-API] getQuotedMessage() not implemented over RPC`);
        return null;
    }
}

function loadCategory(client, activeCategory) {
    client.commands = new Map();
    client.categories = new Map();
    const commandsDir = path.join(__dirname, '..', 'commands');
    if (!fs.existsSync(commandsDir)) {
        console.error(`[${activeCategory}-API] commands/ directory not found!`);
        return;
    }
    const categories = fs.readdirSync(commandsDir).filter(f => fs.statSync(path.join(commandsDir, f)).isDirectory());
    for (const cat of categories) {
        const categoryPath = path.join(commandsDir, cat);
        const commandFiles = fs.readdirSync(categoryPath).filter(f => f.endsWith('.js'));
        const categoryCommands = [];
        for (const file of commandFiles) {
            try {
                const exported = require(path.join(categoryPath, file));
                const commandsToRegister = Array.isArray(exported) ? exported : [exported];
                for (const command of commandsToRegister) {
                    if (!command.name || !command.execute) continue;
                    command.category = cat;
                    client.commands.set(command.name, command);
                    categoryCommands.push(command.name);
                    if (command.aliases && Array.isArray(command.aliases)) {
                        for (const alias of command.aliases) {
                            client.commands.set(alias, command);
                        }
                    }
                    if (cat === activeCategory) {
                        console.log(`  ✓ Loaded: -${command.name} [${cat}]`);
                    }
                }
            } catch (err) {
                console.error(`[${activeCategory}-API] Failed to load ${file} in ${cat}:`, err.message);
            }
        }
        client.categories.set(cat, categoryCommands);
    }
    const activeCommandsCount = client.categories.get(activeCategory)?.length || 0;
    console.log(`\n📦 ${activeCategory.toUpperCase()} Module: ${activeCommandsCount} active commands loaded (with all categories metadata).\n`);
}

async function start() {
    console.log(`\n🔄 Starting Kitsune ${CATEGORY.toUpperCase()} Module API on port ${PORT}...`);

    await connectDB();

    console.log(`📂 Loading stores for ${CATEGORY} module...`);
    await require('../store/groupStore').loadAll();
    await require('../store/banStore').loadAll();
    await require('../store/autoreactStore').loadAll();
    await require('../store/knownUserStore').loadAll();
    await require('../store/immuneStore').loadAll();
    await require('../store/ownerStore').loadAll();
    await require('../store/pokemonGroupStore').loadAll();
    await require('../store/tosStore').loadAll();
    console.log('✅ Stores loaded!');

    loadCategory(mockClient, CATEGORY);

    if (CATEGORY === 'pokemon') {
        try {
            const raidStore = require('../store/raidStore');
            await raidStore.init(mockClient);
            setTimeout(() => raidStore.triggerHourlyRaids(mockClient), 5000);
            setInterval(() => raidStore.triggerHourlyRaids(mockClient), 60 * 60 * 1000);
            console.log(`[${CATEGORY}-API] Raid Engine initialized.`);
        } catch (e) {
            console.error(`[${CATEGORY}-API] Raid Engine Init Failed:`, e);
        }
        try {
            await require('../store/giveawayStore').init(mockClient);
            console.log(`[${CATEGORY}-API] Giveaway Store initialized.`);
        } catch (e) {
            console.error(`[${CATEGORY}-API] Giveaway Store Init Failed:`, e);
        }
    }

    const app = express();
    app.use(express.json({ limit: '50mb' }));

    app.get('/health', (req, res) => {
        res.json({
            module: CATEGORY,
            status: 'online',
            commands: mockClient.categories.get(CATEGORY)?.length || 0,
            uptime: process.uptime()
        });
    });

    app.use(`/api/${CATEGORY}`, requireInternalAuth);

    app.post(`/api/${CATEGORY}/execute`, async (req, res) => {
        if (!req.body || typeof req.body !== 'object') return res.status(400).json({ error: 'Invalid JSON payload' });
        const { message, isGroup, args, commandName } = req.body;

        if (!message || typeof message !== 'object') return res.status(400).json({ error: 'Missing or invalid message object' });
        if (message.from !== undefined && typeof message.from !== 'string') return res.status(400).json({ error: 'message.from must be a string' });
        if (message.body !== undefined && typeof message.body !== 'string') return res.status(400).json({ error: 'message.body must be a string' });
        if (message.author !== undefined && typeof message.author !== 'string') return res.status(400).json({ error: 'message.author must be a string' });
        if (message.botId !== undefined && typeof message.botId !== 'string') return res.status(400).json({ error: 'message.botId must be a string' });
        if (message.mentionedIds !== undefined && !Array.isArray(message.mentionedIds)) return res.status(400).json({ error: 'message.mentionedIds must be an array' });
        if (typeof commandName !== 'string' || !commandName.trim()) return res.status(400).json({ error: 'Missing or invalid commandName' });
        if (!Array.isArray(args)) return res.status(400).json({ error: 'args must be an array' });
        if (!args.every(arg => typeof arg === 'string')) return res.status(400).json({ error: 'All elements in args must be strings' });

        if (message.botId) {
            mockClient.info.wid.user = String(message.botId);
        }

        const msg = new MockMessage(message);
        const command = mockClient.commands.get(commandName);

        if (!command || command.localOnly) {
            return res.json({ success: true, executed: false });
        }

        try {
            command.execute(msg, args, mockClient).catch(async (err) => {
                console.error(`[${CATEGORY.toUpperCase()} API] Async Error [${commandName}]:`, err);
                try { await msg.reply(`❌ ${CATEGORY.toUpperCase()} API Error: ${err.message}`); } catch(e){}
            });
            return res.json({ success: true, executed: true });
        } catch (err) {
            console.error(`[${CATEGORY.toUpperCase()} API] Sync Error [${commandName}]:`, err);
            return res.status(500).json({ error: err.message });
        }
    });

    app.listen(PORT, config.API_HOST, () => {
        console.log(`=========================================`);
        console.log(`🚀 Kitsune ${CATEGORY.toUpperCase()} Module API is ONLINE`);
        console.log(`📡 ${config.API_HOST}:${PORT} | Commands: ${mockClient.categories.get(CATEGORY)?.length || 0}`);
        console.log(`=========================================`);
    });
}

start();
