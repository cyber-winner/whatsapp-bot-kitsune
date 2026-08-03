/**
 * baileysCompat.js — Compatibility shim for migrating from whatsapp-web.js to Baileys.
 *
 * Exposes a wwebjs-like API surface so that existing event handlers, commands,
 * and stores can remain largely unchanged.
 */

const fs = require('fs');
const path = require('path');
const axios = require('axios');
const EventEmitter = require('events');

const groupMetadataCache = new Map();

// ─── MessageMedia Shim ──────────────────────────────────────────────
// Mimics the whatsapp-web.js MessageMedia class used throughout the codebase.
class MessageMedia {
    /**
     * @param {string} mimetype  e.g. 'image/png', 'video/mp4'
     * @param {string} data      Base64-encoded file content
     * @param {string} [filename]
     * @param {number} [filesize]
     */
    constructor(mimetype, data, filename, filesize) {
        this.mimetype = mimetype;
        this.data = data;
        this.filename = filename || null;
        this.filesize = filesize || null;
    }

    /** Read a local file into a MessageMedia instance. */
    static fromFilePath(filePath) {
        const absolutePath = path.resolve(filePath);
        const data = fs.readFileSync(absolutePath).toString('base64');
        const ext = path.extname(absolutePath).slice(1).toLowerCase();
        const mimeMap = {
            png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg',
            gif: 'image/gif', webp: 'image/webp', mp4: 'video/mp4',
            mp3: 'audio/mpeg', ogg: 'audio/ogg', pdf: 'application/pdf',
        };
        const mimetype = mimeMap[ext] || 'application/octet-stream';
        return new MessageMedia(mimetype, data, path.basename(absolutePath));
    }

    /** Download a URL into a MessageMedia instance. */
    static async fromUrl(url) {
        const res = await axios.get(url, { responseType: 'arraybuffer', timeout: 30000 });
        const data = Buffer.from(res.data).toString('base64');
        const contentType = res.headers['content-type'] || 'application/octet-stream';
        const mimetype = contentType.split(';')[0].trim();
        const urlPath = new URL(url).pathname;
        const filename = path.basename(urlPath) || 'download';
        return new MessageMedia(mimetype, data, filename);
    }

    /** Convert to a Baileys-compatible content object for sendMessage(). */
    toBaileysContent(options = {}) {
        const buf = Buffer.from(this.data, 'base64');
        const mt = this.mimetype || '';

        if (mt.startsWith('image/')) {
            return {
                image: buf,
                mimetype: mt,
                caption: options.caption || undefined,
                mentions: options.mentions || undefined,
            };
        }
        if (mt.startsWith('video/')) {
            return {
                video: buf,
                mimetype: mt,
                caption: options.caption || undefined,
                gifPlayback: options.sendVideoAsGif || false,
                mentions: options.mentions || undefined,
            };
        }
        if (mt.startsWith('audio/')) {
            return {
                audio: buf,
                mimetype: mt,
                ptt: options.ptt || false,
            };
        }
        // Fallback: send as document
        return {
            document: buf,
            mimetype: mt,
            fileName: this.filename || 'file',
            caption: options.caption || undefined,
            mentions: options.mentions || undefined,
        };
    }
}

// ─── JID helpers ────────────────────────────────────────────────────
function toJid(id) {
    if (!id) return id;
    if (id.includes('@')) return id;
    return `${id}@s.whatsapp.net`;
}

function toGroupJid(id) {
    if (!id) return id;
    if (id.includes('@g.us')) return id;
    return `${id}@g.us`;
}

/** Convert a Baileys JID to wwebjs-style serialized id. */
function jidToSerialized(jid) {
    if (!jid) return '';
    // Baileys uses @s.whatsapp.net for users, wwebjs used @c.us
    return jid.replace('@s.whatsapp.net', '@c.us');
}

/** Convert a wwebjs-style id to a Baileys JID. */
function serializedToJid(serialized) {
    if (!serialized) return '';
    let jid = serialized;
    if (jid.includes('@c.us')) jid = jid.replace('@c.us', '@s.whatsapp.net');
    
    // Pass LID directly without converting to phone number
    // because some users in communities can only be messaged via their LID.
    
    return jid;
}

/** Extract user number from any JID format. */
function extractUser(jid) {
    if (!jid) return '';
    return jid.split('@')[0].split(':')[0];
}

