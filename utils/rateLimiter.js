
const { FATHER } = require('../config');




const CATEGORY_DEFAULTS = {
    fun:        { maxHits: 4, windowMs: 15_000 },   
    meme:       { maxHits: 3, windowMs: 20_000 },   
    pokemon:    { maxHits: 3, windowMs: 15_000 },   
    family:     { maxHits: 3, windowMs: 15_000 },   
    moderation: { maxHits: 3, windowMs: 20_000 },   
    reactions:  { maxHits: 3, windowMs: 20_000 },   
    snipe:      { maxHits: 4, windowMs: 15_000 },   
    utility:    { maxHits: 4, windowMs: 15_000 },   
};



const COMMAND_OVERRIDES = {
    
    daily:       { maxHits: 1, windowMs: 10_000 },   
    weekly:      { maxHits: 1, windowMs: 10_000 },
    monthly:     { maxHits: 1, windowMs: 10_000 },
    gacha:       { maxHits: 2, windowMs: 20_000 },   
    exchange:    { maxHits: 2, windowMs: 20_000 },   
    pokegift:    { maxHits: 2, windowMs: 20_000 },
    itemgift:    { maxHits: 2, windowMs: 20_000 },
    pokecoin:    { maxHits: 2, windowMs: 15_000 },
    pokemart:    { maxHits: 3, windowMs: 20_000 },
    pokeuse:     { maxHits: 3, windowMs: 20_000 },
    fight:       { maxHits: 1, windowMs: 30_000 },   
    wish:        { maxHits: 1, windowMs: 30_000 },   
    omega:       { maxHits: 2, windowMs: 30_000 },
    omegamart:   { maxHits: 2, windowMs: 20_000 },
    raid:        { maxHits: 2, windowMs: 30_000 },
    spawn:       { maxHits: 2, windowMs: 30_000 },   
    prestige:    { maxHits: 1, windowMs: 30_000 },
    radiant:     { maxHits: 2, windowMs: 20_000 },
    connect:     { maxHits: 2, windowMs: 20_000 },
    compare:     { maxHits: 3, windowMs: 20_000 },
    pokemon:     { maxHits: 4, windowMs: 15_000 },   
    pokedex:     { maxHits: 4, windowMs: 15_000 },
    pokelist:    { maxHits: 3, windowMs: 15_000 },
    profile:     { maxHits: 4, windowMs: 15_000 },   
    balance:     { maxHits: 4, windowMs: 15_000 },   
    baltop:      { maxHits: 2, windowMs: 20_000 },   
    pokeboard:   { maxHits: 2, windowMs: 20_000 },
    inventory:   { maxHits: 4, windowMs: 15_000 },   
    giveaway:    { maxHits: 2, windowMs: 20_000 },

    
    marry:       { maxHits: 2, windowMs: 30_000 },
    divorce:     { maxHits: 2, windowMs: 30_000 },
    adopt:       { maxHits: 2, windowMs: 20_000 },
    disown:      { maxHits: 2, windowMs: 20_000 },

    
    meme:        { maxHits: 3, windowMs: 15_000 },
    dank:        { maxHits: 3, windowMs: 15_000 },

    
    ping:        { maxHits: 2, windowMs: 30_000 },   
    everyone:    { maxHits: 1, windowMs: 60_000 },   
    help:        { maxHits: 3, windowMs: 15_000 },

    
    ban:         { maxHits: 3, windowMs: 30_000 },
    kick:        { maxHits: 3, windowMs: 30_000 },
};


const ACTION_LIMITS = {
    catch: {
        maxHits: 5,
        windowMs: 15_000,
        message: '⏳ _Too many catch attempts! Slow down, trainer._ 🐢\n_Wait a few seconds before trying again._'
    },
    ai_chat: {
        maxHits: 3,
        windowMs: 30_000,
        message: '⏳ _I need a moment to breathe! Too many messages at once._\n_Try again in a few seconds._ 🦊'
    },
    activation: {
        maxHits: 2,
        windowMs: 30_000,
        message: null
    },
    tos: {
        maxHits: 3,
        windowMs: 60_000,
        message: null
    },
    father_give: {
        maxHits: 10,
        windowMs: 30_000,
        message: null
    },
    giveaway_enter: {
        maxHits: 3,
        windowMs: 30_000,
        message: '⏳ _Slow down on the giveaway entries!_'
    },
    service_control: {
        maxHits: 3,
        windowMs: 30_000,
        message: '⏳ _Too many service control commands. Wait a moment._'
    },
    
    command_global: {
        maxHits: 5,
        windowMs: 15_000,
        message: '⏳ _Slow down! You\'re sending commands too fast._\n_Wait a few seconds before trying again._ 🐢'
    }
};


const CMD_RATE_LIMIT_MSG = '⏳ _Slow down! You\'re using this command too fast._\n_Wait a few seconds before trying again._ 🐢';


const TIMEOUTS = {
    command_execute: 30_000,
    ai_generate: 600_000,
    catch_attempt: 15_000,
    module_request: 15_000,
    media_download: 20_000,
};


const rateLimits = new Map();
const CLEANUP_INTERVAL_MS = 60_000;
let cleanupTimer = null;

