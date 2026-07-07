const express = require('express');
const { execFile } = require('child_process');
const path = require('path');
const fs = require('fs');
const axios = require('axios');
const si = require('systeminformation');
const crypto = require('crypto');
const economyStore = require('../store/economyStore');
const gachaStore = require('../store/gachaStore');
const { internalAuthHeaders } = require('../utils/internalAuth');

require('dotenv').config({ path: path.join(__dirname, '..', '.env'), override: true });
const config = require('../config');
const connectDB = require('../db/connect');
connectDB();
const KnownUser = require('../models/KnownUser');
const PlayerWallet = require('../models/PlayerWallet');
const Pokemon = require('../models/Pokemon');
const UserSession = require('../models/UserSession');

const app = express();

app.disable('x-powered-by');
app.set('trust proxy', 1); 
app.use((req, res, next) => {
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
    res.setHeader('Referrer-Policy', 'no-referrer');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval' https://cdn.tailwindcss.com https://unpkg.com https://*.cloudflareinsights.com; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data: https:; connect-src 'self' https://*.cloudflareinsights.com https://api.pokemontcg.io; base-uri 'none'; object-src 'none';");
    next();
});

const rateLimit = require('express-rate-limit');
const apiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, 
    max: 300, 
    message: { success: false, error: 'Too many requests, please try again later.' },
    standardHeaders: true,
    legacyHeaders: false,
});

app.use('/api/', apiLimiter);

app.use('/api/control-centre', express.json({ limit: '10kb' })); 
app.use(express.json({ limit: '10kb' }));

const helmet = require('helmet');
const hpp = require('hpp');


app.use(helmet({
    contentSecurityPolicy: false,
    crossOriginEmbedderPolicy: false
}));


app.use(hpp());


app.use((req, res, next) => {
    const ua = req.headers['user-agent'] || '';
    const maliciousAgents = [
        'curl', 'postman', 'python-requests', 'wget', 'scrapy', 'go-http-client', 
        'nmap', 'sqlmap', 'zmeu', 'nikto', 'dirbuster', 'java/', 'ruby', 'perl', 'headlesschrome'
    ];
    
    if (maliciousAgents.some(agent => ua.toLowerCase().includes(agent))) {
        console.warn(`[Anti-Bot] Blocked suspicious User-Agent: ${ua}`);
        return res.status(403).json({ success: false, error: 'Access denied: Automated bot detected.' });
    }
    
    
    try {
        const urlDecoded = decodeURIComponent(req.originalUrl || '').toLowerCase();
        if (urlDecoded.includes('<script') || urlDecoded.includes('union select') || urlDecoded.includes('../..') || urlDecoded.includes('etc/passwd')) {
            console.warn(`[WAF] Blocked malicious payload in URL: ${req.originalUrl}`);
            return res.status(403).json({ success: false, error: 'Access denied: Malicious request detected.' });
        }
    } catch(e) {
        
    }

    next();
});

const CONTROL_CENTRE_PASSWORD = process.env.CONTROL_CENTRE_PASSWORD;
const USER_SESSION_TTL_MS = parseInt(process.env.USER_SESSION_TTL_MS || '', 10) || 7 * 24 * 60 * 60 * 1000;
const OTP_TTL_MS = parseInt(process.env.OTP_TTL_MS || '', 10) || 5 * 60 * 1000;
const OTP_REQUEST_COOLDOWN_MS = parseInt(process.env.OTP_REQUEST_COOLDOWN_MS || '', 10) || 60 * 1000;
const OTP_MAX_REQUESTS_PER_HOUR = parseInt(process.env.OTP_MAX_REQUESTS_PER_HOUR || '', 10) || 5;
const OTP_MAX_ATTEMPTS = parseInt(process.env.OTP_MAX_ATTEMPTS || '', 10) || 5;

if (!CONTROL_CENTRE_PASSWORD) {
    console.warn('[ControlCentre] CONTROL_CENTRE_PASSWORD is not configured. Admin routes will reject all requests.');
}

const waApiClient = axios.create({
    baseURL: `http://${config.API_HOST}:${config.WA_API_PORT}`,
    headers: internalAuthHeaders()
});

function isAdminPassword(password) {
    return Boolean(CONTROL_CENTRE_PASSWORD) && password === CONTROL_CENTRE_PASSWORD;
}

function requireAdminPassword(req, res) {
    if (!isAdminPassword(req.body?.password)) {
        res.status(401).json({ error: 'Unauthorized' });
        return false;
    }
    return true;
}

function normalizeIndianNumber(number) {
    const digits = String(number || '').replace(/\D/g, '');
    if (digits.length === 10) return digits;
    if (digits.length === 12 && digits.startsWith('91')) return digits.slice(2);
    return null;
}


async function createSession(lid) {
    const token = crypto.randomBytes(32).toString('base64url');
    const expiresAt = new Date(Date.now() + USER_SESSION_TTL_MS);
    await UserSession.create({ token, lid, expiresAt });
    return token;
}

