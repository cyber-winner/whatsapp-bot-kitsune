const fs = require('fs');
const path = require('path');

const MAPPINGS_FILE = path.join(__dirname, '..', 'store-data-for-use', 'lid_mappings.json');
let lidToPhoneMap = {};
let phoneToLidMap = {};

// Auto-load on startup
function loadMappingsFromFile() {
    try {
        if (fs.existsSync(MAPPINGS_FILE)) {
            const data = fs.readFileSync(MAPPINGS_FILE, 'utf8');
            lidToPhoneMap = JSON.parse(data);
            phoneToLidMap = {};
            for (const [lid, phone] of Object.entries(lidToPhoneMap)) {
                phoneToLidMap[phone] = lid;
            }
        }
    } catch (e) {
        console.error('Failed to load LID mappings:', e.message);
    }
}
loadMappingsFromFile();

// Watch for cross-process updates
fs.watchFile(MAPPINGS_FILE, (curr, prev) => {
    if (curr.mtime > prev.mtime) {
        loadMappingsFromFile();
    }
});

function saveMappings() {
    try {
        fs.writeFileSync(MAPPINGS_FILE, JSON.stringify(lidToPhoneMap, null, 2));
    } catch (e) {
        console.error('Failed to save LID mappings:', e.message);
    }
}

function registerMapping(lid, phoneNumber) {
    if (!lid || !phoneNumber || lid === phoneNumber) return;
    if (lidToPhoneMap[lid] === phoneNumber) return; // Already mapped
    
    lidToPhoneMap[lid] = phoneNumber;
    phoneToLidMap[phoneNumber] = lid;
    saveMappings();
}

function getPhoneFromLid(lid) {
    if (lid === '73951434776709') return '919332723557'; // Hardcoded for FATHER
    return lidToPhoneMap[lid] || null;
}

function getLidFromPhone(phone) {
    if (phone === '919332723557') return '73951434776709'; // Hardcoded for FATHER
    return phoneToLidMap[phone] || null;
}

function getUserId(contact) {
    if (!contact) return '';
    
    const serialized = contact.id?._serialized || '';
    const rawId = contact.id?.user || serialized.split('@')[0] || '';
    const isLid = serialized.endsWith('@lid');
    const phoneNumber = contact.number || null;
    
    if (serialized.endsWith('@c.us') && rawId) {
        return rawId;
    }
    
    if (isLid && rawId && phoneNumber && phoneNumber !== rawId) {
        registerMapping(rawId, phoneNumber);
        return phoneNumber;
    }
    
    if (isLid && rawId) {
        const cachedPhone = getPhoneFromLid(rawId);
        if (cachedPhone) return cachedPhone;
    }
    
    if (phoneNumber && phoneNumber !== rawId) {
        return phoneNumber;
    }
    
    return rawId;
}

function getAllMappings() {
    return { ...lidToPhoneMap };
}

function loadMappings(mappings) {
    if (!mappings || typeof mappings !== 'object') return;
    for (const [lid, phone] of Object.entries(mappings)) {
        registerMapping(lid, phone);
    }
}

module.exports = { 
    getUserId, 
    registerMapping, 
    getPhoneFromLid, 
    getLidFromPhone, 
    getAllMappings, 
    loadMappings 
};
