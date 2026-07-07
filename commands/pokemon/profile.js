const economyStore = require('../../store/economyStore');
const knownUserStore = require('../../store/knownUserStore');
const {
  getDisplayName
} = require('../../utils/contactHelper');
const { getUserId } = require('../../utils/getUserId');
module.exports = {
  name: 'profile',
  aliases: ['p', 'trainer', 'trainerprofile'],
  description: 'View your premium Trainer profile and accomplishments',
  adminOnly: false,
  async execute(msg, args, client) {
    const chat = await msg.getChat();
    const mentions = await msg.getMentions();
    let targetContact;
    if (mentions.length > 0) {
      targetContact = mentions[0];
    } else {
      targetContact = await msg.getContact();
    }
    const targetId = getUserId(targetContact);
    const targetName = getDisplayName(targetContact);
    try {
      const profile = await economyStore.getUserProfile(targetId);
      const currentLevel = profile.userLevel;
      const nextLevel = currentLevel + 1;
      const totalXPForCurrent = 25 * (currentLevel - 1) * (currentLevel + 2);
      const totalXPForNext = 25 * (nextLevel - 1) * (nextLevel + 2);
      const levelXpNeeded = totalXPForNext - totalXPForCurrent;
      const levelXpAccumulated = profile.userXP - totalXPForCurrent;
      let xpBar = '';
      if (levelXpNeeded > 0) {
        const percentage = Math.min(1.0, Math.max(0, levelXpAccumulated / levelXpNeeded));
        const filledBlocks = Math.round(percentage * 10);
        const emptyBlocks = 10 - filledBlocks;
        xpBar = '█'.repeat(filledBlocks) + '░'.repeat(emptyBlocks) + ` ${Math.round(percentage * 100)}%`;
      } else {
        xpBar = '█'.repeat(10) + ' 100%';
      }
      const prestigeMult = economyStore.getPrestigeMultiplier(profile.prestigeLevel);
      const prestigeDisplay = profile.prestigeLevel > 0 ? `${profile.prestigeLevel} (×${prestigeMult} Stats Boost)` : `${profile.prestigeLevel}`;
      let titleBanner = '';
      if (profile.customTitle) {
        const emoji = profile.titleEmoji || '⚜️';
        titleBanner = `  ${emoji} *MASTER TITLE:* _[ ${profile.customTitle} ]_ ${emoji}\n\n`;
      }
      const profileText = `\n` + `     🔮  *TRAINER PROFILE: ${targetName.toUpperCase()}*  🔮 ૮꒰ ˶• ༝ •˶꒱ა ♡\n` + `\n` + titleBanner + `⚡ *TRAINER CARD RANKINGS:* 🎀\n` + `  ▸ 🛡️ *Trainer Level:* Lv. ${profile.userLevel} ⋆.˚\n` + `  ▸ 📈 *Experience:* ${profile.userXP.toLocaleString()} XP ੈ✩‧₊˚\n` + `    ↳ \`[${xpBar}]\`\n` + `  ▸ 👑 *Prestige Level:* ${prestigeDisplay} ᡣ𐭩\n` + `  ▸ 🌌 *Omega Level:* ${profile.omegaLevel} 𓆩♡𓆪\n` + `  ▸ 🎯 *Pokémon Level Cap:* Lv. ${profile.levelCap} 🫧\n\n` + `💰 *ECONOMY & NET WORTH:* ⋆｡‧˚ʚ🍓ɞ˚‧｡⋆\n` + `  ▸ 🪙 *Wallet Balance:* ${profile.pokecoins.toLocaleString()} PokéCoins ୨୧\n` + `  ▸ 💎 *Radiant Crystals:* ${profile.radiantCrystals.toLocaleString()} Crystals 🎧ྀི\n` + `  ▸ 🔮 *Total Net Worth:* *${profile.netWorth.toLocaleString()} PokéCoins* 💎 ✧.*\n` + `    _-# Includes: Coins + Crystals worth + Item values + Pokeballs * 25_\n\n` + `📦 *POKÉDEX STATS & MEDALS:* ૮ ˶ᵔ ᵕ ᵔ˶ ა\n` + `  ▸ 🔴 *Total Pokémon:* ${profile.totalPokemon} caught 𓍢ִ໋🌷͙֒\n` + `  ▸ 🗂️ *Unique Species:* ${profile.uniquePokemon} variety ⋆·˚ ༘ *\n` + `  ▸ 🏅 *Highest Level:* Lv. ${profile.bestLevel} 𖦹\n` + `  ▸ 👑 *Legendaries Caught:* ${profile.legendariesCaught} legendary ᯓ★\n` + `  ▸ ✨ *Mythicals Caught:* ${profile.mythicalsCaught} mythical ˚₊‧꒰ა ✦ ໒꒱ ‧₊˚\n\n` + `━━━━━━━━━━━━━━━━━━━━━━━━━\n` + `✨ _"Prestige to reset levels and multiply your stats! Climb to Omega Status!"_ 🌌 ⋆.ೃ࿔*:･`;
      return chat.sendMessage(profileText, {
        mentions: mentions.length > 0 ? [targetContact.id._serialized] : []
      });
    } catch (err) {
      console.error('[Profile Command] Error:', err);
      return msg.reply('❌ _Failed to retrieve trainer profile due to database error._');
    }
  }
};