const economyStore = require('../../store/economyStore');
const {
  getDisplayName
} = require('../../utils/contactHelper');
const { getUserId } = require('../../utils/getUserId');
module.exports = {
  name: 'omega',
  aliases: [],
  category: 'pokemon',
  description: 'Ascend to Omega tier — wipes everything but grants immense power.',
  async execute(msg, args, client) {
    const chat = await msg.getChat();
    const sender = await msg.getContact();
    const senderId = getUserId(sender);
    const senderName = getDisplayName(sender);
    const eligibility = await economyStore.checkOmegaEligibility(senderId);
    const reqs = eligibility.requirements;
    if (!eligibility.eligible) {
      if (eligibility.reason === 'max_omega') {
        await chat.sendMessage(`\n` + `    ˚₊‧꒰ა 🌌 *OMEGA — APEX REACHED* 🌌 ໒꒱ ‧₊˚\n` + `\n` + `    *ੈ✩‧₊˚༺☆༻*ੈ✩‧₊˚ ૮꒰◞ ˕ ◟ ྀི꒱ა ♥︎ ⚚ 𓂃 𓇼𓏲*ੈ✩‧₊˚🎐\n` + `\n` + `👤 *Trainer:* ${senderName} 🎀 ᡣ𐭩\n\n` + `_~ You gaze into the abyss, and the abyss bows to you... ~_ 𓆩♡𓆪\n\n` + ` ˚₊· ͟͟͞͞➳❥ 𝓨𝓸𝓾 𝓱𝓪𝓿𝓮 𝓪𝓵𝓻𝓮𝓪𝓭𝔂 𝓪𝓬𝓱𝓲𝓮𝓿𝓮𝓭 𝓞𝓶𝓮𝓰𝓪 𝓐𝓼𝓬𝓮𝓷𝓼𝓲𝓸𝓷! \n` + ` 𐙚🧸ྀི ˖ ᡣ𐭩 ⊹ ࣪ ౨ৎ˚₊ 𐙚⋆.˚ 𝜗𝜚⋆₊˚ ˙⋆✮ ੈ✩‧₊˚ ✧.* ⋆·˚ ༘ * ˏˋ°•*⁀➷ \n\n` + `The peak of existence belongs entirely to you, ${senderName}! (˶˃ ᵕ ˂˶) Like a legendary trainer who has conquered the most formidable of foes, your name is forever etched into the glittering stars of the cosmos! ⋆｡ﾟ☁︎｡⋆｡ ﾟ☾ ﾟ｡⋆ You stand at the absolute summit. The universe holds no further tiers for you to climb, and every celestial body trembles at your immense power! ☠︎︎༒︎✞︎🕸𖤐 But the journey does not end here, Master! ૮꒰ ˶• ༝ •˶꒱ა ♡ You may continue to gather Pokémon, engage in thrilling battles, and grind through infinite Prestige levels to further cement your legacy! ⋆.˚✮🎧✮˚.⋆ The world is your playground, and you are its reigning champion! 🏆✨\n\n` + `   ▶︎ •၊၊||၊|။||||။၊|• 0:10 ★ 🎀🕯️ ୧ ‧₊˚ 🍵 ⋅ 𖦹 ׂ 𓈒 🥞 ／ ⋆ ۪ ℘ \n\n` + `━━━━━━━━━━━━━━━━━━━━━━━━━\n` + `_Keep exploring, Master Trainer!_ 𓆩♡𓆪 ⋆⭒˚｡⋆ ‧₊˚✧[LEGEND]✧˚₊‧\n` + ` ﮩ٨ـﮩﮩ٨ـ♡ﮩ٨ـﮩﮩ٨ـ  `);
        return;
      }
      let failMsg = '';
      switch (eligibility.reason) {
        case 'insufficient_prestige':
          failMsg = `🌟 *Prestige Level:* ${eligibility.have}/${reqs.minPrestige}`;
          break;
        case 'insufficient_coins':
          failMsg = `💰 *PokéCoins:* ${eligibility.have.toLocaleString()}/${reqs.minCoins.toLocaleString()}`;
          break;
        case 'insufficient_pokemon':
          failMsg = `📦 *Total Pokémon:* ${eligibility.have}/${reqs.minTotalPokemon}`;
          break;
        case 'insufficient_leveled':
          failMsg = `📊 *Lv.${reqs.minPokemonLevel}+ Pokémon:* ${eligibility.have}/${reqs.minLeveledPokemon}`;
          break;
      }
      await chat.sendMessage(`\n` + `    ❌ *OMEGA — NOT ELIGIBLE* (╥﹏╥)\n` + `\n\n` + `👤 *Trainer:* ${senderName} 🎀\n\n` + `${failMsg}\n\n` + `━━━━━━━━━━━━━━━━━━━━━━━━━\n` + `📋 *Requirements:* 𓍢ִ໋🌷͙֒\n` + `• 🌟 Prestige Level ${reqs.minPrestige} ੈ✩‧₊˚\n` + `• 💰 ${reqs.minCoins.toLocaleString()} PokéCoins ⋆｡‧˚ʚ🍓ɞ˚‧｡⋆\n` + `• 📊 ${reqs.minLeveledPokemon} Pokémon at Lv.${reqs.minPokemonLevel}+ ᡣ𐭩\n` + `• 📦 ${reqs.minTotalPokemon} Total Pokémon 🫧\n` + `━━━━━━━━━━━━━━━━━━━━━━━━━\n\n` + `_~The Omega path demands perfection.~_ 🔮 𓆩♡𓆪`);
      return;
    }
    if (!args[0] || args[0].toLowerCase() !== 'confirm') {
      await chat.sendMessage(`\n` + `    🔮 *OMEGA — CONFIRMATION* 🔮 ૮꒰ ˶• ༝ •˶꒱ა ♡\n` + `\n\n` + `👤 *Trainer:* ${senderName} 🎀\n\n` + `⚠️ *THIS IS A RESET!* 𖦹\n\n` + `💥 *This action will:* 🫧\n` + `• Reset PokéCoins to 0\n` + `• Wipe Pokéballs and Level Orbs from inventory\n` + `• 💎 *PRESERVED:* Radiant Crystals are kept!\n` + `• 🧭 *PRESERVED:* Wishing Compasses are kept!\n` + `• Reset Prestige to 0\n` + `• Reset ALL Pokémon levels to Lv.1\n\n` + `🔓 *In return:* ੈ✩‧₊˚\n` + `• Unlock Lv.${((eligibility.wallet?.omegaLevel || 0) + 1) * 1000 + 100} cap ᡣ𐭩\n` + `• Multiply all stats by ×5 (stacking) ⋆.˚\n` + `• Unlock 5 Summoning Candles per day 🎧ྀི\n\n` + `━━━━━━━━━━━━━━━━━━━━━━━━━\n` + ` _Type_ \`-omega confirm\` _to proceed._ ୨୧\n` + `━━━━━━━━━━━━━━━━━━━━━━━━━\n\n` + `_⚠️ THIS CANNOT BE UNDONE!_ 💀 ૮₍ ˃ ⤙ ˂ ₎ა`);
      return;
    }
    const result = await economyStore.performOmega(senderId);
    if (!result.success) {
      await chat.sendMessage(`❌ *Omega failed!* _${result.reason}_`);
      return;
    }
    await chat.sendMessage(`\n` + `   ✧･ﾟ: *✧･ﾟ:* 🌌 *OMEGA ASCENSION COMPLETE!* 🌌 *:･ﾟ✧*:･ﾟ✧\n` + `            ˚₊‧꒰ა ✦ ໒꒱ ‧₊˚ ૮꒰˶ - ˕ -꒱ა ݁ᛪ༙ → ᡣ𐭩\n` + `\n` + `👤 *Trainer:* ${senderName} 🎀 𓍢ִ໋🌷͙֒✧˚.🎀༘⋆\n\n` + `_~ 𝓣𝓱𝓮 𝓱𝓮𝓪𝓿𝓮𝓷𝓼 𝓽𝓻𝓮𝓶𝓫𝓵𝓮, 𝓪𝓷𝓭 𝓻𝓮𝓪𝓵𝓲𝓽𝔂 𝓼𝓱𝓪𝓽𝓽𝓮𝓻𝓼 𝓪𝓻𝓸𝓾𝓷𝓭 𝔂𝓸𝓾... ~_ 𓆩♡𓆪\n\n` + `   ▶︎ •၊၊||၊|။||||| 0:10 𓇼 ⋆.˚ 𓆉 𓆝 𓆡⋆.˚ 𓇼 ⋆˚࿔ ⋆˙⟡ 𝜗ৎ ⋆.𐙚 ̊ \n\n` + `🎉 𝐂𝐎𝐍𝐆𝐑𝐀𝐓𝐔𝐋𝐀𝐓𝐈𝐎𝐍𝐒, 𝐂𝐇𝐀𝐌𝐏𝐈𝐎𝐍! 🎉 ⋆｡‧˚ʚ🍓ɞ˚‧｡⋆ \n` + `You have transcended the mortal realm and achieved the ultimate, absolute form of power! ( ˶ˆ꒳ˆ˵ ) 🏆✨ Like defeating the final boss at the end of a grand, grueling adventure—like slaying the Ender Dragon after countless hours of grinding—you have finally reached the very apex of this world! ૮꒰ ˶• ༝ •˶꒱ა ♡ Every trial, every caught Pokémon, every PokéCoin saved has led to this singular, magnificent moment! ⋆˚✿˖° \n\n` + `You are now the undisputed Master, a living myth walking among ordinary trainers! (๑>◡<๑) 𖤐 ༘⋆✿ The very fabric of the universe itself bows to your sheer will, determination, and boundless energy! 🌌 You are no longer just a player; you are a force of nature, a legend whose name will be whispered with awe in every corner of the globe! ⋆｡ﾟ☁︎｡⋆｡ ﾟ☾ ﾟ｡⋆ 𔓘 ✩ ♬ ₊.🎧⋆☾⋆⁺₊✧ \n\n` + `   *:･ ˚₊· ͟͟͞͞➳❥ ✎ - ,, -‘๑’- ・❥・ ˚₊· ͟͟͞͞➳❥ ✎𓂃 ٩(ˊᗜˋ*)و \n\n` + `Though this is the highest, final tier of ascension, your legendary journey in the world of Celestia does not end here! (˶˃ ᵕ ˂˶) The endless stars are your playground! ⋆.˚✮🎧✮˚.⋆ You can continue to grind, collect, battle, and amass unimaginable wealth! You can endlessly climb through infinite Prestige levels to show off your unyielding supremacy! ⋆⭒˚｡⋆ ‧₊˚✧[INFINITY]✧˚₊‧ The cosmos is yours to command, now and forever! 𓍢ִ໋🌷͙֒✧˚ ༘ ⋆｡˚♡ \n\n` + ` ﮩ٨ـﮩﮩ٨ـ♡ﮩ٨ـﮩﮩ٨ـ ⤿ ⋆｡‧˚ʚ🧸ɞ˚‧｡⋆ ✎𓂃 ٩(ˊᗜˋ*)و ♡ °‧🫧⋆.ೃ࿔*:･ \n\n` + `━━━━━━━━━━━━━━━━━━━━━━━━━\n` + `🌌 *Omega Level:* ${result.newOmega} 𓍢ִ໋🌷͙֒ 👑\n` + `🔓 *New Level Cap:* Lv.${result.newLevelCap} ੈ✩‧₊˚ 📈\n` + `⚡ *Stats Multiplier:* ×${result.newOmega * 5} ᡣ𐭩 💪\n` + `🕯️ *Daily Summons:* ${result.summonCandlesPerDay} 🫧 ✨\n\n` + `💥 PokéCoins reset. Pokéballs and Level Orbs cleared. 🧹\n` + `💎 Radiant Crystals and Wishing Compasses fully preserved! 🛡️\n` + `📊 All Pokémon reset to Lv.1. 🐣\n` + `✅ All cooldowns reset. ⏰\n` + `━━━━━━━━━━━━━━━━━━━━━━━━━\n\n` + `_~ Your legend will be sung for eternity, ${senderName}! ~_ 🌌✨ 𓆩♡𓆪\n` + `  ⋆. 𐙚 ˚ 「 ✦ 𝓣𝓱𝓮 𝓔𝓷𝓭...? ✦ 」 ⌇ ༉‧₊˚. ┆ ⋆.˚ ☾⭒.˚ ₊˚ʚ •ﻌ• \n` + `    ╰┈➤ 𐙚🧸ྀི ˖ ᡣ𐭩 ⊹ ࣪ ౨ৎ˚₊ 𐙚⋆.˚ 𝜗𝜚⋆₊˚ ˙⋆✮ ੈ✩‧₊˚ ✧.* ⋆·˚ ༘ * `);
  }
};