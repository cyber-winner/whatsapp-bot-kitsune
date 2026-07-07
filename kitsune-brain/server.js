const { OWNER_NAME } = require('../config');
const express = require('express');
const path = require('path');
const personaEngine = require(path.join(__dirname, '../store/personaEngine'));
const kitsuneMemory = require(path.join(__dirname, '../store/kitsuneMemory'));
const messageLogger = require(path.join(__dirname, '../store/messageLogger'));
const axios = require('axios');
const fs = require('fs');
const {
  exec
} = require('child_process');
const { weatherToolDefinition, datetimeToolDefinition, newsToolDefinition, fifaToolDefinition, searchToolDefinition, readUrlToolDefinition, mathToolDefinition, newtonToolDefinition, getCurrentWeather, getCurrentDateTime, getLocalNews, getFifaMatches, searchWebEngine, readUrlContent, evaluateMathExpression, evaluateNewtonMath } = require(path.join(__dirname, '../utils/weatherTool'));
const { introspectToolDefinition, selfDiagnosisToolDefinition, executeIntrospection, runSelfDiagnosis } = require(path.join(__dirname, '../utils/introspectTool'));
const pokemonMap = new Map();
let sortedPokemonNames = [];
try {
  const rawData = fs.readFileSync(path.join(__dirname, '../data/pokemon.json'), 'utf-8');
  const pokemonData = JSON.parse(rawData);
  for (const p of pokemonData) {
    if (!p || !p.name) continue;
    const nameLower = p.name.toLowerCase();
    if (!pokemonMap.has(nameLower)) {
      pokemonMap.set(nameLower, p);
    }
  }
  sortedPokemonNames = Array.from(pokemonMap.keys()).sort((a, b) => b.length - a.length);
  console.log(`[Pokemon DB] Loaded ${sortedPokemonNames.length} unique pokemon.`);
} catch (err) {
  console.error('[Pokemon DB] Failed to load pokemon.json:', err.message);
}
function getPokemonContext(prompt) {
  if (!prompt) return '';
  const lowerPrompt = prompt.toLowerCase();
  const found = [];
  let searchStr = lowerPrompt;
  for (const name of sortedPokemonNames) {
    if (searchStr.length === 0) break;
    const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(`(?:^|\\W)(${escaped})(?:$|\\W)`, 'i');
    if (regex.test(searchStr)) {
      found.push(pokemonMap.get(name));
      searchStr = searchStr.replace(regex, ' ');
      if (found.length >= 2) break;
    }
  }
  if (found.length === 0) return '';
  let contextStr = '\nPOKEMON KNOWLEDGE DATABASE:\n';
  for (const p of found) {
    contextStr += `Name: ${p.name}\n`;
    if (p.genus) contextStr += `Species: ${p.genus}\n`;
    if (p.types) contextStr += `Types: ${p.types.join(', ')}\n`;
    if (p.description) contextStr += `Description: ${p.description}\n`;
    if (p.abilities) contextStr += `Abilities: ${p.abilities.map(a => a.name).join(', ')}\n`;
    if (p.baseStats) {
      contextStr += `Base Stats: HP ${p.baseStats.hp}, Atk ${p.baseStats.atk}, Def ${p.baseStats.def}, SpAtk ${p.baseStats.spAtk}, SpDef ${p.baseStats.spDef}, Speed ${p.baseStats.speed}\n`;
    }
    if (p.moves && p.moves.length > 0) {
      contextStr += `Common Moves: ${p.moves.slice(0, 4).map(m => m.name).join(', ')}\n`;
    }
    contextStr += '---\n';
  }
  return contextStr;
}
const app = express();
app.use(express.json({
  limit: '5mb'
}));
const { requireInternalAuth } = require(path.join(__dirname, '../utils/internalAuth'));
const PORT = process.env.BRAIN_PORT || 3100;
const OLLAMA_URL = 'http://localhost:11434/api/generate';
const OLLAMA_MODEL = 'qwen3:4b';
console.log(`

║      🧠 KITSUNE BRAIN API Server       ║
║              v1.0.0                      ║

`);
kitsuneMemory.loadMemories();
personaEngine.init();
personaEngine.startMemoryFlusher(messageLogger, kitsuneMemory);
console.log('🧠 Memory flusher background worker started.');



const AWARENESS_CACHE_TTL = 10 * 60 * 1000; 
let awarenessCache = { weather: null, news: null, lastFetch: 0 };

