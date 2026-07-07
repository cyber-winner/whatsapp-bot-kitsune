const fs = require('fs');
const path = require('path');

const stateFile = path.join(__dirname, '..', 'data', 'apiState.json');

class ApiManager {
    constructor() {
        this.services = {
            family: true,
            fun: true,
            meme: true,
            moderation: true,
            pokemon: true,
            utility: true
        };
        this.load();
    }

    load() {
        try {
            if (fs.existsSync(stateFile)) {
                const data = JSON.parse(fs.readFileSync(stateFile, 'utf8'));
                this.services = { ...this.services, ...data };
            } else {
                this.save();
            }
        } catch (err) {
            console.error('[ApiManager] Error loading state:', err);
        }
    }

    save() {
        try {
            if (!fs.existsSync(path.dirname(stateFile))) {
                fs.mkdirSync(path.dirname(stateFile), { recursive: true });
            }
            fs.writeFileSync(stateFile, JSON.stringify(this.services, null, 2));
        } catch (err) {
            console.error('[ApiManager] Error saving state:', err);
        }
    }

    isServiceEnabled(category) {
        if (this.services[category] === undefined) return true;
        return this.services[category];
    }

    stopService(category) {
        if (this.services[category] !== undefined) {
            this.services[category] = false;
            this.save();
            return true;
        }
        return false;
    }

    startService(category) {
        if (this.services[category] !== undefined) {
            this.services[category] = true;
            this.save();
            return true;
        }
        return false;
    }
    
    getStatuses() {
        return { ...this.services };
    }
}

module.exports = new ApiManager();
