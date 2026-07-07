const fs = require('fs');
const path = require('path');
const axios = require('axios');
const memoryFile = path.join(__dirname, '../store-data-for-use/kitsune_memory.json');
let memories = [];
const flushedIds = new Set();
function cosineSimilarity(vecA, vecB) {
  if (vecA.length !== vecB.length) return 0;
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < vecA.length; i++) {
    dotProduct += vecA[i] * vecB[i];
    normA += vecA[i] * vecA[i];
    normB += vecB[i] * vecB[i];
  }
  if (normA === 0 || normB === 0) return 0;
  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

function isWorthEmbedding(text) {
  if (!text || typeof text !== 'string') return false;
  const trimmed = text.trim();
  if (trimmed.length < 10) return false;
  const words = trimmed.split(/\s+/).filter(w => w.length > 0);
  const hasUrl = /https?:\/\/\S+/.test(trimmed);
  const hasCode = /[`{}();=]/.test(trimmed);
  const hasMention = /@\S+/.test(trimmed);
  const hasDate = /\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}/.test(trimmed);
  if (words.length > 5) return true;
  if (hasUrl || hasCode || hasMention || hasDate) return true;
  return false;
}
function isBotMessage(text, sender) {
  if (!text) return false;
  if (sender === 'Kitsune') return true;
  if (text.startsWith('🦊 *Kitsune:*')) return true;
  if (sender === 'PersonaEngine:MemoryFlusher') return false;
  return false;
}
function loadMemories() {
  try {
    if (fs.existsSync(memoryFile)) {
      const data = fs.readFileSync(memoryFile, 'utf8');
      const parsed = JSON.parse(data);
      if (Array.isArray(parsed)) {
        memories = parsed.map((item, idx) => {
          if (typeof item === 'string') {
            return {
              id: `legacy_${idx}`,
              timestamp: Math.floor(Date.now() / 1000),
              speaker: 'Unknown',
              groupId: 'Unknown',
              chatName: 'Private DM',
              userName: 'Unknown User',
              fact: item,
              text: item,
              vector: null,
              flushed: false
            };
          }
          return {
            id: item.id || `legacy_${idx}`,
            timestamp: item.timestamp || Math.floor(Date.now() / 1000),
            speaker: item.userName || item.speaker || 'Unknown',
            groupId: item.groupId || item.chatName || 'Unknown',
            chatName: item.chatName || 'Private DM',
            userName: item.userName || 'Unknown User',
            fact: item.fact || item.text || '',
            text: item.text || item.fact || '',
            vector: item.vector || null,
            flushed: item.flushed || false
          };
        });
      }
    } else {
      memories = [];
    }
    console.log(`[KitsuneMemory] Loaded ${memories.length} facts from Vector DB.`);
  } catch (err) {
    console.error('[KitsuneMemory] Failed to load:', err.message);
    memories = [];
  }
}
function saveMemories() {
  try {
    const dir = path.dirname(memoryFile);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, {
      recursive: true
    });
    fs.writeFileSync(memoryFile, JSON.stringify(memories, null, 2), 'utf8');
  } catch (err) {
    console.error('[KitsuneMemory] Failed to save:', err.message);
  }
}
async function addMemory(fact, chatName, userName, metadata = {}) {
  if (!fact || typeof fact !== 'string') return;
  if (userName !== 'PersonaEngine:MemoryFlusher' && !isWorthEmbedding(fact)) {
    return;
  }
  if (userName !== 'PersonaEngine:MemoryFlusher' && isBotMessage(fact, userName)) {
    return;
  }
  // Quality gate for MemoryFlusher — reject junk/meta fragments
  if (userName === 'PersonaEngine:MemoryFlusher') {
    const trimmed = fact.trim();
    // Too short to be a useful semantic fact
    if (trimmed.length < 25) return;
    // Reject empty markdown headers like "**Example**:", "**What to do**:", "**Notable Details**:"
    if (/^\*\*[^*]+\*\*\s*:?\s*$/.test(trimmed)) return;
    // Reject meta-commentary about how the AI processed the chat
    const metaPrefixes = [
      'don\'t say', 'what to do', 'avoid mistakes', 'skipped minor',
      'prioritized', 'highlighted the', 'avoided over-explaining',
      'use "', 'say "', 'add ', 'note:', '*note*:', 'tip:', '*tip*:'
    ];
    const lowerFact = trimmed.toLowerCase();
    if (metaPrefixes.some(p => lowerFact.startsWith(p))) return;
    // Reject self-referential analysis ("I kept it short", "I used your language")
    if (/^(kept it|used your|no pressure|added gentle|cricket theme)/i.test(trimmed)) return;
  }
  const exists = memories.find(m => m.fact === fact || m.text === fact);
  if (exists) return;
  // We skip embeddings entirely and use keyword search
  const vector = null;
  const memoryObj = {
    id: `mem_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
    timestamp: Math.floor(Date.now() / 1000),
    speaker: metadata.speaker || userName || 'Unknown',
    groupId: metadata.groupId || chatName || 'Unknown',
    chatName: chatName || 'Private DM',
    userName: userName || 'Unknown User',
    replyTo: metadata.replyTo || null,
    fact: fact,
    vector: vector,
    flushed: false
  };
  memories.push(memoryObj);
  saveMemories();
  console.log(`[KitsuneMemory] ✅ Saved new memory to Local Vector DB (total: ${memories.length}).`);
}
async function searchMemories(queryText, topK = 3, groupId = null) {
  if (memories.length === 0) return '';
  
  let pool = memories;
  if (groupId) {
    pool = memories.filter(mem => (mem.groupId === groupId || mem.chatName === groupId || mem.groupId === 'Unknown') && !(mem.groupId && mem.groupId.startsWith('__dataset')));
  } else {
    pool = memories.filter(mem => !(mem.groupId && mem.groupId.startsWith('__dataset')));
  }
  
  const stopWords = new Set([
    'the', 'and', 'a', 'an', 'of', 'to', 'in', 'is', 'you', 'that', 'it', 'he', 'was', 'for', 'on', 'are', 'as', 'with', 
    'his', 'they', 'i', 'at', 'be', 'this', 'have', 'from', 'or', 'one', 'had', 'by', 'word', 'but', 'not', 'what', 
    'all', 'were', 'we', 'when', 'your', 'can', 'said', 'there', 'use', 'an', 'each', 'which', 'she', 'do', 'how', 
    'their', 'if', 'will', 'up', 'other', 'about', 'out', 'many', 'then', 'them', 'these', 'so', 'some', 'her', 
    'would', 'make', 'like', 'him', 'into', 'time', 'has', 'look', 'two', 'more', 'write', 'go', 'see', 'number', 
    'no', 'way', 'could', 'people', 'my', 'than', 'first', 'water', 'been', 'call', 'who', 'oil', 'its', 'now', 
    'find', 'long', 'down', 'day', 'did', 'get', 'come', 'made', 'may', 'part'
  ]);
  
  const queryLower = queryText.toLowerCase();
  const rawWords = queryLower.match(/\b[a-z]{3,}\b/g) || [];
  let keywords = rawWords.filter(w => !stopWords.has(w));
  if (keywords.length === 0) keywords = rawWords;
  if (keywords.length === 0) return '';
  
  const scoredMemories = [];
  for (const mem of pool) {
    const factText = (mem.fact || mem.text || '').toLowerCase();
    let matchCount = 0;
    for (const keyword of keywords) {
      if (new RegExp(`\\b${keyword}\\b`, 'i').test(factText)) {
        matchCount++;
      }
    }
    if (matchCount > 0) {
      scoredMemories.push({
        ...mem,
        score: matchCount / keywords.length
      });
    }
  }
  
  scoredMemories.sort((a, b) => b.score - a.score || (b.timestamp || 0) - (a.timestamp || 0));
  const topMemories = scoredMemories.slice(0, topK);
  if (topMemories.length === 0) return '';
  
  let str = '\n[Relevant Memories (Retrieved via Offline Keyword Search)]:\n';
  str += 'index, timestamp, groupchat, contact name, message\n';
  topMemories.forEach((m, i) => {
    const ts = m.timestamp || Math.floor(Date.now() / 1000);
    const gc = m.chatName || 'Private DM';
    const un = m.userName || m.speaker || 'Unknown User';
    const text = m.fact || m.text;
    str += `${i + 1}. ${ts}, ${gc}, ${un}, ${text}\n`;
  });
  return str;
}
function getUnflushedMemories(groupId) {
  return memories.filter(m => !m.flushed && (m.groupId === groupId || m.chatName === groupId));
}
function markAsFlushed(memoryIds) {
  let count = 0;
  for (const mem of memories) {
    if (memoryIds.includes(mem.id)) {
      mem.flushed = true;
      count++;
    }
  }
  if (count > 0) {
    saveMemories();
    console.log(`[KitsuneMemory] Marked ${count} memories as flushed.`);
  }
}
function getMemoryCount() {
  return memories.length;
}
module.exports = {
  loadMemories,
  addMemory,
  searchMemories,
  getUnflushedMemories,
  markAsFlushed,
  getMemoryCount,
  isWorthEmbedding,
  isBotMessage
};