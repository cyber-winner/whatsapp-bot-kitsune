const fs = require('fs');
const path = require('path');
const { exec, execSync } = require('child_process');
const os = require('os');
const net = require('net');
const dns = require('dns').promises;
const axios = require('axios');
const config = require('../config');
const { OWNER_NAME } = require('../config');
const PROJECT_ROOT = path.resolve(__dirname, '..');

function isPathAllowed(p) { return path.resolve(p).startsWith(PROJECT_ROOT); }

const introspectToolDefinition = {
  type: 'function',
  function: {
    name: 'introspect_codebase',
    description: 'Read your own source code files, list directory structures, or inspect your architecture. Use this when Father or anyone asks about your internals, code, tools, stores, commands, or system.',
    parameters: {
      type: 'object',
      properties: {
        action: { type: 'string', enum: ['read_file','list_dir','architecture','list_tools','list_stores','list_commands','system_info'] },
        target: { type: 'string', description: 'Relative path for read_file/list_dir' }
      },
      required: ['action']
    }
  }
};

const selfDiagnosisToolDefinition = {
  type: 'function',
  function: {
    name: 'run_self_diagnosis',
    description: 'Run comprehensive self-diagnosis. Use when someone says "run self diagnosis", "health check", "system check", "diagnostics", or similar.',
    parameters: { type: 'object', properties: {}, required: [] }
  }
};

function readCodeFile(rel) {
  try {
    const fp = path.resolve(PROJECT_ROOT, rel);
    if (!isPathAllowed(fp)) return JSON.stringify({ error: 'Access denied' });
    if (!fs.existsSync(fp)) return JSON.stringify({ error: 'File not found: ' + rel });
    const s = fs.statSync(fp);
    if (s.isDirectory()) return JSON.stringify({ error: 'Is a directory, use list_dir' });
    if (s.size > 100000) return JSON.stringify({ error: 'File too large' });
    const c = fs.readFileSync(fp, 'utf8');
    return JSON.stringify({ file: rel, size: s.size, lines: c.split('\n').length, content: c.length > 6000 ? c.substring(0,6000)+'\n...[TRUNCATED]' : c });
  } catch (e) { return JSON.stringify({ error: e.message }); }
}

function listDirectory(rel = '') {
  try {
    const fp = path.resolve(PROJECT_ROOT, rel || '.');
    if (!isPathAllowed(fp) || !fs.existsSync(fp)) return JSON.stringify({ error: 'Invalid path' });
    return JSON.stringify({ directory: rel || '.', entries: fs.readdirSync(fp, {withFileTypes:true})
      .filter(e => !e.name.startsWith('.') && e.name !== 'node_modules')
      .map(e => e.isDirectory() ? {name:e.name,type:'dir',children:fs.readdirSync(path.join(fp,e.name)).length} : {name:e.name,type:'file',kb:(fs.statSync(path.join(fp,e.name)).size/1024).toFixed(1)})
    });
  } catch (e) { return JSON.stringify({ error: e.message }); }
}

function getArchitecture() {
  return JSON.stringify({
    name: 'Kitsune WhatsApp Bot v2.0 Microservices', creator: OWNER_NAME,
    services: { 'celestia-wa-bot':'WA Client (puppeteer)','kitsune-brain:3100':'AI Brain (Groq+tools+persona)','core-api:3400':'Command hub',
      'receiver:3200':'Remote logger','watchdog':'Network monitor','control-centre':'Web panel','autosync':'Git sync',
      'pokemon:3401':'Pokemon','fun:3402':'Fun','moderation:3403':'Mod','family:3404':'Family','meme:3405':'Meme','reactions:3406':'Reactions','snipe:3407':'Snipe','utility:3408':'Utility'},
    ai_tools: ['weather','datetime','news','fifa','web_search','url_reader','math','calculus','introspect','self_diagnosis'],
    stores: ['kitsuneMemory','personaEngine','messageLogger','pokemonStore','familyStore','knownUserStore','banStore','immuneStore','ownerStore','economyStore','raidStore','giveawayStore','battleStore','tosStore','snipeStore','autoreactStore','learningStateStore','apiManager'],
    key_files: ['config.js','index.js','core-api.js','handlers/eventHandler.js','kitsune-brain/server.js','utils/weatherTool.js','utils/introspectTool.js']
  }, null, 2);
}

