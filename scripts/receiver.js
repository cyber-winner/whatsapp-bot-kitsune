const express = require('express');
const fs = require('fs');
const path = require('path');
const { requireInternalAuth } = require('../utils/internalAuth');
const app = express();
const PORT = 3200;

app.use(express.json({ limit: '100mb' }));

const BASE_DIR = path.join(__dirname, '../global-messages');

function getIST() {
  const now = new Date();
  const dateOpts = { timeZone: 'Asia/Kolkata', day: '2-digit', month: '2-digit', year: 'numeric' };
  const timeOpts = { timeZone: 'Asia/Kolkata', hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' };
  const dateStr = now.toLocaleDateString('en-GB', dateOpts).replace(/\//g, '-');
  const timeStr = now.toLocaleTimeString('en-GB', timeOpts);
  return { full: `${dateStr} ${timeStr}`, date: dateStr, time: timeStr };
}

function getSafeFilename(name, fallback) {
  if (!name) return fallback;
  
  let safe = name.replace(/[/\\?%*:|"<>]/g, '-').replace(/\.\.+/g, '.').trim();
  return safe || fallback;
}

function getContext(chat) {
    const safeChatName = getSafeFilename(chat.name, chat.id);
    let basePath = chat.isGroup ? path.join(BASE_DIR, 'group') : path.join(BASE_DIR, 'chats', safeChatName);
    
    const messagesDir = path.join(basePath, 'messages');
    let mediaDir = path.join(basePath, 'media');
    
    if (chat.isGroup) {
        mediaDir = path.join(mediaDir, safeChatName);
    }
    
    if (!fs.existsSync(messagesDir)) fs.mkdirSync(messagesDir, { recursive: true });
    if (!fs.existsSync(mediaDir)) fs.mkdirSync(mediaDir, { recursive: true });
    
    const jsonFullPath = path.join(messagesDir, `${safeChatName}.json`);
    return { mediaDir, jsonFullPath };
}

app.post('/api/log', requireInternalAuth, (req, res) => {
    const data = req.body;
    if (!data || typeof data !== 'object') return res.status(400).send('Invalid payload: must be a JSON object');
    if (typeof data.type !== 'string' || !data.type.trim()) return res.status(400).send('Invalid payload: missing or invalid type');
    if (!data.chat || typeof data.chat !== 'object') return res.status(400).send('Invalid payload: missing or invalid chat object');
    if (typeof data.chat.id !== 'string') return res.status(400).send('Invalid payload: missing chat.id');
    
    try {
        const { mediaDir, jsonFullPath } = getContext(data.chat);
        const ist = getIST();
        
        let existingData = [];
        if (fs.existsSync(jsonFullPath)) {
            try { existingData = JSON.parse(fs.readFileSync(jsonFullPath, 'utf8')); } catch(e){}
        }
        
        if (data.type === 'message') {
            let mediaPath = null;
            if (data.media && data.media.data) {
                let mediaFileName = `${data.media.safeSenderName}.${data.media.ext}`;
                let mediaFullPath = path.join(mediaDir, mediaFileName);
                let counter = 1;
                while (fs.existsSync(mediaFullPath)) {
                    mediaFileName = `${data.media.safeSenderName}[${counter}_${ist.date}].${data.media.ext}`;
                    mediaFullPath = path.join(mediaDir, mediaFileName);
                    counter++;
                }
                fs.writeFileSync(mediaFullPath, data.media.data, 'base64');
                mediaPath = mediaFullPath;
            }
            
            const messageData = {
                ...data.message,
                timestamp: ist.full,
                mediaPath: mediaPath,
                isEdited: false,
                msg_before_edit: null,
                msg_after_edit: null
            };
            existingData.push(messageData);
            console.log(`[+] Logged message in ${data.chat.name} from ${data.message.sender}`);
            
        } else if (data.type === 'edit') {
            const msgIndex = existingData.findIndex(m => m.id === data.edit.id);
            if (msgIndex !== -1) {
                existingData[msgIndex].isEdited = true;
                existingData[msgIndex].msg_before_edit = data.edit.oldBody || existingData[msgIndex].body;
                existingData[msgIndex].msg_after_edit = data.edit.newBody;
                existingData[msgIndex].body = data.edit.newBody;
                existingData[msgIndex].edit_timestamp = ist.full;
                console.log(`[~] Logged edit in ${data.chat.name}`);
            }
        }
        
        fs.writeFileSync(jsonFullPath, JSON.stringify(existingData, null, 2));
        res.sendStatus(200);
    } catch (err) {
        console.error('Error processing log payload:', err);
        res.status(500).send('Internal Server Error');
    }
});

app.listen(PORT, () => {
    console.log(`=========================================`);
    console.log(`🚀 Global Receiver Server Started`);
    console.log(`📡 Listening for remote logs on port ${PORT}`);
    console.log(`📂 Saving to: ${BASE_DIR}`);
    console.log(`=========================================`);
});
