const { OWNER_NAME } = require('../../config');
const pokemonStore = require('../../store/pokemonStore');
const { isFather } = require('../../utils/permissions');
const { MessageMedia } = require('whatsapp-web.js');
const axios = require('axios');

module.exports = {
  name: 'spawn',
  aliases: ['forcespawn'],
  description: 'Force spawn a specific Pokémon in the current group. (Father only)',
  adminOnly: false,
  localOnly: true,
  async execute(msg, args, client) {
    const chat = await msg.getChat();
    if (!chat.isGroup) {
      return msg.reply('❌ _This command only works in group chats._');
    }

    const isFatherUser = await isFather(msg, client);
    if (!isFatherUser) {
      return msg.reply('❌ *ACCESS DENIED* ❌\n\n_Only ' + OWNER_NAME + ' can use this command!_ 👑');
    }

    if (!args || args.length === 0) {
      return msg.reply('⚠️ _Please specify the Pokémon name to spawn!_\n_Example: -spawn Pikachu_');
    }

    const pokemonName = args.join(' ');
    const groupId = chat.id._serialized;
    
    if (pokemonStore.getActiveSpawn(groupId)) {
        return msg.reply('⚠️ _There is already an active spawn in this group! Catch it or wait for it to expire._');
    }

    const spawn = pokemonStore.forceSpawnPokemon(groupId, pokemonName);
    if (!spawn) {
      return msg.reply(`❌ _Could not find a Pokémon named "${pokemonName}"._`);
    }

    pokemonStore.tickCatchCooldowns(groupId);
    
    let spawnText = `🌿 *A wild ${spawn.name} appeared by Father's decree!* 🌿 ૮꒰ ˶• ༝ •˶꒱ა ♡\n\n` + 
                    `Type \`kitsune catch ${spawn.name}\` to catch it! 🎀\n\n` + 
                    `⏳ _Hurry! It will flee in 2 minutes!_ ⚡ ⋆.˚`;
                    
    if (spawn.rarity === 'easter egg') {
        spawnText = `\n` +
        `⠀⠀⠀ ✧･ﾟ: *✧･ﾟ:*  👑  *:･ﾟ✧*:･ﾟ✧\n` +
        `⠀⠀⠀⠀ *MYSTERIOUS ANOMALY*\n` +
        `⠀⠀⠀ ✧･ﾟ: *✧･ﾟ:*  💎  *:･ﾟ✧*:･ﾟ✧\n\n` +
        `ꕥ 𝗘𝗡𝗧𝗜𝗧𝗬 »  *${spawn.name.toUpperCase()}*\n` +
        `ꕥ 𝗥𝗔𝗥𝗜𝗧𝗬 »  🌟 EASTER EGG 🌟\n\n` +
        `⠀⠀ ✦ ━━━ 𝗘𝗫𝗖𝗟𝗨𝗦𝗜𝗩𝗘 𝗥𝗘𝗟𝗜𝗖 ━━━ ✦\n` +
        `_"A rare phenomenon outside of space and time has materialized in this dimension."_\n` +
        `⠀⠀ ✦ ━━━━━━━━━━━━━━━━━━━ ✦\n\n` +
        `> _Type \`kitsune catch ${spawn.name}\` to claim this divine artifact!_ 🎀\n\n` +
        `⏳ _Hurry before it vanishes into the void!_ ⚡ ⋆.˚`;
    }

    if (spawn.cardImage) {
      try {
        let media;
        if (spawn.cardImage.startsWith('http')) {
          const imgRes = await axios.get(spawn.cardImage, {
            responseType: 'arraybuffer',
            timeout: 15000
          });
          const base64 = Buffer.from(imgRes.data).toString('base64');
          media = new MessageMedia('image/png', base64, 'wild_pokemon.png');
        } else {
          media = MessageMedia.fromFilePath(spawn.cardImage);
        }
        await chat.sendMessage(media);
      } catch (imgErr) {
        console.warn(`[Pokemon] Force spawn image failed for ${groupId}:`, imgErr.message);
      }
    }
    await chat.sendMessage(spawnText);
    pokemonStore.markSpawnSent(groupId);
  }
};
