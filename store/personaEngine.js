const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');
const axios = require('axios');
const DB_PATH = path.join(__dirname, '../store-data-for-use/kitsune_persona.db');
const OLLAMA_URL = 'http://localhost:11434/api/generate';
const OLLAMA_MODEL = 'qwen3:4b';
const STYLE_EXTRACT_INTERVAL = 50;
const MEMORY_FLUSH_INTERVAL_MS = 24 * 60 * 60 * 1000;
let db = null;
const messageCounters = new Map();
function initDB() {
  const dir = path.dirname(DB_PATH);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, {
    recursive: true
  });
  db = new Database(DB_PATH);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  db.exec(`
        CREATE TABLE IF NOT EXISTS group_styles (
            group_id TEXT PRIMARY KEY,
            vibe_description TEXT DEFAULT '',
            slang_lexicon TEXT DEFAULT '[]',
            formatting_rules TEXT DEFAULT '[]',
            updated_at TEXT DEFAULT (datetime('now'))
        )
    `);
  db.exec(`
        CREATE TABLE IF NOT EXISTS user_profiles (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            group_id TEXT NOT NULL,
            username TEXT NOT NULL,
            tone TEXT DEFAULT 'Casual',
            emoji_fingerprint TEXT DEFAULT '[]',
            message_pacing TEXT DEFAULT '',
            notable_quirks TEXT DEFAULT '',
            updated_at TEXT DEFAULT (datetime('now')),
            UNIQUE(group_id, username)
        )
    `);
  db.exec(`
        CREATE TABLE IF NOT EXISTS flush_tracker (
            group_id TEXT PRIMARY KEY,
            last_flush_at TEXT DEFAULT (datetime('now'))
        )
    `);
  console.log('[PersonaEngine] SQLite database initialized.');
}
async function queryOllama(prompt, timeoutMs = 120000) {
  try {
    const res = await axios.post(OLLAMA_URL, {
      model: OLLAMA_MODEL,
      prompt: prompt,
      stream: false,
      options: {
        temperature: 0.3,
        num_predict: 2048
      }
    }, {
      timeout: timeoutMs
    });
    return res.data?.response?.trim() || null;
  } catch (err) {
    console.warn('[PersonaEngine] Ollama query failed:', err.message);
    return null;
  }
}
function parseJSONResponse(raw) {
  if (!raw) return null;
  let cleaned = raw.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim();
  try {
    return JSON.parse(cleaned);
  } catch (e) {
    const match = cleaned.match(/\{[\s\S]*\}/);
    if (match) {
      try {
        return JSON.parse(match[0]);
      } catch (e2) {
        console.warn('[PersonaEngine] Failed to parse JSON from Ollama response.');
        return null;
      }
    }
    return null;
  }
}
const STYLE_EXTRACTOR_PROMPT = `SYSTEM: You are a cold, analytical linguistic profiling engine. Your task is to analyze raw chat logs from a private WhatsApp group and extract the collective group dynamic and individual speaking habits. 

Do not write prose. Analyze the text for punctuation choice, capitalization rules, message length, sentence splitting behavior, emoji fingerprints, and slang usage.

CRITICAL INSTRUCTION: You must output a single, valid JSON object following this exact schema. Do not include markdown code block formatting like \`\`\`json.

{
  "group_metadata": {
    "vibe_description": "String describing the overall emotional and social tone",
    "collective_slang_lexicon": ["array", "of", "frequent", "non_standard", "words"],
    "formatting_rules": ["e.g., lowercase only", "never use trailing periods", "split thoughts into 2 texts"]
  },
  "user_profiles": {
    "Username1": {
      "tone": "Casual / Aggressive / Helpful",
      "emoji_fingerprint": ["🔥", "💀"],
      "message_pacing": "Sends single long block vs bursts of 3 short messages",
      "notable_quirks": "Often misspells 'the' as 'teh', uses no capitalization"
    }
  }
}

RAW INPUT LOGS TO ANALYZE:
`;
async function runStyleExtraction(groupId, rawLogs) {
  if (!rawLogs || rawLogs.length === 0) return;
  const filteredLogs = rawLogs.filter(m => {
    if (!m.body) return false;
    if (m.sender === 'Kitsune' || m.body.startsWith('🦊 *Kitsune:*')) return false;
    if (m.body.startsWith('-')) return false;
    return true;
  });
  if (filteredLogs.length < 10) return;
  const logsText = filteredLogs.map(m => {
    return `[${m.timestamp}] ${m.sender}: ${m.body}`;
  }).join('\n');
  const prompt = STYLE_EXTRACTOR_PROMPT + logsText;
  console.log(`[PersonaEngine] Running style extraction for group ${groupId} (${filteredLogs.length} messages)...`);
  const response = await queryOllama(prompt);
  const parsed = parseJSONResponse(response);
  if (!parsed) {
    console.warn('[PersonaEngine] Style extraction returned unparseable data.');
    return;
  }
  if (parsed.group_metadata) {
    const gm = parsed.group_metadata;
    const stmt = db.prepare(`
            INSERT INTO group_styles (group_id, vibe_description, slang_lexicon, formatting_rules, updated_at)
            VALUES (?, ?, ?, ?, datetime('now'))
            ON CONFLICT(group_id) DO UPDATE SET
                vibe_description = excluded.vibe_description,
                slang_lexicon = excluded.slang_lexicon,
                formatting_rules = excluded.formatting_rules,
                updated_at = datetime('now')
        `);
    stmt.run(groupId, gm.vibe_description || '', JSON.stringify(gm.collective_slang_lexicon || []), JSON.stringify(gm.formatting_rules || []));
  }
  if (parsed.user_profiles) {
    const stmt = db.prepare(`
            INSERT INTO user_profiles (group_id, username, tone, emoji_fingerprint, message_pacing, notable_quirks, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, datetime('now'))
            ON CONFLICT(group_id, username) DO UPDATE SET
                tone = excluded.tone,
                emoji_fingerprint = excluded.emoji_fingerprint,
                message_pacing = excluded.message_pacing,
                notable_quirks = excluded.notable_quirks,
                updated_at = datetime('now')
        `);
    for (const [username, profile] of Object.entries(parsed.user_profiles)) {
      stmt.run(groupId, username, profile.tone || 'Casual', JSON.stringify(profile.emoji_fingerprint || []), profile.message_pacing || '', profile.notable_quirks || '');
    }
  }
  console.log(`[PersonaEngine] ✅ Style profile updated for group ${groupId}.`);
}
const MEMORY_FLUSHER_PROMPT = `SYSTEM: You are an advanced memory consolidation agent. Review the day's WhatsApp chat history and extract all core facts, shared links, code snippets, inside jokes, project decisions, and event agreements. Summarize them as discrete, self-contained semantic declarations optimized for vector database indexing.

Ensure every semantic point contains the entities involved so context is not lost when indexed out of chronological order.

OUTPUT FORMAT (one fact per line, each starting with "- "):
- On 2026-06-06, UserA shared a GitHub repository link for an offline P2P chat architecture.
- The group established an inside joke that "cyber" breaks production databases whenever he works past midnight.
- UserB announced they are moving to a new apartment next Tuesday.

RAW CHAT HISTORY:
`;
async function runMemoryFlush(groupId, rawLogs, kitsuneMemory) {
  if (!rawLogs || rawLogs.length === 0) return;
  const filteredLogs = rawLogs.filter(m => {
    if (!m.body) return false;
    if (m.sender === 'Kitsune' || m.body.startsWith('🦊 *Kitsune:*')) return false;
    if (m.body.startsWith('-')) return false;
    return true;
  });
  if (filteredLogs.length < 5) return;
  const logsText = filteredLogs.map(m => {
    return `[${m.timestamp}] ${m.sender}: ${m.body}`;
  }).join('\n');
  const prompt = MEMORY_FLUSHER_PROMPT + logsText;
  console.log(`[PersonaEngine] Running memory flush for group ${groupId} (${filteredLogs.length} messages)...`);
  const response = await queryOllama(prompt, 180000);
  if (!response) {
    console.warn('[PersonaEngine] Memory flusher returned empty response.');
    return;
  }
  const facts = response.split('\n').map(line => line.trim()).filter(line => line.startsWith('- ') || line.startsWith('• ')).map(line => line.replace(/^[-•]\s*/, '').trim()).filter(fact => fact.length > 10);
  if (facts.length === 0) {
    console.warn('[PersonaEngine] No usable facts extracted from memory flush.');
    return;
  }
  console.log(`[PersonaEngine] Extracted ${facts.length} semantic facts. Pushing to Vector DB...`);
  for (const fact of facts) {
    await kitsuneMemory.addMemory(fact, groupId, 'PersonaEngine:MemoryFlusher');
  }
  const stmt = db.prepare(`
        INSERT INTO flush_tracker (group_id, last_flush_at)
        VALUES (?, datetime('now'))
        ON CONFLICT(group_id) DO UPDATE SET last_flush_at = datetime('now')
    `);
  stmt.run(groupId);
  console.log(`[PersonaEngine] ✅ Memory flush complete for group ${groupId}. ${facts.length} facts stored.`);
}
function onMessage(groupId, messageLogger) {
  if (!groupId) return;
  const count = (messageCounters.get(groupId) || 0) + 1;
  messageCounters.set(groupId, count);
  if (count >= STYLE_EXTRACT_INTERVAL) {
    messageCounters.set(groupId, 0);
    (async () => {
      try {
        const rawLogs = messageLogger.getRawLogsChunk(groupId, STYLE_EXTRACT_INTERVAL);
        await runStyleExtraction(groupId, rawLogs);
      } catch (err) {
        console.error('[PersonaEngine] Style extraction error:', err.message);
      }
    })();
  }
}
function startMemoryFlusher(messageLogger, kitsuneMemory) {
  console.log('[PersonaEngine] Memory flusher scheduled (every 24h).');
  const flushAll = async () => {
    try {
      const groups = messageLogger.getTrackedGroupIds();
      for (const groupId of groups) {
        const dayLogs = messageLogger.getDayLogs(groupId);
        if (dayLogs && dayLogs.length > 0) {
          await runMemoryFlush(groupId, dayLogs, kitsuneMemory);
        }
      }
    } catch (err) {
      console.error('[PersonaEngine] Memory flush cycle error:', err.message);
    }
  };
  setTimeout(flushAll, 5 * 60 * 1000);
  setInterval(flushAll, MEMORY_FLUSH_INTERVAL_MS);
}
function getGroupStyles(groupId) {
  if (!db) return null;
  try {
    const groupRow = db.prepare('SELECT * FROM group_styles WHERE group_id = ?').get(groupId);
    const userRows = db.prepare('SELECT * FROM user_profiles WHERE group_id = ?').all(groupId);
    if (!groupRow && userRows.length === 0) return null;
    const result = {
      group_metadata: groupRow ? {
        vibe_description: groupRow.vibe_description || 'Not yet analyzed',
        collective_slang_lexicon: JSON.parse(groupRow.slang_lexicon || '[]'),
        formatting_rules: JSON.parse(groupRow.formatting_rules || '[]')
      } : null,
      user_profiles: {}
    };
    for (const row of userRows) {
      result.user_profiles[row.username] = {
        tone: row.tone,
        emoji_fingerprint: JSON.parse(row.emoji_fingerprint || '[]'),
        message_pacing: row.message_pacing,
        notable_quirks: row.notable_quirks
      };
    }
    return result;
  } catch (err) {
    console.error('[PersonaEngine] Error reading group styles:', err.message);
    return null;
  }
}
async function forceStyleExtraction(groupId, messageLogger) {
  const rawLogs = messageLogger.getRawLogsChunk(groupId, 100);
  await runStyleExtraction(groupId, rawLogs);
}
async function forceMemoryFlush(groupId, messageLogger, kitsuneMemory) {
  const dayLogs = messageLogger.getDayLogs(groupId);
  await runMemoryFlush(groupId, dayLogs, kitsuneMemory);
}
function init() {
  initDB();
  console.log('[PersonaEngine] ✅ Engine initialized.');
}
module.exports = {
  init,
  onMessage,
  startMemoryFlusher,
  getGroupStyles,
  forceStyleExtraction,
  forceMemoryFlush
};