const express = require('express');
const { MessageMedia } = require('whatsapp-web.js');
const { requireInternalAuth } = require('./utils/internalAuth');

function reviveMedia(obj) {
    if (obj && typeof obj === 'object' && obj.mimetype && obj.data) {
        return new MessageMedia(obj.mimetype, obj.data, obj.filename, obj.filesize);
    }
    return obj;
}

function startWaApiServer(client, port = 3300) {
    const app = express();
    app.use(express.json({ limit: '50mb' }));
    app.use('/api', requireInternalAuth);

    app.post('/api/reply', async (req, res) => {
        try {
            if (!req.body || typeof req.body !== 'object') return res.status(400).json({ error: 'Invalid JSON payload' });
            const { chatId, messageId, text, options } = req.body;
            
            if (typeof chatId !== 'string' || !chatId.trim()) return res.status(400).json({ error: 'Missing or invalid chatId' });
            if (text === undefined || text === null) return res.status(400).json({ error: 'Missing text content' });
            if (messageId && typeof messageId !== 'string') return res.status(400).json({ error: 'Invalid messageId' });
            if (options && typeof options !== 'object') return res.status(400).json({ error: 'Invalid options' });
            
            const sendOptions = { ...options };
            if (messageId) {
                sendOptions.quotedMessageId = messageId;
            }
            if (sendOptions.media) sendOptions.media = reviveMedia(sendOptions.media);

            if (sendOptions.mentions && Array.isArray(sendOptions.mentions)) {
                sendOptions.mentions = sendOptions.mentions.map(m => {
                    if (typeof m === 'string') return m;
                    if (m && m.id && m.id._serialized) return m.id._serialized;
                    if (m && typeof m.id === 'string') return m.id;
                    return m;
                });
            }

            const content = reviveMedia(text);
            const sent = await client.sendMessage(chatId, content, sendOptions);
            res.json({ success: true, id: sent.id._serialized });
        } catch (error) {
            console.error('[WA-API] Error in /reply:', error);
            res.status(500).json({ error: error.message });
        }
    });

    app.post('/api/send', async (req, res) => {
        try {
            if (!req.body || typeof req.body !== 'object') return res.status(400).json({ error: 'Invalid JSON payload' });
            const { chatId, text, options } = req.body;
            if (typeof chatId !== 'string' || !chatId.trim()) return res.status(400).json({ error: 'Missing or invalid chatId' });
            if (text === undefined || text === null) return res.status(400).json({ error: 'Missing text content' });
            if (options && typeof options !== 'object') return res.status(400).json({ error: 'Invalid options' });

            const sendOptions = { ...options };
            if (sendOptions.media) sendOptions.media = reviveMedia(sendOptions.media);

            if (sendOptions.mentions && Array.isArray(sendOptions.mentions)) {
                sendOptions.mentions = sendOptions.mentions.map(m => {
                    if (typeof m === 'string') return m;
                    if (m && m.id && m.id._serialized) return m.id._serialized;
                    if (m && typeof m.id === 'string') return m.id;
                    return m;
                });
            }

            const content = reviveMedia(text);
            const sent = await client.sendMessage(chatId, content, sendOptions);
            res.json({ success: true, id: sent.id._serialized });
        } catch (error) {
            console.error('[WA-API] Error in /send:', error);
            res.status(500).json({ error: error.message });
        }
    });

    app.post('/api/react', async (req, res) => {
        try {
            if (!req.body || typeof req.body !== 'object') return res.status(400).json({ error: 'Invalid JSON payload' });
            const { messageId, emoji } = req.body;
            if (typeof messageId !== 'string' || !messageId.trim()) return res.status(400).json({ error: 'Missing or invalid messageId' });
            if (typeof emoji !== 'string' || !emoji.trim()) return res.status(400).json({ error: 'Missing or invalid emoji' });

            const msg = await client.getMessageById(messageId);
            if (!msg) return res.status(404).json({ error: 'Message not found' });

            await msg.react(emoji);
            res.json({ success: true });
        } catch (error) {
            console.error('[WA-API] Error in /react:', error);
            res.status(500).json({ error: error.message });
        }
    });

    app.post('/api/getChat', async (req, res) => {
        try {
            if (!req.body || typeof req.body !== 'object') return res.status(400).json({ error: 'Invalid JSON payload' });
            const { chatId } = req.body;
            if (typeof chatId !== 'string' || !chatId.trim()) return res.status(400).json({ error: 'Missing or invalid chatId' });

            const chat = await client.getChatById(chatId);
            res.json({ 
                success: true, 
                chat: {
                    id: chat.id,
                    name: chat.name,
                    isGroup: chat.isGroup,
                    participants: chat.participants
                }
            });
        } catch (error) {
            console.error('[WA-API] Error in /getChat:', error);
            res.status(500).json({ error: error.message });
        }
    });

    app.post('/api/getContact', async (req, res) => {
        try {
            if (!req.body || typeof req.body !== 'object') return res.status(400).json({ error: 'Invalid JSON payload' });
            const { contactId } = req.body;
            if (typeof contactId !== 'string' || !contactId.trim()) return res.status(400).json({ error: 'Missing or invalid contactId' });

            const contact = await client.getContactById(contactId);
            
            const { registerMapping } = require('./utils/getUserId');
            const serialized = contact.id?._serialized || '';
            const rawId = serialized.split('@')[0];
            const isLid = serialized.endsWith('@lid');
            
            let phoneNumber = contact.number || null;
            if (isLid) {
                if (phoneNumber && rawId !== phoneNumber) {
                    registerMapping(rawId, phoneNumber);
                } else if (typeof client.getContactLidAndPhone === 'function') {
                    try {
                        const resolved = await client.getContactLidAndPhone([serialized]);
                        if (resolved && resolved.length > 0 && resolved[0].pn) {
                            const rawPhone = resolved[0].pn.split('@')[0];
                            if (rawId !== rawPhone) {
                                registerMapping(rawId, rawPhone);
                                phoneNumber = rawPhone;
                            }
                        }
                    } catch (lidErr) {
                        console.error('[WA-API] getContactLidAndPhone failed in /getContact:', lidErr.message);
                    }
                }
            }
            
            res.json({ 
                success: true, 
                contact: {
                    id: contact.id,
                    name: contact.name,
                    pushname: contact.pushname,
                    number: phoneNumber,
                    lid: isLid ? rawId : null
                }
            });
        } catch (error) {
            console.error('[WA-API] Error in /getContact:', error);
            res.status(500).json({ error: error.message });
        }
    });

    app.post('/api/getProfilePic', async (req, res) => {
        try {
            if (!req.body || typeof req.body !== 'object') return res.status(400).json({ error: 'Invalid JSON payload' });
            let { contactId } = req.body;
            if (typeof contactId !== 'string' || !contactId.trim()) return res.status(400).json({ error: 'Missing or invalid contactId' });
            
            if (!contactId.includes('@')) contactId = `${contactId}@c.us`;

            try {
                const contact = await client.getContactById(contactId);
                if (!contact) return res.json({ success: true, url: null });

                const picUrl = await contact.getProfilePicUrl();
                res.json({ success: true, url: picUrl });
            } catch (err) {
                res.json({ success: true, url: null });
            }
        } catch (error) {
            console.error('[WA-API] Error in /getProfilePic:', error);
            res.status(500).json({ error: error.message });
        }
    });

    const host = process.env.API_HOST || '127.0.0.1';
    app.listen(port, host, () => {
        console.log(`[WA-API] Internal WhatsApp RPC Server running on ${host}:${port}`);
    });
}

module.exports = { startWaApiServer };
