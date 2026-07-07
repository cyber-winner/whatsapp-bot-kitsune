const axios = require('axios');
const fs = require('fs');
const path = require('path');
const {
  createReadStream
} = require('fs');
const readline = require('readline');
const config = require('../config');
const BRAIN_URL = process.env.BRAIN_URL || `http://${config.API_HOST}:${config.BRAIN_PORT}`;
const DATA_DIR = path.join(__dirname, '../store-data-for-use/datasets');
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, {
  recursive: true
});
async function checkBrainAPI() {
  try {
    const res = await axios.get(`${BRAIN_URL}/health`, {
      timeout: 5000
    });
    return res.data?.status === 'ok';
  } catch {
    return false;
  }
}
async function addMemoryToBrain(fact, chatName, userName, metadata = {}) {
  try {
    await axios.post(`${BRAIN_URL}/memory/add`, {
      fact,
      chatName,
      userName,
      metadata
    }, {
      timeout: 60000
    });
    return true;
  } catch (err) {
    console.warn(`  [!] Failed to add memory: ${err.message}`);
    return false;
  }
}
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}
async function downloadGoEmotions() {
  const outFile = path.join(DATA_DIR, 'goemotions.tsv');
  if (fs.existsSync(outFile)) {
    console.log('  ✓ GoEmotions already downloaded.');
    return outFile;
  }
  console.log('  ↓ Downloading GoEmotions dataset...');
  const url = 'https://raw.githubusercontent.com/google-research/google-research/master/goemotions/data/train.tsv';
  const res = await axios.get(url, {
    timeout: 30000
  });
  fs.writeFileSync(outFile, res.data);
  console.log(`  ✓ Saved to ${outFile} (${(res.data.length / 1024).toFixed(0)} KB)`);
  return outFile;
}
async function ingestGoEmotions(filePath, maxEntries = 500) {
  console.log(`\n📊 Processing GoEmotions (max ${maxEntries} entries)...`);
  const content = fs.readFileSync(filePath, 'utf8');
  const lines = content.split('\n').filter(l => l.trim().length > 0);
  if (lines.length < 1) {
    console.warn('  [!] GoEmotions file appears empty.');
    return 0;
  }
  const emotions = ['admiration', 'amusement', 'anger', 'annoyance', 'approval', 'caring', 'confusion', 'curiosity', 'desire', 'disappointment', 'disapproval', 'disgust', 'embarrassment', 'excitement', 'fear', 'gratitude', 'grief', 'joy', 'love', 'nervousness', 'optimism', 'pride', 'realization', 'relief', 'remorse', 'sadness', 'surprise', 'neutral'];
  let ingested = 0;
  let skipped = 0;
  for (let i = 0; i < lines.length && ingested < maxEntries; i++) {
    const line = lines[i];
    const parts = line.split('\t');
    if (parts.length < 2) continue;
    const text = parts[0].trim();
    if (!text || text.length < 15) {
      skipped++;
      continue;
    }
    const emotionIds = parts[1].split(',').map(id => parseInt(id.trim(), 10));
    const detectedEmotions = emotionIds.filter(id => !isNaN(id) && id >= 0 && id < emotions.length).map(id => emotions[id]);
    if (detectedEmotions.length === 0) {
      skipped++;
      continue;
    }
    const fact = `[Emotion Reference] Text expressing ${detectedEmotions.join(', ')}: "${text}"`;
    const success = await addMemoryToBrain(fact, 'GoEmotions:Dataset', 'DatasetIngester', {
      groupId: '__dataset_goemotions',
      speaker: 'reddit_user'
    });
    if (success) {
      ingested++;
      if (ingested % 25 === 0) {
        console.log(`  [${ingested}/${maxEntries}] Ingested...`);
        await sleep(500);
      }
    }
  }
  console.log(`  ✅ GoEmotions: ${ingested} entries ingested, ${skipped} skipped.`);
  return ingested;
}
async function downloadHHRLHF() {
  const outFile = path.join(DATA_DIR, 'hh_rlhf_sample.jsonl');
  if (fs.existsSync(outFile)) {
    console.log('  ✓ HH-RLHF already downloaded.');
    return outFile;
  }
  console.log('  ↓ Downloading Anthropic HH-RLHF sample...');
  const url = 'https://huggingface.co/datasets/Anthropic/hh-rlhf/resolve/main/helpful-base/train.jsonl.gz';
  try {
    const res = await axios.get(url, {
      responseType: 'arraybuffer',
      timeout: 60000,
      maxContentLength: 50 * 1024 * 1024
    });
    const zlib = require('zlib');
    const decompressed = zlib.gunzipSync(Buffer.from(res.data));
    const allLines = decompressed.toString('utf8').split('\n').filter(l => l.trim());
    const sampleLines = allLines.slice(0, 2000);
    fs.writeFileSync(outFile, sampleLines.join('\n'));
    console.log(`  ✓ Saved ${sampleLines.length} conversations to ${outFile}`);
    return outFile;
  } catch (err) {
    console.warn(`  [!] Failed to download HH-RLHF: ${err.message}`);
    console.log('  → Falling back to manual download instructions.');
    return null;
  }
}
async function ingestHHRLHF(filePath, maxEntries = 200) {
  if (!filePath || !fs.existsSync(filePath)) {
    console.log('  ⏭ Skipping HH-RLHF (file not available).');
    return 0;
  }
  console.log(`\n📊 Processing Anthropic HH-RLHF (max ${maxEntries} entries)...`);
  const content = fs.readFileSync(filePath, 'utf8');
  const lines = content.split('\n').filter(l => l.trim().length > 0);
  let ingested = 0;
  for (let i = 0; i < lines.length && ingested < maxEntries; i++) {
    try {
      const entry = JSON.parse(lines[i]);
      const chosen = entry.chosen || '';
      if (!chosen || chosen.length < 50) continue;
      const turns = chosen.split('\n\nHuman:').filter(t => t.trim());
      if (turns.length < 1) continue;
      const lastTurn = turns[turns.length - 1];
      const assistantPart = lastTurn.split('\n\nAssistant:');
      if (assistantPart.length < 2) continue;
      const humanQ = assistantPart[0].trim().slice(0, 200);
      const assistantA = assistantPart[1].trim().slice(0, 300);
      if (!humanQ || !assistantA || assistantA.length < 20) continue;
      const fact = `[Conversational Style Reference] Natural response pattern — Q: "${humanQ}" → Good response: "${assistantA}"`;
      const success = await addMemoryToBrain(fact, 'AnthropicHHRLHF:Dataset', 'DatasetIngester', {
        groupId: '__dataset_hhrlhf',
        speaker: 'preferred_response'
      });
      if (success) {
        ingested++;
        if (ingested % 25 === 0) {
          console.log(`  [${ingested}/${maxEntries}] Ingested...`);
          await sleep(500);
        }
      }
    } catch (e) {
      continue;
    }
  }
  console.log(`  ✅ HH-RLHF: ${ingested} entries ingested.`);
  return ingested;
}
async function downloadSST() {
  const outFile = path.join(DATA_DIR, 'sst_sentences.txt');
  if (fs.existsSync(outFile)) {
    console.log('  ✓ SST already downloaded.');
    return outFile;
  }
  console.log('  ↓ Downloading Stanford Sentiment Treebank...');
  const url = 'https://raw.githubusercontent.com/clairett/pytorch-sentiment-classification/master/data/SST2/train.tsv';
  try {
    const res = await axios.get(url, {
      timeout: 30000
    });
    fs.writeFileSync(outFile, res.data);
    console.log(`  ✓ Saved to ${outFile}`);
    return outFile;
  } catch (err) {
    console.warn(`  [!] Failed to download SST: ${err.message}`);
    return null;
  }
}
async function ingestSST(filePath, maxEntries = 300) {
  if (!filePath || !fs.existsSync(filePath)) {
    console.log('  ⏭ Skipping SST (file not available).');
    return 0;
  }
  console.log(`\n📊 Processing Stanford Sentiment (max ${maxEntries} entries)...`);
  const content = fs.readFileSync(filePath, 'utf8');
  const lines = content.split('\n').filter(l => l.trim().length > 0);
  let ingested = 0;
  for (let i = 1; i < lines.length && ingested < maxEntries; i++) {
    const parts = lines[i].split('\t');
    if (parts.length < 2) continue;
    const text = parts[0].trim();
    const label = parts[1]?.trim();
    if (!text || text.length < 20) continue;
    const sentiment = label === '1' ? 'positive' : 'negative';
    const fact = `[Sentiment Reference] ${sentiment} sentiment expression: "${text}"`;
    const success = await addMemoryToBrain(fact, 'SST:Dataset', 'DatasetIngester', {
      groupId: '__dataset_sst',
      speaker: 'movie_review'
    });
    if (success) {
      ingested++;
      if (ingested % 25 === 0) {
        console.log(`  [${ingested}/${maxEntries}] Ingested...`);
        await sleep(500);
      }
    }
  }
  console.log(`  ✅ SST: ${ingested} entries ingested.`);
  return ingested;
}

