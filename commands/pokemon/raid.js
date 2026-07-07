const raidStore = require('../../store/raidStore');
const {
  getDisplayName
} = require('../../utils/contactHelper');
const {
  isBotOwner
} = require('../../utils/permissions');
const { getUserId } = require('../../utils/getUserId');
module.exports = {
  name: 'raid',
  aliases: ['raidhour', 'epicraid', 'bossfight'],
  description: 'Co-op Epic Raid Hour. Usage: -raid | -raid enter <pokemon> | -raid spawn',
  category: 'pokemon',
  adminOnly: false,
  async execute(msg, args, client) {
    const chat = await msg.getChat();
    if (!chat.isGroup) return msg.reply('❌ _This command only works in groups._');
    const sender = await msg.getContact();
    const senderId = getUserId(sender);
    const senderName = getDisplayName(sender);
    const groupId = msg.from;
    const subcommand = (args[0] || '').toLowerCase();
    if (subcommand === 'spawn') {
      const ownerCheck = await isBotOwner(msg, client);
      if (!ownerCheck) return msg.reply('❌ *Only the Bot Owner can manually spawn Raids!*');
      const spawned = await raidStore.spawnRaid(groupId, client);
      if (!spawned) {
        return msg.reply('❌ _Failed to spawn Raid Boss (could not load candidates)._');
      }
      return;
    }
    if (subcommand === 'force' || subcommand === 'resolve') {
      const ownerCheck = await isBotOwner(msg, client);
      if (!ownerCheck) return msg.reply('❌ *Only the Bot Owner can force-resolve Raids!*');
      await raidStore.syncFromDb(client);
      const active = raidStore.activeRaids.get(groupId);
      if (!active) {
        return msg.reply('❌ *There is no active Raid in this group to resolve.*');
      }
      await chat.sendMessage('⚡ *Force-resolving Raid Hour combat simulation...* 💥');
      await raidStore.resolveRaid(client);
      return;
    }
    if (subcommand === 'enter' || subcommand === 'join') {
      const pokemonChoice = args.slice(1).join(' ').trim();
      if (!pokemonChoice) {
        return msg.reply(`❌ *Which Pokémon will join the fight?*\n\n` + `_Usage:_ \`-raid enter <pokemon_name>\`\n` + `_Example:_ \`-raid enter Pikachu\``);
      }
      return raidStore.enterRaid(groupId, userIdToSerialized(senderId), senderName, pokemonChoice, msg, client);
    }
    await raidStore.syncFromDb(client);
    return showRaidStatus(msg, chat, groupId);
  }
};
function userIdToSerialized(userId) {
  return userId;
}
async function showRaidStatus(msg, chat, groupId) {
  const raid = raidStore.activeRaids.get(groupId);
  if (!raid) {
    return chat.sendMessage(`💤 *STADIUM STATUS: CALM* 💤 ૮꒰ ˶• ༝ •˶꒱ა ♡\n` + `━━━━━━━━━━━━━━━━━━━━━━━━━\n\n` + `There is no active Raid Boss in this group right now. 🎀\n\n` + `📅 *Next Hourly Spawn:* Automatic hourly check. 🫧\n` + `🛒 *Preparation:* Buy a **Raid Pass** at the PokéMart to be ready! ੈ✩‧₊˚\n` + `  ▸ \`-pokemart buy raid pass\` _(2,000 PokéCoins)_ ᡣ𐭩`);
  }
  const elapsed = Date.now() - raid.spawnedAt;
  const remainingMs = Math.max(0, 50 * 60 * 1000 - elapsed);
  const mins = Math.floor(remainingMs / (60 * 1000));
  const secs = Math.floor(remainingMs % (60 * 1000) / 1000);
  const typeStr = (raid.boss.types || []).join(' / ');
  const raiderList = Array.from(raid.participants.values());
  let raiderLines = '_No trainers have joined the raid party yet!_';
  if (raiderList.length > 0) {
    raiderLines = raiderList.map((r, idx) => `• *#${idx + 1} ${r.senderName}* with *${r.pokemonName}* (Lv. ${r.fighter.level})`).join('\n');
  }
  const hpPct = Math.round(raid.boss.hp / raid.boss.maxHp * 100);
  const filledSize = Math.round(raid.boss.hp / raid.boss.maxHp * 10);
  const emptySize = 10 - filledSize;
  const hpBar = '█'.repeat(Math.max(0, filledSize)) + '░'.repeat(Math.max(0, emptySize));
  let statusText = `\n` + `    🏟️ *ACTIVE STADIUM RAID* 🏟️ ૮ ˶ᵔ ᵕ ᵔ˶ ა\n` + `\n\n` + `🔴 *Raid Boss:* *${raid.boss.name}* (Lv. ${raid.boss.level}) 🎀\n` + `📊 *HP Bar:* \`[${hpBar}]\` *${hpPct}%* 🫧\n` + `❤️ *Boss HP:* ${raid.boss.hp.toLocaleString()} / ${raid.boss.maxHp.toLocaleString()} HP 𓍢ִ໋🌷͙֒\n` + `🔖 *Type:* ${typeStr} ੈ✩‧₊˚\n` + `⏳ *Remaining Time:* *${mins}m ${secs}s* 🎧ྀི\n\n` + `━━━━━━━━━━━━━━━━━━━━━━━━━\n` + `👥 *CO-OP RAID PARTY PARTNERS:* (${raiderList.length}) ୨୧\n` + `━━━━━━━━━━━━━━━━━━━━━━━━━\n` + `${raiderLines}\n\n` + `━━━━━━━━━━━━━━━━━━━━━━━━━\n` + `🎟️ *WANT TO JOIN THE FIGHT?* ᡣ𐭩\n` + `👉 Type \`-raid enter <your_pokemon>\`!\n` + `• _Requires 1 Raid Pass._\n` + `• _Co-op auto-simulation resolves at the end of the hour!_ ✨ 𓆩♡𓆪`;
  await chat.sendMessage(statusText);
}