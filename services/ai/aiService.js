/**
 * aiService.js - Common AI Service Interface
 *
 * Implements primary provider (Gemini) with automatic fallback to Groq.
 * Handles timeouts, keeps conversation context bounded, and redacts credentials.
 */

const GeminiProvider = require('./geminiProvider');
const GroqProvider = require('./groqProvider');

class AIService {
    constructor() {
        this.providers = [
            new GeminiProvider(),
            new GroqProvider(),
        ];
    }

    /**
     * Generate response with primary (Gemini) and fallback (Groq).
     */
    async generateResponse({ prompt, systemInstruction = '', history = [], maxTokens = 1000 }) {
        let lastError = null;

        for (const provider of this.providers) {
            if (!provider.isAvailable()) {
                console.warn(`[AIService] Provider ${provider.name} is not configured (missing API key). Skipping.`);
                continue;
            }

            try {
                console.log(`[AIService] Requesting AI response from provider: ${provider.name}`);
                const response = await provider.generateResponse({
                    prompt,
                    systemInstruction,
                    history,
                    maxTokens
                });
                return {
                    provider: provider.name,
                    response
                };
            } catch (err) {
                lastError = err;
                console.warn(`[AIService] ${provider.name} failed:`, err.message);
            }
        }

        throw new Error(`All AI providers failed. Last error: ${lastError ? lastError.message : 'No providers available'}`);
    }
}

module.exports = new AIService();
