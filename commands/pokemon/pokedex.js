const {
  getUserPokedex,
  getUserStats,
  pokemonMetaMap
} = require('../../store/pokemonStore');
const {
  getDisplayName
} = require('../../utils/contactHelper');
const { getUserId } = require('../../utils/getUserId');
module.exports = {
  name: 'pokedex',
  aliases: ['dex'],
  description: 'Inspect another trainer\'s Pokédex. Usage: -pokedex inspect @user',
  adminOnly: false,
  async execute(msg, args, client) {
    const chat = await msg.getChat();
    if (!chat.isGroup) return msg.reply('❌ _This command only works in groups._');
    const subcommand = (args[0] || '').toLowerCase();
    const mentions = await msg.getMentions();
    if (subcommand !== 'inspect' || mentions.length === 0) {
      return chat.sendMessage(`📖 *INSPECT POKÉDEX COMMAND* 📖\n` + `━━━━━━━━━━━━━━━━━━━━━━\n` + `📝 *Usage:* \`-pokedex inspect @user [tag] [page]\`\n` + `📖 *Description:* Inspect another trainer's caught Pokémon. You can filter their collection using tags like 'legendary', 'mythical', or a specific Pokémon name.\n\n` + `💡 *Examples:* \n` + `  ▸ \`-pokedex inspect @trainer\` (Show all)\n` + `  ▸ \`-pokedex inspect @trainer legendary\` (Show only legendaries)\n` + `  ▸ \`-pokedex inspect @trainer Charizard 2\` (Show Charizards page 2)`);
    }
    const target = mentions[0];
    const targetId = getUserId(target);
    const targetName = getDisplayName(target);
    const dex = await getUserPokedex(targetId);
    const stats = await getUserStats(targetId);
    if (dex.length === 0) {
      return chat.sendMessage(`📭 *${targetName}* hasn't caught any Pokémon yet!\n\n` + `_Their Pokédex is empty._ 🌙`);
    }
    const filterArgs = args.filter(a => a.toLowerCase() !== 'inspect' && !a.startsWith('@'));
    let page = 1;
    let tag = '';
    if (filterArgs.length > 0) {
      const lastArg = filterArgs[filterArgs.length - 1];
      if (!isNaN(parseInt(lastArg))) {
        page = parseInt(lastArg) || 1;
        tag = filterArgs.slice(0, filterArgs.length - 1).join(' ').trim();
      } else {
        tag = filterArgs.join(' ').trim();
      }
    }
    let filteredDex = dex;
    if (tag) {
      const tagLower = tag.toLowerCase();
      if (tagLower === 'legendary') {
        filteredDex = dex.filter(p => pokemonMetaMap[p.name.toLowerCase()]?.isLeg);
      } else if (tagLower === 'mythical' || tagLower === 'mythiccal') {
        filteredDex = dex.filter(p => pokemonMetaMap[p.name.toLowerCase()]?.isMyth);
      } else {
        filteredDex = dex.filter(p => p.name.toLowerCase().includes(tagLower));
      }
    }
    if (filteredDex.length === 0) {
      return chat.sendMessage(`🔍 *${targetName}*, no Pokémon matching *"${tag}"* found in their Pokédex!\n\n` + `💡 _Try checking your spelling or filtering by legendary or mythical._`);
    }
    const perPage = 15;
    const totalPages = Math.ceil(filteredDex.length / perPage);
    if (page < 1) page = 1;
    if (page > totalPages) page = totalPages;
    const startIdx = (page - 1) * perPage;
    const pageItems = filteredDex.slice(startIdx, startIdx + perPage);
    let list = `\n` + `    🔍 *${targetName.toUpperCase()}'S POKÉDEX* 🔍 ૮ ˶ᵔ ᵕ ᵔ˶ ა\n` + `\n\n` + `🏆 *Total Caught:* ${stats.total} | *Unique:* ${stats.unique} 🎀\n`;
    if (tag) {
      list += `🔍 *Filter:* "${tag}" (Matches: ${filteredDex.length}) ᡣ𐭩\n`;
    }
    list += `━━━━━━━━━━━━━━━━━━━━━━\n`;
    for (let i = 0; i < pageItems.length; i++) {
      const p = pageItems[i];
      const rank = startIdx + i + 1;
      const lvlBadge = p.bestLevel >= 91 ? '🔥' : p.bestLevel >= 81 ? '⭐' : p.bestLevel >= 71 ? '🟢' : p.bestLevel >= 61 ? '🔵' : p.bestLevel >= 51 ? '🟣' : '⬜';
      list += `${lvlBadge} *#${rank}* │ *${p.name}* — Lv.${p.bestLevel} (×${p.count}) 🫧\n`;
    }
    list += `━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
    if (totalPages > 1) {
      const nextPrompt = page < totalPages ? ` — \`-pokedex inspect @${target.id.user} ${tag ? tag + ' ' : ''}${page + 1}\`` : '';
      list += `📄 _Page ${page}/${totalPages}_${nextPrompt} ੈ✩‧₊˚\n`;
    }
    list += `💡 _Use_ \`-pokemon details <name> @${target.id.user}\` _for card info._ 🎧ྀི\n`;
    list += `_~Kitsune Pokédex System~_ ✨ 𓆩♡𓆪`;
    await chat.sendMessage(list);
  }
};