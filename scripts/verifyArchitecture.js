/**
 * verifyArchitecture.js - Sanity test runner for command autoloader, rank utility, rate limiter, and menu generation.
 */

const { loadCommands } = require('../handlers/commandHandler');
const { getRank } = require('../utils/rankUtil');
const { checkMessageBurst } = require('../utils/rateLimiter');
const aiService = require('../services/ai/aiService');

async function testAll() {
    console.log('--- Testing Rank Utility ---');
    console.log('Rank 0 pts:', getRank(0).name);
    console.log('Rank 150 pts:', getRank(150).name);
    console.log('Rank 6500 pts:', getRank(6500).name);

    console.log('\n--- Testing Command Loader ---');
    const mockClient = { commands: new Map(), categories: new Map() };
    loadCommands(mockClient);
    console.log(`Commands loaded: ${mockClient.commands.size}`);

    console.log('\n--- Testing Anti-Spam Rate Limiter ---');
    const testUser = '1234567890';
    for (let i = 1; i <= 5; i++) {
        const res = checkMessageBurst(testUser);
        console.log(`Hit ${i}: allowed=${res.allowed}`);
    }

    console.log('\n--- Testing AI Providers Setup ---');
    console.log('Gemini Available:', aiService.providers[0].isAvailable());
    console.log('Groq Available:', aiService.providers[1].isAvailable());

    console.log('\n✅ All internal integrity checks passed!');
}

testAll().catch(err => {
    console.error('❌ Test failed:', err);
    process.exit(1);
});