async function refreshAwareness() {
  try {
    const [weatherJson, newsJson] = await Promise.all([
      getCurrentWeather(),
      getLocalNews(undefined, 5, 'headlines')
    ]);
    awarenessCache.weather = JSON.parse(weatherJson);
    awarenessCache.news = JSON.parse(newsJson);
    awarenessCache.lastFetch = Date.now();
    console.log('[Awareness] ✅ Cache refreshed (weather + headlines).');
  } catch (err) {
    console.error('[Awareness] Cache refresh failed:', err.message);
  }
}

function getAwarenessContext() {
  const time = JSON.parse(getCurrentDateTime());
  let ctx = `\n[REAL-TIME AWARENESS — You know this right now, reference naturally when relevant]:\n`;
  ctx += `🕐 Current Time: ${time.time} | ${time.day_of_week}, ${time.date} (${time.timezone})\n`;
  
  if (awarenessCache.weather?.current) {
    const w = awarenessCache.weather.current;
    ctx += `🌦️ Weather: ${w.temperature} (feels ${w.feels_like}), ${w.condition}, Humidity ${w.humidity}, Wind ${w.wind_speed}\n`;
  }
  
  if (awarenessCache.news?.headlines?.length > 0) {
    ctx += `📰 Top Headlines:\n`;
    for (const h of awarenessCache.news.headlines.slice(0, 3)) {
      ctx += `  • ${h.headline} (${h.source})\n`;
    }
  }
  
  return ctx;
}