function getBearerToken(req) {
    const header = req.get('authorization') || '';
    return header.startsWith('Bearer ') ? header.slice(7) : '';
}

async function requireUserSession(req, res, next) {
    const token = getBearerToken(req);
    if (!token) return res.status(401).json({ success: false, error: 'Unauthorized' });

    try {
        const session = await UserSession.findOne({ token });
        if (!session || session.expiresAt <= new Date()) {
            if (session) await UserSession.deleteOne({ token });
            return res.status(401).json({ success: false, error: 'Session expired. Please log in again.' });
        }
        
        session.expiresAt = new Date(Date.now() + USER_SESSION_TTL_MS);
        await session.save();
        req.user = { lid: session.lid };
        next();
    } catch (e) {
        console.error('[Session] DB error:', e.message);
        return res.status(500).json({ success: false, error: 'Session lookup failed.' });
    }
}

function escapeRegex(value) {
    return String(value || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

app.use((req, res, next) => {
    const origin = req.headers.origin || '';
    const host   = req.headers.host || '';
    const allowed =
        origin.includes('localhost') ||
        origin.includes('127.0.0.1') ||
        (process.env.ALLOWED_ORIGIN && origin.includes(process.env.ALLOWED_ORIGIN)) ||
        origin.includes(host);

    if (origin && allowed) {
        res.header('Access-Control-Allow-Origin', origin);
        res.header('Access-Control-Allow-Credentials', 'true');
    }
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
    res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    if (req.method === 'OPTIONS') return res.sendStatus(200);
    next();
});

app.use('/api', (req, res, next) => {
    const secFetchDest = req.headers['sec-fetch-dest'];
    const secFetchSite = req.headers['sec-fetch-site'];
    
    if (secFetchDest === 'document' || secFetchSite === 'none') {
        return res.status(403).json({ success: false, error: 'Direct API access forbidden. API must be accessed via the web client.' });
    }

    const origin = req.headers.origin;
    const referer = req.headers.referer;
    if (req.method !== 'OPTIONS' && !origin && !referer) {
        return res.status(403).json({ success: false, error: 'Strict mode: Missing Origin or Referer headers.' });
    }

    next();
});

const MODULE_MAP = {
    pokemon:    { port: 3401, pm2: 'kitsune-pokemon' },
    fun:        { port: 3402, pm2: 'kitsune-fun' },
    moderation: { port: 3403, pm2: 'kitsune-moderation' },
    family:     { port: 3404, pm2: 'kitsune-family' },
    meme:       { port: 3405, pm2: 'kitsune-meme' },
    reactions:  { port: 3406, pm2: 'kitsune-reactions' },
    snipe:      { port: 3407, pm2: 'kitsune-snipe' },
    utility:    { port: 3408, pm2: 'kitsune-utility' },
};

app.use('/assets', express.static(path.join(__dirname, '..', 'frontend', 'dist', 'assets')));
app.use('/data', express.static(path.join(__dirname, '..', 'data')));



app.get('/api/pokemon/all', (req, res) => {
    try {
        const pokemonList = require('../data/pokemon.json');
        res.json({ success: true, pokemons: pokemonList.filter(p => p.isSpawnable !== false) });
    } catch(err) {
        res.json({ success: false, error: err.message });
    }
});

app.get('/download-hub', (req, res) => {
    
    const dockerImagePath = path.join(__dirname, '..', 'kitsune-bot.tar.gz');
    const dockerImageExists = fs.existsSync(dockerImagePath);
    let dockerImageSize = '';
    if (dockerImageExists) {
        const stats = fs.statSync(dockerImagePath);
        dockerImageSize = (stats.size / (1024 * 1024)).toFixed(0) + ' MB';
    }

    res.send(`
        <!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Kitsune | Download Hub</title>
            <style>
                @import url('https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;600;800&display=swap');
                * { box-sizing: border-box; margin: 0; padding: 0; }
                body {
                    background: #0B0E14;
                    color: #fff;
                    font-family: 'Outfit', sans-serif;
                    display: flex;
                    justify-content: center;
                    align-items: center;
                    min-height: 100vh;
                    overflow-x: hidden;
                    padding: 40px 20px;
                }
                .page-wrapper {
                    position: relative;
                    z-index: 10;
                    width: 100%;
                    max-width: 520px;
                    display: flex;
                    flex-direction: column;
                    gap: 24px;
                }
                .header-card {
                    background: rgba(20, 25, 35, 0.7);
                    backdrop-filter: blur(16px);
                    border: 1px solid rgba(255, 255, 255, 0.08);
                    border-radius: 24px;
                    padding: 40px 40px 30px;
                    text-align: center;
                    box-shadow: 0 20px 40px rgba(0,0,0,0.4);
                }
                .logo {
                    width: 80px;
                    height: 80px;
                    background: linear-gradient(135deg, #ff2a5f, #ff7e40);
                    border-radius: 50%;
                    margin: 0 auto 20px;
                    display: flex;
                    justify-content: center;
                    align-items: center;
                    font-size: 36px;
                    box-shadow: 0 10px 20px rgba(255, 42, 95, 0.3);
                    animation: pulse 3s ease-in-out infinite;
                }
                @keyframes pulse {
                    0%, 100% { box-shadow: 0 10px 20px rgba(255, 42, 95, 0.3); }
                    50% { box-shadow: 0 10px 30px rgba(255, 42, 95, 0.5), 0 0 60px rgba(255, 126, 64, 0.15); }
                }
                h1 {
                    font-size: 30px;
                    font-weight: 800;
                    margin-bottom: 8px;
                    background: linear-gradient(135deg, #fff, #a0a5b5);
                    -webkit-background-clip: text;
                    -webkit-text-fill-color: transparent;
                }
                .subtitle { color: #8a91a6; font-size: 14px; line-height: 1.5; }
                .auth-section {
                    background: rgba(20, 25, 35, 0.7);
                    backdrop-filter: blur(16px);
                    border: 1px solid rgba(255, 255, 255, 0.08);
                    border-radius: 20px;
                    padding: 28px;
                    box-shadow: 0 20px 40px rgba(0,0,0,0.4);
                }
                .auth-section .input-group { margin-bottom: 16px; }
                input {
                    width: 100%;
                    background: rgba(0, 0, 0, 0.3);
                    border: 1px solid rgba(255,255,255,0.1);
                    padding: 14px 18px;
                    border-radius: 12px;
                    color: #fff;
                    font-family: 'Outfit', sans-serif;
                    font-size: 15px;
                    transition: all 0.3s;
                }
                input:focus {
                    outline: none;
                    border-color: #ff2a5f;
                    box-shadow: 0 0 0 3px rgba(255, 42, 95, 0.2);
                }
                .download-cards {
                    display: flex;
                    flex-direction: column;
                    gap: 14px;
                }
                .dl-card {
                    background: rgba(255, 255, 255, 0.03);
                    border: 1px solid rgba(255, 255, 255, 0.07);
                    border-radius: 16px;
                    padding: 20px;
                    display: flex;
                    align-items: center;
                    gap: 16px;
                    cursor: pointer;
                    transition: all 0.3s ease;
                    position: relative;
                    overflow: hidden;
                }
                .dl-card::before {
                    content: '';
                    position: absolute;
                    inset: 0;
                    opacity: 0;
                    transition: opacity 0.3s;
                    border-radius: 16px;
                }
                .dl-card:hover {
                    border-color: rgba(255, 255, 255, 0.15);
                    transform: translateY(-2px);
                    box-shadow: 0 8px 24px rgba(0,0,0,0.3);
                }
                .dl-card:active { transform: translateY(0); }
                .dl-card.source::before { background: linear-gradient(135deg, rgba(255, 42, 95, 0.08), rgba(255, 126, 64, 0.05)); }
                .dl-card.docker::before { background: linear-gradient(135deg, rgba(30, 144, 255, 0.08), rgba(0, 200, 255, 0.05)); }
                .dl-card:hover::before { opacity: 1; }
                .dl-icon {
                    width: 48px;
                    height: 48px;
                    border-radius: 12px;
                    display: flex;
                    justify-content: center;
                    align-items: center;
                    font-size: 22px;
                    flex-shrink: 0;
                    position: relative;
                    z-index: 1;
                }
                .dl-icon.source { background: linear-gradient(135deg, #ff2a5f, #ff7e40); }
                .dl-icon.docker { background: linear-gradient(135deg, #1e90ff, #00c8ff); }
                .dl-info { flex: 1; text-align: left; position: relative; z-index: 1; }
                .dl-info h3 { font-size: 16px; font-weight: 700; margin-bottom: 3px; color: #fff; }
                .dl-info .dl-desc { font-size: 12px; color: #6b7280; line-height: 1.4; }
                .dl-badge {
                    font-size: 11px;
                    padding: 4px 10px;
                    border-radius: 20px;
                    font-weight: 600;
                    position: relative;
                    z-index: 1;
                    flex-shrink: 0;
                }
                .dl-badge.source { background: rgba(255, 42, 95, 0.15); color: #ff6b8a; }
                .dl-badge.docker { background: rgba(30, 144, 255, 0.15); color: #5bb8ff; }
                .dl-card.disabled {
                    opacity: 0.4;
                    cursor: not-allowed;
                    pointer-events: none;
                }
                .status-msg {
                    text-align: center;
                    font-size: 13px;
                    padding: 10px;
                    border-radius: 10px;
                    display: none;
                    margin-top: 8px;
                }
                .status-msg.error { display: block; background: rgba(255, 74, 74, 0.1); color: #ff4a4a; border: 1px solid rgba(255, 74, 74, 0.2); }
                .status-msg.loading { display: block; background: rgba(255, 200, 50, 0.1); color: #ffc832; border: 1px solid rgba(255, 200, 50, 0.2); }
                .status-msg.success { display: block; background: rgba(50, 255, 120, 0.1); color: #32ff78; border: 1px solid rgba(50, 255, 120, 0.2); }
                .footer-note {
                    text-align: center;
                    font-size: 12px;
                    color: #3a3f4d;
                    padding-top: 4px;
                }
                .bg-glow {
                    position: fixed;
                    width: 600px;
                    height: 600px;
                    background: radial-gradient(circle, rgba(255,42,95,0.12) 0%, rgba(0,0,0,0) 70%);
                    top: 30%;
                    left: 50%;
                    transform: translate(-50%, -50%);
                    z-index: 0;
                    pointer-events: none;
                }
                .bg-glow-blue {
                    position: fixed;
                    width: 400px;
                    height: 400px;
                    background: radial-gradient(circle, rgba(30,144,255,0.08) 0%, rgba(0,0,0,0) 70%);
                    bottom: 10%;
                    right: 10%;
                    z-index: 0;
                    pointer-events: none;
                }
            </style>
        </head>
        <body>
            <div class="bg-glow"></div>
            <div class="bg-glow-blue"></div>

            <div class="page-wrapper">
                <div class="header-card">
                    <div class="logo">🦊</div>
                    <h1>Download Hub</h1>
                    <p class="subtitle">Securely download Kitsune to deploy a new instance on any machine.</p>
                </div>

                <div class="auth-section">
                    <div class="input-group">
                        <input type="password" id="pwd" placeholder="🔑  Control Centre Password" required>
                    </div>

                    <div class="download-cards">
                        <div class="dl-card source" onclick="downloadFile('code')" id="card-code">
                            <div class="dl-icon source">📦</div>
                            <div class="dl-info">
                                <h3>Source Code</h3>
                                <div class="dl-desc">Full codebase — requires Node.js, Chrome & npm install</div>
                            </div>
                            <span class="dl-badge source">ZIP</span>
                        </div>

                        <div class="dl-card docker ${dockerImageExists ? '' : 'disabled'}" onclick="downloadFile('docker')" id="card-docker">
                            <div class="dl-icon docker">🐳</div>
                            <div class="dl-info">
                                <h3>Docker Image</h3>
                                <div class="dl-desc">${dockerImageExists ? 'Pre-built container — just load & run. Works on Linux, Windows & Mac' : 'Docker image not available on this server'}</div>
                            </div>
                            <span class="dl-badge docker">${dockerImageExists ? dockerImageSize : 'N/A'}</span>
                        </div>
                    </div>

                    <div class="status-msg" id="statusMsg"></div>
                </div>

                <div class="footer-note">Kitsune v2.0 · Files exclude .env, sessions & node_modules</div>
            </div>

            <script>
                function downloadFile(type) {
                    const pwd = document.getElementById('pwd').value;
                    const status = document.getElementById('statusMsg');

                    if (!pwd) {
                        status.className = 'status-msg error';
                        status.textContent = '🔑 Enter the Control Centre password first';
                        return;
                    }

                    status.className = 'status-msg loading';
                    status.textContent = type === 'docker' ? '🐳 Verifying & preparing Docker image...' : '📦 Verifying & generating archive...';

                    fetch('/api/control-centre/execute', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ action: 'verify', password: pwd })
                    })
                    .then(r => r.json())
                    .then(data => {
                        if (!data.success) throw new Error('Invalid password');

                        status.className = 'status-msg success';
                        status.textContent = type === 'docker' ? '✅ Starting Docker image download...' : '✅ Starting source code download...';

                        const endpoint = type === 'docker'
                            ? '/api/control-centre/download-docker?password=' + encodeURIComponent(pwd)
                            : '/api/control-centre/download-code?password=' + encodeURIComponent(pwd);

                        window.location.href = endpoint;

                        setTimeout(() => {
                            status.className = 'status-msg';
                            status.style.display = 'none';
                        }, 4000);
                    })
                    .catch(e => {
                        status.className = 'status-msg error';
                        status.textContent = '❌ Invalid password or server error';
                    });
                }

                // Allow Enter key to trigger first available download
                document.getElementById('pwd').addEventListener('keydown', (e) => {
                    if (e.key === 'Enter') {
                        e.preventDefault();
                        downloadFile('code');
                    }
                });
            </script>
        </body>
        </html>
    `);
});

app.get('/api/control-centre/download-code', async (req, res) => {
    const pwd = req.query.password;
    if (!isAdminPassword(pwd)) {
        return res.status(401).send('Unauthorized: Invalid Password');
    }

    const { exec } = require('child_process');
    const zipPath = `/tmp/kitsune-bot-code-${Date.now()}.zip`;
    const botDir = path.join(__dirname, '..');
    
    
    const cmd = `cd "${botDir}" && zip -r "${zipPath}" . -x "*.git*" "*node_modules*" "*.wwebjs_auth*" "*.wwebjs_cache*" "*frontend/node_modules*" "*.env*" "*.zip" "*.tar.gz" "global-messages/*" "store-data-for-use/*" "downloads/*" "scratch/*" "logs/*" "db/*" "*.deb" "*.csv"`;
    
    exec(cmd, { maxBuffer: 1024 * 1024 * 10 }, (err) => {
        if (err) {
            console.error('Zip Error:', err);
            return res.status(500).send('Failed to generate archive');
        }
        res.download(zipPath, 'kitsune-bot-code.zip', () => {
            if (fs.existsSync(zipPath)) fs.unlinkSync(zipPath);
        });
    });
});

app.get('/api/control-centre/download-docker', async (req, res) => {
    const pwd = req.query.password;
    if (!isAdminPassword(pwd)) {
        return res.status(401).send('Unauthorized: Invalid Password');
    }

    const dockerImagePath = path.join(__dirname, '..', 'kitsune-bot.tar.gz');
    if (!fs.existsSync(dockerImagePath)) {
        return res.status(404).send('Docker image not found. Build it first with: docker compose build');
    }

    res.download(dockerImagePath, 'kitsune-bot.tar.gz');
});

app.post('/api/control-centre/execute', async (req, res) => {
    if (!req.body || typeof req.body !== 'object') return res.status(400).json({ success: false, error: 'Invalid JSON payload' });
    const { action } = req.body;
    if (typeof action !== 'string' || !action.trim()) return res.status(400).json({ success: false, error: 'Missing or invalid action' });
    if (!requireAdminPassword(req, res)) return;

    const allowedPm2Processes = new Set([
        ...Object.values(MODULE_MAP).map(mod => mod.pm2),
        'celestia-wa-bot',
        'kitsune-brain',
        'kitsune-receiver',
        'kitsune-watchdog',
        'kitsune-control-centre'
    ]);
    const runPm2 = (args) => {
        execFile('pm2', args, { timeout: 30000 }, (err, stdout, stderr) => {
            if (err) return res.json({ success: false, error: err.message, output: stderr });
            return res.json({ success: true, output: stdout });
        });
    };

    switch(action) {
        case 'verify':
            return res.json({ success: true });
        
        case 'get-modules': {
            const checks = Object.entries(MODULE_MAP).map(async ([cat, info]) => {
                try {
                    const r = await axios.get(`http://localhost:${info.port}/health`, { timeout: 2000 });
                    return { 
                        category: cat, 
                        pm2Name: info.pm2,
                        online: true, 
                        commands: r.data.commands,
                        uptime: r.data.uptime 
                    };
                } catch {
                    return { category: cat, pm2Name: info.pm2, online: false };
                }
            });
            const modules = await Promise.all(checks);
            return res.json({ success: true, modules });
        }

        case 'module-toggle': {
            const { moduleName, targetState } = req.body;
            const mod = MODULE_MAP[moduleName];
            if (!mod) return res.json({ success: false, error: 'Unknown module' });
            const pm2Action = targetState ? 'start' : 'stop';
            return runPm2([pm2Action, mod.pm2]);
        }

        case 'module-restart': {
            const { moduleName } = req.body;
            const mod = MODULE_MAP[moduleName];
            if (!mod) return res.json({ success: false, error: 'Unknown module' });
            return runPm2(['restart', mod.pm2]);
        }

        case 'pm2-restart':
            return runPm2(['restart', 'all']);
        case 'pm2-stop':
            return runPm2(['stop', 'all']);
        case 'pm2-status':
            return runPm2(['status']);
        case 'pm2-jlist':
            execFile('pm2', ['jlist'], { timeout: 30000 }, (err, stdout) => {
                if (err) return res.json({ success: false, error: err.message });
                try {
                    const parsed = JSON.parse(stdout);
                    return res.json({ success: true, processes: parsed });
                } catch(e) {
                    return res.json({ success: false, error: 'Failed to parse pm2 jlist' });
                }
            });
            break;
        case 'pm2-service-toggle': {
            const { processName, targetPm2State } = req.body;
            if (!allowedPm2Processes.has(processName)) return res.json({ success: false, error: 'Unknown process' });
            return runPm2([targetPm2State ? 'start' : 'stop', processName]);
        }
        case 'pc-shutdown':
            if (process.env.ALLOW_HOST_POWER_CONTROL !== 'true') return res.json({ success: false, error: 'Host power control is disabled' });
            const pwdShutdown = process.env.SUDO_PASSWORD || process.env.CONTROL_CENTRE_PASSWORD || '';
            return execFile('sh', ['-c', `echo "${pwdShutdown}" | sudo -S shutdown -h now`], { timeout: 30000 }, (err, stdout, stderr) => {
                if (err) return res.json({ success: false, error: err.message, output: stderr });
                return res.json({ success: true, output: stdout });
            });
        case 'pc-reboot':
            if (process.env.ALLOW_HOST_POWER_CONTROL !== 'true') return res.json({ success: false, error: 'Host power control is disabled' });
            const pwdReboot = process.env.SUDO_PASSWORD || process.env.CONTROL_CENTRE_PASSWORD || '';
            return execFile('sh', ['-c', `echo "${pwdReboot}" | sudo -S reboot`], { timeout: 30000 }, (err, stdout, stderr) => {
                if (err) return res.json({ success: false, error: err.message, output: stderr });
                return res.json({ success: true, output: stdout });
            });
        default:
            return res.json({ success: false, error: 'Unknown action' });
    }
});

app.get('/api/control-centre/top-trainers', async (req, res) => {
    try {
        const topWallets = await PlayerWallet.find()
            .sort({ prestigeLevel: -1, pokecoins: -1 })
            .limit(10)
            .lean();
            
        const trainerIds = topWallets.map(w => w.userId);
        const knownUsers = await KnownUser.find({ lid: { $in: trainerIds } }).lean();
        const userMap = knownUsers.reduce((acc, user) => {
            acc[user.lid] = user.name;
            return acc;
        }, {});
        
        const topTrainers = [];
        for (const wallet of topWallets) {
            const pkmnCount = await Pokemon.countDocuments({ userId: wallet.userId });
            let profilePic = null;
            try {
                const picRes = await waApiClient.post('/api/getProfilePic', { contactId: wallet.userId });
                if (picRes.data && picRes.data.success) {
                    profilePic = picRes.data.url;
                }
            } catch(e) {}
            
            topTrainers.push({
                lid: wallet.userId,
                name: userMap[wallet.userId] || 'Unknown Trainer',
                prestigeLevel: wallet.prestigeLevel || 0,
                pokecoins: wallet.pokecoins || 0,
                pokeballs: wallet.pokeballs || 0,
                radiantCrystals: wallet.radiantCrystals || 0,
                pokemonCount: pkmnCount,
                profilePic: profilePic
            });
        }
        res.json({ success: true, trainers: topTrainers });
    } catch(err) {
        res.json({ success: false, error: err.message });
    }
});

const tcgCardCache = new Map();

app.post('/api/control-centre/search-pokemon', async (req, res) => {
    if (!req.body || typeof req.body !== 'object') return res.status(400).json({ success: false, error: 'Invalid JSON payload' });
    let { query } = req.body;
    if (typeof query !== 'string' || !query.trim()) return res.status(400).json({ success: false, error: 'Missing or invalid query string' });
    if (query && typeof query === 'string') {
        query = query.replace(/@c\.us$/, '');
    }
    try {
        let lid = query;
        let trainerName = 'Unknown Trainer';

        const userById = await KnownUser.findOne({ lid: query });
        if (userById) {
            trainerName = userById.name;
        } else {
            const userByName = await KnownUser.findOne({ name: { $regex: new RegExp('^' + escapeRegex(query) + '$', 'i') } });
            if (userByName) {
                lid = userByName.lid;
                trainerName = userByName.name;
            }
        }
        
        const wallet = await PlayerWallet.findOne({ userId: lid });
        if (!wallet) return res.json({ success: false, error: 'Profile not found' });
        
        const pokemons = await Pokemon.find({ userId: lid }).sort({ level: -1 });
        const pokemonList = require('../data/pokemon.json');
        
        const dex = {};
        for (const p of pokemons) {
            if (!dex[p.pokemonName]) {
                const staticData = pokemonList.find(x => x.name.toLowerCase() === p.pokemonName.toLowerCase());
                dex[p.pokemonName] = {
                    name: p.pokemonName,
                    count: 0,
                    bestLevel: 0,
                    cardImage: null, 
                    types: staticData?.types || [],
                    isLegendary: staticData?.isLegendary || false,
                    isMythical: staticData?.isMythical || false,
                };
            }
            dex[p.pokemonName].count++;
            if (p.level > dex[p.pokemonName].bestLevel) dex[p.pokemonName].bestLevel = p.level;
        }

        
        const uniqueNames = Object.keys(dex);
        await Promise.all(uniqueNames.map(async (name) => {
            if (!tcgCardCache.has(name)) {
                try {
                    const cleanName = name.replace(/ (ex|gx|v|vmax|vstar)$/i, '');
                    const tcgRes = await axios.get(`https://api.pokemontcg.io/v2/cards?q=name:"${encodeURIComponent(cleanName)}"&pageSize=1`, { timeout: 5000 });
                    if (tcgRes.data && tcgRes.data.data && tcgRes.data.data.length > 0) {
                        const img = tcgRes.data.data[0].images.large || tcgRes.data.data[0].images.small;
                        tcgCardCache.set(name, img);
                    } else {
                        tcgCardCache.set(name, null); // Cache the miss
                    }
                } catch(e) {
                    console.error('[TCG API Error] ' + name + ':', e.message);
                    tcgCardCache.set(name, null); // Cache null to avoid retry spam on failure
                }
            }

            const cachedImg = tcgCardCache.get(name);
            if (cachedImg) {
                dex[name].cardImage = cachedImg;
            } else {
                // Fallback to local JSON if API absolutely fails or finds nothing
                const staticData = pokemonList.find(x => x.name.toLowerCase() === name.toLowerCase());
                dex[name].cardImage = staticData?.cardImage || null;
            }
        }));
        
        let profilePic = null;
        try {
            const picRes = await waApiClient.post('/api/getProfilePic', { contactId: lid });
            if (picRes.data && picRes.data.success) {
                profilePic = picRes.data.url;
            }
        } catch(e) {}
        
        res.json({ 
            success: true, 
            profile: { ...wallet.toObject(), lid, name: trainerName, profilePic }, 
            pokemons: Object.values(dex)
        });
    } catch(err) {
        res.json({ success: false, error: err.message });
    }
});

const userOtps = new Map();
const otpRequestLimits = new Map();

app.post('/api/user/request-otp', async (req, res) => {
    if (!req.body || typeof req.body !== 'object') return res.status(400).json({ success: false, error: 'Invalid JSON payload' });
    if (typeof req.body.number !== 'string' && typeof req.body.number !== 'number') return res.status(400).json({ success: false, error: 'Invalid phone number format' });
    const number = normalizeIndianNumber(req.body.number);
    if (!number) return res.json({ success: false, error: 'Invalid number' });
    
    const wId = `91${number}@c.us`;
    const lid = `91${number}`;
    const now = Date.now();
    const limitKey = `${req.ip}:${lid}`;
    const currentLimit = otpRequestLimits.get(limitKey) || { count: 0, windowStart: now, lastRequestAt: 0 };
    if (now - currentLimit.windowStart >= 60 * 60 * 1000) {
        currentLimit.count = 0;
        currentLimit.windowStart = now;
    }
    if (now - currentLimit.lastRequestAt < OTP_REQUEST_COOLDOWN_MS) {
        return res.status(429).json({ success: false, error: 'Please wait before requesting another OTP.' });
    }
    if (currentLimit.count >= OTP_MAX_REQUESTS_PER_HOUR) {
        return res.status(429).json({ success: false, error: 'Too many OTP requests. Try again later.' });
    }

    const otp = crypto.randomInt(100000, 1000000).toString();
    currentLimit.count += 1;
    currentLimit.lastRequestAt = now;
    otpRequestLimits.set(limitKey, currentLimit);
    userOtps.set(lid, { otp, expiresAt: now + OTP_TTL_MS, attempts: 0 });
    
    
    try {
        await waApiClient.post('/api/send', {
            chatId: wId,
            text: `🔑 *Kitsune Web Authentication*\n\nYour OTP is: *${otp}*\n\nPlease enter this on the website to login. Do not share this code with anyone.`
        });
        res.json({ success: true });
    } catch(e) {
        console.error('OTP Send Error:', e.message);
        res.json({ success: false, error: 'Failed to send OTP via WhatsApp. Is the bot running?' });
    }
});

app.post('/api/user/verify-otp', async (req, res) => {
    if (!req.body || typeof req.body !== 'object') return res.status(400).json({ success: false, error: 'Invalid JSON payload' });
    if (typeof req.body.number !== 'string' && typeof req.body.number !== 'number') return res.status(400).json({ success: false, error: 'Invalid phone number format' });
    if (typeof req.body.otp !== 'string' && typeof req.body.otp !== 'number') return res.status(400).json({ success: false, error: 'Invalid OTP format' });
    const number = normalizeIndianNumber(req.body.number);
    const otp = String(req.body.otp || '').trim();
    if (!number || !/^\d{6}$/.test(otp)) return res.json({ success: false, error: 'Invalid OTP' });
    const lid = `91${number}`;
    const record = userOtps.get(lid);
    
    if (!record || record.expiresAt <= Date.now()) {
        userOtps.delete(lid);
        return res.json({ success: false, error: 'OTP expired. Please request a new code.' });
    }

    record.attempts += 1;
    if (record.attempts > OTP_MAX_ATTEMPTS) {
        userOtps.delete(lid);
        return res.status(429).json({ success: false, error: 'Too many OTP attempts. Please request a new code.' });
    }

    if (record.otp !== otp) {
        userOtps.set(lid, record);
        return res.json({ success: false, error: 'Invalid OTP' });
    }

    userOtps.delete(lid);
    
    let trainerName = 'Unknown Trainer';
    const user = await KnownUser.findOne({ lid });
    if (user) trainerName = user.name;
    
    const token = await createSession(lid);
    res.json({ success: true, lid, name: trainerName, token });
});

app.get('/api/user/profile', requireUserSession, async (req, res) => {
    try {
        const wallet = await PlayerWallet.findOne({ userId: req.user.lid });
        if (!wallet) return res.json({ success: false, error: 'Profile not found' });

        const user = await KnownUser.findOne({ lid: req.user.lid });
        res.json({ success: true, lid: req.user.lid, name: user?.name || 'Unknown Trainer', wallet });
    } catch (e) {
        res.json({ success: false, error: e.message });
    }
});

app.post('/api/user/buy-item', requireUserSession, async (req, res) => {
    if (!req.body || typeof req.body !== 'object') return res.status(400).json({ success: false, error: 'Invalid JSON payload' });
    const { itemKey, qty } = req.body;
    if (typeof itemKey !== 'string' || !itemKey.trim()) return res.status(400).json({ success: false, error: 'Invalid itemKey' });
    if (qty !== undefined && typeof qty !== 'number') return res.status(400).json({ success: false, error: 'qty must be a number' });
    const lid = req.user.lid;
    if (!itemKey) return res.json({ success: false, error: 'Missing parameters' });
    try {
        const result = await economyStore.buyItem(lid, itemKey, qty || 1);
        res.json(result);
    } catch (e) {
        res.json({ success: false, reason: e.message });
    }
});

app.post('/api/user/use-item', requireUserSession, async (req, res) => {
    if (!req.body || typeof req.body !== 'object') return res.status(400).json({ success: false, error: 'Invalid JSON payload' });
    const { itemName, pokemonName } = req.body;
    if (typeof itemName !== 'string' || !itemName.trim()) return res.status(400).json({ success: false, error: 'Invalid itemName' });
    if (typeof pokemonName !== 'string' || !pokemonName.trim()) return res.status(400).json({ success: false, error: 'Invalid pokemonName' });
    const lid = req.user.lid;
    if (!itemName || !pokemonName) return res.json({ success: false, error: 'Missing parameters' });
    try {
        let result;
        if (itemName === 'Level Orb') {
            result = await economyStore.useLevelOrb(lid, pokemonName);
        } else if (itemName === 'Enchanted Stardust') {
            result = await economyStore.useEnchantedStardust(lid, pokemonName);
        } else {
            return res.json({ success: false, reason: 'unsupported_item' });
        }
        res.json(result);
    } catch (e) {
        res.json({ success: false, reason: e.message });
    }
});

app.post('/api/user/gacha-wish', requireUserSession, async (req, res) => {
    if (!req.body || typeof req.body !== 'object') return res.status(400).json({ success: false, error: 'Invalid JSON payload' });
    let { count } = req.body;
    if (count !== undefined && typeof count !== 'number') return res.status(400).json({ success: false, error: 'count must be a number' });
    const lid = req.user.lid;
    count = count || 1;
    if (count < 1 || count > 10) return res.json({ success: false, reason: 'invalid_count' });
    
    try {
        const inventory = await economyStore.getInventory(lid);
        const compassItem = inventory.items.find(i => i.itemName === 'Wishing Compass');
        const compassesOwned = compassItem ? compassItem.quantity : 0;
        
        if (compassesOwned < count) {
            return res.json({ success: false, reason: 'insufficient_compass', have: compassesOwned, need: count });
        }
        
        const consumed = await economyStore.removeInventoryItem(lid, 'Wishing Compass', count);
        if (!consumed) return res.json({ success: false, reason: 'consume_failed' });
        
        const { results, profile } = await gachaStore.executeWishes(lid, count, economyStore);
        res.json({ success: true, results, profile });
    } catch (e) {
        res.json({ success: false, reason: e.message });
    }
});

app.post('/api/control-centre/system-stats', async (req, res) => {
    if (!req.body || typeof req.body !== 'object') return res.status(400).json({ success: false, error: 'Invalid JSON payload' });
    if (!requireAdminPassword(req, res)) return;
    try {
        const [cpu, mem, os, battery, temp, currentLoad, diskLayout, networkInterfaces] = await Promise.all([
            si.cpu(),
            si.mem(),
            si.osInfo(),
            si.battery(),
            si.cpuTemperature(),
            si.currentLoad(),
            si.diskLayout(),
            si.networkInterfaces()
        ]);
        
        res.json({
            success: true,
            stats: {
                cpu: {
                    manufacturer: cpu.manufacturer,
                    brand: cpu.brand,
                    cores: cpu.cores,
                    speed: cpu.speed,
                    load: currentLoad.currentLoad.toFixed(2),
                    temp: temp.main ? temp.main.toFixed(1) : 'N/A'
                },
                memory: {
                    total: mem.total,
                    used: mem.active,
                    free: mem.available
                },
                os: {
                    platform: os.platform,
                    distro: os.distro,
                    release: os.release,
                    uptime: si.time().uptime
                },
                battery: {
                    hasBattery: battery.hasBattery,
                    isCharging: battery.isCharging,
                    percent: battery.percent
                },
                disks: diskLayout.map(d => ({
                    name: d.name,
                    type: d.type,
                    size: d.size
                })),
                network: Array.isArray(networkInterfaces) ? networkInterfaces.filter(n => n.ip4).map(n => ({
                    iface: n.iface,
                    ip4: n.ip4,
                    mac: n.mac
                })) : []
            }
        });
    } catch (err) {
        res.json({ success: false, error: err.message });
    }
});

app.use((req, res) => {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
    res.sendFile(path.join(__dirname, '..', 'frontend', 'dist', 'index.html'));
});

const PORT = 8000;
app.listen(PORT, '0.0.0.0', () => {
    console.log(`[Kitsune Control Centre] Running on 0.0.0.0:${PORT}`);
});