async function downloadBanglishSample() {
  const outFile = path.join(DATA_DIR, 'banglish_sample.json');
  if (fs.existsSync(outFile)) {
    console.log('  ✓ Banglish dataset sample already downloaded.');
    return outFile;
  }
  console.log('  ↓ Downloading Banglish Reviews sample...');
  const url = 'https://huggingface.co/datasets/BanglishRev/bangla-english-and-code-mixed-ecommerce-review-dataset/resolve/main/reviews%20v1.json';
  try {
    const res = await axios.get(url, {
      headers: {
        'Range': 'bytes=0-500000'
      },
      timeout: 30000
    });
    fs.writeFileSync(outFile, res.data);
    console.log(`  ✓ Saved chunk to ${outFile}`);
    return outFile;
  } catch (err) {
    console.warn(`  [!] Failed to download Banglish dataset: ${err.message}`);
    return null;
  }
}

async function ingestBanglishSample(filePath, maxEntries = 500) {
  if (!filePath || !fs.existsSync(filePath)) {
    console.log('  ⏭ Skipping Banglish Dataset (file not available).');
    return 0;
  }
  console.log(`\n📊 Processing Banglish E-commerce Reviews (max ${maxEntries} entries)...`);
  const content = fs.readFileSync(filePath, 'utf8');
  const regex = /"Review Content"\s*:\s*("(?:[^"\\]|\\.)*")/g;
  let match;
  let ingested = 0;
  
  while ((match = regex.exec(content)) !== null && ingested < maxEntries) {
    try {
      const reviewText = JSON.parse(match[1]);
      if (!reviewText || reviewText.length < 15) continue;
      
      const fact = `[E-commerce Review Pattern] Mixed Bangla/English review style: "${reviewText}"`;
      const success = await addMemoryToBrain(fact, 'BanglishRev:Dataset', 'DatasetIngester', {
        groupId: '__dataset_banglish',
        speaker: 'ecommerce_buyer'
      });
      if (success) {
        ingested++;
        if (ingested % 25 === 0) {
          console.log(`  [${ingested}/${maxEntries}] Ingested...`);
          await sleep(500);
        }
      }
    } catch (e) {
      continue;
    }
  }
  console.log(`  ✅ Banglish Reviews: ${ingested} entries ingested.`);
  return ingested;
}

