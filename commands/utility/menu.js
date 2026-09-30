/**
 * menu.js - Dynamic Context-Aware Menu System for WhatsApp
 */

const { PREFIX } = require('../../config');
const { isBotAdmin } = require('../../utils/permissions');

module.exports = {
  name: 'menu',
  aliases: ['help', 'commands', 'start'],
  description: 'Displays the DB-Lenrah WhatsApp bot dynamic menu system.',
  usage: '-menu [category]',
  category: 'utility',

  async execute(msg, args, client) {
    const isGroup = msg.from.endsWith('@g.us');
    let isAdmin = false;

    if (isGroup) {
      try {
        isAdmin = await isBotAdmin(msg, client);
      } catch (e) {
        isAdmin = false;
      }
    }

    const requestedSubmenu = (args[0] || '').toLowerCase().trim();

    // Map submenus
    const CATEGORY_MAP = {
      'ai': 'ai',
      'group': 'moderation',
      'admin': 'moderation',
      'moderation': 'moderation',
      'utility': 'utility',
      'utilities': 'utility',
      'points': 'points',
      'ranks': 'points',
      'fun': 'fun',
      'meme': 'meme',
      'pokemon': 'pokemon'
    };

    const targetCategory = CATEGORY_MAP[requestedSubmenu] || null;

    // Collect all registered unique commands
    const uniqueCommands = new Map();
    if (client.commands) {
      for (const [key, cmd] of client.commands.entries()) {
        if (cmd.name && cmd.name.toLowerCase() === key) {
          uniqueCommands.set(cmd.name, cmd);
        }
      }
    }

    // Filter based on context
    const availableCommands = [];
    for (const cmd of uniqueCommands.values()) {
      // Context checks
      if (isGroup && cmd.privateOnly) continue;
      if (!isGroup && cmd.groupOnly) continue;
      if (cmd.adminOnly && !isAdmin) continue;

      availableCommands.push(cmd);
    }

    if (targetCategory) {
      // Submenu view
      const categoryCmds = availableCommands.filter(c => c.category === targetCategory);
      let text = `\n    📜 *${targetCategory.toUpperCase()} MENU* 📜    \n\n`;
      text += `_Showing commands available in current context_\n\n`;

      if (categoryCmds.length === 0) {
        text += `_No executable commands found for this category in current context._\n`;
      } else {
        for (const cmd of categoryCmds) {
          text += `▸ *${PREFIX}${cmd.name}*: ${cmd.description}\n`;
          if (cmd.usage) text += `   _Usage:_ \`${cmd.usage}\`\n`;
        }
      }

      text += `\n━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
      text += `> _Type \`${PREFIX}menu\` to view all menus._ 💫`;
      return msg.reply(text);
    }

    // Main menu view
    let menuText = `\n  🍓 ⋆ ˚｡⋆୨୧˚ *DB-LENRAH BOT MENU* ˚୨୧⋆｡˚ ⋆ 🍓  \n`;
    menuText += `━━━━━━━━━━━━━━━━━━━━━━━━━\n\n`;
    menuText += `📱 *Context:* ${isGroup ? 'Group Chat 👥' : 'Private Chat 👤'}\n`;
    menuText += `⚡ *Prefix:* \`${PREFIX}\`\n\n`;

    menuText += `📂 *AVAILABLE MENUS:*\n\n`;
    menuText += `1. 🤖 *AI Menu* (\`${PREFIX}menu ai\`)\n`;
    menuText += `2. 🛠️ *Commands Menu* (\`${PREFIX}menu commands\`)\n`;
    menuText += `3. 🛡️ *Group/Admin Menu* (\`${PREFIX}menu group\`)\n`;
    menuText += `4. ⚙️ *Utilities Menu* (\`${PREFIX}menu utility\`)\n`;
    menuText += `5. 🏆 *Points/Ranks Menu* (\`${PREFIX}menu points\`)\n`;
    menuText += `6. 🎮 *Fun & Games Menu* (\`${PREFIX}menu fun\`)\n`;
    menuText += `7. ❓ *Help Menu* (\`${PREFIX}menu help\`)\n\n`;

    menuText += `━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
    menuText += `💡 *Quick Tip:* Type \`${PREFIX}menu <category>\` to open any section directly!\n`;
    menuText += `_~At your service, master.~_ ✨`;

    return msg.reply(menuText);
  }
};