// ─── Contact Wrapper ────────────────────────────────────────────────
function wrapContact(jid, store, sock) {
    const user = extractUser(jid);
    const serialized = jidToSerialized(jid);
    const isLid = jid && jid.endsWith('@lid');

    // Try to get contact info from store
    let storeContact = null;
    if (store && store.contacts) {
        storeContact = store.contacts[jid] || store.contacts[serialized] || null;
    }

    return {
        id: {
            user: user,
            _serialized: serialized,
        },
        pushname: storeContact?.pushName || storeContact?.notify || '',
        name: storeContact?.name || storeContact?.verifiedName || '',
        shortName: storeContact?.short || '',
        verifiedName: storeContact?.verifiedName || '',
        number: isLid ? '' : user,
        isGroup: jid ? jid.endsWith('@g.us') : false,

        async getProfilePicUrl() {
            try {
                return await sock.profilePictureUrl(jid, 'image');
            } catch {
                return null;
            }
        },
    };
}

// ─── Chat Wrapper ───────────────────────────────────────────────────
async function wrapChat(jid, sock, store) {
    const isGroup = jid && jid.endsWith('@g.us');
    const serialized = jidToSerialized(jid);
    let _groupMetadata = null;

    const chat = {
        id: { _serialized: serialized },
        name: '',
        isGroup,
        participants: [],

        async sendMessage(content, options = {}) {
            const targetJid = serializedToJid(serialized);

            // If content is a MessageMedia instance
            if (content instanceof MessageMedia) {
                const baileysContent = content.toBaileysContent(options);
                // Convert wwebjs mention format (strings like "123@c.us") to Baileys JIDs
                if (options.mentions && Array.isArray(options.mentions)) {
                    baileysContent.mentions = options.mentions.map(m =>
                        typeof m === 'string' ? serializedToJid(m) : m
                    );
                }
                if (options.quotedMessageId) {
                    baileysContent.quoted = store?.messages?.[targetJid]?.get(options.quotedMessageId) || undefined;
                }
                const sent = await sock.sendMessage(targetJid, baileysContent);
                return wrapSentMessage(sent, targetJid);
            }

            // Plain text
            const baileysContent = { text: String(content) };
            if (options.mentions && Array.isArray(options.mentions)) {
                baileysContent.mentions = options.mentions.map(m =>
                    typeof m === 'string' ? serializedToJid(m) : m
                );
            }
            if (options.quotedMessageId) {
                baileysContent.quoted = store?.messages?.[targetJid]?.get(options.quotedMessageId) || undefined;
            }
            const sent = await sock.sendMessage(targetJid, baileysContent);
            return wrapSentMessage(sent, targetJid);
        },

        async removeParticipants(ids) {
            if (!isGroup) return;
            const jids = ids.map(id => serializedToJid(id));
            await sock.groupParticipantsUpdate(serializedToJid(serialized), jids, 'remove');
        },

        async promoteParticipants(ids) {
            if (!isGroup) return;
            const jids = ids.map(id => serializedToJid(id));
            await sock.groupParticipantsUpdate(serializedToJid(serialized), jids, 'promote');
        },

        async demoteParticipants(ids) {
            if (!isGroup) return;
            const jids = ids.map(id => serializedToJid(id));
            await sock.groupParticipantsUpdate(serializedToJid(serialized), jids, 'demote');
        },
    };

    // Lazy-load group metadata
    if (isGroup) {
        const loadMeta = async () => {
            if (_groupMetadata) return _groupMetadata;
            
            const now = Date.now();
            const cached = groupMetadataCache.get(serialized);
            if (cached && now - cached.timestamp < 5 * 60 * 1000) { // 5 min cache
                _groupMetadata = cached.data;
            } else {
                try {
                    _groupMetadata = await sock.groupMetadata(serializedToJid(serialized));
                    groupMetadataCache.set(serialized, { data: _groupMetadata, timestamp: now });
                } catch (err) {
                    console.warn('[BaileysCompat] Failed to get group metadata:', err.message);
                }
            }
            
            if (_groupMetadata) {
                chat.name = _groupMetadata.subject || '';
                chat.participants = (_groupMetadata.participants || []).map(p => ({
                    id: { _serialized: jidToSerialized(p.id) },
                    isAdmin: p.admin === 'admin' || p.admin === 'superadmin',
                    isSuperAdmin: p.admin === 'superadmin',
                }));
            }
            return _groupMetadata;
        };

        // Pre-load metadata
        await loadMeta();
    }

    return chat;
}

