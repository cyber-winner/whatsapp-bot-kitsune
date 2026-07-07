require('dotenv').config();
const express = require('express');
const { exec } = require('child_process');
const path = require('path');
const { loadCommands, unloadCategory, reloadCategory } = require('./handlers/commandHandler');
const connectDB = require('./db/connect');
const axios = require('axios');
const http = require('http');
const https = require('https');
const { internalAuthHeaders, requireInternalAuth } = require('./utils/internalAuth');


const config = require('./config');

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

const { PREFIX } = require('./config');

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
            console.error('[MockClient] sendMessage error:', e.message);
            throw e;
        }
    },
    getChatById: async (chatId) => {
        try {
            const res = await waApiClient.post('/api/getChat', { chatId }, { retry: 3, retryDelay: 500 });
            return new MockChat(res.data.chat);
        } catch (e) {
            console.error('[MockClient] getChatById error:', e.message);
            return null;
        }
    },
    getContactById: async (contactId) => {
        try {
            const res = await waApiClient.post('/api/getContact', { contactId }, { retry: 3, retryDelay: 500 });
            const contact = res.data.contact;
            if (contact && contact.lid && contact.number) {
                const { registerMapping } = require('./utils/getUserId');
                registerMapping(contact.lid, contact.number);
            }
            return contact;
        } catch (e) {
            console.error('[MockClient] getContactById error:', e.message);
            return null;
        }
    }
};

class MockChat {
    constructor(data) {
        Object.assign(this, data);
    }
    async sendMessage(text, options = {}) {
        const chatId = this.id && this.id._serialized ? this.id._serialized : this.id;
        return mockClient.sendMessage(chatId, text, options);
    }
}

class MockMessage {
    constructor(data) {
        Object.assign(this, data);

        if (!this.id) {
            this.id = { _serialized: data.messageId || 'unknown' };
        }
    }

    async reply(text, chatId, options = {}) {
        try {
            const res = await waApiClient.post('/api/reply', {
                chatId: this.from,
                messageId: this.id._serialized,
                text,
                options
            }, { retry: 3, retryDelay: 500 });
            return { id: { _serialized: res.data.id } };
        } catch (e) {
            console.error('[MockMessage] reply error:', e.message);
            throw e;
        }
    }

    async react(emoji) {
        try {
            await waApiClient.post('/api/react', { messageId: this.id._serialized, emoji }, { retry: 3, retryDelay: 500 });
            return true;
        } catch (e) {
            console.error('[MockMessage] react error:', e.message);
        }
    }

    async getChat() {
        return mockClient.getChatById(this.from);
    }

    async getContact() {
        return mockClient.getContactById(this.author || this.from);
    }

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
        console.warn('[MockMessage] getQuotedMessage() called but not fully implemented over RPC');
        return null;
    }
}

