module.exports = {
  name: 'help',
  aliases: ['h', 'commands', 'menu'],
  description: 'Show all commands or details for a specific command.',
  adminOnly: false,
  async execute(msg, args, client) {
    const chat = await msg.getChat();
    const categoryEmojis = {
      fun: '🎮',
      moderation: '🛡️',
      snipe: '🔫',
      reactions: '💫',
      utility: '🔧',
      pokemon: '⚡',
      meme: '🎭'
    };
    const categoryDescriptions = {
      fun: '_Anime interactions & fun_',
      moderation: '_Group management & control_',
      snipe: '_Deleted message recovery_',
      reactions: '_Emoji reactions_',
      utility: '_General tools_',
      pokemon: '_Catch & collect Pokémon_',
      meme: '_Fresh & hilarious memes_'
    };
    if (args.length > 0) {
      const query = args[0].toLowerCase();
      if (client.categories.has(query)) {
        const commandNames = client.categories.get(query);
        const uniqueCommands = [...new Set(commandNames)];
        const emoji = categoryEmojis[query] || '📂';
        const desc = categoryDescriptions[query] || '';
        if (query === 'hoyo') {
          const hoyoCmd = client.commands.get('hoyo');
          if (hoyoCmd) return hoyoCmd.execute(msg, [], client);
        }
        let menu = `\n` + `   ${emoji} *${query.toUpperCase()} COMMANDS* \n` + `\n\n` + `${desc}\n\n`;
        for (const name of uniqueCommands) {
          const cmd = client.commands.get(name);
          if (cmd) {
            const lock = cmd.adminOnly ? ' 🔒' : '';
            menu += `  ▸ \`-${cmd.name}\` — _${cmd.description.split('.')[0]}_${lock}\n`;
          }
        }
        menu += `\n━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
        menu += `💡 _Type_ \`-help <command>\` _for details_\n`;
        return chat.sendMessage(menu);
      }
      const cmd = client.commands.get(query);
      if (cmd) {
        let help = `\n` + `  📖 *COMMAND INFO*   \n` + `\n\n` + `⚡ *Command:* \`-${cmd.name}\`\n` + `📝 *Description:* _${cmd.description}_\n` + `📁 *Category:* _${cmd.category}_\n`;
        if (cmd.aliases && cmd.aliases.length > 0) {
          help += `🔗 *Aliases:* _${cmd.aliases.map(a => `-${a}`).join(', ')}_\n`;
        }
        help += `🔒 *Admin only:* _${cmd.adminOnly ? 'Yes' : 'No'}_`;
        return chat.sendMessage(help);
      }
      return msg.reply(`❌ _Unknown category or command:_ \`${query}\``);
    }
    let menu = `\n` + ` ⋆｡‧˚ʚ🍓ɞ˚‧｡⋆ ✨ *KITSUNE* ✨ ⋆｡‧˚ʚ🍓ɞ˚‧｡⋆ \n` + `\n\n` + `_Your personal guardian at your service._ ૮꒰ ˶• ༝ •˶꒱ა ♡\n` + `_Prefix:_ \`-\`\n\n`;
    for (const [category, commandNames] of client.categories) {
      const emoji = categoryEmojis[category] || '📂';
      const desc = categoryDescriptions[category] || '';
      const uniqueCommands = [...new Set(commandNames)];
      menu += `${emoji} *${category.toUpperCase()}* — _${uniqueCommands.length} cmds_\n`;
      menu += `   └ \`-help ${category}\`\n\n`;
    }
    menu += `━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
    menu += `💡 _Type_ \`-help <category>\` _to view its commands._\n`;
    menu += `💡 _Type_ \`-help <command>\` _to view specific details._\n`;
    menu += `_~Kitsune, always watching~_ 𓍢ִ໋🌷͙֒✧˚.🎀༘⋆ ᡣ𐭩`;
    await chat.sendMessage(menu);
  }
};