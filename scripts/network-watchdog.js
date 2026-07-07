
const fs = require('fs');
const path = require('path');
const { execFile } = require('child_process');
const { promisify } = require('util');
const execFileAsync = promisify(execFile);
require('dotenv').config({ path: path.join(__dirname, '..', '.env'), override: true });

const CHECK_INTERVAL_MS = 10_000;
const PROJECT_ROOT = path.resolve(__dirname, '..');

const MODULE_MAP = {
    pokemon:    'kitsune-pokemon',
    fun:        'kitsune-fun',
    moderation: 'kitsune-moderation',
    family:     'kitsune-family',
    meme:       'kitsune-meme',
    reactions:  'kitsune-reactions',
    snipe:      'kitsune-snipe',
    utility:    'kitsune-utility',
};

const ALL_MODULES = [
    ...Object.values(MODULE_MAP),
    'kitsune-brain',
    'kitsune-receiver'
];

const WATCH_RULES = [];

for (const [category, pm2Name] of Object.entries(MODULE_MAP)) {
    WATCH_RULES.push({
        dir: path.join(PROJECT_ROOT, 'commands', category),
        pm2Name,
        label: `commands/${category}`
    });
}

const SHARED_DIRS = ['store', 'utils', 'models'];
for (const dir of SHARED_DIRS) {
    WATCH_RULES.push({
        dir: path.join(PROJECT_ROOT, dir),
        pm2Name: Object.values(MODULE_MAP).join(' '),
        label: dir,
        isMulti: true
    });
}

let lastStateWasCharging = true;
let isShuttingDown = false;
const fileTimestamps = new Map();
const recentRestarts = new Map();
const RESTART_DEBOUNCE_MS = 3000;

function ts() {
    return new Date().toISOString().replace('T', ' ').slice(0, 19);
}

function emitHeartbeat() {
    fs.writeFileSync('/tmp/celestia_watchdog_heartbeat', Date.now().toString());
}
emitHeartbeat();

function getPowerState() {
    try {
        const acOnline = fs.readFileSync('/sys/class/power_supply/ACAD/online', 'utf8').trim();
        const batCap = parseInt(fs.readFileSync('/sys/class/power_supply/BAT1/capacity', 'utf8').trim());
        return { isCharging: acOnline === '1', capacity: batCap };
    } catch (e) {
        return { isCharging: true, capacity: 100 };
    }
}

async function stopAllModules() {
    console.log(`[${ts()}] 🔋 Power Disconnected! Stopping all modules...`);
    try {
        await execFileAsync('pm2', ['stop', ...ALL_MODULES]);
        console.log(`[${ts()}] ✅ All modules stopped. WA Bot running solo.`);
    } catch (e) {
        console.error(`[${ts()}] ⚠️ Failed to stop modules:`, e.message);
    }
}

async function startAllModules() {
    console.log(`[${ts()}] 🔌 Power Restored! Starting all modules...`);
    try {
        await execFileAsync('pm2', ['start', ...ALL_MODULES]);
        console.log(`[${ts()}] ✅ All modules started.`);
    } catch (e) {
        console.error(`[${ts()}] ⚠️ Failed to start modules:`, e.message);
    }
}

function scanDirRecursive(dir) {
    const results = [];
    try {
        const entries = fs.readdirSync(dir, { withFileTypes: true });
        for (const entry of entries) {
            const fullPath = path.join(dir, entry.name);
            if (entry.isDirectory()) {
                if (['node_modules', '.git', '__pycache__'].includes(entry.name)) continue;
                results.push(...scanDirRecursive(fullPath));
            } else if (entry.name.endsWith('.js') || entry.name.endsWith('.json') || entry.name.endsWith('.py')) {
                results.push(fullPath);
            }
        }
    } catch (e) {}
    return results;
}

function checkForFileChanges() {
    for (const rule of WATCH_RULES) {
        if (!fs.existsSync(rule.dir)) continue;

        const files = scanDirRecursive(rule.dir);
        for (const filePath of files) {
            try {
                const stat = fs.statSync(filePath);
                const mtime = stat.mtimeMs;
                const prevMtime = fileTimestamps.get(filePath);

                if (prevMtime === undefined) {
                    fileTimestamps.set(filePath, mtime);
                    continue;
                }

                if (mtime > prevMtime) {
                    fileTimestamps.set(filePath, mtime);
                    
                    const lastRestart = recentRestarts.get(rule.pm2Name) || 0;
                    if (Date.now() - lastRestart < RESTART_DEBOUNCE_MS) continue;
                    
                    const relPath = path.relative(PROJECT_ROOT, filePath);
                    console.log(`[${ts()}] 📝 File changed: ${relPath}`);
                    console.log(`[${ts()}] 🔄 Restarting: ${rule.pm2Name}`);
                    
                    recentRestarts.set(rule.pm2Name, Date.now());
                    execFile('pm2', ['restart', ...rule.pm2Name.split(' ')], (err) => {
                        if (err) {
                            console.error(`[${ts()}] ⚠️ Restart failed for ${rule.pm2Name}:`, err.message);
                        } else {
                            console.log(`[${ts()}] ✅ ${rule.pm2Name} restarted successfully.`);
                        }
                    });
                }
            } catch (e) {}
        }
    }
}

async function runCheck() {
    if (isShuttingDown) return;

    const state = getPowerState();
    if (state.isCharging !== lastStateWasCharging) {
        if (!state.isCharging) {
            await stopAllModules();
        } else {
            await startAllModules();
        }
        lastStateWasCharging = state.isCharging;
    }

    if (!state.isCharging && state.capacity <= 20 && !isShuttingDown) {
        isShuttingDown = true;
        console.log(`[${ts()}] 🚨 CRITICAL BATTERY (${state.capacity}%). Shutting down...`);
        try {
            if (process.env.ALLOW_HOST_POWER_CONTROL !== 'true') {
                throw new Error('Host power control is disabled');
            }
            const pwdWatchdog = process.env.SUDO_PASSWORD || process.env.CONTROL_CENTRE_PASSWORD || '';
            await execFileAsync('sh', ['-c', `echo "${pwdWatchdog}" | sudo -S shutdown -h now`]);
        } catch (e) {
            console.error(`[${ts()}] ⚠️ Shutdown failed:`, e.message);
        }
    }

    checkForFileChanges();

    emitHeartbeat();
    setTimeout(runCheck, CHECK_INTERVAL_MS);
}

console.log(`[${ts()}] 🐕 Kitsune Watchdog Started.`);
console.log(`[${ts()}] 📂 Watching ${WATCH_RULES.length} directories for changes.`);
console.log(`[${ts()}] 🔋 Power management active.`);

for (const rule of WATCH_RULES) {
    if (!fs.existsSync(rule.dir)) continue;
    const files = scanDirRecursive(rule.dir);
    for (const f of files) {
        try { fileTimestamps.set(f, fs.statSync(f).mtimeMs); } catch(e) {}
    }
}
console.log(`[${ts()}] 📊 Initial scan: ${fileTimestamps.size} files indexed.`);

runCheck();
