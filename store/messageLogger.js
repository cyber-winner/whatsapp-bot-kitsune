const fs = require('fs');
const path = require('path');
const mime = require('mime-types');
const BASE_DIR = path.join(__dirname, '../store-data-for-use');
function getIST() {
  const now = new Date();
  const dateOpts = {
    timeZone: 'Asia/Kolkata',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  };
  const timeOpts = {
    timeZone: 'Asia/Kolkata',
    hour12: false,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  };
  const dateStr = now.toLocaleDateString('en-GB', dateOpts).replace(/\//g, '-');
  const timeStr = now.toLocaleTimeString('en-GB', timeOpts);
  return {
    full: `${dateStr} ${timeStr}`,
    date: dateStr,
    time: timeStr
  };
}
function getSafeFilename(name, fallback) {
  if (!name) return fallback;
  let safe = name.replace(/[/\\?%*:|"<>]/g, '-').trim();
  return safe || fallback;
}
function getChatContext(chat) {
  const isGroup = chat.isGroup;
  let chatName = chat.name || '';
  if (!chatName) {
    chatName = isGroup ? 'Unknown_Group' : 'Unknown_User';
  }
  const chatId = chat.id._serialized.split('@')[0];
  const safeChatName = getSafeFilename(chatName, chatId);
  let basePath;
  if (isGroup) {
    basePath = path.join(BASE_DIR, 'group');
  } else {
    basePath = path.join(BASE_DIR, 'chats', safeChatName);
  }
  const messagesDir = path.join(basePath, 'messages');
  let mediaDir = path.join(basePath, 'media');
  if (isGroup) {
    mediaDir = path.join(mediaDir, safeChatName);
  }
  if (!fs.existsSync(messagesDir)) fs.mkdirSync(messagesDir, {
    recursive: true
  });
  if (!fs.existsSync(mediaDir)) fs.mkdirSync(mediaDir, {
    recursive: true
  });
  const jsonFilename = `${safeChatName}.json`;
  const jsonFullPath = path.join(messagesDir, jsonFilename);
  return {
    mediaDir,
    jsonFullPath,
    safeChatName,
    chatId
  };
}
function resolveGroupJsonPath(groupId) {
  const messagesDir = path.join(BASE_DIR, 'group', 'messages');
  if (!fs.existsSync(messagesDir)) return null;
  try {
    const files = fs.readdirSync(messagesDir).filter(f => f.endsWith('.json'));
    const cleanId = groupId.split('@')[0];
    for (const file of files) {
      if (file === `${cleanId}.json`) {
        return path.join(messagesDir, file);
      }
    }
    for (const file of files) {
      const filePath = path.join(messagesDir, file);
      try {
        const content = fs.readFileSync(filePath, 'utf8');
        const data = JSON.parse(content);
        if (Array.isArray(data) && data.length > 0) {
          return filePath;
        }
      } catch (e) {
        continue;
      }
    }
  } catch (e) {
    return null;
  }
  return null;
}
async function logMessage(msg, client) {
  if (msg.fromMe) return;
  if (msg.body && msg.body.startsWith('-')) return;
  try {
    const chat = await msg.getChat();
    const contact = await msg.getContact();
    const senderName = contact.pushname || contact.name || (msg.fromMe ? 'Kitsune' : 'Unknown');
    const senderIdSerialized = msg.author || msg.from;
    const senderNumber = contact.number || senderIdSerialized.split('@')[0];
    const safeSenderName = getSafeFilename(senderName, senderNumber);
    const {
      mediaDir,
      jsonFullPath
    } = getChatContext(chat);
    const ist = getIST();
    let mediaPath = null;
    if (msg.hasMedia) {
      try {
        const media = await msg.downloadMedia();
        if (media) {
          const ext = mime.extension(media.mimetype) || 'bin';
          let mediaFileName = `${safeSenderName}.${ext}`;
          let mediaFullPath = path.join(mediaDir, mediaFileName);
          let counter = 1;
          while (fs.existsSync(mediaFullPath)) {
            mediaFileName = `${safeSenderName}[${counter}_${ist.date}].${ext}`;
            mediaFullPath = path.join(mediaDir, mediaFileName);
            counter++;
          }
          fs.writeFileSync(mediaFullPath, media.data, 'base64');
          mediaPath = mediaFullPath;
        }
      } catch (err) {
        console.warn('[MessageLogger] Failed to download media:', err.message);
      }
    }
    const messageData = {
      id: msg.id._serialized,
      sender: senderName,
      number: senderNumber,
      body: msg.body || '',
      timestamp: ist.full,
      hasMedia: msg.hasMedia,
      mediaPath: mediaPath,
      isEdited: false,
      msg_before_edit: null,
      msg_after_edit: null,
      groupId: msg.from || null,
      replyTo: msg.hasQuotedMsg ? msg._data?.quotedMsg?.body || null : null,
      isFromBot: msg.fromMe || false,
      epochMs: Date.now()
    };
    let existingData = [];
    if (fs.existsSync(jsonFullPath)) {
      try {
        const fileContent = fs.readFileSync(jsonFullPath, 'utf8');
        existingData = JSON.parse(fileContent);
        if (!Array.isArray(existingData)) existingData = [];
      } catch (e) {
        existingData = [];
      }
    }
    existingData.push(messageData);
    fs.writeFileSync(jsonFullPath, JSON.stringify(existingData, null, 2));
  } catch (err) {
    console.error('[MessageLogger] Error logging message:', err);
  }
}
async function logEdit(newMsg, oldBody) {
  if (newMsg.fromMe) return;
  try {
    const chat = await newMsg.getChat();
    const {
      jsonFullPath
    } = getChatContext(chat);
    if (fs.existsSync(jsonFullPath)) {
      let existingData = [];
      try {
        existingData = JSON.parse(fs.readFileSync(jsonFullPath, 'utf8'));
        if (!Array.isArray(existingData)) existingData = [];
      } catch (e) {
        return;
      }
      const msgIndex = existingData.findIndex(m => m.id === newMsg.id._serialized);
      const ist = getIST();
      if (msgIndex !== -1) {
        existingData[msgIndex].isEdited = true;
        existingData[msgIndex].msg_before_edit = oldBody || existingData[msgIndex].body;
        existingData[msgIndex].msg_after_edit = newMsg.body;
        existingData[msgIndex].body = newMsg.body;
        existingData[msgIndex].edit_timestamp = ist.full;
        fs.writeFileSync(jsonFullPath, JSON.stringify(existingData, null, 2));
      }
    }
  } catch (err) {
    console.error('[MessageLogger] Error logging edit:', err);
  }
}
async function getRecentMessages(msg, limit = 15) {
  try {
    const chat = await msg.getChat();
    const {
      jsonFullPath
    } = getChatContext(chat);
    if (fs.existsSync(jsonFullPath)) {
      const fileContent = fs.readFileSync(jsonFullPath, 'utf8');
      let existingData = JSON.parse(fileContent);
      if (!Array.isArray(existingData)) existingData = [];
      return existingData.slice(-limit);
    }
    return [];
  } catch (err) {
    console.error('[MessageLogger] Error fetching recent messages:', err);
    return [];
  }
}
function getRawLogsChunk(groupId, count = 50) {
  try {
    const jsonPath = resolveGroupJsonPath(groupId);
    if (!jsonPath || !fs.existsSync(jsonPath)) return [];
    const fileContent = fs.readFileSync(jsonPath, 'utf8');
    let data = JSON.parse(fileContent);
    if (!Array.isArray(data)) return [];
    return data.slice(-count);
  } catch (err) {
    console.error('[MessageLogger] Error in getRawLogsChunk:', err.message);
    return [];
  }
}
function getDayLogs(groupId) {
  try {
    const jsonPath = resolveGroupJsonPath(groupId);
    if (!jsonPath || !fs.existsSync(jsonPath)) return [];
    const fileContent = fs.readFileSync(jsonPath, 'utf8');
    let data = JSON.parse(fileContent);
    if (!Array.isArray(data)) return [];
    const oneDayAgo = Date.now() - 24 * 60 * 60 * 1000;
    return data.filter(m => {
      if (m.epochMs) return m.epochMs >= oneDayAgo;
      return true;
    });
  } catch (err) {
    console.error('[MessageLogger] Error in getDayLogs:', err.message);
    return [];
  }
}
function getTrackedGroupIds() {
  try {
    const messagesDir = path.join(BASE_DIR, 'group', 'messages');
    if (!fs.existsSync(messagesDir)) return [];
    const files = fs.readdirSync(messagesDir).filter(f => f.endsWith('.json'));
    return files.map(f => f.replace('.json', ''));
  } catch (err) {
    console.error('[MessageLogger] Error in getTrackedGroupIds:', err.message);
    return [];
  }
}
module.exports = {
  logMessage,
  logEdit,
  getRecentMessages,
  getRawLogsChunk,
  getDayLogs,
  getTrackedGroupIds
};