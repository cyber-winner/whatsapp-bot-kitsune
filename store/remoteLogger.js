const axios = require('axios');
const mime = require('mime-types');
const http = require('http');
const https = require('https');
const { internalAuthHeaders } = require('../utils/internalAuth');

const RECEIVER_URL = process.env.RECEIVER_URL || 'http://localhost:3200';

const loggerClient = axios.create({
    baseURL: RECEIVER_URL,
    headers: internalAuthHeaders(),
    httpAgent: new http.Agent({ keepAlive: true, maxSockets: Infinity, keepAliveMsecs: 1000 }),
    httpsAgent: new https.Agent({ keepAlive: true, maxSockets: Infinity, keepAliveMsecs: 1000 })
});

loggerClient.interceptors.response.use(undefined, async (err) => {
    const config = err.config;
    if (!config || !config.retry) return Promise.reject(err);
    config.__retryCount = config.__retryCount || 0;
    if (config.__retryCount >= config.retry) return Promise.reject(err);
    config.__retryCount += 1;
    await new Promise(r => setTimeout(r, config.retryDelay || 200));
    return loggerClient(config);
});

function getSafeFilename(name, fallback) {
  if (!name) return fallback;
  let safe = name.replace(/[/\\?%*:|"<>]/g, '-').trim();
  return safe || fallback;
}

async function logMessage(msg, client) {
    if (process.platform !== 'win32' && process.env.ENABLE_REMOTE_LOGGING !== 'true') return;
    if (msg.fromMe) return;
    try {
        const chat = await msg.getChat();
        const contact = await msg.getContact();
        
        const senderName = contact.pushname || contact.name || (msg.fromMe ? 'Me' : 'Unknown');
        const senderIdSerialized = msg.author || msg.from;
        const senderNumber = contact.number || senderIdSerialized.split('@')[0];
        const safeSenderName = getSafeFilename(senderName, senderNumber);
        
        let chatName = chat.name || '';
        if (!chatName) chatName = chat.isGroup ? 'Unknown_Group' : 'Unknown_User';
        const chatId = chat.id._serialized.split('@')[0];
        
        let mediaData = null;
        let ext = null;
        if (msg.hasMedia) {
            try {
                const media = await msg.downloadMedia();
                if (media) {
                    mediaData = media.data; 
                    ext = mime.extension(media.mimetype) || 'bin';
                }
            } catch (e) {
                console.warn('[RemoteLogger] Media download skipped/failed:', e.message);
            }
        }
        
        const payload = {
            type: 'message',
            chat: {
                isGroup: chat.isGroup,
                name: chatName,
                id: chatId
            },
            message: {
                id: msg.id._serialized,
                sender: senderName,
                number: senderNumber,
                body: msg.body || '',
                hasMedia: msg.hasMedia,
                groupId: msg.from || null,
                replyTo: msg.hasQuotedMsg ? msg._data?.quotedMsg?.body || null : null,
                isFromBot: msg.fromMe || false,
                epochMs: Date.now()
            },
            media: mediaData ? { data: mediaData, ext, safeSenderName } : null
        };
        
        // Send payload in the background, catch errors to prevent crashing
        loggerClient.post('/api/log', payload, { timeout: 15000, retry: 3, retryDelay: 500 }).catch(e => {
            console.error('[RemoteLogger] Failed to send message to receiver:', e.message);
        });
    } catch(e) {
        console.error('[RemoteLogger Error]', e.message);
    }
}

async function logEdit(newMsg, oldBody) {
    if (process.platform !== 'win32' && process.env.ENABLE_REMOTE_LOGGING !== 'true') return;
    if (newMsg.fromMe) return;
    try {
        const chat = await newMsg.getChat();
        let chatName = chat.name || (chat.isGroup ? 'Unknown_Group' : 'Unknown_User');
        const chatId = chat.id._serialized.split('@')[0];
        
        const payload = {
            type: 'edit',
            chat: {
                isGroup: chat.isGroup,
                name: chatName,
                id: chatId
            },
            edit: {
                id: newMsg.id._serialized,
                oldBody: oldBody || '',
                newBody: newMsg.body || '',
                epochMs: Date.now()
            }
        };
        loggerClient.post('/api/log', payload, { timeout: 15000, retry: 3, retryDelay: 500 }).catch(e => {
            console.error('[RemoteLogger] Failed to send edit to receiver:', e.message);
        });
    } catch(e) {
        console.error('[RemoteLogger Edit Error]', e.message);
    }
}

module.exports = { logMessage, logEdit };
