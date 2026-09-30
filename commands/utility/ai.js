/**
 * aiCommand.js - AI Conversation command (Private & Group)
 */

const aiService = require('../../services/ai/aiService');
const { checkRateLimit } = require('../../utils/rateLimiter');
const { getUserId } = require('../../utils/getUserId');

module.exports = {
  name: 'ai',
  aliases: ['ask', 'chat'],
  description: 'Converses with the bot using AI (Gemini primary, Groq fallback).',
  usage: '-ai <your query>',
  category: 'utility',

  async execute(msg, args, client) {
    const prompt = args.join(' ').trim();
    if (!prompt) {
      return msg.reply('❌ _Please provide a query: `-ai What is the capital of France?`_');
    }

    const contact = await msg.getContact();
    const userId = getUserId(contact);

    const rl = checkRateLimit(userId, 'ai_chat');
    if (!rl.allowed) {
      return msg.reply(rl.message || '⏳ _Rate limit reached for AI. Please wait a moment._');
    }

    try {
      await msg.react('🤖');
      const result = await aiService.generateResponse({
        prompt,
        systemInstruction: 'You are Kitsune / DB-Lenrah AI assistant. Be helpful, concise, and friendly.',
      });

      return msg.reply(`🤖 *[${result.provider}]*\n\n${result.response}`);
    } catch (err) {
      console.error('[AI Command Error]:', err.message);
      return msg.reply('❌ _Sorry, AI services are currently unavailable or timed out. Please try again later._');
    }
  }
};
