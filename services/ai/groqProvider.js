/**
 * groqProvider.js - Groq AI Provider implementation
 */

const axios = require('axios');

function sanitizeText(text) {
    if (!text) return '';
    return text.replace(/(AIzaSy[a-zA-Z0-9_-]{33})|(gsk_[a-zA-Z0-9_-]{32,})/g, '[REDACTED_API_KEY]');
}

class GroqProvider {
    constructor() {
        this.name = 'Groq';
        this.modelName = process.env.GROQ_MODEL || 'llama-3.3-70b-versatile';
    }

    isAvailable() {
        return Boolean(process.env.GROQ_API_KEY);
    }

    async generateResponse({ prompt, systemInstruction = '', history = [], maxTokens = 1000 }) {
        const apiKey = process.env.GROQ_API_KEY;
        if (!apiKey) {
            throw new Error('GROQ_API_KEY is not set');
        }

        const messages = [];

        if (systemInstruction) {
            messages.push({ role: 'system', content: systemInstruction });
        }

        if (Array.isArray(history) && history.length > 0) {
            const recentHistory = history.slice(-10);
            for (const h of recentHistory) {
                messages.push({
                    role: h.role === 'assistant' ? 'assistant' : 'user',
                    content: h.content
                });
            }
        }

        const truncatedPrompt = prompt.length > 4000 ? prompt.slice(0, 4000) + '...[truncated]' : prompt;
        messages.push({ role: 'user', content: truncatedPrompt });

        const res = await axios.post(
            'https://api.groq.com/openai/v1/chat/completions',
            {
                model: process.env.GROQ_MODEL || this.modelName,
                messages,
                max_tokens: maxTokens,
                temperature: 0.7,
            },
            {
                headers: {
                    'Authorization': `Bearer ${apiKey}`,
                    'Content-Type': 'application/json',
                },
                timeout: 30000,
            }
        );

        const responseText = res?.data?.choices?.[0]?.message?.content;
        if (!responseText) {
            throw new Error('Empty response received from Groq API');
        }

        return sanitizeText(responseText.trim());
    }
}

module.exports = GroqProvider;