function listAllTools() { return JSON.stringify(['weather(Open-Meteo)','datetime(local)','news(Google RSS)','fifa(ESPN)','search(DDG+Wiki)','url_reader(Jina)','math(mathjs)','calculus(SymPy)','introspect(local)','diagnosis(local)']); }
function listAllStores() { const d=path.join(PROJECT_ROOT,'store'); return JSON.stringify(fs.readdirSync(d).filter(f=>f.endsWith('.js')).map(f=>({file:f,kb:(fs.statSync(path.join(d,f)).size/1024).toFixed(1)}))); }
function listAllCommands() { const d=path.join(PROJECT_ROOT,'commands'); const r={}; fs.readdirSync(d,{withFileTypes:true}).filter(x=>x.isDirectory()).forEach(c=>{r[c.name]=fs.readdirSync(path.join(d,c.name)).filter(f=>f.endsWith('.js')).map(f=>f.replace('.js',''));}); return JSON.stringify(r,null,2); }
function getSystemInfo() { const m=process.memoryUsage(); return JSON.stringify({node:process.version,os:`${os.type()} ${os.release()}`,cpu:os.cpus()[0]?.model,cores:os.cpus().length,ram_gb:(os.totalmem()/1e9).toFixed(1),free_gb:(os.freemem()/1e9).toFixed(1),load:os.loadavg(),uptime_s:Math.round(process.uptime()),heap_mb:Math.round(m.heapUsed/1e6)}); }

function executeIntrospection(action, target) {
  switch(action) {
    case 'read_file': return readCodeFile(target||'');
    case 'list_dir': return listDirectory(target||'');
    case 'architecture': return getArchitecture();
    case 'list_tools': return listAllTools();
    case 'list_stores': return listAllStores();
    case 'list_commands': return listAllCommands();
    case 'system_info': return getSystemInfo();
    default: return JSON.stringify({error:'Unknown action'});
  }
}





function checkPort(port) {
  return new Promise(r => {
    const t = Date.now(), s = new net.Socket();
    s.setTimeout(2000);
    s.on('connect', () => { s.destroy(); r({up:true,ms:Date.now()-t}); });
    s.on('timeout', () => { s.destroy(); r({up:false,ms:'>2s'}); });
    s.on('error', () => { s.destroy(); r({up:false,ms:'-'}); });
    s.connect(port, config.API_HOST || '127.0.0.1');
  });
}

function pm2List() {
  return new Promise(r => {
    exec('pm2 jlist', {timeout:5000}, (e,o) => {
      if (e) return r([]);
      try { r(JSON.parse(o)); } catch { r([]); }
    });
  });
}

function safeExec(cmd, timeout=5000) {
  try { return execSync(cmd, {timeout, encoding:'utf8'}).trim(); } catch { return null; }
}

async function httpCheck(url, timeout=5000) {
  try { const r = await axios.get(url, {timeout, headers: {'User-Agent': 'Mozilla/5.0 (compatible; KitsuneBot/2.0)'}}); return {up:true,status:r.status}; }
  catch(e) { return {up:false,err:e.code||e.message}; }
}

