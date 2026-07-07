const gachaStore = require('../../store/gachaStore');
const {
  getDisplayName
} = require('../../utils/contactHelper');
const { getUserId } = require('../../utils/getUserId');
module.exports = {
  name: 'gacha',
  aliases: ['banner', 'banners', 'gachainfo'],
  description: 'View active gacha banners, pool rewards, rates, or system guides. Usage: -gacha [info]',
  category: 'pokemon',
  adminOnly: false,
  async execute(msg, args, client) {
    const chat = await msg.getChat();
    if (!chat.isGroup) return msg.reply('❌ _This command only works in groups._');
    try {
      const subcommand = (args[0] || '').toLowerCase();
      const banner = gachaStore.getBannerInfo();
      if (subcommand === 'info' || subcommand === 'help' || subcommand === 'guide') {
        const guideText = `🧭 *KITSUNE GACHA SYSTEM GUIDE* 🧭\n\n` + `Welcome to the Kitsune Gacha Wishing Guide. Here is a breakdown of the mathematical probabilities, pity mechanics, and currencies.\n\n` + `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` + `💎 *1. CURRENCY & WISHING COST*\n` + `━━━━━━━━━━━━━━━━━━━━━━━━━\n` + `• *Wishing Compass* (🧭): Required to make a wish pull.\n` + `  ▸ Cost: *160 Radiant Crystals* (💎) per Compass.\n` + `  ▸ Purchase Command: \`-pokemart buy wishing compass\`\n\n` + `• *How to earn Radiant Crystals (💎):*\n` + `  ▸ Catch a *Legendary Pokémon* in the wild: *+80* 💎\n` + `  ▸ Catch a *Mythical / Ultra Beast* in the wild: *+160* 💎\n` + `  ▸ Win a *Global Raid Battle*: *+480* 💎 (all active winners)\n\n` + `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` + `📊 *2. RATES & PITY CALCULATIONS*\n` + `━━━━━━━━━━━━━━━━━━━━━━━━━\n` + `Kitsune uses a custom piece-wise probability distribution with a hidden **Soft Pity** system and a strict **Hard Pity** cap.\n\n` + `🌟 *5-Star Pokémon (Legendary/Mythical):*\n` + `  ▸ *Base Probability:* *0.6%* (Pulls 1 to 73)\n` + `  ▸ *Soft Pity:* Begins at pull *74*. The probability increases by *+6.0%* per pull (e.g., pull 74 has a 6.6% rate, pull 75 has 12.6%, etc.).\n` + `  ▸ *Hard Pity:* *100%* guaranteed at pull *90*.\n\n` + `💜 *4-Star Pokémon (Featured Pool):*\n` + `  ▸ *Base Probability:* *5.1%* (Pulls 1 to 8)\n` + `  ▸ *Soft Pity:* Pull *9* has a boosted *56.1%* rate.\n` + `  ▸ *Hard Pity:* *100%* guaranteed at pull *10*.\n\n` + `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` + `⚖️ *3. FEATURED 50/50 GUARANTEE SYSTEM*\n` + `━━━━━━━━━━━━━━━━━━━━━━━━━\n` + `When you hit a 5-star Pokémon:\n` + `• There is a **55%** chance it will be the **Featured Pokémon Variant** (e.g., *${banner.featured5Star}* variants like GX/EX/LV.X).\n` + `• There is a **45%** chance it will be the **Standard Base Pokémon** (e.g., standard *${banner.featured5Star}*).\n` + `• **The Guarantee:** If you lose the 50/50 and get the Standard Base Pokémon, your **next 5-star is 100% guaranteed** to be the Featured Pokémon Variant.\n\n` + `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` + `✨ *4. GACHA BOOSTS & VARIANTS*\n` + `━━━━━━━━━━━━━━━━━━━━━━━━━\n` + `• **Variant Form Chance:** Any 4-star Pokémon won from wishing has a **50%** chance to be a premium **Variant card** instead of its base form.\n` + `• **Dynamic Level Cap & Double Stats:** All Pokémon obtained via wishes are pre-trained to your **MAX level cap** with **2× Max Stats** permanently!\n\n` + `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` + `🎰 *WISHING COMMANDS:*\n` + `  ▸ \`-wish 1\` — Make 1 wish pull\n` + `  ▸ \`-wish 10\` — Make 10 wish pulls\n` + `  ▸ \`-gacha\` — View current active banner details & pity status\n` + `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` + `_~May the stars guide your pulls, trainer!~_ 💫`;
        return await chat.sendMessage(guideText);
      }
      const sender = await msg.getContact();
      const senderId = getUserId(sender);
      const senderName = getDisplayName(sender);
      const profile = await gachaStore.getProfileStats(senderId);
      const current5Rate = gachaStore.get5StarRate(profile.pity5 + 1);
      const current4Rate = gachaStore.get4StarRate(profile.pity4 + 1);
      const text = `🧭 *ACTIVE GACHA BANNER* 🧭 ૮꒰ ˶• ༝ •˶꒱ა ♡\n\n` + `✨ *${banner.name}* 🎀\n\n` + `━━━━━━━━━━━━━━━━━━━━━━━━━\n` + `⭐⭐⭐⭐⭐ *5-STAR POOL:* ੈ✩‧₊˚\n` + `  👑 *${banner.featured5Star}* — Legendary Deity of Time ᯓ★\n` + `  (Standard Base Form or premium Variant Form)\n\n` + `⭐⭐⭐⭐ *4-STAR POOL:* 𓍢ִ໋🌷͙֒\n` + `  🔥 ${banner.pool4Star.join(' | ')}\n\n` + `⭐⭐⭐ *3-STAR REWARDS & CHANCES:* 🫧\n` + `  🔮 Level Orb (50%)\n` + `  🎟️ Raid Pass (30%)\n` + `  ✨ Enchanted Stardust (19%)\n` + `  💩 Dirty Diaper (1%)\n` + `━━━━━━━━━━━━━━━━━━━━━━━━━\n\n` + `📈 *YOUR PITY STATUS — ${senderName}:* 🎧ྀི\n` + `━━━━━━━━━━━━━━━━━━━━━━━━━\n` + `  ⭐ 5★ Pity Counter: *${profile.pity5}/90*\n` + `  💜 4★ Pity Counter: *${profile.pity4}/10*\n` + `  🎯 Next 5★: ${profile.guaranteed5 ? '✅ *GUARANTEED VARIANT*' : '🎲 50/50 Coin Flip'}\n\n` + `📊 *CURRENT RATES (Next Pull):* ⋆.˚\n` + `  ⭐ 5★ Rate: *${(current5Rate * 100).toFixed(1)}%*${profile.pity5 >= 73 ? ' 🔥 SOFT PITY!' : ''}\n` + `  💜 4★ Rate: *${(current4Rate * 100).toFixed(1)}%*${profile.pity4 >= 8 ? ' 🔥 SOFT PITY!' : ''}\n\n` + `📊 *LIFETIME STATS:* ୨୧\n` + `  🎰 Total Wishes: ${profile.totalWishes}\n` + `  ⭐ Total 5★ Won: ${profile.total5Stars}\n` + `  💜 Total 4★ Won: ${profile.total4Stars}\n\n` + `━━━━━━━━━━━━━━━━━━━━━━━━━\n` + `🧭 *HOW TO WISH:* ᡣ𐭩\n` + `  ▸ \`-wish 1\` — Single pull\n` + `  ▸ \`-wish 10\` — 10-pull session\n` + `  ▸ \`-gacha info\` — How wishing works & pity mechanics\n\n` + `🧭 *Wishing Compass Cost:* 160 Radiant Crystals each 💎\n` + `🏪 _Buy at:_ \`-pokemart buy wishing compass\` 🛒\n` + `━━━━━━━━━━━━━━━━━━━━━━━━━\n` + `_~All gacha Pokémon are pulled at your MAX level cap with 2× boosted stats!~_ 🔥 𓆩♡𓆪`;
      await chat.sendMessage(text);
    } catch (err) {
      console.error('[Gacha Command] Error:', err);
      await msg.reply('❌ _Failed to retrieve active gacha banner info._');
    }
  }
};