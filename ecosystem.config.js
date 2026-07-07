
const MODULE_CATEGORIES = [
    { name: 'kitsune-pokemon',    category: 'pokemon',    port: 3401 },
    { name: 'kitsune-fun',        category: 'fun',        port: 3402 },
    { name: 'kitsune-moderation', category: 'moderation', port: 3403 },
    { name: 'kitsune-family',     category: 'family',     port: 3404 },
    { name: 'kitsune-meme',       category: 'meme',       port: 3405 },
    { name: 'kitsune-reactions',  category: 'reactions',  port: 3406 },
    { name: 'kitsune-snipe',      category: 'snipe',      port: 3407 },
    { name: 'kitsune-utility',    category: 'utility',    port: 3408 },
];

const moduleApps = MODULE_CATEGORIES.map(mod => ({
    name: mod.name,
    script: 'services/module-api.js',
    args: `${mod.category} ${mod.port}`,
    cwd: __dirname,
    watch: false,
    autorestart: true,
    env: { NODE_ENV: 'production' },
    out_file: '/dev/null',
    error_file: 'logs/kitsune-brain-error.log',
    kill_timeout: 5000
}));

module.exports = {
    apps: [
        {
            name: 'celestia-wa-bot',
            script: 'index.js',
            cwd: __dirname,
            watch: false,
            autorestart: true,
            exp_backoff_restart_delay: 100,
            max_restarts: 0,
            min_uptime: '10s',
            restart_delay: 3000,
            env: { NODE_ENV: 'production' },
            out_file: '/dev/null',
            error_file: 'logs/kitsune-brain-error.log',
            kill_timeout: 10000,
            listen_timeout: 30000
        },

        ...moduleApps,

        {
            name: 'kitsune-brain',
            script: 'server.js',
            cwd: __dirname + '/kitsune-brain',
            watch: false,
            autorestart: true,
            exp_backoff_restart_delay: 100,
            max_restarts: 0,
            min_uptime: '10s',
            restart_delay: 3000,
            env: { NODE_ENV: 'production', BRAIN_PORT: 3100 },
            out_file: '/dev/null',
            error_file: 'logs/kitsune-brain-error.log',
            kill_timeout: 10000
        },

        {
            name: 'kitsune-receiver',
            script: 'scripts/receiver.js',
            cwd: __dirname,
            watch: false,
            autorestart: true,
            env: { NODE_ENV: 'production' },
            out_file: '/dev/null',
            error_file: 'logs/kitsune-brain-error.log'
        },

        {
            name: 'kitsune-watchdog',
            script: 'scripts/network-watchdog.js',
            cwd: __dirname,
            watch: false,
            max_memory_restart: '128M',
            autorestart: true,
            exp_backoff_restart_delay: 100,
            max_restarts: 0,
            min_uptime: '5s',
            env: { NODE_ENV: 'production' },
            out_file: '/dev/null',
            error_file: 'logs/kitsune-brain-error.log',
            node_args: ['--max-old-space-size=96'],
            kill_timeout: 5000
        },

        {
            name: 'kitsune-control-centre',
            script: 'scripts/control-centre-api.js',
            cwd: __dirname,
            watch: false,
            autorestart: true,
            env: { NODE_ENV: 'production' },
            out_file: '/dev/null',
            error_file: 'logs/kitsune-brain-error.log'
        }
    ]
};