// ─── Message Wrapper ────────────────────────────────────────────────
function wrapMessage(rawMsg, sock, store) {
    const key = rawMsg.key || {};
    const msgContent = rawMsg.message || {};
    const jid = key.remoteJid || '';
    const isGroup = jid.endsWith('@g.us');
    const fromMe = key.fromMe || false;

    // Extract participant (sender in group)
    const participant = key.participant || '';

    // Build `from` (wwebjs style: the chat id)
    const from = jidToSerialized(jid);

    // Build `author` (the actual sender in a group)
    const author = isGroup ? jidToSerialized(participant) : from;

    // Extract body
    const body = extractBody(msgContent);

    // Check for media
    const hasMedia = !!(
        msgContent.imageMessage ||
        msgContent.videoMessage ||
        msgContent.audioMessage ||
        msgContent.documentMessage ||
        msgContent.stickerMessage
    );

    // Check for quoted message
    const contextInfo = extractContextInfo(msgContent);
    const hasQuotedMsg = !!(contextInfo && contextInfo.quotedMessage);

    // Build msg.id compatible object
    const msgId = key.id || '';
    const serializedId = `${fromMe ? 'true' : 'false'}_${from}_${msgId}`;

    // Message timestamp
    const timestamp = rawMsg.messageTimestamp
        ? (typeof rawMsg.messageTimestamp === 'object'
            ? rawMsg.messageTimestamp.low || rawMsg.messageTimestamp.toNumber?.() || 0
            : Number(rawMsg.messageTimestamp))
        : Math.floor(Date.now() / 1000);

    // Type
    const type = hasMedia
        ? (msgContent.imageMessage ? 'image' :
           msgContent.videoMessage ? 'video' :
           msgContent.audioMessage ? 'audio' :
           msgContent.documentMessage ? 'document' :
           msgContent.stickerMessage ? 'sticker' : 'chat')
        : 'chat';

    const msg = {
        id: { _serialized: serializedId, id: msgId },
        from,
        author,
        body,
        fromMe,
        hasMedia,
        hasQuotedMsg,
        timestamp,
        type,
        // Keep raw data accessible for edge cases
        _data: { quotedMsg: hasQuotedMsg ? { body: extractBody(contextInfo.quotedMessage) } : null },
        _rawKey: key,
        _rawMsg: rawMsg,

        async getChat() {
            return wrapChat(jid, sock, store);
        },

        async getContact() {
            const senderJid = isGroup ? participant : jid;
            return wrapContact(senderJid, store, sock);
        },

        async getMentions() {
            if (!contextInfo || !contextInfo.mentionedJid) return [];
            return contextInfo.mentionedJid.map(mJid => wrapContact(mJid, store, sock));
        },

        async getQuotedMessage() {
            if (!hasQuotedMsg) return null;
            const quotedBody = extractBody(contextInfo.quotedMessage);
            // Build a minimal quoted message wrapper
            return {
                id: { _serialized: contextInfo.stanzaId || '' },
                from,
                body: quotedBody,
                fromMe: contextInfo.participant ? false : true,
                hasMedia: !!(
                    contextInfo.quotedMessage?.imageMessage ||
                    contextInfo.quotedMessage?.videoMessage ||
                    contextInfo.quotedMessage?.audioMessage ||
                    contextInfo.quotedMessage?.documentMessage
                ),
                type: 'chat',
            };
        },

        async reply(text, chatId, options = {}) {
            const targetJid = serializedToJid(jid);
            if (text instanceof MessageMedia) {
                const baileysContent = text.toBaileysContent(options);
                baileysContent.quoted = rawMsg;
                const sent = await sock.sendMessage(targetJid, baileysContent);
                return wrapSentMessage(sent, targetJid);
            }
            const sent = await sock.sendMessage(targetJid, {
                text: String(text),
                mentions: options.mentions ? options.mentions.map(m => typeof m === 'string' ? serializedToJid(m) : m) : undefined,
            }, { quoted: rawMsg });
            return wrapSentMessage(sent, targetJid);
        },

        async react(emoji) {
            const targetJid = serializedToJid(jid);
            await sock.sendMessage(targetJid, {
                react: { text: emoji, key: key }
            });
        },

        async downloadMedia() {
            if (!hasMedia) return null;
            const { downloadMediaMessage } = require('@whiskeysockets/baileys');
            try {
                const buffer = await downloadMediaMessage(rawMsg, 'buffer', {});
                const mediaMsg = msgContent.imageMessage || msgContent.videoMessage ||
                                 msgContent.audioMessage || msgContent.documentMessage ||
                                 msgContent.stickerMessage;
                const mimetype = mediaMsg?.mimetype || 'application/octet-stream';
                const data = buffer.toString('base64');
                return new MessageMedia(mimetype, data, mediaMsg?.fileName || 'media');
            } catch (err) {
                console.error('[BaileysCompat] downloadMedia failed:', err.message);
                return null;
            }
        },
    };

    return msg;
}

// ─── Sent message wrapper ───────────────────────────────────────────
function wrapSentMessage(sent, jid) {
    if (!sent) return null;
    const key = sent.key || {};
    return {
        id: {
            _serialized: `true_${jidToSerialized(jid)}_${key.id || ''}`,
            id: key.id || '',
        },
        key: sent.key,
    };
}

