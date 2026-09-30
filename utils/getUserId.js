const fs = require('fs');
const path = require('path');

const MAPPINGS_FILE = path.join(__dirname, '..', 'data', 'lid_mappings.json');
let lidToPhoneMap = {};
let phoneToLidMap = {};

const dataDir = path.dirname(MAPPINGS_FILE);
if (!fs.existsSync(dataDir)) {
    try {
        fs.mkdirSync(dataDir, { recursive: true });
    } catch (e) {}
}

function loadMappingsFromFile() {
    try {
        if (fs.existsSync(MAPPINGS_FILE)) {
            const data = fs.readFileSync(MAPPINGS_FILE, 'utf8');
            lidToPhoneMap = JSON.parse(data);
            phoneToLidMap = {};
            for (const [lid, phone] of Object.entries(lidToPhoneMap)) {
                if (phone) phoneToLidMap[phone] = lid;
            }
        }
    } catch (e) {
        console.error('Failed to load LID mappings:', e.message);
    }
}
loadMappingsFromFile();

function saveMappings() {
    try {
        fs.writeFileSync(MAPPINGS_FILE, JSON.stringify(lidToPhoneMap, null, 2));
    } catch (e) {
        console.error('Failed to save LID mappings:', e.message);
    }
}

function registerMapping(lid, phoneNumber) {
    if (!lid || !phoneNumber || lid === phoneNumber) return;
    const cleanLid = lid.split('@')[0].split(':')[0];
    const cleanPhone = phoneNumber.split('@')[0].split(':')[0];

    if (lidToPhoneMap[cleanLid] === cleanPhone) return;
    
    lidToPhoneMap[cleanLid] = cleanPhone;
    phoneToLidMap[cleanPhone] = cleanLid;
    saveMappings();
}

function getPhoneFromLid(lid) {
    if (!lid) return null;
    const cleanLid = lid.split('@')[0].split(':')[0];
    return lidToPhoneMap[cleanLid] || null;
}

function getLidFromPhone(phone) {
    if (!phone) return null;
    const cleanPhone = phone.split('@')[0].split(':')[0];
    return phoneToLidMap[cleanPhone] || null;
}

/**
 * Returns a clean user identifier without destroying valid @lid identifiers or forcing string replacement.
 */
function getUserId(contact) {
    if (!contact) return '';
    
    if (typeof contact === 'string') {
        return contact.split('@')[0].split(':')[0];
    }

    const serialized = contact.id?._serialized || '';
    const rawId = contact.id?.user || serialized.split('@')[0] || '';
    const isLid = serialized.endsWith('@lid') || (typeof contact.id === 'string' && contact.id.endsWith('@lid'));
    const phoneNumber = contact.number || null;
    
    if (isLid) {
        if (phoneNumber && phoneNumber !== rawId) {
            registerMapping(rawId, phoneNumber);
        }
        return rawId;
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
