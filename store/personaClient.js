const axios = require('axios');
const http = require('http');
const https = require('https');

const config = require('../config');
const BRAIN_URL = process.env.BRAIN_URL || `http://${config.API_HOST}:${config.BRAIN_PORT}`;
const TIMEOUT_MS = 60000;
const GENERATE_TIMEOUT_MS = 600000;
const { internalAuthHeaders } = require('../utils/internalAuth');
const brain = axios.create({
  baseURL: BRAIN_URL,
  timeout: TIMEOUT_MS,
  headers: {
    'Content-Type': 'application/json',
    ...internalAuthHeaders()
  },
  httpAgent: new http.Agent({ keepAlive: true, maxSockets: Infinity, keepAliveMsecs: 1000 }),
  httpsAgent: new https.Agent({ keepAlive: true, maxSockets: Infinity, keepAliveMsecs: 1000 })
});

brain.interceptors.response.use(undefined, async (err) => {
    const config = err.config;
    if (!config || !config.retry) return Promise.reject(err);
    config.__retryCount = config.__retryCount || 0;
    if (config.__retryCount >= config.retry) return Promise.reject(err);
    config.__retryCount += 1;
    await new Promise(r => setTimeout(r, config.retryDelay || 200));
    return brain(config);
});
async function isAlive() {
  try {
    const res = await brain.get('/health');
    return res.data?.status === 'ok';
  } catch {
    return false;
  }
}
function onMessage(groupId) {
  if (!groupId) return;
  brain.post('/message', {
    groupId
  }, { retry: 3, retryDelay: 500 }).catch(() => {});
}
async function getGroupStyles(groupId) {
  try {
    const res = await brain.get(`/styles/${encodeURIComponent(groupId)}`);
    return res.data?.styles || null;
  } catch {
    return null;
  }
}
async function searchMemories(query, topK = 5, groupId = null) {
  try {
    const res = await brain.post('/memory/search', {
      query,
      topK,
      groupId
    }, { retry: 3, retryDelay: 500 });
    return res.data?.results || '';
  } catch {
    return '';
  }
}
async function addMemory(fact, chatName, userName, metadata = {}) {
  try {
    await brain.post('/memory/add', {
      fact,
      chatName,
      userName,
      metadata
    }, { retry: 3, retryDelay: 500 });
  } catch {}
}
async function generate(params) {
  try {
    const res = await brain.post('/generate', params, {
      timeout: GENERATE_TIMEOUT_MS,
      retry: 3,
      retryDelay: 500
    });
    return res.data || null;
  } catch (err) {
    console.error('[PersonaClient] /generate failed:', err.message);
    if (err.response) {
      console.error('[PersonaClient] response data:', err.response.data);
      console.error('[PersonaClient] response status:', err.response.status);
    }
    return null;
  }
}
async function forceStyleExtraction(groupId) {
  try {
    const res = await brain.post('/style/force', {
      groupId
    });
    return res.data;
  } catch (err) {
    console.error('[PersonaClient] /style/force failed:', err.message);
    return null;
  }
}
async function forceMemoryFlush(groupId) {
  try {
    const res = await brain.post('/flush/force', {
      groupId
    });
    return res.data;
  } catch (err) {
    console.error('[PersonaClient] /flush/force failed:', err.message);
    return null;
  }
}
async function getStats() {
  try {
    const res = await brain.get('/stats');
    return res.data;
  } catch {
    return null;
  }
}
module.exports = {
  isAlive,
  onMessage,
  getGroupStyles,
  searchMemories,
  addMemory,
  generate,
  forceStyleExtraction,
  forceMemoryFlush,
  getStats,
  BRAIN_URL
};