async function runSelfDiagnosis() {
  const R = { timestamp: new Date().toISOString(), sections: [], problems: [], score: 0, max: 0 };
  const add = (section, name, status, detail) => {
    if (!R.sections.find(s=>s.name===section)) R.sections.push({name:section,checks:[]});
    R.sections.find(s=>s.name===section).checks.push({name,status,detail});
    R.max += 10;
    if (status === 'PASS') R.score += 10;
    else if (status === 'WARN') R.score += 5;
    else R.problems.push(`${name}: ${detail}`);
  };

  
  const ports = {WA:config.WA_API_PORT || 3300,Brain:config.BRAIN_PORT || 3100,Receiver:3200,Pokemon:3401,Fun:3402,Mod:3403,Family:3404,Meme:3405,Reactions:3406,Snipe:3407,Utility:3408};
  const portResults = await Promise.all(Object.entries(ports).map(async ([n,p]) => ({n,p,...await checkPort(p)})));
  for (const p of portResults) add('🔌 Service Ports', `${p.n} (:${p.p})`, p.up?'PASS':'FAIL', p.up?`Online (${p.ms}ms)`:'Unreachable');

  
  const procs = await pm2List();
  const expected = ['celestia-wa-bot','kitsune-brain','kitsune-receiver','kitsune-watchdog','kitsune-pokemon','kitsune-fun','kitsune-moderation','kitsune-family','kitsune-meme','kitsune-reactions','kitsune-snipe','kitsune-utility','kitsune-control-centre'];
  let totalBotRam = 0;
  for (const name of expected) {
    const p = procs.find(x => x.name === name);
    if (!p) { add('⚙️ PM2 Processes', name, 'FAIL', 'Not found'); continue; }
    const mem = p.monit?.memory ? (p.monit.memory/1e6).toFixed(0) : '?';
    const cpu = p.monit?.cpu ?? '?';
    const restarts = p.pm2_env?.restart_time ?? 0;
    const status = p.pm2_env?.status;
    totalBotRam += (p.monit?.memory || 0);
    if (status !== 'online') { add('⚙️ PM2 Processes', name, 'FAIL', `${status} | ${restarts} restarts`); continue; }
    const warn = restarts > 50 ? 'WARN' : 'PASS';
    add('⚙️ PM2 Processes', name, warn, `Online | ${mem}MB RAM | ${cpu}% CPU | ${restarts} restarts`);
  }
  add('⚙️ PM2 Processes', 'Total Bot RAM', totalBotRam/1e6 > 3000 ? 'WARN' : 'PASS', `${(totalBotRam/1e6).toFixed(0)}MB across all services`);

  
  const memFile = path.join(PROJECT_ROOT, 'store-data-for-use/kitsune_memory.json');
  try {
    if (fs.existsSync(memFile)) {
      const d = JSON.parse(fs.readFileSync(memFile,'utf8'));
      const sizeMB = (fs.statSync(memFile).size/1e6).toFixed(1);
      add('💾 Data Stores', 'Vector Memory', 'PASS', `${d.length} memories | ${sizeMB}MB on disk`);
    } else add('💾 Data Stores', 'Vector Memory', 'WARN', 'File missing');
  } catch(e) { add('💾 Data Stores', 'Vector Memory', 'FAIL', 'Corrupted: '+e.message); }

  const personaDb = path.join(PROJECT_ROOT, 'kitsune-brain/persona_engine.db');
  if (fs.existsSync(personaDb)) {
    add('💾 Data Stores', 'Persona Engine DB', 'PASS', `${(fs.statSync(personaDb).size/1024).toFixed(0)}KB SQLite`);
  } else add('💾 Data Stores', 'Persona Engine DB', 'WARN', 'Missing');

  const pokFile = path.join(PROJECT_ROOT, 'data/pokemon.json');
  try {
    const pd = JSON.parse(fs.readFileSync(pokFile,'utf8'));
    add('💾 Data Stores', 'Pokémon DB', 'PASS', `${pd.length} Pokémon loaded`);
  } catch { add('💾 Data Stores', 'Pokémon DB', 'FAIL', 'Missing or corrupted'); }

  
  try {
    const env = fs.readFileSync(path.join(PROJECT_ROOT,'.env'),'utf8');
    const mongoMatch = env.match(/MONGODB_URI\s*=\s*(.+)/);
    if (mongoMatch) {
      const mongoResult = await httpCheck('http://localhost:27017', 2000);
      add('💾 Data Stores', 'MongoDB', mongoResult.up ? 'PASS' : 'WARN', mongoResult.up ? 'Port 27017 reachable' : 'Port check failed (may use remote Atlas)');
    } else add('💾 Data Stores', 'MongoDB', 'WARN', 'MONGODB_URI not in .env');
  } catch { add('💾 Data Stores', 'MongoDB', 'WARN', 'Could not check'); }

  
  const logDir = path.join(PROJECT_ROOT, 'logs');
  try {
    if (fs.existsSync(logDir)) {
      let totalLogMB = 0;
      fs.readdirSync(logDir).forEach(f => { try { totalLogMB += fs.statSync(path.join(logDir,f)).size/1e6; } catch {} });
      add('💾 Data Stores', 'Log Files', totalLogMB > 500 ? 'WARN' : 'PASS', `${totalLogMB.toFixed(1)}MB total`);
    }
  } catch {}


  
  const extChecks = [
    ['Open-Meteo (Weather)', 'https://api.open-meteo.com/v1/forecast?latitude=0&longitude=0&current=temperature_2m'],
    ['MathJS API', 'http://api.mathjs.org/v4/?expr=1%2B1'],
    ['DuckDuckGo API', 'https://api.duckduckgo.com/?q=test&format=json'],
    ['Google News RSS', 'https://news.google.com/rss?hl=en-IN&gl=IN&ceid=IN:en'],
    ['Wikipedia API', 'https://en.wikipedia.org/w/api.php?action=query&titles=Main%20Page&format=json'],
    ['Jina Reader API', 'https://r.jina.ai/https://example.com'],
  ];
  const extResults = await Promise.allSettled(extChecks.map(async ([name, url]) => {
    const r = await httpCheck(url, 8000);
    return {name, ...r};
  }));
  for (const er of extResults) {
    if (er.status === 'fulfilled') {
      const v = er.value;
      add('🌐 External APIs', v.name, v.up?'PASS':'FAIL', v.up?`Reachable (HTTP ${v.status})`:`Down: ${v.err}`);
    }
  }

  
  const sympyVer = safeExec('python3 -c "import sympy; print(sympy.__version__)"');
  add('🌐 External APIs', 'SymPy (local)', sympyVer?'PASS':'FAIL', sympyVer?`v${sympyVer}`:'python3/sympy unavailable');

  
  try {
    const espn = await httpCheck('https://site.api.espn.com/apis/site/v2/sports/soccer/fifa.world/scoreboard', 5000);
    add('🌐 External APIs', 'ESPN FIFA API', espn.up?'PASS':'WARN', espn.up?'Reachable':'Down');
  } catch { add('🌐 External APIs', 'ESPN FIFA', 'WARN', 'Check failed'); }

  
  const totalGB = (os.totalmem()/1e9).toFixed(1);
  const freeGB = (os.freemem()/1e9).toFixed(1);
  const usedPct = Math.round(((os.totalmem()-os.freemem())/os.totalmem())*100);
  add('🖥️ Hardware', 'RAM', usedPct>90?'FAIL':usedPct>75?'WARN':'PASS', `${usedPct}% used (${freeGB}GB free / ${totalGB}GB total)`);

  const load1 = os.loadavg()[0], load5 = os.loadavg()[1], load15 = os.loadavg()[2], cores = os.cpus().length;
  add('🖥️ Hardware', 'CPU Load', load1>cores*2?'FAIL':load1>cores?'WARN':'PASS', `1m: ${load1.toFixed(2)} | 5m: ${load5.toFixed(2)} | 15m: ${load15.toFixed(2)} (${cores} cores)`);

  try {
    const t = (parseInt(fs.readFileSync('/sys/class/thermal/thermal_zone0/temp','utf8'))/1000).toFixed(1);
    add('🖥️ Hardware', 'CPU Temp', t>85?'FAIL':t>70?'WARN':'PASS', `${t}°C`);
  } catch { add('🖥️ Hardware', 'CPU Temp', 'WARN', 'Sensor unavailable'); }

  try {
    const ac = fs.readFileSync('/sys/class/power_supply/ACAD/online','utf8').trim();
    const bat = fs.readFileSync('/sys/class/power_supply/BAT1/capacity','utf8').trim();
    const charging = ac === '1';
    add('🖥️ Hardware', 'Power', !charging&&parseInt(bat)<20?'FAIL':!charging?'WARN':'PASS', charging?`🔌 Charging (${bat}%)`:`🔋 Battery (${bat}%)`);
  } catch { add('🖥️ Hardware', 'Power', 'PASS', 'AC/Desktop'); }

  const dfOut = safeExec('df -h / --output=size,used,avail,pcent | tail -1');
  if (dfOut) {
    const parts = dfOut.trim().split(/\s+/);
    const pct = parseInt(parts[3]);
    add('🖥️ Hardware', 'Disk', pct>90?'FAIL':pct>75?'WARN':'PASS', `${parts[1]} used / ${parts[0]} total (${parts[3]}) | ${parts[2]} free`);
  }

  const sysUp = os.uptime();
  const d = Math.floor(sysUp/86400), h = Math.floor((sysUp%86400)/3600), m = Math.floor((sysUp%3600)/60);
  add('🖥️ Hardware', 'System Uptime', 'PASS', `${d}d ${h}h ${m}m`);
  add('🖥️ Hardware', 'CPU', 'PASS', `${os.cpus()[0]?.model} (${cores} cores)`);

  
  const gpuOut = safeExec('nvidia-smi --query-gpu=name,memory.used,memory.total,temperature.gpu --format=csv,noheader');
  if (gpuOut) {
    const gp = gpuOut.split(', ');
    add('🖥️ Hardware', 'GPU', parseInt(gp[3])>90?'WARN':'PASS', `${gp[0]} | VRAM: ${gp[1]}/${gp[2]} | ${gp[3]}°C`);
  } else add('🖥️ Hardware', 'GPU', 'PASS', 'No dedicated GPU');

  
  const inet = await httpCheck('https://1.1.1.1', 5000);
  add('📡 Network', 'Internet', inet.up?'PASS':'FAIL', inet.up?'Connected (Cloudflare DNS reachable)':'NO INTERNET');

  try {
    const dnsRes = await dns.resolve4('google.com');
    add('📡 Network', 'DNS Resolution', dnsRes.length>0?'PASS':'WARN', dnsRes.length>0?`google.com → ${dnsRes[0]}`:'No IPs found');
  } catch(e) {
    add('📡 Network', 'DNS Resolution', 'WARN', `DNS check failed: ${e.message}`);
  }

  
  const ifaces = os.networkInterfaces();
  const activeIfs = Object.entries(ifaces).filter(([n]) => !n.startsWith('lo')).map(([n,addrs]) => {
    const v4 = addrs.find(a => a.family === 'IPv4');
    return v4 ? `${n}: ${v4.address}` : null;
  }).filter(Boolean);
  add('📡 Network', 'Interfaces', activeIfs.length>0?'PASS':'WARN', activeIfs.join(' | ') || 'No active interfaces');

  
  const criticalFiles = ['index.js','core-api.js','config.js','handlers/eventHandler.js','handlers/commandHandler.js','kitsune-brain/server.js','utils/weatherTool.js','utils/introspectTool.js','utils/sympy_solver.py','ecosystem.config.js','package.json'];
  let missing = [];
  for (const f of criticalFiles) { if (!fs.existsSync(path.join(PROJECT_ROOT,f))) missing.push(f); }
  add('📦 Codebase', 'Critical Files', missing.length===0?'PASS':'FAIL', missing.length===0?`All ${criticalFiles.length} files present`:`Missing: ${missing.join(', ')}`);

  
  try {
    const cmdDir = path.join(PROJECT_ROOT,'commands');
    let totalCmds = 0, cats = 0;
    fs.readdirSync(cmdDir,{withFileTypes:true}).filter(d=>d.isDirectory()).forEach(d => { cats++; totalCmds += fs.readdirSync(path.join(cmdDir,d.name)).filter(f=>f.endsWith('.js')).length; });
    add('📦 Codebase', 'Commands', 'PASS', `${totalCmds} commands across ${cats} categories`);
  } catch { add('📦 Codebase', 'Commands', 'WARN', 'Could not count'); }

  
  const gitBranch = safeExec('git -C ' + PROJECT_ROOT + ' branch --show-current');
  const gitDirty = safeExec('git -C ' + PROJECT_ROOT + ' status --porcelain');
  const gitCommit = safeExec('git -C ' + PROJECT_ROOT + ' log -1 --format="%h %s" 2>/dev/null');
  if (gitBranch) {
    const changedFiles = gitDirty ? gitDirty.split('\n').length : 0;
    add('📦 Codebase', 'Git Status', changedFiles>20?'WARN':'PASS', `Branch: ${gitBranch} | ${changedFiles} uncommitted changes | Last: ${gitCommit||'?'}`);
  }

  
  add('📦 Codebase', 'Node.js', 'PASS', process.version);
  const pm2v = safeExec('pm2 -v');
  if (pm2v) add('📦 Codebase', 'PM2', 'PASS', `v${pm2v}`);

  
  try {
    const pkg = JSON.parse(fs.readFileSync(path.join(PROJECT_ROOT,'package.json'),'utf8'));
    const depCount = Object.keys(pkg.dependencies||{}).length;
    const devCount = Object.keys(pkg.devDependencies||{}).length;
    add('📦 Codebase', 'Dependencies', 'PASS', `${depCount} deps + ${devCount} devDeps`);
  } catch {}

  
  try {
    const brainHealth = await httpCheck(`http://${config.API_HOST || '127.0.0.1'}:${config.BRAIN_PORT || 3100}/health`, 3000);
    if (brainHealth.up) {
      const stats = await axios.get(`http://${config.API_HOST || '127.0.0.1'}:${config.BRAIN_PORT || 3100}/stats`, {timeout:3000});
      const s = stats.data;
      add('🧠 AI Brain', 'Brain API', 'PASS', `Uptime: ${Math.round(s.uptime/60)}min | Heap: ${s.memoryUsageMB?.heapUsed}MB | Memories: ${s.vectorMemories} | Groups: ${s.trackedGroups}`);
    } else add('🧠 AI Brain', 'Brain API', 'FAIL', 'Not responding');
  } catch(e) { add('🧠 AI Brain', 'Brain API', 'FAIL', e.message); }

  
  try {
    const env = fs.readFileSync(path.join(PROJECT_ROOT,'.env'),'utf8');
    const model = env.match(/GROQ_MODEL\s*=\s*(.+)/);
    add('🧠 AI Brain', 'LLM Model', 'PASS', model ? model[1].trim() : 'llama-3.3-70b-versatile (default)');
  } catch {}

  add('🧠 AI Brain', 'Tools Available', 'PASS', '10 tools (weather, datetime, news, fifa, search, url, math, calculus, introspect, diagnosis)');

  
  const pct = Math.round((R.score / R.max) * 100);
  R.healthPct = pct;
  R.status = pct >= 90 ? '🟢 EXCELLENT' : pct >= 70 ? '🟡 GOOD' : pct >= 50 ? '🟠 DEGRADED' : '🔴 CRITICAL';
  const passed = R.sections.reduce((a,s) => a + s.checks.filter(c=>c.status==='PASS').length, 0);
  const warned = R.sections.reduce((a,s) => a + s.checks.filter(c=>c.status==='WARN').length, 0);
  const failed = R.sections.reduce((a,s) => a + s.checks.filter(c=>c.status==='FAIL').length, 0);
  const total = passed + warned + failed;
  R.summary = `${passed} passed, ${warned} warnings, ${failed} failures out of ${total} checks`;

  return JSON.stringify(R, null, 2);
}

module.exports = { introspectToolDefinition, selfDiagnosisToolDefinition, executeIntrospection, runSelfDiagnosis };