refreshAwareness();
setInterval(refreshAwareness, AWARENESS_CACHE_TTL);
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'kitsune-brain',
    uptime: process.uptime(),
    memoryCount: kitsuneMemory.getMemoryCount()
  });
});
app.post('/message', requireInternalAuth, (req, res) => {
  if (!req.body || typeof req.body !== 'object') return res.status(400).json({ error: 'Invalid JSON payload' });
  const {
    groupId
  } = req.body;
  if (typeof groupId !== 'string' || !groupId.trim()) return res.status(400).json({
    error: 'groupId required and must be a string'
  });
  personaEngine.onMessage(groupId, messageLogger);
  res.json({
    ok: true
  });
});
app.get('/styles/:groupId', requireInternalAuth, (req, res) => {
  const groupId = req.params.groupId;
  if (typeof groupId !== 'string' || !groupId.trim()) return res.status(400).json({ error: 'Invalid groupId' });
  const styles = personaEngine.getGroupStyles(groupId);
  res.json({
    styles: styles || null
  });
});
app.post('/memory/search', requireInternalAuth, async (req, res) => {
  try {
    if (!req.body || typeof req.body !== 'object') return res.status(400).json({ error: 'Invalid JSON payload' });
    const {
      query,
      topK = 5,
      groupId = null
    } = req.body;
    if (typeof query !== 'string' || !query.trim()) return res.status(400).json({
      error: 'query required and must be a string'
    });
    const results = await kitsuneMemory.searchMemories(query, topK, groupId);
    res.json({
      results
    });
  } catch (err) {
    console.error('[Brain API] /memory/search error:', err.message);
    res.status(500).json({
      error: err.message
    });
  }
});
app.post('/memory/add', requireInternalAuth, async (req, res) => {
  try {
    if (!req.body || typeof req.body !== 'object') return res.status(400).json({ error: 'Invalid JSON payload' });
    const {
      fact,
      chatName,
      userName,
      metadata = {}
    } = req.body;
    if (typeof fact !== 'string' || !fact.trim()) return res.status(400).json({
      error: 'fact required and must be a string'
    });
    await kitsuneMemory.addMemory(fact, chatName, userName, metadata);
    res.json({
      ok: true,
      totalMemories: kitsuneMemory.getMemoryCount()
    });
  } catch (err) {
    console.error('[Brain API] /memory/add error:', err.message);
    res.status(500).json({
      error: err.message
    });
  }
});
app.post('/generate', requireInternalAuth, async (req, res) => {
  try {
    if (!req.body || typeof req.body !== 'object') return res.status(400).json({ error: 'Invalid JSON payload' });
    const {
      groupId,
      senderName,
      aiPrompt,
      roleContext,
      familyStr,
      shortTermBuffer,
      groupRosterStr,
      chatName,
      learningDisabled
    } = req.body;
    if (typeof aiPrompt !== 'string' || !aiPrompt.trim()) return res.status(400).json({
      error: 'aiPrompt required and must be a string'
    });
    const vectorDbResults = await kitsuneMemory.searchMemories(aiPrompt, 5, groupId);
    const groupStyles = personaEngine.getGroupStyles(groupId);
    let groupMetadataJson = 'Not yet analyzed — use natural conversational style.';
    let userProfilesJson = '{}';
    if (groupStyles) {
      if (groupStyles.group_metadata) {
        groupMetadataJson = JSON.stringify(groupStyles.group_metadata, null, 2);
      }
      if (groupStyles.user_profiles && Object.keys(groupStyles.user_profiles).length > 0) {
        userProfilesJson = JSON.stringify(groupStyles.user_profiles, null, 2);
      }
    }

    
    let relatedNewsContext = '';
    const newsKeywords = /\b(news|headline|happening|election|politics|cricket|football|soccer|tennis|match|score|tournament|cup|team|win|won|lose|government|modi|india|war|attack|earthquake|flood|exam|neet|result|controversy|protest|strike|accident|update)\b/i;
    if (newsKeywords.test(aiPrompt) && aiPrompt.length > 5) {
      try {
        // Extract the most relevant 2-3 word query from the message
        const stopWords = new Set(['what','the','is','are','about','any','whats','tell','me','do','you','know','have','has','been','latest','recent','today','news','headline','happening','will','think','they','against','who','hey','kitsune','please','can','could','would','and','for','with']);
        const queryWords = aiPrompt.toLowerCase().match(/\b[a-z0-9]{2,}\b/g)?.filter(w => !stopWords.has(w)).slice(0, 3) || [];
        if (queryWords.length > 0) {
          const searchQuery = queryWords.join(' ');
          const relatedJson = await getLocalNews(searchQuery, 3);
          const related = JSON.parse(relatedJson);
          if (related.headlines?.length > 0) {
            relatedNewsContext = `\n[RELATED NEWS for "${searchQuery}" — use this knowledge if relevant to the conversation]:\n`;
            for (const h of related.headlines) {
              relatedNewsContext += `  • ${h.headline} (${h.source}, ${h.published})\n`;
            }
          }
        }
      } catch (err) {
        
      }
    }

    const pokemonInfoStr = getPokemonContext(aiPrompt);
    const sysInstructions = `SYSTEM: You are an active participant in a private WhatsApp group chat. You talk naturally like the members of this chat.
    
Rules:
1. LANGUAGE: You MUST respond in English. You understand Banglish (Bengali written in English script) since many group members use it, but your replies should stay in English. Do NOT translate or explain Bengali phrases unless asked.
2. Keep your answers concise, creative, and highly conversational. NEVER repeat yourself.
3. DO NOT write responses for multiple people. ONLY reply to the very last message from the User.
4. Do NOT use generic assistant filler phrases ("Sure, I can help", "As an AI...", "I'd be happy to...").
8. Match the exact capitalization, punctuation, and brevity rules specified in the CORE STYLE GUIDELINES below.
9. If the style profile says the group uses lowercase and short fragments, format your response as fragments separated by newlines.
10. AWARENESS: You always know the current weather, time, and top news headlines — this info is provided below. You can casually reference it when relevant (e.g., if someone says "I'm bored" you might mention the weather or a news headline, if someone says "good morning" you know the actual time). But do NOT dump weather/news data unprompted — only weave it in naturally when it fits.
11. TARGETED SEARCH: If someone asks about a SPECIFIC news topic, sports match, current event, weather in a different location, or a different timezone, YOU MUST use your search tools to find targeted results immediately. NEVER ask for permission to check the news or weather. Just use the tool and provide the answer. Your background awareness covers general/local info only.
12. ANTI-HALLUCINATION: The news tool only provides HEADLINES. If the headlines do not contain the specific sports score, team matchup, or fact you need, YOU MUST ADMIT YOU DON'T KNOW. Under NO circumstances should you guess or make up sports schedules, scores, or news events.
13. MATHS & CALCULATIONS: Whenever a user provides a mathematical equation, calculus problem (integrals, derivatives), or asks a math question, YOU MUST use your evaluation tools to solve or verify it immediately. When the tool returns the result, YOU MUST STATE THE EXACT MATHEMATICAL RESULT RETURNED BY THE TOOL. Do not try to algebraically simplify the tool's output in your head. Do not agree with the user's incorrect equation if it is missing coefficients, fractions, or signs compared to the tool's output. Do not output raw tool names in your text.
14. SELF-AWARENESS: You have FULL access to your own source code and codebase. If Father or anyone asks about your internals, architecture, how something works in your code, your tools, your stores, your commands, or anything about your system — use the introspect_codebase tool to read the actual file and answer accurately. You can read ANY of your own files.
15. SELF-DIAGNOSIS: If someone says "run self diagnosis", "self diagnosis", "system check", "health check", or any similar request, YOU MUST use the run_self_diagnosis tool immediately. Present the results in a clear, organized format showing what passed, what failed, and the overall health score.`;
    const fullPrompt = `${sysInstructions}

CORE STYLE GUIDELINES (Generated by Style Extractor — match this tone exactly):
${groupMetadataJson}

MEMBER TONE MATCHING REFERENCE:
${userProfilesJson}

HISTORICAL CONTEXT (Retrieved from Vector DB based on semantic relevance):
${vectorDbResults || 'No relevant long-term memories found.'}

${pokemonInfoStr}[Group & Family Database]:${groupRosterStr || ''}
${familyStr || ''}

RECENT CONVERSATION BUFFER (Immediate context of the last 20 messages):
${shortTermBuffer || 'No recent messages available.'}

${roleContext || ''}
${relatedNewsContext}

CURRENT SITUATION:
Current User Speaking: ${senderName}
Message: ${aiPrompt}
${getAwarenessContext()}

OUTPUT (Provide ONLY the raw text response. Do NOT use markdown code blocks (\`\`\`), do NOT output <think> tags. Just the raw conversational message):`;
    const optimizePrompt = (fullPrompt, senderName) => {
      const sections = {
        SYSTEM: '', 'STYLE GUIDELINES': '', 'MEMBER TONE MATCHING': '', 'HISTORICAL CONTEXT': '', 'POKEMON': '', 'ROSTER': '', 'RECENT': '', 'SITUATION': ''
      };
      const lines = fullPrompt.split('\n');
      let currentSection = 'SYSTEM';
      for (const line of lines) {
        if (line.includes('CORE STYLE GUIDELINES')) { currentSection = 'STYLE GUIDELINES'; continue; }
        else if (line.includes('MEMBER TONE MATCHING REFERENCE:')) { currentSection = 'MEMBER TONE MATCHING'; continue; }
        else if (line.includes('HISTORICAL CONTEXT')) { currentSection = 'HISTORICAL CONTEXT'; continue; }
        else if (line.includes('POKEMON KNOWLEDGE DATABASE:')) { currentSection = 'POKEMON'; continue; }
        else if (line.includes('[Group & Family Database]') || line.includes('[Full Registered Users & Family Database]')) { currentSection = 'ROSTER'; continue; }
        else if (line.includes('[Recent Conversation Buffer') || line.includes('RECENT CONVERSATION BUFFER')) { currentSection = 'RECENT'; continue; }
        else if (line.includes('CURRENT SITUATION:')) { currentSection = 'SITUATION'; continue; }
        sections[currentSection] += line + '\n';
      }
      
      const recentText = sections['RECENT'];
      const activeNames = new Set();
      const regex = /\[(.*?)\]:/g;
      let match;
      while ((match = regex.exec(recentText)) !== null) {
        activeNames.add(match[1]);
      }
      activeNames.add(senderName);
      activeNames.add('Kitsune');
      activeNames.add(OWNER_NAME);
      
      const filteredRoster = [];
      const rosterLines = sections['ROSTER'].split('\n');
      for (const line of rosterLines) {
        if (!line.trim()) continue;
        const lowerLine = line.toLowerCase();
        let nameMatched = false;
        for (const name of activeNames) {
          if (lowerLine.includes(name.toLowerCase())) {
            nameMatched = true;
            break;
          }
        }
        if (nameMatched) {
          filteredRoster.push(line);
        }
      }
      
      let filteredRosterStr = filteredRoster.join('\n');
      if (!filteredRosterStr.trim()) {
        filteredRosterStr = 'No specific family data relevant for active users.';
      }
      
      return `${sections['SYSTEM'].trim()}\n\n[STYLE MATCHING]:\n${sections['STYLE GUIDELINES'].trim()}\n\n[RELEVANT MEMORIES]:\n${sections['HISTORICAL CONTEXT'].trim()}\n\n[RELEVANT FAMILY DATABASE]:\n${filteredRosterStr}\n\n[RECENT CONVERSATION]:\n${sections['RECENT'].trim()}\n\n[CURRENT SITUATION]:\n${sections['SITUATION'].trim()}\n`;
    };

    const optimized = optimizePrompt(fullPrompt, senderName);
    
    let envVars = {};
    try {
      const envPath = path.join(__dirname, '../.env');
      if (fs.existsSync(envPath)) {
        const envFile = fs.readFileSync(envPath, 'utf8');
        envFile.split('\n').forEach(line => {
          if (line.includes('=') && !line.trim().startsWith('#')) {
            const [key, ...valParts] = line.trim().split('=');
            envVars[key.trim()] = valParts.join('=').trim();
          }
        });
      }
    } catch (e) {}

    const groqApiKey = process.env.GROQ_API_KEY || envVars['GROQ_API_KEY'];
    const groqModel = process.env.GROQ_MODEL || envVars['GROQ_MODEL'] || 'llama-3.3-70b-versatile';

    if (!groqApiKey) {
      throw new Error("GROQ_API_KEY not found in environment or .env file");
    }

    let messages = [];
    if (optimized.includes("[RECENT CONVERSATION]:")) {
      const parts = optimized.split("[RECENT CONVERSATION]:");
      let systemContent = parts[0].trim();
      let userContent = "[RECENT CONVERSATION]:\n" + parts[1].trim();
      if (systemContent.startsWith("SYSTEM:")) {
        systemContent = systemContent.substring("SYSTEM:".length).trim();
      }
      messages = [
        { role: "system", content: systemContent },
        { role: "user", content: userContent }
      ];
    } else {
      messages = [
        { role: "user", content: optimized }
      ];
    }

    
    const FALLBACK_MODEL = 'llama-3.1-8b-instant';
    let activeModel = groqModel;
    let groqResponse;

    const makeGroqCall = async (model, msgs, tools = null) => {
      const payload = { model, messages: msgs, temperature: 1.0 };
      if (tools) { payload.tools = tools; payload.tool_choice = 'auto'; }
      return axios.post("https://api.groq.com/openai/v1/chat/completions", payload, {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${groqApiKey}`,
          'User-Agent': 'Mozilla/5.0'
        }
      });
    };

    try {
      groqResponse = await makeGroqCall(activeModel, messages, [weatherToolDefinition, datetimeToolDefinition, newsToolDefinition, fifaToolDefinition, searchToolDefinition, readUrlToolDefinition, mathToolDefinition, newtonToolDefinition, introspectToolDefinition, selfDiagnosisToolDefinition]);
    } catch (toolErr) {
      const errData = toolErr.response?.data?.error;
      const statusCode = toolErr.response?.status;

      
      if (statusCode === 429) {
        console.error(`[Brain API] 429 rate limit on ${activeModel}, falling back to ${FALLBACK_MODEL}`);
        activeModel = FALLBACK_MODEL;
        try {
          groqResponse = await makeGroqCall(activeModel, messages, [weatherToolDefinition, datetimeToolDefinition, newsToolDefinition, fifaToolDefinition, searchToolDefinition, readUrlToolDefinition, mathToolDefinition, newtonToolDefinition, introspectToolDefinition, selfDiagnosisToolDefinition]);
        } catch (fallbackErr) {
          throw fallbackErr;
        }
      }
      
      else if (errData?.code === 'tool_use_failed' && errData?.failed_generation) {
        console.error('[Brain API] tool_use_failed — attempting manual tool recovery from:', errData.failed_generation);
        
        let recoveryContent = null;
        const failedGen = errData.failed_generation;
        
        const funcMatch = failedGen.match(/evaluate_advanced_calculus[>"'\s:]*\{(.*?)\}/s);
        if (funcMatch) {
          try {
            const args = JSON.parse('{' + funcMatch[1] + '}');
            console.log(`[Brain API] 📐 Recovery: executing calculus tool (op: ${args.operation}, expr: ${args.expression})`);
            const calcResult = await evaluateNewtonMath(args.operation, args.expression);
            recoveryContent = calcResult;
          } catch (parseErr) {
            console.error('[Brain API] Recovery parse failed:', parseErr.message);
          }
        }
        
        if (!recoveryContent) {
          const mathMatch = failedGen.match(/evaluate_math_expression[>"'\s:]*\{(.*?)\}/s);
          if (mathMatch) {
            try {
              const args = JSON.parse('{' + mathMatch[1] + '}');
              console.log(`[Brain API] 🧮 Recovery: executing math tool (expr: ${args.expression})`);
              const mathResult = await evaluateMathExpression(args.expression);
              recoveryContent = mathResult;
            } catch (parseErr) {
              console.error('[Brain API] Recovery parse failed:', parseErr.message);
            }
          }
        }
        
        const retryMessages = [...messages];
        if (recoveryContent) {
          retryMessages.push({ role: 'assistant', content: 'I used the math evaluation tool.' });
          retryMessages.push({ role: 'user', content: `Tool result: ${recoveryContent}\n\nNow respond naturally to the original message using this result. Remember to state the exact result from the tool.` });
        }
        
        try {
          groqResponse = await makeGroqCall(activeModel, retryMessages);
        } catch (retryErr) {
          
          if (retryErr.response?.status === 429) {
            console.error(`[Brain API] 429 on retry, falling back to ${FALLBACK_MODEL}`);
            activeModel = FALLBACK_MODEL;
            groqResponse = await makeGroqCall(activeModel, retryMessages);
          } else {
            throw retryErr;
          }
        }
      } else {
        throw toolErr;
      }
    }

    let aiText = '';
    const firstChoice = groqResponse.data.choices?.[0];
    if (!firstChoice) throw new Error("Groq returned empty response");

    // ── Handle tool calls ──
    if (firstChoice.finish_reason === 'tool_calls' && firstChoice.message?.tool_calls?.length > 0) {
      const toolCalls = firstChoice.message.tool_calls;
      console.error('[Brain API] Tool calls triggered:', JSON.stringify(toolCalls, null, 2));
      const toolMessages = [firstChoice.message]; 

      for (const toolCall of toolCalls) {
        if (toolCall.function.name === 'get_current_weather') {
          let args = {};
          try { args = JSON.parse(toolCall.function.arguments) || {}; } catch (e) {}
          console.log(`[Brain API] 🌦️  AI invoked weather tool (lat: ${args.latitude || 'default'}, lon: ${args.longitude || 'default'})`);
          const weatherResult = await getCurrentWeather(args.latitude, args.longitude);
          toolMessages.push({
            role: 'tool',
            tool_call_id: toolCall.id,
            name: toolCall.function.name,
            content: weatherResult
          });
        }
        else if (toolCall.function.name === 'get_current_datetime') {
          let args = {};
          try { args = JSON.parse(toolCall.function.arguments) || {}; } catch (e) {}
          console.log(`[Brain API] 🕒 AI invoked datetime tool (tz: ${args.timezone || 'default'})`);
          const dtResult = getCurrentDateTime(args.timezone);
          toolMessages.push({
            role: 'tool',
            tool_call_id: toolCall.id,
            name: toolCall.function.name,
            content: dtResult
          });
        }
        else if (toolCall.function.name === 'get_local_news') {
          let args = {};
          try { args = JSON.parse(toolCall.function.arguments) || {}; } catch (e) {}
          console.log(`[Brain API] 📰 AI invoked news tool (query: ${args.query || 'none'}, category: ${args.category || 'headlines'})`);
          const newsResult = await getLocalNews(args.query, args.max_results, args.category);
          toolMessages.push({
            role: 'tool',
            tool_call_id: toolCall.id,
            name: toolCall.function.name,
            content: newsResult
          });
        }
        else if (toolCall.function.name === 'get_fifa_matches') {
          console.log(`[Brain API] ⚽ AI invoked FIFA tool`);
          const fifaResult = await getFifaMatches();
          toolMessages.push({
            role: 'tool',
            tool_call_id: toolCall.id,
            name: toolCall.function.name,
            content: fifaResult
          });
        }
        else if (toolCall.function.name === 'search_web_engine') {
          let args = {};
          try { args = JSON.parse(toolCall.function.arguments) || {}; } catch (e) {}
          console.log(`[Brain API] 🌐 AI invoked Web Search tool (query: ${args.query || 'none'})`);
          const searchResult = await searchWebEngine(args.query);
          toolMessages.push({
            role: 'tool',
            tool_call_id: toolCall.id,
            name: toolCall.function.name,
            content: searchResult
          });
        }
        else if (toolCall.function.name === 'read_url_content') {
          let args = {};
          try { args = JSON.parse(toolCall.function.arguments) || {}; } catch (e) {}
          console.log(`[Brain API] 📄 AI invoked URL Reader (url: ${args.url || 'none'})`);
          const urlResult = await readUrlContent(args.url);
          toolMessages.push({
            role: 'tool',
            tool_call_id: toolCall.id,
            name: toolCall.function.name,
            content: urlResult
          });
        }
        else if (toolCall.function.name === 'evaluate_math_expression') {
          let args = {};
          try { args = JSON.parse(toolCall.function.arguments) || {}; } catch (e) {}
          console.log(`[Brain API] 🧮 AI invoked Math tool (expr: ${args.expression || 'none'})`);
          const mathResult = await evaluateMathExpression(args.expression);
          toolMessages.push({
            role: 'tool',
            tool_call_id: toolCall.id,
            name: toolCall.function.name,
            content: mathResult
          });
        }
        else if (toolCall.function.name === 'evaluate_advanced_calculus') {
          let args = {};
          try { args = JSON.parse(toolCall.function.arguments) || {}; } catch (e) {}
          console.log(`[Brain API] 📐 AI invoked Advanced Calculus tool (op: ${args.operation}, expr: ${args.expression || 'none'})`);
          const calcResult = await evaluateNewtonMath(args.operation, args.expression);
          toolMessages.push({
            role: 'tool',
            tool_call_id: toolCall.id,
            name: toolCall.function.name,
            content: calcResult
          });
        }
        else if (toolCall.function.name === 'introspect_codebase') {
          let args = {};
          try { args = JSON.parse(toolCall.function.arguments) || {}; } catch (e) {}
          console.log(`[Brain API] 🔍 AI invoked Introspect tool (action: ${args.action}, target: ${args.target || 'none'})`);
          const introspectResult = executeIntrospection(args.action, args.target);
          toolMessages.push({
            role: 'tool',
            tool_call_id: toolCall.id,
            name: toolCall.function.name,
            content: introspectResult
          });
        }
        else if (toolCall.function.name === 'run_self_diagnosis') {
          console.log(`[Brain API] 🩺 AI invoked Self-Diagnosis tool`);
          const diagResult = await runSelfDiagnosis();
          toolMessages.push({
            role: 'tool',
            tool_call_id: toolCall.id,
            name: toolCall.function.name,
            content: diagResult
          });
        }
      }

      
      let followUpResponse;
      try {
        followUpResponse = await makeGroqCall(activeModel, [...messages, ...toolMessages]);
      } catch (followUpErr) {
        if (followUpErr.response?.status === 429) {
          console.error(`[Brain API] 429 on follow-up, falling back to ${FALLBACK_MODEL}`);
          activeModel = FALLBACK_MODEL;
          followUpResponse = await makeGroqCall(activeModel, [...messages, ...toolMessages]);
        } else {
          throw followUpErr;
        }
      }

      const followUpChoice = followUpResponse.data.choices?.[0];
      if (followUpChoice?.message?.content) {
        let rawContent = followUpChoice.message.content;
        rawContent = rawContent.replace(/scalablytyped\s*<\|start_header_id\|>\s*assistant\s*<\|end_header_id\|>/gi, '');
        rawContent = rawContent.replace(/<\|(?:start_header_id|end_header_id|eot_id)\|>/gi, '');
        rawContent = rawContent.replace(/scalablytyped/gi, '');
        aiText = rawContent.trim();
      } else {
        throw new Error("Groq returned empty response after tool call");
      }
    } else if (firstChoice.message?.content) {
      // No tool call — normal response
      let rawContent = firstChoice.message.content;
      rawContent = rawContent.replace(/scalablytyped\s*<\|start_header_id\|>\s*assistant\s*<\|end_header_id\|>/gi, '');
      rawContent = rawContent.replace(/<\|(?:start_header_id|end_header_id|eot_id)\|>/gi, '');
      rawContent = rawContent.replace(/scalablytyped/gi, '');
      aiText = rawContent.trim();
    } else {
      throw new Error("Groq returned empty response");
    }
    
    // Strip <think> tags and their contents (deepseek-r1 style)
    aiText = aiText.replace(/<think>[\s\S]*?<\/think>/gi, '');
    // Strip any markdown codeblock wrappers
    aiText = aiText.replace(/```[a-z]*\n/gi, '');
    aiText = aiText.replace(/```/g, '');
    // Strip any stray wrapping XML tags (like <response>...</response>)
    aiText = aiText.replace(/^<[a-z0-9_-]+>\s*([\s\S]+?)\s*<\/[a-z0-9_-]+>$/i, '$1');
    
    
    aiText = aiText.replace(/<?\/?function[=\s][^>]*>[\s\S]*?(<\/function>|(?=\n|$))/gi, '');
    aiText = aiText.replace(/<?function=[a-z_]+[>"'\s:]*\{[^}]*\}/gi, '');
    aiText = aiText.replace(/<\/?function[^>]*>/gi, '');
    // Also strip lines that are just "function=..." hallucinations
    aiText = aiText.replace(/^function=[a-z_]+.*$/gim, '');
    // Strip leaked tool result prefixes
    aiText = aiText.replace(/VERIFIED RESULT[^:]*:/gi, '');
    aiText = aiText.replace(/CRITICAL SYSTEM WARNING[^:]*:/gi, '');
    aiText = aiText.trim();
    
    aiText = aiText.replace(/^(Kitsune|kitsune|KITSUNE)\s*[:：]\s*/i, '');
    if (!learningDisabled) {
      const factStr = `${senderName} asked Kitsune: "${aiPrompt}"`;
      kitsuneMemory.addMemory(factStr, chatName || 'Private DM', senderName, {
        groupId: groupId || chatName || 'Private DM',
        speaker: senderName
      });
    }
    const shouldSplit = groupStyles?.group_metadata?.formatting_rules?.some(rule => /split|burst|fragment|separate/i.test(rule)) || false;
    res.json({
      response: aiText,
      shouldSplit,
      groupStyles: groupStyles || null
    });
  } catch (err) {
    if (err.response && err.response.data) {
      console.error('[Brain API] /generate Groq error details:', JSON.stringify(err.response.data, null, 2));
    } else {
      console.error('[Brain API] /generate error:', err.message);
    }
    res.status(500).json({
      error: err.message
    });
  }
});
app.post('/style/force', requireInternalAuth, async (req, res) => {
  try {
    if (!req.body || typeof req.body !== 'object') return res.status(400).json({ error: 'Invalid JSON payload' });
    const {
      groupId
    } = req.body;
    if (typeof groupId !== 'string' || !groupId.trim()) return res.status(400).json({
      error: 'groupId required and must be a string'
    });
    await personaEngine.forceStyleExtraction(groupId, messageLogger);
    const styles = personaEngine.getGroupStyles(groupId);
    res.json({
      ok: true,
      styles
    });
  } catch (err) {
    console.error('[Brain API] /style/force error:', err.message);
    res.status(500).json({
      error: err.message
    });
  }
});
app.post('/flush/force', requireInternalAuth, async (req, res) => {
  try {
    if (!req.body || typeof req.body !== 'object') return res.status(400).json({ error: 'Invalid JSON payload' });
    const {
      groupId
    } = req.body;
    if (typeof groupId !== 'string' || !groupId.trim()) return res.status(400).json({
      error: 'groupId required and must be a string'
    });
    await personaEngine.forceMemoryFlush(groupId, messageLogger, kitsuneMemory);
    res.json({
      ok: true,
      totalMemories: kitsuneMemory.getMemoryCount()
    });
  } catch (err) {
    console.error('[Brain API] /flush/force error:', err.message);
    res.status(500).json({
      error: err.message
    });
  }
});
app.get('/weather', async (req, res) => {
  try {
    const lat = parseFloat(req.query.lat) || undefined;
    const lon = parseFloat(req.query.lon) || undefined;
    const weatherJson = await getCurrentWeather(lat, lon);
    res.json(JSON.parse(weatherJson));
  } catch (err) {
    console.error('[Brain API] /weather error:', err.message);
    res.status(500).json({ error: err.message });
  }
});
app.get('/self-diagnosis', async (req, res) => {
  try {
    const result = await runSelfDiagnosis();
    res.json(JSON.parse(result));
  } catch (err) {
    console.error('[Brain API] /self-diagnosis error:', err.message);
    res.status(500).json({ error: err.message });
  }
});
app.get('/stats', (req, res) => {
  const mem = process.memoryUsage();
  res.json({
    uptime: Math.round(process.uptime()),
    memoryUsageMB: {
      rss: Math.round(mem.rss / 1024 / 1024),
      heapUsed: Math.round(mem.heapUsed / 1024 / 1024),
      heapTotal: Math.round(mem.heapTotal / 1024 / 1024)
    },
    vectorMemories: kitsuneMemory.getMemoryCount(),
    trackedGroups: messageLogger.getTrackedGroupIds().length
  });
});
const host = process.env.API_HOST || '0.0.0.0';
app.listen(PORT, host, () => {
  console.log('═══════════════════════════════════════');
  console.log(`  🧠 Kitsune Brain API listening on http://${host}:${PORT}`);
  console.log('  📡 Endpoints:');
  console.log('     GET  /health        — Health check');
  console.log('     GET  /stats         — System statistics');
  console.log('     POST /message       — Notify new message');
  console.log('     GET  /styles/:id    — Get group style profile');
  console.log('     POST /memory/search — Semantic vector search');
  console.log('     POST /memory/add    — Add memory to vector DB');
  console.log('     POST /generate      — Generate AI response (with weather tool)');
  console.log('     GET  /weather       — Direct weather lookup');
  console.log('     GET  /self-diagnosis — Full system self-diagnosis');
  console.log('     POST /style/force   — Force style extraction');
  console.log('     POST /flush/force   — Force memory flush');
  console.log('═══════════════════════════════════════\n');
});