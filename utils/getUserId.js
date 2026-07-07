
const lidToPhoneMap = {};
const phoneToLidMap = {};

function registerMapping(lid, phoneNumber) {
    if (!lid || !phoneNumber || lid === phoneNumber) return;
    lidToPhoneMap[lid] = phoneNumber;
    phoneToLidMap[phoneNumber] = lid;
}

function getPhoneFromLid(lid) {
    return lidToPhoneMap[lid] || null;
}

function getLidFromPhone(phone) {
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
