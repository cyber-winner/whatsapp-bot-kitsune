const { default: makeWASocket, useMultiFileAuthState } = require('@whiskeysockets/baileys');
const pino = require('pino');
async function start() {
    const { state } = await useMultiFileAuthState('./baileys_auth');
    const sock = makeWASocket({
        auth: state,
        logger: pino({ level: 'silent' })
    });
    sock.ev.on('messages.upsert', ({ messages }) => {
        for (const m of messages) {
            console.log('MSG KEY:', m.key);
            console.log('PARTICIPANT:', m.participant);
            console.log('REMOTE JID:', m.key.remoteJid);
        }
    });
}
start();