function getCommandConfig(commandName, category) {
    if (COMMAND_OVERRIDES[commandName]) {
        return COMMAND_OVERRIDES[commandName];
    }
    if (category && CATEGORY_DEFAULTS[category]) {
        return CATEGORY_DEFAULTS[category];
    }
    return ACTION_LIMITS.command_global;
}

function checkCommandLimit(userId, commandName, category) {
    if (FATHER.includes(userId)) {
        return { allowed: true, remaining: Infinity, retryAfterMs: 0, message: null };
    }

    const config = getCommandConfig(commandName, category);
    const action = `cmd:${commandName}`;

    return _check(userId, action, config.maxHits, config.windowMs, CMD_RATE_LIMIT_MSG);
}

function checkRateLimit(userId, action) {
    if (FATHER.includes(userId)) {
        return { allowed: true, remaining: Infinity, retryAfterMs: 0, message: null };
    }

    const config = ACTION_LIMITS[action];
    if (!config) {
        return { allowed: true, remaining: Infinity, retryAfterMs: 0, message: null };
    }

    return _check(userId, action, config.maxHits, config.windowMs, config.message);
}

function _check(userId, action, maxHits, windowMs, message) {
    const now = Date.now();

    if (!rateLimits.has(userId)) {
        rateLimits.set(userId, new Map());
    }
    const userActions = rateLimits.get(userId);
    if (!userActions.has(action)) {
        userActions.set(action, []);
    }

    const timestamps = userActions.get(action);

    
    const windowStart = now - windowMs;
    while (timestamps.length > 0 && timestamps[0] <= windowStart) {
        timestamps.shift();
    }

    if (timestamps.length >= maxHits) {
        const oldestInWindow = timestamps[0];
        const retryAfterMs = (oldestInWindow + windowMs) - now;
        return {
            allowed: false,
            remaining: 0,
            retryAfterMs: Math.max(0, retryAfterMs),
            message: message || null
        };
    }

    timestamps.push(now);

    return {
        allowed: true,
        remaining: maxHits - timestamps.length,
        retryAfterMs: 0,
        message: null
    };
}

function recordHit(userId, action) {
    if (!rateLimits.has(userId)) {
        rateLimits.set(userId, new Map());
    }
    const userActions = rateLimits.get(userId);
    if (!userActions.has(action)) {
        userActions.set(action, []);
    }
    userActions.get(action).push(Date.now());
}

function wrapWithTimeout(promise, timeoutMs, label = 'Operation') {
    return new Promise((resolve, reject) => {
        const timer = setTimeout(() => {
            reject(new TimeoutError(`${label} timed out after ${timeoutMs}ms`));
        }, timeoutMs);

        promise
            .then(result => {
                clearTimeout(timer);
                resolve(result);
            })
            .catch(err => {
                clearTimeout(timer);
                reject(err);
            });
    });
}

class TimeoutError extends Error {
    constructor(message) {
        super(message);
        this.name = 'TimeoutError';
        this.isTimeout = true;
    }
}

function getUserStats(userId) {
    if (!rateLimits.has(userId)) return {};
    const userActions = rateLimits.get(userId);
    const stats = {};
    const now = Date.now();

    for (const [action, timestamps] of userActions.entries()) {
        
        let windowMs = 15_000; 
        if (action.startsWith('cmd:')) {
            const cmdName = action.slice(4);
            const cfg = COMMAND_OVERRIDES[cmdName] || ACTION_LIMITS.command_global;
            windowMs = cfg.windowMs;
        } else if (ACTION_LIMITS[action]) {
            windowMs = ACTION_LIMITS[action].windowMs;
        }
        const windowStart = now - windowMs;
        const activeHits = timestamps.filter(t => t > windowStart).length;
        stats[action] = { hits: activeHits };
    }
    return stats;
}

function resetLimits(userId = null) {
    if (userId) {
        rateLimits.delete(userId);
    } else {
        rateLimits.clear();
    }
}

function cleanup() {
    const now = Date.now();
    
    const maxWindow = 120_000;
    for (const [userId, userActions] of rateLimits.entries()) {
        for (const [action, timestamps] of userActions.entries()) {
            const cutoff = now - maxWindow;
            while (timestamps.length > 0 && timestamps[0] <= cutoff) {
                timestamps.shift();
            }
            if (timestamps.length === 0) {
                userActions.delete(action);
            }
        }
        if (userActions.size === 0) {
            rateLimits.delete(userId);
        }
    }
}

function startCleanup() {
    if (cleanupTimer) return;
    cleanupTimer = setInterval(cleanup, CLEANUP_INTERVAL_MS);
    if (cleanupTimer.unref) cleanupTimer.unref();
}

function stopCleanup() {
    if (cleanupTimer) {
        clearInterval(cleanupTimer);
        cleanupTimer = null;
    }
}

startCleanup();

module.exports = {
    checkRateLimit,
    checkCommandLimit,
    getCommandConfig,
    recordHit,
    wrapWithTimeout,
    TimeoutError,
    getUserStats,
    resetLimits,
    cleanup,
    startCleanup,
    stopCleanup,
    ACTION_LIMITS,
    CATEGORY_DEFAULTS,
    COMMAND_OVERRIDES,
    TIMEOUTS
};
