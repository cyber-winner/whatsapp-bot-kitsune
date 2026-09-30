/**
 * eventHandler.js - Message routing and event handling for Private and Group chats.
 */

const { PREFIX, OWNER_NAME, FATHER } = require('../config');
const { isBotOwner, isFather, isBotAdmin } = require('../utils/permissions');
const { isActivated, activateGroup, deactivateGroup } = require('../store/groupStore');
const knownUserStore = require('../store/knownUserStore');
const immuneStore = require('../store/immuneStore');
const User = require('../models/User');
const Group = require('../models/Group');
const Warning = require('../models/Warning');
const rankUtil = require('../utils/rankUtil');
const aiService = require('../services/ai/aiService');
const { getUserId } = require('../utils/getUserId');
const { checkRateLimit, checkCommandLimit, checkMessageBurst, wrapWithTimeout, TIMEOUTS } = require('../utils/rateLimiter');

function registerEvents(client) {
  client.on('message_create', async msg => {
    try {
      if (msg.from === 'status@broadcast') return;

      // Duplicate prevention
      if (!global.processedMessageIds) global.processedMessageIds = new Set();
      if (global.processedMessageIds.has(msg.id._serialized)) return;
      global.processedMessageIds.add(msg.id._serialized);
      if (global.processedMessageIds.size > 1000) {
        const iterator = global.processedMessageIds.values();
        for (let i = 0; i < 200; i++) global.processedMessageIds.delete(iterator.next().value);
      }

      const isGroup = msg.from.endsWith('@g.us');
      const groupId = isGroup ? msg.from : null;
      const contact = await msg.getContact();
      const userId = getUserId(contact);

      // Anti-spam message burst check
      const burstCheck = checkMessageBurst(userId);
      if (!burstCheck.allowed) {
        console.warn(`[AntiSpam] Message burst blocked from user ${userId}`);
        if (burstCheck.message) {
          try { await msg.reply(burstCheck.message); } catch (_) {}
        }
        return;
      }

      const body = msg.body?.trim() || '';
      const now = Math.floor(Date.now() / 1000);

      // Discard stale messages older than 30 seconds
      if (now - msg.timestamp > 30) return;
      if (!body && !msg.hasMedia) return;

      // Increment user points for message participation
      try {
        await User.findOneAndUpdate(
          { userId },
          { $inc: { points: 1 }, $setOnInsert: { name: contact.pushname || contact.name || 'User' } },
          { upsert: true, new: true }
        );
      } catch (e) {}

      // Check group activation if in group
      if (isGroup && !isActivated(groupId)) {
        const bodyLower = body.toLowerCase();
        if (bodyLower === 'kitsune activate' && (await isBotOwner(msg, client))) {
          activateGroup(groupId);
          return msg.reply('✨ *DB-Lenrah Bot Activated for this group!* 🌙');
        }
        return;
      }

      // Handle Anti-Link in Group Chats
      if (isGroup && body) {
        const hasLink = /(https?:\/\/[^\s]+)/gi.test(body);
        if (hasLink) {
          const grpConfig = await Group.findOne({ groupId }) || { antiLink: false, maxWarnings: 3 };
          if (grpConfig.antiLink) {
            const isAdmin = await isBotAdmin(msg, client);
            if (!isAdmin) {
              try {
                const chat = await msg.getChat();
                await chat.sendMessage(`⚠️ *Link detected from @${userId}! Links are not allowed in this group.*`, { mentions: [contact.id._serialized] });

                // Add warning
                await Warning.create({ groupId, userId, reason: 'Anti-link violation', warnedBy: 'System AntiLink' });
                const warnCount = await Warning.countDocuments({ groupId, userId });

                if (warnCount >= grpConfig.maxWarnings) {
                  await chat.removeParticipants([contact.id._serialized]);
                  await chat.sendMessage(`🛑 *Auto-Kicked @${userId} for exceeding max warnings (${grpConfig.maxWarnings}).*`, { mentions: [contact.id._serialized] });
                }
              } catch (linkErr) {
                console.error('[AntiLink Error]:', linkErr.message);
              }
            }
          }
        }
      }

      // Check command routing
      if (body.startsWith(PREFIX)) {
        const args = body.slice(PREFIX.length).trim().split(/\s+/);
        const commandName = args.shift().toLowerCase();

        if (!client.commands.has(commandName)) return;
        const command = client.commands.get(commandName);

        // Command context validation
        if (isGroup && command.privateOnly) {
          return msg.reply('❌ _This command can only be executed in private chats._');
        }
        if (!isGroup && command.groupOnly) {
          return msg.reply('❌ _This command can only be executed in group chats._');
        }
        if (command.adminOnly) {
          const isAdmin = isGroup ? await isBotAdmin(msg, client) : await isBotOwner(msg, client);
          if (!isAdmin) {
            return msg.reply('❌ _You do not have permission to execute this admin command._');
          }
        }

        // Rate limit command execution
        const cmdRL = checkCommandLimit(userId, commandName, command.category);
        if (!cmdRL.allowed) {
          if (cmdRL.message) await msg.reply(cmdRL.message);
          return;
        }

        // Execute command
        await wrapWithTimeout(
          command.execute(msg, args, client),
          TIMEOUTS.command_execute,
          `Command -${commandName}`
        );
        return;
      }

      // Private chat AI conversation handling
      if (!isGroup && body) {
        const rl = checkRateLimit(userId, 'ai_chat');
        if (rl.allowed) {
          try {
            const aiRes = await aiService.generateResponse({
              prompt: body,
              systemInstruction: 'You are Kitsune / DB-Lenrah AI assistant answering in a private 1-on-1 WhatsApp chat.'
            });
            return msg.reply(`🤖 *[${aiRes.provider}]*\n\n${aiRes.response}`);
          } catch (aiErr) {
            console.error('[Private AI Error]:', aiErr.message);
          }
        }
      }

    } catch (err) {
      console.error('[EventHandler Error]:', err);
    }
  });

  console.log('📡 Refactored event listeners registered.\n');
}

module.exports = { registerEvents };