async function main() {
  console.log(`

║    📦 Kitsune Brain — Dataset Ingestion Tool     ║

`);
  console.log('🔌 Checking Brain API...');
  const alive = await checkBrainAPI();
  if (!alive) {
    console.error('❌ Brain API is not running! Start it first:');
    console.error('   pm2 start ecosystem.config.js --only kitsune-brain');
    process.exit(1);
  }
  console.log('✅ Brain API is online.\n');
  console.log('🔌 Checking Ollama...');
  try {
    await axios.get('http://localhost:11434/api/tags', {
      timeout: 5000
    });
    console.log('✅ Ollama is online.\n');
  } catch {
    console.error('❌ Ollama is not running! Start it first.');
    process.exit(1);
  }
  let totalIngested = 0;
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('📥 Dataset 1/4: GoEmotions (Reddit emotions)');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  try {
    const goFile = await downloadGoEmotions();
    totalIngested += await ingestGoEmotions(goFile, 500);
  } catch (err) {
    console.error('  ❌ GoEmotions failed:', err.message);
  }
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('📥 Dataset 2/4: Anthropic HH-RLHF (conversation style)');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  try {
    const hhFile = await downloadHHRLHF();
    totalIngested += await ingestHHRLHF(hhFile, 200);
  } catch (err) {
    console.error('  ❌ HH-RLHF failed:', err.message);
  }
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('📥 Dataset 3/4: Stanford Sentiment Treebank');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  try {
    const sstFile = await downloadSST();
    totalIngested += await ingestSST(sstFile, 300);
  } catch (err) {
    console.error('  ❌ SST failed:', err.message);
  }
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('📥 Dataset 4/4: Banglish E-commerce Reviews');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  try {
    const banglishFile = await downloadBanglishSample();
    totalIngested += await ingestBanglishSample(banglishFile, 500);
  } catch (err) {
    console.error('  ❌ Banglish Dataset failed:', err.message);
  }
  console.log('\n═══════════════════════════════════════');
  console.log(`  ✅ Dataset ingestion complete!`);
  console.log(`  📊 Total memories added: ${totalIngested}`);
  try {
    const stats = await axios.get(`${BRAIN_URL}/stats`);
    console.log(`  🧠 Total Vector DB size: ${stats.data.vectorMemories} memories`);
    console.log(`  💾 Heap used: ${stats.data.memoryUsageMB.heapUsed} MB`);
  } catch {}
  console.log('═══════════════════════════════════════\n');
}
main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});