async function startCoreAPI() {
    console.log('🔄 Starting Celestia Core API...');
    await connectDB();

    console.log('📂 Loading database stores into Core API...');
    await require('./store/groupStore').loadAll();
    await require('./store/banStore').loadAll();
    await require('./store/autoreactStore').loadAll();
    await require('./store/knownUserStore').loadAll();
    await require('./store/immuneStore').loadAll();
    await require('./store/ownerStore').loadAll();
    await require('./store/pokemonGroupStore').loadAll();
    await require('./store/tosStore').loadAll();
    console.log('✅ Stores loaded!');

    loadCommands(mockClient);

    try {
        const raidStore = require('./store/raidStore');
        await raidStore.init(mockClient);
        setTimeout(() => {
            raidStore.triggerHourlyRaids(mockClient);
        }, 5000);
        setInterval(() => {
            raidStore.triggerHourlyRaids(mockClient);
        }, 60 * 60 * 1000);
        console.log('[CoreAPI] Raid Engine and Hourly Sync initialized.');
    } catch (e) {
        console.error('[CoreAPI] Raid Engine Init Failed:', e);
    }

    const app = express();
    app.use(express.json({ limit: '50mb' }));

    
    app.use((req, res, next) => {
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type,Authorization');
        if (req.method === 'OPTIONS') return res.sendStatus(204);
        next();
    });



    const apiManager = require('./store/apiManager');

    for (const [category, cmds] of mockClient.categories.entries()) {
        const router = express.Router();
        router.use(requireInternalAuth);

        router.post('/execute', async (req, res) => {
            if (!apiManager.isServiceEnabled(category)) {
                return res.json({ success: true, executed: false, disabled: true });
            }

            const { message, isGroup, args, commandName } = req.body;
            if (message.botId) {
                mockClient.info.wid.user = message.botId;
            }

            const msg = new MockMessage(message);
            const command = mockClient.commands.get(commandName);

            if (!command || command.localOnly) {
                return res.json({ success: true, executed: false });
            }

            try {
                command.execute(msg, args, mockClient).catch(async (err) => {
                    console.error(`[${category.toUpperCase()} API] Async Error [${commandName}]:`, err);
                    try { await msg.reply(`❌ ${category.toUpperCase()} API Error: ${err.message}`); } catch (e) { }
                });
                return res.json({ success: true, executed: true });
            } catch (err) {
                console.error(`[${category.toUpperCase()} API] Sync Error [${commandName}]:`, err);
                return res.status(500).json({ error: err.message });
            }
        });

        app.use(`/api/${category}`, router);
        console.log(`[CoreAPI] Mounted internal module: /api/${category}`);
    }

    app.post('/api/service-control', requireInternalAuth, async (req, res) => {
        const { action, service } = req.body;
        if (action === 'stop') {
            const success = apiManager.stopService(service);
            return res.json({ success });
        } else if (action === 'start') {
            const success = apiManager.startService(service);
            return res.json({ success });
        } else if (action === 'status') {
            return res.json({ status: apiManager.getStatuses() });
        }
        res.json({ success: false });
    });


    app.post('/api/control-centre/execute', (req, res) => {
        const { password, action, service, targetState } = req.body;

        if (!process.env.CONTROL_CENTRE_PASSWORD || password !== process.env.CONTROL_CENTRE_PASSWORD) {
            return res.status(401).json({ error: 'Unauthorized' });
        }

        switch (action) {
            case 'verify':
                return res.json({ success: true });
            case 'get-services':
                const statuses = apiManager.getStatuses();
                const details = {};
                for (const cat of Object.keys(statuses)) {
                    details[cat] = {
                        enabled: statuses[cat],
                        commandsCount: statuses[cat] && mockClient.categories.has(cat)
                            ? mockClient.categories.get(cat).length
                            : 0
                    };
                }
                return res.json({ services: details });
            case 'api-toggle':
                let msg = '';
                if (targetState) {
                    apiManager.startService(service);
                    reloadCategory(mockClient, service);
                    msg = `Enabled ${service}. Re-allocated memory.`;
                } else {
                    const memBefore = process.memoryUsage().heapUsed;
                    apiManager.stopService(service);
                    unloadCategory(mockClient, service);
                    if (global.gc) {
                        global.gc();
                    }
                    const memAfter = process.memoryUsage().heapUsed;
                    const freed = ((memBefore - memAfter) / 1024 / 1024).toFixed(2);
                    msg = `Disabled ${service}. Released ${freed} MB of RAM!`;
                }
                return res.json({ success: true, message: msg });
            default:
                return res.json({ success: false, error: 'Unknown action in core-api proxy' });
        }
    });

    const PORT = config.CORE_API_PORT;
    app.listen(PORT, config.API_HOST, () => {
        console.log(`=========================================`);
        console.log(`🚀 Celestia Core API is ONLINE`);
        console.log(`📡 Listening for Webhooks on ${config.API_HOST}:${PORT}`);
        console.log(`=========================================`);
    });
}

startCoreAPI();