// ─── Body extraction helpers ────────────────────────────────────────
function extractBody(msgContent) {
    if (!msgContent) return '';
    return (
        msgContent.conversation ||
        msgContent.extendedTextMessage?.text ||
        msgContent.imageMessage?.caption ||
        msgContent.videoMessage?.caption ||
        msgContent.documentMessage?.caption ||
        msgContent.buttonsResponseMessage?.selectedDisplayText ||
        msgContent.listResponseMessage?.singleSelectReply?.selectedRowId ||
        msgContent.templateButtonReplyMessage?.selectedId ||
        ''
    );
}

function extractContextInfo(msgContent) {
    if (!msgContent) return null;
    return (
        msgContent.extendedTextMessage?.contextInfo ||
        msgContent.imageMessage?.contextInfo ||
        msgContent.videoMessage?.contextInfo ||
        msgContent.audioMessage?.contextInfo ||
        msgContent.documentMessage?.contextInfo ||
        msgContent.stickerMessage?.contextInfo ||
        msgContent.conversation?.contextInfo ||
        null
    );
}

// ─── Client Wrapper ─────────────────────────────────────────────────
/**
 * Wraps a Baileys socket to expose a wwebjs-like client interface.
 * All existing code that does `client.sendMessage()`, `client.getContacts()`,
 * `client.on('message_create', ...)` etc. continues to work.
 */
function wrapSocket(sock, store) {
    const emitter = new EventEmitter();
    emitter.setMaxListeners(50);

    const botJid = sock.user?.id || '';
    const botUser = extractUser(botJid);
    const botSerialized = jidToSerialized(botJid);

    const client = {
        // ── Mimic wwebjs client.info ──
        info: {
            wid: {
                user: botUser,
                _serialized: botSerialized,
            },
            pushname: sock.user?.name || 'Kitsune',
        },

        // ── Command maps (populated by commandHandler.js) ──
        commands: new Map(),
        categories: new Map(),

        // ── EventEmitter interface ──
        on: (event, fn) => emitter.on(event, fn),
        once: (event, fn) => emitter.once(event, fn),
        emit: (event, ...args) => emitter.emit(event, ...args),
        removeAllListeners: (event) => emitter.removeAllListeners(event),

        // ── Core messaging ──
        async sendMessage(chatId, content, options = {}) {
            const targetJid = serializedToJid(chatId);

            if (content instanceof MessageMedia) {
                const baileysContent = content.toBaileysContent(options);
                if (options.mentions && Array.isArray(options.mentions)) {
                    baileysContent.mentions = options.mentions.map(m =>
                        typeof m === 'string' ? serializedToJid(m) : m
                    );
                }
                if (options.quotedMessageId) {
                    // Try to find the quoted message in the store
                    baileysContent.quoted = store?.messages?.[targetJid]?.get(options.quotedMessageId) || undefined;
                }
                const sent = await sock.sendMessage(targetJid, baileysContent);
                return wrapSentMessage(sent, targetJid);
            } else if (typeof content === 'object' && content !== null) {
                const baileysContent = { ...content };
                if (options.mentions && Array.isArray(options.mentions)) {
                    baileysContent.mentions = options.mentions.map(m =>
                        typeof m === 'string' ? serializedToJid(m) : m
                    );
                }
                if (options.quotedMessageId) {
                    baileysContent.quoted = store?.messages?.[targetJid]?.get(options.quotedMessageId) || undefined;
                }
                const sent = await sock.sendMessage(targetJid, baileysContent);
                return wrapSentMessage(sent, targetJid);
            }

            const baileysContent = { text: String(content) };
            if (options.mentions && Array.isArray(options.mentions)) {
                baileysContent.mentions = options.mentions.map(m =>
                    typeof m === 'string' ? serializedToJid(m) : m
                );
            }
            if (options.quotedMessageId) {
                baileysContent.quoted = store?.messages?.[targetJid]?.get(options.quotedMessageId) || undefined;
            }
            const sent = await sock.sendMessage(targetJid, baileysContent);
            return wrapSentMessage(sent, targetJid);
        },

        async getContacts() {
            if (!store || !store.contacts) return [];
            return Object.entries(store.contacts).map(([jid, contact]) =>
                wrapContact(jid, store, sock)
            );
        },

        async getContactById(id) {
            const jid = serializedToJid(id);
            return wrapContact(jid, store, sock);
        },

        async getChatById(id) {
            const jid = serializedToJid(id);
            return wrapChat(jid, sock, store);
        },

        async getMessageById(id) {
            // Baileys doesn't have a direct getMessageById, return null
            return null;
        },

        async destroy() {
            sock.end(undefined);
        },

        // Expose the raw Baileys socket for edge cases
        _sock: sock,
        _store: store,
    };

    return { client, emitter };
}

// ─── Exports ────────────────────────────────────────────────────────
module.exports = {
    MessageMedia,
    wrapSocket,
    wrapMessage,
    wrapChat,
    wrapContact,
    toJid,
    toGroupJid,
    jidToSerialized,
    serializedToJid,
    extractUser,
};
