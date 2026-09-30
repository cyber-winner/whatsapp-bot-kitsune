/**
 * geminiProvider.js - Google Gemini AI Provider implementation using modern @google/genai SDK
 */

const { GoogleGenAI } = require('@google/genai');

function sanitizeText(text) {
    if (!text) return '';
    return text.replace(/(AIzaSy[a-zA-Z0-9_-]{33})|(gsk_[a-zA-Z0-9_-]{32,})/g, '[REDACTED_API_KEY]');
}

class GeminiProvider {
    constructor() {
        this.name = 'Gemini';
        this.modelName = process.env.GEMINI_MODEL || 'gemini-2.5-flash';
    }

    isAvailable() {
        return Boolean(process.env.GEMINI_API_KEY);
    }

    async generateResponse({ prompt, systemInstruction = '', history = [], maxTokens = 1000 }) {
        const apiKey = process.env.GEMINI_API_KEY;
        if (!apiKey) {
            throw new Error('GEMINI_API_KEY is not set');
        }

        const ai = new GoogleGenAI({ apiKey });
        const targetModel = process.env.GEMINI_MODEL || this.modelName;

        const contents = [];
        if (Array.isArray(history) && history.length > 0) {
            const recentHistory = history.slice(-10);
            for (const h of recentHistory) {
                contents.push({
                    role: h.role === 'assistant' ? 'model' : 'user',
                    parts: [{ text: h.content }]
                });
            }
        }

        const truncatedPrompt = prompt.length > 4000 ? prompt.slice(0, 4000) + '...[truncated]' : prompt;
        contents.push({ role: 'user', parts: [{ text: truncatedPrompt }] });

        const response = await ai.models.generateContent({
            model: targetModel,
            contents,
            config: {
                maxOutputTokens: maxTokens,
                temperature: 0.7,
                systemInstruction: systemInstruction || undefined,
            }
        });

        const responseText = response?.text;
        if (!responseText) {
            throw new Error('Empty response received from Gemini API');
        }

        return sanitizeText(responseText.trim());
    }
}

module.exports = GeminiProvider;
