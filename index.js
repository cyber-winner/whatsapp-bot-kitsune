require('dotenv').config();
const config = require('./config');
const vibe = require('vibe-rewards');
if (config.VIBE_REWARDS_API_KEY) {
    vibe.init(config.VIBE_REWARDS_API_KEY);
}
console.log("Hello World");
const {
  Client,
  LocalAuth
} = require('whatsapp-web.js');
const mongoose = require('mongoose');
const qrcode = require('qrcode-terminal');
const connectDB = require('./db/connect');
const {
  loadCommands
} = require('./handlers/commandHandler');
const {
  registerEvents
} = require('./handlers/eventHandler');
const { startWaApiServer } = require('./wa_api_server');
const fs = require('fs');
const path = require('path');
const {
  execSync
} = require('child_process');
const groupStore = require('./store/groupStore');
const banStore = require('./store/banStore');
const autoreactStore = require('./store/autoreactStore');
const knownUserStore = require('./store/knownUserStore');
const immuneStore = require('./store/immuneStore');
const ownerStore = require('./store/ownerStore');
const pokemonGroupStore = require('./store/pokemonGroupStore');
const tosStore = require('./store/tosStore');

console.log(`

║  ⋆｡‧˚ʚ🍓ɞ˚‧｡⋆  KITSUNE  ⋆｡‧˚ʚ🍓ɞ˚‧｡⋆   ║
║         v2.0.0 — Microservices            ║

`);
function cleanUpZombieSessions() {
  if (process.env.GITHUB_ACTIONS) return;
  console.log('🧹 Cleaning up stale Chrome/Puppeteer sessions and duplicate bot instances...');
  try {
    if (process.platform === 'linux') {
      try {
        execSync("pkill -9 -f '.wwebjs_auth/session' 2>/dev/null || true", {
          stdio: 'ignore'
        });
        console.log('  ✓ Killed all stale WhatsApp headless Chrome processes.');
      } catch (_) {}
    }
  } catch (err) {
    console.warn('  ⚠️ Chrome cleanup error:', err.message);
  }
  const lockPath = path.resolve(__dirname, '.wwebjs_auth/session/SingletonLock');
  try {
    if (fs.existsSync(lockPath)) {
      fs.unlinkSync(lockPath);
      console.log('  ✓ Removed stale SingletonLock file.');
    }
  } catch (err) {
    console.warn('  ⚠️ Failed to remove SingletonLock:', err.message);
  }
  const cacheDirs = ['Service Worker', 'Cache', 'Code Cache', 'GPUCache'];
  for (const dir of cacheDirs) {
    const p = path.resolve(__dirname, '.wwebjs_auth/session/Default', dir);
    try {
      if (fs.existsSync(p)) {
        fs.rmSync(p, {
          recursive: true,
          force: true
        });
      }
    } catch (_) {}
  }
  console.log('  ✓ Cleared browser caches.');
  const wwebjsCacheDir = path.resolve(__dirname, '.wwebjs_cache');
  try {
    if (fs.existsSync(wwebjsCacheDir)) {
      const files = fs.readdirSync(wwebjsCacheDir).filter(f => f.endsWith('.html'));
      if (files.length > 1) {
        const sortedFiles = files
          .map(f => ({ name: f, time: fs.statSync(path.join(wwebjsCacheDir, f)).mtimeMs }))
          .sort((a, b) => b.time - a.time);
        for (let i = 1; i < sortedFiles.length; i++) {
          fs.unlinkSync(path.join(wwebjsCacheDir, sortedFiles[i].name));
        }
        console.log(`  ✓ Cleaned up ${sortedFiles.length - 1} old .wwebjs_cache HTML files.`);
      }
    }
  } catch (err) {
    console.warn('  ⚠️ Failed to clean .wwebjs_cache:', err.message);
  }
  try {
    execSync('sleep 2', {
      stdio: 'ignore'
    });
  } catch (_) {}
}
async function start() {
  cleanUpZombieSessions();
  await connectDB();
  console.log('📂 Loading database stores...');
  await groupStore.loadAll();
  await banStore.loadAll();
  await autoreactStore.loadAll();
  await knownUserStore.loadAll();
  await immuneStore.loadAll();
  await ownerStore.loadAll();
  await pokemonGroupStore.loadAll();
  await tosStore.loadAll();
  console.log('✅ All stores loaded into memory.\n');
  const client = new Client({
    authStrategy: new LocalAuth({
      dataPath: './.wwebjs_auth'
    }),
    puppeteer: {
      headless: true,
      executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || '/usr/bin/google-chrome-stable',
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-accelerated-2d-canvas', '--no-first-run', '--no-zygote', '--disable-gpu']
    }
  });
  client.on('qr', qr => {
    console.log('\n📱 Scan this QR code with WhatsApp:\n');
    qrcode.generate(qr, {
      small: true
    });
    console.log('\nWaiting for scan...\n');
  });
  client.on('authenticated', () => {
    console.log('🔐 Authenticated successfully (session restored from disk).');
    
    
    global.readyWatchdog = setTimeout(() => {
      console.error('⏳ [WATCHDOG] Client got stuck at authenticated and never reached ready state. Force restarting...');
      process.exit(1);
    }, 180000);
    
    const dismissInterval = setInterval(async () => {
      try {
        if (client.pupPage) {
          const dismissed = await client.pupPage.evaluate(() => {
            const useHereBtn = Array.from(document.querySelectorAll('div[role="button"]')).find(b => b.innerText && b.innerText.includes('Use Here'));
            if (useHereBtn) { useHereBtn.click(); return true; }
            const closeBtn = document.querySelector('button[aria-label="Close"]:not([data-tab])');
            if (closeBtn) { closeBtn.click(); return true; }
            return false;
          });
          if (dismissed) {
            console.log('🧹 Automatically dismissed a "What\'s New" or similar popup modal.');
            clearInterval(dismissInterval);
          }
        }
      } catch (e) {
      }
    }, 1000);

    setTimeout(() => clearInterval(dismissInterval), 120000);
  });
  client.on('auth_failure', err => {
    console.error('❌ Authentication failed:', err);
    process.exit(1);
  });
  client.on('ready', async () => {
    if (global.readyWatchdog) clearTimeout(global.readyWatchdog);
    global.BOT_ID = client.info.wid.user;
    console.log('═══════════════════════════════════════');
    console.log('  🌟 Kitsune is ONLINE and ready! 🎀 ⋆ ˚｡⋆୨୧˚');
    console.log(`  📞 Logged in as: ${client.info.pushname} (${client.info.wid.user})`);
    console.log('  💡 Say "Kitsune activate" in a group to enable. ૮ ˶ᵔ ᵕ ᵔ˶ ა');
    console.log('═══════════════════════════════════════\n');

    startWaApiServer(client, config.WA_API_PORT);
    
    try {
      const { registerMapping } = require('./utils/getUserId');
      console.log('🔄 Building LID↔Phone mapping from contacts...');
      const contacts = await client.getContacts();
      let mappingCount = 0;
      const lids = [];
      for (const contact of contacts) {
        const serialized = contact.id?._serialized || '';
        const isLid = serialized.endsWith('@lid');
        const rawId = serialized.split('@')[0];
        if (isLid) {
          if (contact.number && rawId !== contact.number) {
            registerMapping(rawId, contact.number);
            mappingCount++;
          } else {
            lids.push(serialized);
          }
        }
      }
      console.log(`ℹ️ Found ${lids.length} LID contacts without direct .number field.`);
      if (lids.length > 0 && typeof client.getContactLidAndPhone === 'function') {
        console.log(`🔄 Resolving ${lids.length} LIDs via getContactLidAndPhone...`);
        const chunkSize = 50;
        for (let i = 0; i < lids.length; i += chunkSize) {
          const chunk = lids.slice(i, i + chunkSize);
          try {
            const resolved = await client.getContactLidAndPhone(chunk);
            if (resolved && Array.isArray(resolved)) {
              for (const item of resolved) {
                if (item.lid && item.pn) {
                  const rawLid = item.lid.split('@')[0];
                  const rawPhone = item.pn.split('@')[0];
                  if (rawLid && rawPhone && rawLid !== rawPhone) {
                    registerMapping(rawLid, rawPhone);
                    mappingCount++;
                  }
                }
              }
            }
          } catch (chunkErr) {
            console.error(`⚠️ Failed to resolve LID chunk starting at index ${i}:`, chunkErr.message);
          }
        }
      }
      console.log(`✅ Built ${mappingCount} LID↔Phone mappings from ${contacts.length} contacts.`);
    } catch (mapErr) {
      console.warn('⚠️  LID mapping build failed:', mapErr.message);
    }
    
    try {
      const personaClient = require('./store/personaClient');
      const alive = await personaClient.isAlive();
      if (alive) {
        console.log(`🧠 Kitsune Brain API connected at ${personaClient.BRAIN_URL}`);
      } else {
        console.warn('⚠️  Kitsune Brain API is NOT running! Start it with: pm2 start ecosystem.config.js --only kitsune-brain');
      }
    } catch (peErr) {
      console.warn('⚠️  Could not reach Kitsune Brain API:', peErr.message);
    }
  });
  client.on('disconnected', reason => {
    console.warn('⚠️  Bot disconnected:', reason);
    console.log('Attempting to reconnect...');
    client.initialize();
  });
  console.log('📂 Loading commands...\n');
  loadCommands(client);
  registerEvents(client);
  const shutdown = async signal => {
    console.log(`\n🛑 ${signal} received. Shutting down gracefully...`);
    try {
      await client.destroy();
      console.log('✅ WhatsApp client destroyed cleanly.');
    } catch (e) {
      console.warn('⚠️ Client destroy error:', e.message);
    }
    process.exit(0);
  };
  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
  console.log('🔄 Initializing WhatsApp connection...\n');
  client.initialize();
}
start();