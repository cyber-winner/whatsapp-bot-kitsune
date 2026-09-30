/**
 * wwebjsCompat.js - Clean wrapper and JID helpers for whatsapp-web.js
 *
 * Ensures @lid, @c.us, @s.whatsapp.net, and @g.us JIDs remain intact without illegal string replacements.
 */

const fs = require('fs');
const path = require('path');
const axios = require('axios');
const { MessageMedia } = require('whatsapp-web.js');

function toJid(id) {
    if (!id) return id;
    if (id.includes('@')) return id;
    return `${id}@c.us`;
}

function toGroupJid(id) {
    if (!id) return id;
    if (id.includes('@g.us')) return id;
    return `${id}@g.us`;
}

function jidToSerialized(jid) {
    if (!jid) return '';
    if (jid.endsWith('@lid')) return jid;
    if (jid.endsWith('@g.us')) return jid;
    return jid.replace('@s.whatsapp.net', '@c.us');
}

function serializedToJid(serialized) {
    if (!serialized) return '';
    return serialized;
}

function extractUser(jid) {
    if (!jid) return '';
    return jid.split('@')[0].split(':')[0];
}

module.exports = {
    MessageMedia,
    toJid,
    toGroupJid,
    jidToSerialized,
    serializedToJid,
    extractUser,
};
