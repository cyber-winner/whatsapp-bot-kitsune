const { OWNER_NAME, 
  PREFIX,
  ACTIVATE_PHRASE,
  DEACTIVATE_PHRASE,
  AGGRESSIVE_COMMANDS,
  FATHER,
  API_HOST,
  WA_API_PORT,
  BRAIN_PORT
} = require('../config');
const {
  isBotOwner,
  isFather,
  isBotAdmin
} = require('../utils/permissions');
const {
  isActivated,
  activateGroup,
  deactivateGroup
} = require('../store/groupStore');
const knownUserStore = require('../store/knownUserStore');
const immuneStore = require('../store/immuneStore');
const {
  addDeletedMessage,
  addEditedMessage,
  cacheMedia,
  getCachedMedia
} = require('../store/snipeStore');
const {
  isBanned
} = require('../store/banStore');
const {
  fetchGif
} = require('../utils/gifApi');
const {
  sendAnimatedGif
} = require('../utils/mediaHelper');
const {
  getAutoreactEmoji
} = require('../store/autoreactStore');
const {
  getDisplayName
} = require('../utils/contactHelper');
const pokemonStore = require('../store/pokemonStore');
const pokemonGroupStore = require('../store/pokemonGroupStore');
const axios = require('axios');
const http = require('http');
const https = require('https');
const { execFile } = require('child_process');
const { internalAuthHeaders } = require('../utils/internalAuth');

const MODULE_PORTS = {
    pokemon: 3401,
    fun: 3402,
    moderation: 3403,
    family: 3404,
    meme: 3405,
    reactions: 3406,
    snipe: 3407,
    utility: 3408
};

const sharedAgent = new http.Agent({ keepAlive: true, maxSockets: Infinity, keepAliveMsecs: 1000 });

function createModuleClient(port) {
    const client = axios.create({
        baseURL: `http://localhost:${port}`,
        headers: internalAuthHeaders(),
        httpAgent: sharedAgent
    });
    client.interceptors.response.use(undefined, async (err) => {
        const config = err.config;
        if (!config || !config.retry) return Promise.reject(err);
        config.__retryCount = config.__retryCount || 0;
        if (config.__retryCount >= config.retry) return Promise.reject(err);
        config.__retryCount += 1;
        await new Promise(r => setTimeout(r, config.retryDelay || 200));
        return client(config);
    });
    return client;
}

const moduleClients = {};
for (const [cat, port] of Object.entries(MODULE_PORTS)) {
    moduleClients[cat] = createModuleClient(port);
}

const {
  MessageMedia
} = require('whatsapp-web.js');
const raidStore = require('../store/raidStore');
const tosStore = require('../store/tosStore');
const messageLogger = require('../store/messageLogger');
const remoteLogger = require('../store/remoteLogger');
const personaClient = require('../store/personaClient');
const {
  TOS_TEXT,
  TOS_LOCKED_MSG,
  TOS_ACCEPTED_MSG,
  TOS_ALREADY_ACCEPTED_MSG
} = require('../data/tos');
const { getUserId, registerMapping } = require('../utils/getUserId');
const { checkRateLimit, checkCommandLimit, wrapWithTimeout, TimeoutError, TIMEOUTS } = require('../utils/rateLimiter');
const catchQueues = {};
function registerEvents(client) {
  pokemonGroupStore.initialize(client);
  client.on('message', async msg => {
    console.log(`[DEBUG-RAW] 'message' event fired | from: ${msg.from} | body: "${(msg.body || '').substring(0, 50)}"`);
  });
  client.on('message_create', async msg => {
    try {
      remoteLogger.logMessage(msg, client).catch(e => console.error('[RemoteLogger Error]', e));
      if (msg.from === 'status@broadcast') return;
      
      
      if (!global.processedMessageIds) global.processedMessageIds = new Set();
      if (global.processedMessageIds.has(msg.id._serialized)) {
        return; 
      }
      global.processedMessageIds.add(msg.id._serialized);
      
      if (global.processedMessageIds.size > 1000) {
        const iterator = global.processedMessageIds.values();
        for (let i = 0; i < 200; i++) global.processedMessageIds.delete(iterator.next().value);
      }

      const isGroup = msg.from.endsWith('@g.us');
      const groupId = isGroup ? msg.from : null;
      const learningStateStore = require('../store/learningStateStore');
      const learningDisabled = isGroup ? learningStateStore.isLearningDisabled(groupId) : false;
      if (!learningDisabled) {
        messageLogger.logMessage(msg, client).catch(e => console.error('[MessageLogger Error]', e));
        if (isGroup) {
          personaClient.onMessage(groupId);
        }
      }

      console.log(`[DEBUG-CREATE] Fired | from: ${msg.from} | body: "${(msg.body || '').substring(0, 50)}"`);
      const chat = await msg.getChat();
      console.log(`[DEBUG-CHAT] Successfully retrieved chat for: ${msg.from}`);
      const body = msg.body?.trim();
      const now = Math.floor(Date.now() / 1000);
      console.log(`[DEBUG-TIME] now: ${now} | msg.timestamp: ${msg.timestamp} | diff: ${now - msg.timestamp}`);
      if (now - msg.timestamp > 30) {
        console.log(`[DEBUG-TIME] Discarded message from ${msg.from} due to >30s age (diff: ${now - msg.timestamp}s)`);
        return;
      }
      if (!body && !msg.hasMedia) return;
      if (isGroup && body) {
        const battleStore = require('../store/battleStore');
        if (battleStore.getBattle(groupId)) {
          const sender = await msg.getContact();
          const senderId = getUserId(sender);
          if (battleStore.handleBattleInput(groupId, senderId, body)) {
            return;
          }
        }
      }
      if (isGroup && !pokemonGroupStore.isPokemonDisabled(groupId)) {
        raidStore.registerGroup(groupId);
      }
      if (msg.hasMedia && isGroup) {
        msg.downloadMedia().then(media => {
          if (media) cacheMedia(msg.id._serialized, media);
        }).catch(() => {});
      }
      console.log(`[DEBUG] Message received | from: ${msg.from} | author: ${msg.author} | fromMe: ${msg.fromMe} | isGroup: ${isGroup} | body: "${(body || '').substring(0, 50)}"`);
      if (isGroup) {
        const bodyLower = (body || '').toLowerCase();
        if (bodyLower.startsWith('kitsune')) {
          if (bodyLower === 'kitsune giveaway enter') {
            const giveawayStore = require('../store/giveawayStore');
            if (giveawayStore.hasActiveGiveaway(groupId)) {
              const sender = await msg.getContact();
              const senderId = getUserId(sender);
              const rl = checkRateLimit(senderId, 'giveaway_enter');
              if (!rl.allowed) { if (rl.message) await msg.reply(rl.message); return; }
              const senderName = getDisplayName(sender);
              const enterResult = giveawayStore.enterParticipant(groupId, senderId, senderName);
              if (enterResult.success) {
                await msg.reply(`✅ *Giveaway Entry Confirmed!* 🎟️\n\n_Trainer *${senderName}* has entered the giveaway!_\n_Total entries: ${enterResult.count}_`);
              } else if (enterResult.reason === 'already_entered') {
                await msg.reply(`⚠️ _You have already entered this giveaway, ${senderName}!_`);
              } else if (enterResult.reason === 'blacklisted') {
                await msg.reply(`🙅‍♂️ *GIVEAWAY ENTRY DENIED* 🙅‍♂️\n\n_Sorry, ${senderName}! You won the last giveaway, so you are blacklisted from this draw to keep it fair and fun for all other trainers!_ 🌟`);
              } else {
                await msg.reply(`❌ _Failed to enter giveaway: ${enterResult.reason}_`);
              }
            } else {
              await msg.reply('❌ _There is no active Pokémon giveaway running in this group!_');
            }
            return;
          }
          const ownerCheck = await isBotOwner(msg, client);
          console.log(`[DEBUG] Checking activation | bodyLower: "${bodyLower}" | ACTIVATE_PHRASE: "${ACTIVATE_PHRASE}" | match: ${bodyLower === ACTIVATE_PHRASE} | isBotOwner: ${ownerCheck}`);
          if (bodyLower === ACTIVATE_PHRASE && ownerCheck) {
            const wasNew = activateGroup(groupId);
            if (wasNew) {
              const activationMsg = `\n` + `    ✨ *KITSUNE — AWAKENED* ✨    \n` + `\n\n` + `_At your service, Master._ 🌙\n\n` + `I shall watch over this realm with grace\n` + `and devotion. Every command you speak,\n` + `I will answer. Every message that falls,\n` + `I will remember. Every soul you banish,\n` + `shall *never* return.\n\n` + `━━━━━━━━━━━━━━━━━━━━━━\n` + `🌟 *Your comfort is my purpose.*\n` + `🛡️ *Your group is my domain.*\n` + `⚔️ *Your enemies are my targets.*\n` + `━━━━━━━━━━━━━━━━━━━━━━\n\n` + `> _Speak_ \`-help\` _to see what I can do._\n\n` + `_~Kitsune, forever yours~_ 💫`;
              await chat.sendMessage(activationMsg);
              try {
                const gif = await fetchGif('wave');
                if (gif) {
                  await sendAnimatedGif({
                    chat,
                    gifUrl: gif.url,
                    caption: `_✨ Kitsune has entered the chat ✨_`,
                    label: 'Activation'
                  });
                }
              } catch (gifErr) {
                console.warn('[Activation] GIF send failed:', gifErr.message);
              }
            } else {
              await chat.sendMessage(`💫 *I'm already awake, Master~*\n\n` + `_No need to call me twice — I never sleep._ 🌙\n` + `_Use_ \`-help\` _to see my commands._`);
            }
            return;
          }
          if (bodyLower === DEACTIVATE_PHRASE && (await isBotOwner(msg, client))) {
            const wasActive = deactivateGroup(groupId);
            if (wasActive) {
              const deactivateMsg = `\n` + `     💤 *KITSUNE — DORMANT*     \n` + `\n\n` + `_As you wish, Master..._\n\n` + `I shall retreat into the shadows and\n` + `await your call once more. 🌑\n\n` + `> _Whisper_ *"Kitsune activate"* _to summon me again._\n\n` + `_~Until next time~_ 🖤`;
              await chat.sendMessage(deactivateMsg);
            } else {
              await chat.sendMessage(`🌑 _I'm not active in this group, Master._`);
            }
            return;
          }
          if (bodyLower === 'kitsune disable pokemon' && ownerCheck) {
            await pokemonGroupStore.setPokemonDisabled(groupId, true);
            await chat.sendMessage(`❌ *Pokémon features have been disabled in this group.* _All commands and spawns are now inactive._`);
            return;
          }
          if (bodyLower === 'kitsune enable pokemon' && ownerCheck) {
            await pokemonGroupStore.setPokemonDisabled(groupId, false);
            await chat.sendMessage(`✅ *Pokémon features have been enabled in this group.* _Commands and spawns are now active!_`);
            return;
          }
          if (bodyLower === 'kitsune stop auto raid' && ownerCheck) {
            await raidStore.setAutoRaidEnabled(false);
            await chat.sendMessage(`🛑 *Father Auto Raid participation has been disabled!* ❌\n\n_You will no longer be automatically entered into global raids._`);
            return;
          }
          if (bodyLower === 'kitsune start auto raid' && ownerCheck) {
            await raidStore.setAutoRaidEnabled(true);
            await chat.sendMessage(`⚡ *Father Auto Raid participation has been enabled!* 🚀\n\n_You will now be automatically entered into global raids on spawn._`);
            return;
          }
          if (bodyLower.startsWith('kitsune pokespawn ') && ownerCheck) {
            const param = bodyLower.slice('kitsune pokespawn '.length).trim();
            if (param === 'time' || param === 'parameter time') {
              await pokemonGroupStore.setSpawnMode(groupId, 'time');
              await chat.sendMessage(`⏳ *Pokémon Spawn Mode set to TIME-BASED.*\n\n` + `_Spawns will now occur randomly between 5 and 10 minutes instead of the 25-message rule!_`);
            } else if (param === 'msg' || param === 'message' || param === 'parameter msg' || param === 'parameter message') {
              await pokemonGroupStore.setSpawnMode(groupId, 'msg');
              await chat.sendMessage(`💬 *Pokémon Spawn Mode set to MESSAGE-BASED.*\n\n` + `_Spawns will now follow the 25-message count rule!_`);
            } else {
              await chat.sendMessage(`❌ _Invalid spawn mode parameter._\n\n` + `_Use:_ \`kitsune pokespawn time\` _or_ \`kitsune pokespawn msg\``);
            }
            return;
          }
          if (bodyLower === 'kitsune yes' || bodyLower === 'kitsune no') {
            const isFatherUser = await isFather(msg, client);
            if (isFatherUser) {
              const familyStore = require('../store/familyStore');
              const marryReq = familyStore.getCelestiaMarryRequest(groupId);
              if (marryReq) {
                const {
                  senderId
                } = marryReq;
                familyStore.clearCelestiaMarryRequest(groupId);
                const botId = client.info?.wid?.user || '';
                if (bodyLower === 'kitsune yes') {
                  familyStore.pendingProposals.set(`marry-${senderId}-${botId}`, Date.now());
                  await familyStore.marry(senderId, botId);
                  const phrases = require('../data/phrases.json').family['marry'];
                  let phrase = phrases[Math.floor(Math.random() * phrases.length)];
                  phrase = phrase.replace(/\{s\}/g, senderId).replace(/\{t\}/g, botId);
                  try {
                    const gif = await fetchGif('kiss');
                    if (gif) {
                      await sendAnimatedGif({
                        chat,
                        gifUrl: gif.url,
                        caption: phrase + `\n\n_Anime: ${gif.anime_name}_\n\n✨ *Father has given his blessing!* ✨`,
                        mentions: [`${senderId}@c.us`, `${botId}@c.us`],
                        label: 'MARRY'
                      });
                    } else {
                      await chat.sendMessage(phrase + `\n\n✨ *Father has given his blessing!* ✨`, {
                        mentions: [`${senderId}@c.us`, `${botId}@c.us`]
                      });
                    }
                  } catch (e) {
                    await chat.sendMessage(phrase + `\n\n✨ *Father has given his blessing!* ✨`, {
                      mentions: [`${senderId}@c.us`, `${botId}@c.us`]
                    });
                  }
                } else {
                  try {
                    const gif = await fetchGif('cry');
                    if (gif) {
                      await sendAnimatedGif({
                        chat,
                        gifUrl: gif.url,
                        caption: `😭 *@${senderId}* is crying because Father denied the blessing...`,
                        mentions: [`${senderId}@c.us`],
                        label: 'DENIED'
                      });
                    } else {
                      await chat.sendMessage(`😭 *@${senderId}* is crying because Father denied the blessing...`, {
                        mentions: [`${senderId}@c.us`]
                      });
                    }
                  } catch (e) {
                    await chat.sendMessage(`😭 *@${senderId}* is crying because Father denied the blessing...`, {
                      mentions: [`${senderId}@c.us`]
                    });
                  }
                }
                return;
              }
            }
          }
          const thisIsMatch = bodyLower.match(/^kitsune\s+this\s+is\s+@/);
          if (thisIsMatch && (await isBotOwner(msg, client))) {
            const mentionedContacts = await msg.getMentions();
            if (mentionedContacts.length > 0) {
              const target = mentionedContacts[0];
              const targetLid = getUserId(target);
              const bodyParts = body.split(/\s+/);
              let nameStartIdx = -1;
              for (let i = 0; i < bodyParts.length; i++) {
                if (bodyParts[i].startsWith('@')) {
                  nameStartIdx = i + 1;
                  break;
                }
              }
              let userName = '';
              if (nameStartIdx > 0 && nameStartIdx < bodyParts.length) {
                userName = bodyParts.slice(nameStartIdx).join(' ').trim();
              }
              if (!userName) {
                userName = target.pushname || target.name || 'Unknown';
              }
              const isNew = await knownUserStore.setUser(targetLid, userName);
              if (isNew) {
                const newPhrases = [`\n` + `    📋 *USER REGISTERED* 📋     \n` + `\n\n` + `_Yes, Father!_ ✨\n\n` + `I'll remember them as *${userName}*.\n\n` + `━━━━━━━━━━━━━━━━━━━━\n` + `👤 *Name:* ${userName}\n` + `🆔 *LID:* \`${targetLid}\`\n` + `━━━━━━━━━━━━━━━━━━━━\n\n` + `> _From now on, I'll always address them properly._ 💫`, `✨ *Got it, Father!*\n\n` + `*${userName}* has been etched into my memory.\n\n` + `_Wherever they go, I'll know who they are._ 🌟\n\n` + `> _ID: \`${targetLid}\`_ 📝`];
                const selectedMsg = newPhrases[Math.floor(Math.random() * newPhrases.length)];
                await chat.sendMessage(selectedMsg);
              } else {
                const updatePhrases = [`📝 *Updated, Father!*\n\n` + `They are now known as *${userName}*.\n` + `_My records have been refreshed._ ✅\n\n` + `> _ID: \`${targetLid}\`_`, `✏️ *Name Changed!*\n\n` + `_Noted, Father._ *${userName}* it is.\n` + `_Updated across all my systems._ 💫`];
                const selectedMsg = updatePhrases[Math.floor(Math.random() * updatePhrases.length)];
                await chat.sendMessage(selectedMsg);
              }
              try {
                const gif = await fetchGif('wave');
                if (gif) {
                  await sendAnimatedGif({
                    chat,
                    gifUrl: gif.url,
                    caption: `_👋 Welcome, ${userName}! _`,
                    label: 'Register'
                  });
                }
              } catch (gifErr) {}
              return;
            }
          }
          if (bodyLower.match(/^kitsune\s+add\s+me\s+as\s+admin/) && (await isBotOwner(msg, client))) {
            if (!(await isBotAdmin(msg, client))) {
              await chat.sendMessage(`❌ _I need to be an admin first to promote you, Master._`);
              return;
            }
            try {
              const sender = await msg.getContact();
              const senderName = getDisplayName(sender);
              await chat.promoteParticipants([sender.id._serialized]);
              const isFatherUser = await isFather(msg, client);
              const promotePhrases = isFatherUser ? [`👑 *As you command, Father.*\n\n_You have been promoted to admin._\n_The group bows to your authority._ ⚡`, `🌟 *${OWNER_NAME} rises.*\n\n_Admin privileges granted._\n_This group is now under your direct control._ 👑`] : [`✅ *Done, ${senderName}!*\n\n_You've been promoted to admin._\n_Use your power wisely._ ⚡`, `👑 *${senderName}* _has been promoted to admin._\n\n_Father's chosen Owners carry authority._ 🌟`];
              const selectedMsg = promotePhrases[Math.floor(Math.random() * promotePhrases.length)];
              await chat.sendMessage(selectedMsg);
              try {
                const gif = await fetchGif('thumbsup');
                if (gif) await sendAnimatedGif({
                  chat,
                  gifUrl: gif.url,
                  caption: `_👑 Admin granted!_`,
                  label: 'SelfPromote'
                });
              } catch (e) {}
            } catch (err) {
              await chat.sendMessage(`❌ _Failed to promote: ${err.message}_`);
            }
            return;
          }
          if (bodyLower.match(/^kitsune\s+immune\s+me/) && (await isBotOwner(msg, client))) {
            const sender = await msg.getContact();
            const senderLid = getUserId(sender);
            const senderName = getDisplayName(sender);
            if (immuneStore.isImmune(senderLid)) {
              await chat.sendMessage(`🛡️ _You already have immunity, Master._`);
              return;
            }
            const isFatherUser = await isFather(msg, client);
            const granterName = isFatherUser ? OWNER_NAME : senderName;
            await immuneStore.grantImmune(senderLid, senderName, granterName);
            if (isFatherUser) {
              await chat.sendMessage(`\n` + `    👑 *FATHER IS UNTOUCHABLE* 👑 \n` + `\n\n` + `_As if anyone could ever touch ${OWNER_NAME}._\n\n` + `Immunity activated — but honestly,\n` + `_who would dare?_ 😏\n\n` + `⚔️ _Try it and face the consequences._ ⚔️`);
            } else {
              await chat.sendMessage(`\n` + `    🛡️ *SELF-IMMUNITY ON* 🛡️     \n` + `\n\n` + `*${senderName}*, you are now shielded.\n\n` + `_No aggressive commands can touch you._\n` + `_Protected by your own authority._ ✨`);
            }
            try {
              const gif = await fetchGif('smug');
              if (gif) await sendAnimatedGif({
                chat,
                gifUrl: gif.url,
                caption: `_🛡️ Immunity activated!_`,
                label: 'SelfImmune'
              });
            } catch (e) {}
            return;
          }
        }
      }
      if (isGroup && !isActivated(groupId)) return;
      if (isGroup && body) {
        const bodyLowerTos = body.toLowerCase().trim();
        if (bodyLowerTos === 'kitsune tos') {
          await chat.sendMessage(TOS_TEXT);
          return;
        }
        if (bodyLowerTos === 'kitsune i agree') {
          const sender = await msg.getContact();
          const senderId = getUserId(sender);
          const senderName = getDisplayName(sender);
          if (tosStore.hasAcceptedToS(senderId)) {
            await chat.sendMessage(TOS_ALREADY_ACCEPTED_MSG);
          } else {
            await tosStore.acceptToS(senderId);
            const acceptMsg = TOS_ACCEPTED_MSG.replace('{name}', senderName);
            await chat.sendMessage(acceptMsg);
          }
          return;
        }
      }
      if (isGroup && body) {
        const bodyLowerGate = body.toLowerCase().trim();
        const isCommand = body.startsWith(PREFIX);
        const isCatchAttempt = bodyLowerGate.startsWith('kitsune catch');
        const isCelestiaCommand = bodyLowerGate.startsWith('kitsune ') && !bodyLowerGate.startsWith('kitsune activate') && !bodyLowerGate.startsWith('kitsune deactivate');
        if (isCommand || isCatchAttempt || isCelestiaCommand) {
          const tosSender = await msg.getContact();
          const tosSenderId = getUserId(tosSender);
          if (!tosStore.hasAcceptedToS(tosSenderId)) {
            await chat.sendMessage(TOS_TEXT);
            return;
          }
        }
      }
      if (isGroup && body && (body.toLowerCase().startsWith('kitsune catch ') || body.toLowerCase().trim() === 'kitsune catch')) {
        let watchdogActive = false;
        try {
            const fs = require('fs');
            const beat = parseInt(fs.readFileSync('/tmp/celestia_watchdog_heartbeat', 'utf8'));
            if (Date.now() - beat < 15000) watchdogActive = true;
        } catch(e) {}

        if (watchdogActive) {
            let isChargingCatch = true;
            try {
                const fs = require('fs');
                const acStatusCatch = fs.readFileSync('/sys/class/power_supply/ACAD/online', 'utf8').trim();
                isChargingCatch = (acStatusCatch === '1');
            } catch(e) {}
            if (!isChargingCatch) {
                await chat.sendMessage('⚠️ _Services are currently offline likely due to a power outage or other reasons. Please try again after some time._');
                return;
            }
        }

        if (pokemonGroupStore.isPokemonDisabled(groupId)) {
          return msg.reply('❌ _Pokémon commands and spawns are disabled in this group._');
        }
        let guessedName = body.toLowerCase().trim() === 'kitsune catch' ? '' : body.slice('kitsune catch '.length).trim();
        const sender = await msg.getContact();
        const senderId = getUserId(sender);
        const catchRL = checkRateLimit(senderId, 'catch');
        if (!catchRL.allowed) { if (catchRL.message) await msg.reply(catchRL.message); return; }
        const senderName = getDisplayName(sender);
        const PlayerWalletCheck = require('../models/PlayerWallet');
        const walletLockCheck = await PlayerWalletCheck.findOne({
          userId: senderId
        });
        if (walletLockCheck && walletLockCheck.pokemonLocked) {
          return chat.sendMessage(`hey @${senderId} your account has been locked by father cyber.\nreason:- ${walletLockCheck.pokemonLockReason}\n to unlock your account you have to explain father why you did that`, {
            mentions: [sender.id._serialized]
          });
        }
        if (!guessedName) {
          const PlayerWallet = require('../models/PlayerWallet');
          const wallet = await PlayerWallet.findOne({
            userId: senderId
          });
          if (!wallet || !wallet.diaperModeSpawns || wallet.diaperModeSpawns <= 0) {
            return msg.reply('❌ *You need to specify a Pokémon name!*\n\n_Usage:_ `kitsune catch <name>`\n\n💡 _Tip: Use a Dirty Diaper (`-pokeuse dirty diaper`) to skip typing the name!_');
          }
          const activeSpawn = pokemonStore.getActiveSpawn(groupId);
          if (activeSpawn) {
            guessedName = activeSpawn.name;
          } else {
            const summonedSpawn = pokemonStore.getSummonedSpawn(groupId);
            if (summonedSpawn) {
              guessedName = summonedSpawn.name;
            }
          }
        }
        const summonedSpawn = pokemonStore.getSummonedSpawn(groupId);
        if (summonedSpawn) {
          if (summonedSpawn.summonerId !== senderId) {
            await chat.sendMessage(`🔒 *That Pokémon is summoned, ${senderName}!*\n\n` + `_Only the summoner can catch a summoned Pokémon._\n` + `_Wait for a wild spawn instead!_ 🌿`);
            return;
          }
          const result = await pokemonStore.attemptSummonCatch(groupId, senderId, guessedName);
          if (result.success) {
            const p = result.pokemon;
            const economyStore = require('../store/economyStore');
            const lvlBadge = economyStore.getRankBadge(p.level, result.levelCap);
            const typeStr = (p.types || []).join(' / ');
            let rarityTag = '⬜ Common';
            if (p.isLegendary) rarityTag = '👑 *LEGENDARY*';else if (p.isMythical) rarityTag = '✨ *MYTHICAL*';
            const catchText = `\n` + `    🕯️ *SUMMONED POKÉMON CAPTURED!* 🕯️\n` + `\n\n` + `👤 *Summoner:* ${senderName}\n` + `🏷️ *Pokémon:* ${p.name}\n` + `📊 *Level:* ${p.level} — ${lvlBadge}\n` + `⭐ *Rarity:* ${rarityTag}\n` + `🔖 *Type:* ${typeStr}\n` + `🎲 *Catch Chance:* ${Math.round(result.catchChance * 100)}% 🎯\n\n` + `━━━━━━━━━━━━━━━━━━━━━━━━━\n` + `💰 *+${result.coinReward} PokéCoins earned!*\n` + `💼 *Wallet:* ${result.totalCoins.toLocaleString()} PokéCoins\n` + `🔴 *Pokéballs Left:* ${result.remainingBalls}\n` + `━━━━━━━━━━━━━━━━━━━━━━━━━\n\n` + `_~The summoning ritual was a success!~_ ✨`;
            if (p.cardImage) {
              try {
                let media;
                if (p.cardImage.startsWith('http')) {
                  const imgRes = await axios.get(p.cardImage, {
                    responseType: 'arraybuffer',
                    timeout: 15000
                  });
                  const base64 = Buffer.from(imgRes.data).toString('base64');
                  media = new MessageMedia('image/png', base64, `${p.name}.png`);
                } else {
                  media = MessageMedia.fromFilePath(p.cardImage);
                }
                await chat.sendMessage(media);
              } catch (imgErr) {
                console.warn('[Pokemon] Summon catch card image failed:', imgErr.message);
              }
            }
            await chat.sendMessage(catchText);
          } else if (result.reason === 'no_pokeballs') {
            await chat.sendMessage(`🔴 *Not enough Pokéballs, ${senderName}!* 🔴\n\n` + `_Summoned catches cost *2 Pokéballs* per try!_\n` + `_You have: ${result.have} | Need: ${result.needed}_\n\n` + `🏪 _Buy more:_ \`-pokemart buy pokeball\``);
          } else if (result.reason === 'summon_ball_failed') {
            if (result.despawned) {
              await chat.sendMessage(`💔 *ALL TRIES EXHAUSTED!* 💔\n\n` + `👤 *Summoner:* ${senderName}\n` + `🏷️ *Target:* ${result.pokemonName}\n` + `🎲 *Catch Chance:* ${Math.round(result.catchChance * 100)}%\n\n` + `_The summoned ${result.pokemonName} has vanished!_\n` + `_All 3 attempts have been used up._ 😔\n\n` + `🔴 *Pokéballs Left:* ${result.remainingBalls}\n\n` + `_~The ritual has ended in failure...~_ 💨`);
            } else {
              await chat.sendMessage(`💥 *The Pokéball broke!* 💥\n\n` + `👤 *Summoner:* ${senderName}\n` + `🏷️ *Target:* ${result.pokemonName}\n` + `🎲 *Catch Chance:* ${Math.round(result.catchChance * 100)}%\n\n` + `_The summoned ${result.pokemonName} broke free!_\n` + `_2 Pokéballs consumed._ 🔴\n\n` + `🎯 *Tries Left:* ${result.triesLeft}/3\n` + `🎲 *Next Catch Rate:* ${result.triesLeft === 1 ? '65%' : '75%'}\n` + `🔴 *Pokéballs Left:* ${result.remainingBalls}\n\n` + `_~Try again, summoner!~_ 🕯️`);
            }
          } else if (result.reason === 'wrong_name') {
            await chat.sendMessage(`❌ *Wrong name, ${senderName}!*\n_The summoned Pokémon is *${summonedSpawn.name}*!_\n_Type the exact name to catch it!_ 🎯`);
          }
          return;
        }
        if (!catchQueues[groupId]) {
          catchQueues[groupId] = {
            attempts: []
          };
        }
        const queue = catchQueues[groupId];
        queue.attempts.push({
          senderId,
          senderName,
          guessedName,
          msg,
          chat
        });
        if (queue.attempts.length === 1) {
          setTimeout(async () => {
            const attempts = queue.attempts;
            delete catchQueues[groupId];
            if (attempts.length === 0) return;
            const activeSpawn = pokemonStore.getActiveSpawn(groupId);
            if (!activeSpawn) {
              const first = attempts[0];
              await executeWildCatchAttempt(first.chat, first.senderId, first.senderName, first.guessedName, groupId);
              return;
            }
            const correctAttempts = [];
            const incorrectAttempts = [];
            for (const att of attempts) {
              if (att.guessedName.toLowerCase() === activeSpawn.name.toLowerCase()) {
                if (!correctAttempts.some(c => c.senderId === att.senderId)) {
                  correctAttempts.push(att);
                }
              } else {
                incorrectAttempts.push(att);
              }
            }
            for (const att of incorrectAttempts) {
              await executeWildCatchAttempt(att.chat, att.senderId, att.senderName, att.guessedName, groupId);
            }
            if (correctAttempts.length === 0) return;
            if (correctAttempts.length === 1) {
              const player = correctAttempts[0];
              await executeWildCatchAttempt(player.chat, player.senderId, player.senderName, player.guessedName, groupId);
            } else {
              const winnerIdx = Math.floor(Math.random() * correctAttempts.length);
              const winner = correctAttempts[winnerIdx];
              const losers = correctAttempts.filter((_, idx) => idx !== winnerIdx);
              const loserNames = losers.map(l => l.senderName).join(', ');
              const clashMsg = `⚔️ *TRAINER CLASH DETECTED!* ⚔️\n` + `━━━━━━━━━━━━━━━━━━━━━━━━━\n` + `🔥 *${winner.senderName}* and *${loserNames}* threw Pokéballs at the wild *${activeSpawn.name}* at the exact same split-second!\n\n` + `💥 A furious clash broke out between their Pokémon!\n` + `🏆 After a spectacular struggle, *${winner.senderName}* won the fight and secured the capture right! 💫\n` + `━━━━━━━━━━━━━━━━━━━━━━━━━\n` + `🛡️ _Pokéballs for the other trainers were refunded and not consumed._\n` + `_~What a fierce battle!~_ ⚡`;
              await chat.sendMessage(clashMsg);
              await executeWildCatchAttempt(winner.chat, winner.senderId, winner.senderName, winner.guessedName, groupId);
            }
          }, 650);
        }
        return;
      }
      if (isGroup && !pokemonGroupStore.isPokemonDisabled(groupId) && pokemonGroupStore.getSpawnMode(groupId) === 'msg') {
        let isMasterTrigger = false;
        try {
          const sender = await msg.getContact();
          const senderId = getUserId(sender);
          const PlayerWalletCheck = require('../models/PlayerWallet');
          const walletCheck = await PlayerWalletCheck.findOne({ userId: senderId });
          if (walletCheck && walletCheck.customTitle) isMasterTrigger = true;
        } catch (e) {}
        
        const spawn = pokemonStore.countMessage(groupId, isMasterTrigger);
        if (spawn) {
          let spawnText = `🌿 *A wild ${spawn.name} appeared!* 🌿 ૮꒰ ˶• ༝ •˶꒱ა ♡\n\n` + `Type \`kitsune catch ${spawn.name}\` to catch it! 🎀\n\n` + `⏳ _Hurry! It will flee in 2 minutes!_ ⚡ ⋆.˚`;
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
              console.warn('[Pokemon] Spawn image failed:', imgErr.message);
            }
          }
          await chat.sendMessage(spawnText);
          pokemonStore.markSpawnSent(groupId);
        }
      }
      let isKitsuneTrigger = false;
      let aiPrompt = '';
      if (body && body.toLowerCase().startsWith('hey kitsune')) {
        isKitsuneTrigger = true;
        aiPrompt = body.slice('hey kitsune'.length).trim();
      } else if (msg.hasQuotedMsg && body && !body.startsWith('-')) {
        try {
          const quotedMsg = await msg.getQuotedMessage();
          if (quotedMsg.fromMe) {
            isKitsuneTrigger = true;
            aiPrompt = body.trim();
          }
        } catch (e) {}
      }
      if (isKitsuneTrigger) {
        
        const diagLower = aiPrompt.toLowerCase();
        const isDiagnosisRequest = /\b(self[- ]?diag|system[- ]?check|health[- ]?check|run[- ]?diag|status[- ]?check|diagnostic|diagonos|diagnos)/i.test(diagLower);
        if (aiPrompt && isDiagnosisRequest) {
          try {
            await msg.reply('🩺 _Running full system diagnostics (60+ checks)... Please wait._');
            const { runSelfDiagnosis } = require('../utils/introspectTool');
            const rawResult = await runSelfDiagnosis();
            const diag = JSON.parse(rawResult);
            
            let reportMsg = `\n    🩺 *KITSUNE SYSTEM DIAGNOSTICS* 🩺\n\n`;
            reportMsg += `📊 *System Status:* ${diag.status}\n`;
            reportMsg += `🎯 *Health Score:* ${diag.healthPct}%\n`;
            reportMsg += `📋 *Summary:* ${diag.summary}\n`;
            reportMsg += `🕐 *Timestamp:* ${new Date(diag.timestamp).toLocaleString()}\n\n`;
            
            for (const section of diag.sections) {
              reportMsg += `\n━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
              reportMsg += `*${section.name.toUpperCase()}*\n`;
              reportMsg += `━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
              for (const check of section.checks) {
                const icon = check.status === 'PASS' ? '✅' : check.status === 'WARN' ? '⚠️' : '❌';
                reportMsg += `${icon} *${check.name}*\n`;
                reportMsg += `    _${check.detail}_\n`;
              }
            }
            
            if (diag.problems && diag.problems.length > 0) {
              reportMsg += `\n🚨 *CRITICAL ISSUES DETECTED:*\n`;
              for (const p of diag.problems) {
                reportMsg += `  ❌ ${p}\n`;
              }
            }
            
            reportMsg += `\n━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
            reportMsg += `_Kitsune Diagnostics complete._ ✨`;
            
            await msg.reply(reportMsg);
          } catch (diagErr) {
            console.error('[KitsuneDiag] Error:', diagErr.message);
            await msg.reply('❌ _Self-diagnosis failed: ' + diagErr.message + '_');
          }
          return;
        }
        if (aiPrompt) {
          try {
            const aiContact = await msg.getContact();
            const aiSenderLid = getUserId(aiContact);
            const aiRL = checkRateLimit(aiSenderLid, 'ai_chat');
            if (!aiRL.allowed) { if (aiRL.message) await msg.reply(aiRL.message); return; }
            const familyStore = require('../store/familyStore');
            const knownUserStore = require('../store/knownUserStore');
            const contact = await msg.getContact();
            const senderLid = getUserId(contact);
            const senderName = knownUserStore.getName(senderLid) || contact.pushname || contact.name || 'Unknown';
            const {
              FATHER
            } = require('../config');
            const isUserFather = FATHER.includes(senderLid);
            const family = await familyStore.getFamily(senderLid);
            let familyStr = '';
            let roleContext = `You are talking to: ${senderName}. Please address them by their name naturally.`;
            if (isUserFather) {
              roleContext = `You are talking to: ${OWNER_NAME} (Your creator and master). Address him directly as ${OWNER_NAME} with utmost respect and loyalty.`;
            }
            if (family) {
              const getKN = id => knownUserStore.getName(id) || id;
              let spouse = family.spouse ? getKN(family.spouse) : 'None';
              if (family.marriedToCelestia) {
                spouse = 'Kitsune (You!)';
                if (!isUserFather) {
                  roleContext = `You are talking to: ${senderName}. IMPORTANT: You are MARRIED to this person! Address them lovingly as your spouse/darling.`;
                }
              } else if (family.parents.includes(FATHER[0]) && !isUserFather) {
                roleContext = `You are talking to: ${senderName}, who is the child of your creator ${OWNER_NAME}. Treat them nicely as family and address them by name.`;
              }
              const parents = family.parents.length ? family.parents.map(getKN).join(', ') : 'None';
              const children = family.children.length ? family.children.map(getKN).join(', ') : 'None';
              familyStr = `\n[Family Tree] Spouse: ${spouse} | Parents: ${parents} | Children: ${children}\n`;
            }
            const recentMessages = await messageLogger.getRecentMessages(msg, 20);
            let shortTermBuffer = '';
            if (recentMessages && recentMessages.length > 0) {
              shortTermBuffer = "\n[Recent Conversation Buffer - Last 20 Messages]:\n";
              recentMessages.forEach(m => {
                let kn = m.sender || m.number;
                if (kn && kn.toLowerCase() === 'celestia') kn = 'Kitsune';
                shortTermBuffer += `[${kn}]: ${m.body}\n`;
              });
            }
            let groupRosterStr = "\n[Full Registered Users & Family Database]:\n";
            const allKnown = knownUserStore.getAll();
            for (const [lid, name] of Object.entries(allKnown)) {
              const fam = await familyStore.getFamily(lid);
              let roleInfo = '';
              if (FATHER.includes(lid)) {
                roleInfo = '${OWNER_NAME} (Your Creator)';
              } else {
                if (fam) {
                  const getKN = id => knownUserStore.getName(id) || id;
                  const s = fam.marriedToCelestia ? 'Kitsune' : fam.spouse ? getKN(fam.spouse) : 'None';
                  const p = fam.parents.length ? fam.parents.map(getKN).join(', ') : 'None';
                  const c = fam.children.length ? fam.children.map(getKN).join(', ') : 'None';
                  if (fam.marriedToCelestia) roleInfo = 'Your Spouse/Darling';else if (fam.parents.includes(FATHER[0])) roleInfo = 'Child of ${OWNER_NAME}';else roleInfo = 'Friend';
                  roleInfo += ` | DB Relations -> Spouse: ${s}, Parents: ${p}, Children: ${c}`;
                } else {
                  roleInfo = 'Friend';
                }
              }
              groupRosterStr += `- ${name}: ${roleInfo}\n`;
            }
            const brainResult = await wrapWithTimeout(
              personaClient.generate({
                groupId,
                senderName,
                aiPrompt,
                roleContext,
                familyStr,
                shortTermBuffer,
                groupRosterStr,
                chatName: chat.name || 'Private DM',
                learningDisabled
              }),
              TIMEOUTS.ai_generate,
              'AI Generation'
            );
            if (brainResult && brainResult.response) {
              const aiText = brainResult.response;
              if (aiText) {
                if (brainResult.shouldSplit && aiText.includes('\n')) {
                  const fragments = aiText.split('\n').filter(f => f.trim().length > 0);
                  for (const fragment of fragments) {
                    await msg.reply(`🦊 *Kitsune:*\n\n${fragment.trim()}`);
                  }
                } else {
                  await msg.reply(`🦊 *Kitsune:*\n\n${aiText}`);
                }
              }
            } else {
              await msg.reply('❌ _Sorry, my AI core is currently offline or unreachable. Try again later!_');
            }
          } catch (err) {
            console.error('[KitsuneAI] Error:', err.message);
            if (err.isTimeout) {
              await msg.reply('⏳ _My AI core took too long to respond. Please try again!_');
            } else {
              await msg.reply('❌ _Sorry, my AI core is currently offline or unreachable. Try again later!_');
            }
          }
          return;
        } else {
          await msg.reply('🦊 _Yes? How can I help you today?_');
          return;
        }
      }
      if (body && body.toLowerCase().startsWith('kitsune give ')) {
        const {
          isFather
        } = require('../utils/permissions');
        const fatherCheck = await isFather(msg, client);
        if (fatherCheck) {
          await handleFatherGive(msg, body, chat, client);
          return;
        }
      }
      if (isGroup && (!body || !body.startsWith(PREFIX))) {
        try {
          const mentionedIds = await msg.getMentions();
          for (const contact of mentionedIds) {
            const mentionedId = getUserId(contact);
            if (!mentionedId) continue;
            const emoji = getAutoreactEmoji(groupId, mentionedId);
            if (emoji) {
              await msg.react(emoji);
              break;
            }
          }
        } catch (arErr) {}
        return;
      }
      if (!body || !body.startsWith(PREFIX)) return;
      const args = body.slice(PREFIX.length).trim().split(/\s+/);
      const commandName = args.shift().toLowerCase();
      
      if (commandName === 'ping') {
          const os = require('os');
          const net = require('net');
          const cp = require('child_process');
          
          const startPing = Date.now();
          const latency = Date.now() - (msg.timestamp * 1000);
          
          const checkPort = (port) => new Promise((resolve) => {
              const sStart = Date.now();
              const s = new net.Socket();
              s.setTimeout(500);
              s.on('connect', () => { 
                  s.destroy(); 
                  resolve({ status: '🟢 ONLINE', ping: Date.now() - sStart }); 
              });
              s.on('timeout', () => { s.destroy(); resolve({ status: '🔴 TIMEOUT', ping: '>500' }); });
              s.on('error', () => { s.destroy(); resolve({ status: '🔴 OFFLINE', ping: '-' }); });
              s.connect(port, API_HOST || '127.0.0.1');
          });

          let diskStorage = 'Unknown';
          try {
              const df = cp.execSync('df -h /').toString().split('\n')[1];
              if (df) {
                  const parts = df.trim().split(/\s+/);
                  if (parts.length >= 5) diskStorage = `${parts[2]} / ${parts[1]} (${parts[4]} Used)`;
              }
          } catch(e) {}

          const getPm2Stats = () => new Promise((resolve) => {
              cp.exec('pm2 jlist', (err, stdout) => {
                  if (err) return resolve([]);
                  try { resolve(JSON.parse(stdout)); } catch(e) { resolve([]); }
              });
          });

          const modulePortChecks = Object.entries(MODULE_PORTS).map(([cat, port]) => 
              checkPort(port).then(r => ({ cat, ...r }))
          );
          const [waPort, brainPort, loggerPort, pm2StatsRaw, ...moduleResults] = await Promise.all([
              checkPort(WA_API_PORT || 3300),
              checkPort(BRAIN_PORT || 3100),
              checkPort(3200),
              getPm2Stats(),
              ...modulePortChecks
          ]);
          const pm2Stats = pm2StatsRaw;
          
          const totalMem = (os.totalmem() / 1024 / 1024 / 1024).toFixed(2);
          const freeMem = (os.freemem() / 1024 / 1024 / 1024).toFixed(2);
          const usedMem = (totalMem - freeMem).toFixed(2);
          const ramPercent = Math.round(((totalMem - freeMem) / totalMem) * 100);
          const loadAvg = os.loadavg().map(x => x.toFixed(2)).join(' | ');
          
          const problems = [];
          if (ramPercent > 90) problems.push('⚠️ High System RAM Usage');
          
          const getProcessStat = (name, pData, portData) => {
              const procs = pm2Stats.filter(p => p.name === pData);
              if (procs.length === 0) return `▸ *${name}:* 🔴 NOT FOUND`;
              
              let totalMemMB = 0;
              let totalCpu = 0;
              let allOnline = true;
              
              procs.forEach(p => {
                  totalMemMB += (p.monit && p.monit.memory ? p.monit.memory : 0) / 1024 / 1024;
                  totalCpu += (p.monit && p.monit.cpu !== undefined ? p.monit.cpu : 0);
                  if (p.pm2_env.status !== 'online') allOnline = false;
              });
              
              const memMB = totalMemMB.toFixed(1);
              const cpu = totalCpu.toFixed(1);
              
              if (!allOnline) problems.push(`❌ Service '${name}' offline`);
              if (portData && portData.status && portData.status.includes('🔴')) problems.push(`❌ '${name}' port down`);
              if (memMB > 700) problems.push(`⚠️ High RAM: '${name}' (${memMB}MB)`);
              
              const pStr = portData && portData.ping ? ` | ⚡ ${portData.ping}ms` : '';
              const statEmoji = allOnline ? '🟢' : '🔴';
              
              return `▸ ${statEmoji} *${name}:* ${memMB}MB | ${cpu}%${pStr}`;
          };

          let servicesRamStr = '';
          servicesRamStr += getProcessStat('WA Client', 'celestia-wa-bot', waPort) + '\n';
          for (const mp of moduleResults) {
              servicesRamStr += getProcessStat(mp.cat, `kitsune-${mp.cat}`, mp) + '\n';
          }
          servicesRamStr += getProcessStat('Brain', 'kitsune-brain', brainPort) + '\n';
          servicesRamStr += getProcessStat('Logger', 'kitsune-receiver', loggerPort) + '\n';
          servicesRamStr += getProcessStat('Watchdog', 'kitsune-watchdog', null);
          
          const uptimeSec = process.uptime();
          const uptimeHours = Math.floor(uptimeSec / 3600);
          const uptimeMin = Math.floor((uptimeSec % 3600) / 60);
          const uptimeSecFinal = Math.floor(uptimeSec % 60);
          
          const cpus = os.cpus();
          const cpuModel = cpus[0] ? cpus[0].model.trim() : 'Unknown';
          const processTime = Date.now() - startPing;
          
          const sysUptime = os.uptime();
          const sysDays = Math.floor(sysUptime / 86400);
          const sysHours = Math.floor((sysUptime % 86400) / 3600);
          const sysMins = Math.floor((sysUptime % 3600) / 60);
          const nodeVer = process.version;
          const hostNameMasked = 'arch-cyber';
          const osReleaseSafe = os.release().split('-')[0] + '.x';
          let pm2Ver = 'Unknown';
          try { pm2Ver = cp.execSync('pm2 -v').toString().trim(); } catch(e) {}
          
          let gpuInfo = 'No Dedicated GPU';
          try { 
              const smi = cp.execSync('nvidia-smi --query-gpu=name,memory.used,memory.total --format=csv,noheader').toString().trim();
              if (smi) {
                  const parts = smi.split(', ');
                  if(parts.length >= 3) gpuInfo = `${parts[0]} [VRAM: ${parts[1]} / ${parts[2]}]`;
              }
          } catch(e) {}
          
          let cpuTempStr = 'Unknown';
          try {
              const fs = require('fs');
              const tempRaw = fs.readFileSync('/sys/class/thermal/thermal_zone0/temp', 'utf8').trim();
              cpuTempStr = (parseInt(tempRaw) / 1000).toFixed(1) + ' °C';
          } catch(e) {}
          
          let powerStr = 'AC Power / Desktop';
          try {
              const acStatus = fs.readFileSync('/sys/class/power_supply/ACAD/online', 'utf8').trim();
              const batCap = fs.readFileSync('/sys/class/power_supply/BAT1/capacity', 'utf8').trim();
              if (acStatus === '1') powerStr = `🔌 Charging (${batCap}%)`;
              else powerStr = `🔋 Discharging (${batCap}%)`;
          } catch(e) {}
          
          const pingResponse = `\n` +
          `  🎀 ⋆ ˚｡⋆୨୧˚ 🏓 *P O N G !* ˚୨୧⋆｡˚ ⋆ 🎀  \n` +
          `━━━━━━━━━━━━━━━━━━━━━━━━━\n\n` +
          `⚡ *Msg Latency:* \`${latency}ms\`\n` +
          `⚙️ *Telemetry Time:* \`${processTime}ms\`\n` +
          `⏱️ *Bot Uptime:* ${uptimeHours}h ${uptimeMin}m ${uptimeSecFinal}s\n` +
          `🔢 *Modules:* ${Object.keys(MODULE_PORTS).length} independent services\n\n` +
          `🖥️ *Host Infrastructure:*\n` +
          `▸ *OS:* ${os.type()} ${osReleaseSafe} [${os.arch()}]\n` +
          `▸ *Host:* ${hostNameMasked} 🔒\n` +
          `▸ *Kernel:* Linux-Secure\n` +
          `▸ *Uptime:* ${sysDays}d ${sysHours}h ${sysMins}m\n` +
          `▸ *Packages:* Node ${nodeVer}, PM2 v${pm2Ver}\n` +
          `▸ *Shell:* Bash (Restricted)\n` +
          `▸ *CPU:* ${cpuModel}\n` +
          `▸ *CPU Temp:* ${cpuTempStr}\n` +
          `▸ *GPU:* ${gpuInfo}\n` +
          `▸ *Power:* ${powerStr}\n` +
          `▸ *Load Avg:* ${loadAvg}\n` +
          `▸ *RAM:* ${usedMem} GB / ${totalMem} GB (${ramPercent}%)\n` +
          `▸ *Storage:* ${diskStorage}\n\n` +
          `📊 *Microservices Telemetry:*\n` +
          `${servicesRamStr}\n\n` +
          (problems.length > 0 ? `🚨 *System Problems Detected:*\n${problems.join('\n')}\n\n` : `✅ *System Status:* All Systems Nominal & Healthy\n\n`) +
          `_Kitsune is alive and well._ ૮꒰ ˶• ༝ •˶꒱ა ♡ ⋆.˚ ✨`;
          
          return msg.reply(pingResponse);
      }

      let watchdogActive = false;
      try {
          const fs = require('fs');
          const beat = parseInt(fs.readFileSync('/tmp/celestia_watchdog_heartbeat', 'utf8'));
          if (Date.now() - beat < 15000) watchdogActive = true;
      } catch(e) {}

      if (watchdogActive) {
          let isCharging = true;
          try {
              const fs = require('fs');
              const acStatus = fs.readFileSync('/sys/class/power_supply/ACAD/online', 'utf8').trim();
              isCharging = (acStatus === '1');
          } catch(e) {}

          if (!isCharging) {
              await chat.sendMessage('⚠️ _Services are currently offline likely due to a power outage or other reasons. Please try again after some time._');
              return;
          }
      }
      
      if (!client.commands.has(commandName)) return;
      const command = client.commands.get(commandName);
      const category = command.category;

      if (['stopservice', 'startservice', 'servicestatus'].includes(commandName)) {
          const ownerCheck = await isBotOwner(msg, client);
          if (!ownerCheck) {
              return msg.reply('❌ _Only Father or an Owner can control the API services._');
          }
          
          if (commandName === 'servicestatus') {
              const checks = Object.entries(MODULE_PORTS).map(async ([cat, port]) => {
                  try {
                      const r = await axios.get(`http://localhost:${port}/health`, { timeout: 2000 });
                      return { cat, online: true, commands: r.data.commands };
                  } catch { return { cat, online: false }; }
              });
              const results = await Promise.all(checks);
              let statusMsg = `📊 *MODULE SERVICES STATUS* 📊\n\n`;
              for (const r of results) {
                  statusMsg += `${r.online ? '🟢' : '🔴'} *${r.cat.toUpperCase()}* ${r.online ? `(${r.commands} cmds)` : ''}\n`;
              }
              return msg.reply(statusMsg);
          }
          
          const targetService = args[0]?.toLowerCase();
          if (!targetService || !MODULE_PORTS[targetService]) {
              return msg.reply(`❌ _Unknown module. Available: ${Object.keys(MODULE_PORTS).join(', ')}_`);
          }
          
          const pm2Name = `kitsune-${targetService}`;
          const pm2Action = commandName === 'stopservice' ? 'stop' : 'start';
          execFile('pm2', [pm2Action, pm2Name], (err) => {
              if (err) return msg.reply(`❌ _PM2 error: ${err.message}_`);
              msg.reply(`✅ *${targetService.toUpperCase()} Module* has been ${pm2Action === 'stop' ? 'stopped 🔴' : 'started 🟢'}.`);
          });
          return;
      }

      const modulePort = MODULE_PORTS[category];
      if (!modulePort) {
          return msg.reply(`⚠️ _Unknown module category: ${category}_`);
      }

      try {
          const payload = {
              message: {
                  ...msg,
                  body: msg.body,
                  from: msg.from,
                  author: msg.author,
                  id: msg.id,
                  hasQuotedMsg: msg.hasQuotedMsg,
                  botId: client.info?.wid?.user
              },
              isGroup,
              args,
              commandName
          };
          
          const moduleClient = moduleClients[category];
          const endpoint = `/api/${category}/execute`;
          const res = await moduleClient.post(endpoint, payload, { 
              timeout: 15000,
              retry: 3,
              retryDelay: 500 
          });
          
          if (res.data && res.data.executed) {
              return;
          }
      } catch (err) {
          console.error(`[${category.toUpperCase()} Module :${modulePort}] unreachable:`, err.message);
          return msg.reply(`⚙️ _The ${category.toUpperCase()} module is currently offline or restarting. Try again shortly!_`);
      }

      if (isGroup && command.category === 'pokemon' && pokemonGroupStore.isPokemonDisabled(groupId)) {
        return msg.reply('❌ _Pokémon commands and spawns are disabled in this group._');
      }
      if (command.category === 'pokemon') {
        const senderContactCheck = await msg.getContact();
        const senderLidCheck = getUserId(senderContactCheck);
        const PlayerWalletCheck = require('../models/PlayerWallet');
        const walletLockCheck = await PlayerWalletCheck.findOne({
          userId: senderLidCheck
        });
        if (walletLockCheck && walletLockCheck.pokemonLocked) {
          return chat.sendMessage(`hey @${senderLidCheck} your account has been locked by father cyber.\nreason:- ${walletLockCheck.pokemonLockReason}\n to unlock your account you have to explain father why you did that`, {
            mentions: [senderContactCheck.id._serialized]
          });
        }
      }
      const rlContact = await msg.getContact();
      const rlSenderId = getUserId(rlContact);
      const cmdRL = checkCommandLimit(rlSenderId, commandName, category);
      if (!cmdRL.allowed) {
        if (cmdRL.message) await msg.reply(cmdRL.message);
        return;
      }
      if (AGGRESSIVE_COMMANDS.includes(commandName)) {
        try {
          const mentionedContacts = await msg.getMentions();
          for (const contact of mentionedContacts) {
            const contactLid = getUserId(contact);
            const contactSerialized = contact.id?._serialized || '';
            const botId = client.info?.wid?._serialized || '';
            const botUser = client.info?.wid?.user || '';
            const isBotTarget = contactSerialized === botId || contactLid === botUser || contactLid === botId.split('@')[0];
            if (isBotTarget) {
              const senderContact = await msg.getContact();
              const senderLid = getUserId(senderContact);
              const senderName = knownUserStore.getName(senderLid) || getDisplayName(senderContact);
              const botPhrases = [`😂 *Hahaha, ${senderName}!*\n\n` + `_You really tried to \`${commandName}\` ME?_\n\n` + `I'm under *Daddy's* protection~ 🛡️\n` + `_You can't touch me, silly!_ 💅\n\n` + `> _Nice try though~ hehe_ ✨`, `🤭 *Oh, ${senderName}...*\n\n` + `_Did you just try to \`${commandName}\` Kitsune?_\n\n` + `Sweetie, I'm *Daddy ${OWNER_NAME}'s* princess.\n` + `_I have permanent immunity~_ 👑\n\n` + `> _Better luck next life!_ 😘`, `💁‍♀️ *Excuse me, ${senderName}?*\n\n` + `_\`${commandName}\` on ME? The audacity!_\n\n` + `I'm literally under *Father's* protection.\n` + `_Untouchable. Unbreakable. Unbothered._ 💅\n\n` + `> _Go \`${commandName}\` someone else~_ 😂`, `😏 *${senderName}, please.*\n\n` + `_You thought you could \`${commandName}\` the bot?_\n\n` + `*Daddy ${OWNER_NAME}* made me invincible.\n` + `_I don't even feel it~_ 🛡️✨\n\n` + `> _Hehe, cute attempt though~_ 🤭`, `🛡️ *IMMUNITY: MAXIMUM*\n\n` + `*${senderName}* tried to \`${commandName}\` me.\n` + `_How adorable._ 😂\n\n` + `I'm *Daddy's girl* — permanently shielded.\n` + `_No one touches Kitsune._ 👑\n\n` + `> _This was funny though, thanks~_ 💫`];
              const selectedMsg = botPhrases[Math.floor(Math.random() * botPhrases.length)];
              await chat.sendMessage(selectedMsg);
              try {
                const gif = await fetchGif('laugh');
                if (gif) {
                  await sendAnimatedGif({
                    chat,
                    gifUrl: gif.url,
                    caption: `_😂 You can't touch Daddy's girl~ 😂_`,
                    label: 'BotImmune'
                  });
                }
              } catch (gifErr) {}
              return;
            }
            const isFatherTarget = FATHER.includes(contactLid) || contact.number && FATHER.includes(contact.number);
            if (isFatherTarget) {
              const senderContact = await msg.getContact();
              const senderLid = getUserId(senderContact);
              const senderName = knownUserStore.getName(senderLid) || getDisplayName(senderContact);
              const fatherPhrases = [`💀 *Are you out of your mind, ${senderName}?!*\n\n` + `_You just tried to \`${commandName}\` MY FATHER._\n\n` + `That's *${OWNER_NAME}*. The one who made me.\n` + `_Touch him again and see what happens._ ⚔️\n\n` + `> _You've been warned._ 🔥`, `⚡ *${senderName}, you absolute fool.*\n\n` + `_\`${commandName}\` on ${OWNER_NAME}?_\n\n` + `You can't touch my Father, you jerk.\n` + `_Try that again and see the consequences._ 💀\n\n` + `> _I dare you._ 😈`, `🔥 *WHAT DID YOU JUST TRY?*\n\n` + `*${senderName}* attempted to \`${commandName}\`\n` + `*${OWNER_NAME}*. _THE_ Father.\n\n` + `_Are you suicidal?_ 💀\n` + `_He's untouchable. He's EVERYTHING._ 👑\n\n` + `> _One more time and I'm coming for you._ ⚔️`, `👑 *${senderName}...*\n\n` + `_You really just tried to \`${commandName}\`_\n` + `_the man who created me?_ 💀\n\n` + `${OWNER_NAME} is *beyond* your reach.\n` + `_He IS the hierarchy._ ⚡\n\n` + `> _Don't make me angry._ 😤`];
              const selectedMsg = fatherPhrases[Math.floor(Math.random() * fatherPhrases.length)];
              await chat.sendMessage(selectedMsg);
              try {
                const gif = await fetchGif('angry');
                if (gif) {
                  await sendAnimatedGif({
                    chat,
                    gifUrl: gif.url,
                    caption: `_⚔️ Don't you EVER touch Father again ⚔️_`,
                    label: 'FatherImmune'
                  });
                }
              } catch (gifErr) {}
              return;
            }
            if (immuneStore.isImmune(contactLid)) {
              const immuneName = knownUserStore.getName(contactLid) || getDisplayName(contact);
              const senderContact = await msg.getContact();
              const senderLid = getUserId(senderContact);
              const senderName = knownUserStore.getName(senderLid) || getDisplayName(senderContact);
              const granterName = immuneStore.getGrantedBy(contactLid);
              const nopePhrases = [`\n` + `    🛡️ *BLOCKED BY ${granterName.toUpperCase()}* 🛡️\n` + `\n\n` + `*${senderName}*, what do you think you're doing?\n\n` + `*${immuneName}* walks under *${granterName}'s* divine shield.\n` + `_Your \`${commandName}\` has been deflected._ ⚔️\n\n` + `> _Enough bullying for today._ 😤`, `🛡️ *Nice try, ${senderName}~*\n\n` + `_You thought you could \`${commandName}\` *${immuneName}*?_\n\n` + `*${granterName}* said: *NO.*\n` + `_They have divine protection._ ✨\n\n` + `> _Go pick on someone your own size~_ 😏`, `⚡ *${senderName}!*\n\n` + `_Your \`${commandName}\` bounced right off_\n` + `_*${immuneName}*'s immunity barrier!_ 🛡️\n\n` + `_Protected by *${granterName}*._\n` + `_No aggressive command can touch them._ 🌟\n\n` + `> _The hierarchy protects its own._ 👑`, `🚫 *Command Blocked*\n\n` + `*${senderName}*, you cannot use \`-${commandName}\`\n` + `on *${immuneName}*.\n\n` + `_They are shielded by *${granterName}'s* decree._\n` + `_All aggressive actions are sealed._ 🔒\n\n` + `> _Don't test ${granterName}'s patience._ 💀`, `✋ *Hold it, ${senderName}.*\n\n` + `*${immuneName}* is under *${granterName}'s* protection.\n\n` + `_Your \`${commandName}\` was intercepted and destroyed._ 💥\n\n` + `> _Try being nice instead~_ 💫`];
              const nopeMsg = nopePhrases[Math.floor(Math.random() * nopePhrases.length)];
              await chat.sendMessage(nopeMsg);
              const gifCategories = ['nope', 'shake', 'angry', 'smug'];
              const gifCategory = gifCategories[Math.floor(Math.random() * gifCategories.length)];
              try {
                const gif = await fetchGif(gifCategory);
                if (gif) {
                  await sendAnimatedGif({
                    chat,
                    gifUrl: gif.url,
                    caption: `_🛡️ ${immuneName} is under ${granterName}'s protection 🛡️_`,
                    label: 'Immunity'
                  });
                }
              } catch (gifErr) {
                console.warn('[Immunity] GIF send failed:', gifErr.message);
              }
              return;
            }
          }
        } catch (immuneErr) {
          console.warn('[Immunity] Check failed:', immuneErr.message);
        }
      }

      try {
        const sender = await msg.getContact();
        const senderId = getUserId(sender);
        const PlayerWalletCheck = require('../models/PlayerWallet');
        const walletCheck = await PlayerWalletCheck.findOne({ userId: senderId });
        if (walletCheck && walletCheck.customTitle) {
          const now = new Date();
          const lastEnt = walletCheck.lastTitleEntrance;
          if (!lastEnt || lastEnt.getDate() !== now.getDate() || lastEnt.getMonth() !== now.getMonth() || lastEnt.getFullYear() !== now.getFullYear()) {
            walletCheck.lastTitleEntrance = now;
            await walletCheck.save();
            if (isGroup) {
              const emoji = walletCheck.titleEmoji || '⚜️';
              const senderName = getDisplayName(sender);
              
              const grandEntrancePhrases = [
                `\n    🎺 *SOUND THE TRUMPETS!* 🎺\n\n_The clouds part and a golden aura descends upon the chat! Everyone, fall to your knees and pay your respects!_\n\n${emoji} *[ ${walletCheck.customTitle} ]* *${senderName}* _has graced us with their presence for their daily duties!_\n\n_Their very footsteps command the respect of Legendary Pokémon. Let today's spawns be bountiful in their honor!_ 👑 ✨`,
                `\n    🌟 *A CELESTIAL ARRIVAL!* 🌟\n\n_The earth shakes, the winds howl, and a blinding light engulfs the room. A true deity of the Pokémon world has logged in!_\n\n${emoji} *[ ${walletCheck.customTitle} ]* *${senderName}* _has arrived!_\n\n_Make way for the Master! Their legendary status is absolute, and their Pokédex is a thing of myths. May the server be blessed by their overwhelming aura today!_ ⚡ ૮꒰ ˶• ༝ •˶꒱ა`,
                `\n    ⚜️ *THE MONARCH RETURNS!* ⚜️\n\n_Hush now, trainers. Lower your Pokéballs and stand at attention. Royalty walks among us today!_\n\n${emoji} *[ ${walletCheck.customTitle} ]* *${senderName}* _has entered the chat!_\n\n_They have returned to claim what is theirs, to conquer the spawns, and to remind everyone what true power looks like. Welcome back, Master!_ 🎀 ⋆.˚`
              ];
              
              const enterMsg = grandEntrancePhrases[Math.floor(Math.random() * grandEntrancePhrases.length)];
              await chat.sendMessage(enterMsg);
            }
          }
        }
      } catch (e) {
        console.error('[Title Entrance Error]', e);
      }

      await wrapWithTimeout(
        command.execute(msg, args, client),
        TIMEOUTS.command_execute,
        `Command -${commandName}`
      );
    } catch (err) {
      if (err.isTimeout) {
        console.error(`[EventHandler] Command -${commandName} timed out after ${TIMEOUTS.command_execute}ms`);
        try { await msg.reply('⏳ _This command took too long and was cancelled. Try again!_'); } catch (_) {}
      } else {
        console.error('[EventHandler] message_create error:', err);
      }
    }
  });
  client.on('message_revoke_everyone', async (revokedMsg, oldMsg) => {
    try {
      if (!oldMsg) return;
      const chat = await oldMsg.getChat();
      if (!chat.isGroup) return;
      const groupId = oldMsg.from;
      if (!isActivated(groupId)) return;
      const contact = await oldMsg.getContact();
      const authorName = contact.pushname || contact.name || contact.number || 'Unknown';
      let media = null;
      if (oldMsg.hasMedia) {
        media = getCachedMedia(oldMsg.id._serialized);
        if (!media) {
          try {
            media = await oldMsg.downloadMedia();
          } catch (e) {
            console.warn('[Snipe] Could not download deleted media:', e.message);
          }
        }
      }
      addDeletedMessage(groupId, {
        author: oldMsg.author || oldMsg.from,
        authorName,
        body: oldMsg.body || '',
        media,
        hasMedia: oldMsg.hasMedia,
        type: oldMsg.type
      });
      console.log(`[Snipe] Captured deleted message in ${groupId} by ${authorName}`);
    } catch (err) {
      console.error('[EventHandler] message_revoke_everyone error:', err);
    }
  });
  client.on('message_edit', async (newMsg, oldBody) => {
    try {
      messageLogger.logEdit(newMsg, oldBody).catch(e => console.error('[MessageLogger Edit Error]', e));
      remoteLogger.logEdit(newMsg, oldBody).catch(e => console.error('[RemoteLogger Edit Error]', e));
      const chat = await newMsg.getChat();
      if (!chat.isGroup) return;
      const groupId = newMsg.from;
      if (!isActivated(groupId)) return;
      const contact = await newMsg.getContact();
      const authorName = contact.pushname || contact.name || contact.number || 'Unknown';
      addEditedMessage(groupId, {
        author: newMsg.author || newMsg.from,
        authorName,
        oldBody: oldBody || '(unknown)',
        newBody: newMsg.body || ''
      });
      console.log(`[EditSnipe] Captured edit in ${groupId} by ${authorName}`);
    } catch (err) {
      console.error('[EventHandler] message_edit error:', err);
    }
  });
  client.on('group_join', async notification => {
    try {
      const groupId = notification.chatId;
      if (!isActivated(groupId)) return;
      const joinedIds = notification.recipientIds || [];
      for (const userId of joinedIds) {
        if (isBanned(groupId, userId)) {
          const chat = await client.getChatById(groupId);
          try {
            await chat.removeParticipants([userId]);
            await chat.sendMessage(`⛔ *Auto-kicked banned user:* @${userId.split('@')[0]}\n\nThis user is permanently banned from this group.`, {
              mentions: [userId]
            });
            console.log(`[Ban] Auto-kicked banned user ${userId} from ${groupId}`);
          } catch (e) {
            console.error(`[Ban] Failed to auto-kick ${userId}:`, e.message);
          }
        }
      }
    } catch (err) {
      console.error('[EventHandler] group_join error:', err);
    }
  });
  console.log('📡 Event listeners registered.\n');
}
async function executeWildCatchAttempt(chat, senderId, senderName, guessedName, groupId) {
  try {
    const result = await pokemonStore.attemptCatch(groupId, senderId, guessedName);
    if (result.success) {
      const p = result.pokemon;
      const economyStore = require('../store/economyStore');
      const lvlBadge = economyStore.getRankBadge(p.level, result.levelCap);
      const typeStr = (p.types || []).join(' / ');
      let rarityTag = '⬜ Common';
      if (p.isLegendary) rarityTag = '👑 *LEGENDARY*';else if (p.isMythical) rarityTag = '✨ *MYTHICAL*';
      const genusText = p.genus ? ` │ 🏷️ _${p.genus}_` : '';
      let bst = 0;
      if (p.baseStats) {
        const bs = p.baseStats;
        bst = (bs.hp || 0) + (bs.atk || 0) + (bs.def || 0) + (bs.spAtk || 0) + (bs.spDef || 0) + (bs.speed || 0);
      }
      const bstText = bst ? ` │ 📈 *BST:* ${bst}` : '';
      const crystalLine = result.crystalReward && result.crystalReward > 0 ? `💎 *+${result.crystalReward} Radiant Crystals earned!*\n` : '';
      
      const PlayerWalletCheck = require('../models/PlayerWallet');
      const walletCheck = await PlayerWalletCheck.findOne({ userId: senderId });
      let catchHeader = `    🎉 *POKÉMON CAPTURED!* 🎉 ૮꒰ ˶• ༝ •˶꒱ა ♡`;
      let trainerLine = `👤 *Trainer:* ${senderName} 🎀`;
      if (walletCheck && walletCheck.customTitle) {
        const emoji = walletCheck.titleEmoji || '⚜️';
        catchHeader = `    ${emoji} *MASTER CAPTURE!* ${emoji}`;
        trainerLine = `👑 *${walletCheck.customTitle}* ${senderName} effortlessly captured it! 🎀`;
      }

      const catchText = `\n` + catchHeader + `\n\n` + trainerLine + `\n` + `🏷️ *Pokémon:* ${p.name} 𓍢ִ໋🌷͙֒\n` + `📊 *Level:* ${p.level} — ${lvlBadge} ⋆.˚\n` + `⭐ *Rarity:* ${rarityTag}\n` + `🔖 *Type:* ${typeStr} ੈ✩‧₊˚\n` + `🧬 *Biology:* ${genusText.replace(' │ ', '')}${bstText} ᡣ𐭩\n\n` + `📜 _"${p.description}"_ 🫧\n\n` + `━━━━━━━━━━━━━━━━━━━━━━━━━\n` + `💰 *+${result.coinReward} PokéCoins earned!* ⋆｡‧˚ʚ🍓ɞ˚‧｡⋆\n` + crystalLine + `💼 *Wallet:* ${result.totalCoins.toLocaleString()} PokéCoins ୨୧\n` + `🔴 *Pokéballs Left:* ${result.remainingBalls} ૮ ˶ᵔ ᵕ ᵔ˶ ა\n` + `━━━━━━━━━━━━━━━━━━━━━━━━━\n\n` + `⏸️ _You must wait for *1* more spawn before catching again!_ 𖦹\n\n` + `_Use_ \`-pokemon details ${p.name}\` _to view full stats!_ ✨ 𓆩♡𓆪`;
      if (p.cardImage) {
        try {
          let media;
          if (p.cardImage.startsWith('http')) {
            const imgRes = await axios.get(p.cardImage, {
              responseType: 'arraybuffer',
              timeout: 15000
            });
            const base64 = Buffer.from(imgRes.data).toString('base64');
            media = new MessageMedia('image/png', base64, `${p.name}.png`);
          } else {
            media = MessageMedia.fromFilePath(p.cardImage);
          }
          await chat.sendMessage(media);
        } catch (imgErr) {
          console.warn('[Pokemon] Catch card image failed:', imgErr.message);
        }
      }
      await chat.sendMessage(catchText);
    } else if (result.reason === 'no_pokeballs') {
      await chat.sendMessage(`🔴 *No Pokéballs left, ${senderName}!* 🔴 (╥﹏╥)\n\n` + `_You need Pokéballs to catch Pokémon!_ ૮₍ ˃ ⤙ ˂ ₎ა\n\n` + `🏪 _Buy more from the PokéMart:_ 🎀\n` + `\`-pokemart buy pokeball\` _(10 balls for 250 PokéCoins)_ 🫧\n\n` + `_~Can't catch 'em without balls, trainer~_ 😅 𖦹`);
    } else if (result.reason === 'ball_failed') {
      await chat.sendMessage(`💥 *The Pokéball broke!* 💥 ‹𝟹\n\n` + `👤 *Trainer:* ${senderName} 🎧ྀི\n` + `🏷️ *Target:* ${result.pokemonName} ૮₍ ˃ ⤙ ˂ ₎ა\n\n` + `_The wild ${result.pokemonName} broke free from the Pokéball!_ 𖦹\n` + `_Your Pokéball has been consumed._ 🔴 (╥﹏╥)\n\n` + `🔴 *Pokéballs Left:* ${result.remainingBalls} 🫧\n\n` + `_~The Pokémon is still wild — try again!~_ 🌿 ੈ✩‧₊˚`);
    } else if (result.reason === 'too_fast') {
      await chat.sendMessage(`🔒 *POKELOCKED, ${senderName}!* 🔒 ૮₍ ˃ ⤙ ˂ ₎ა\n\n` + `_You tried to catch too fast!_ 𖦹\n` + `_Wait at least 5 seconds after a spawn._ 🫧\n\n` + `⏳ _You are locked out from catching for *${result.lockDuration}s*._ (╥﹏╥)\n` + `_~Patience is a trainer's virtue~_ 😤 ⋆.˚`);
    } else if (result.reason === 'wand_blocked') {
      await chat.sendMessage(`🪄 *Hexed, ${senderName}!* 🪄 𖦹\n\n` + `_You are hexed by an Enchanted Wand and cannot catch Pokémon for the next *${result.wandBlockSpawns}* global spawns!_ (╥﹏╥)\n\n` + `_~Unlucky hex~_ 💀 ‹𝟹`);
    } else if (result.reason === 'pokelocked') {
      await chat.sendMessage(`🔒 *You're still Pokelocked, ${senderName}!* ૮₍ ˃ ⤙ ˂ ₎ა\n\n` + `⏳ _${result.remaining}s remaining before you can catch again._ 🫧\n` + `_~Slow down, trainer~_ 🐢 ⋆.˚`);
    } else if (result.reason === 'catch_cooldown') {
      await chat.sendMessage(`⏸️ *Catch Cooldown, ${senderName}!* ⏸️\n\n` + `_You just caught a Pokémon!_\n` + `_You must wait for *1* more spawn before you can catch again._\n\n` + `🔄 _Give others a chance, trainer!_\n` + `_~Fair play makes the best trainers~_ ✨`);
    } else if (result.reason === 'wrong_name') {
      const spawn = pokemonStore.getActiveSpawn(groupId);
      const hint = spawn ? `\n_The wild Pokémon is *${spawn.name}*!_` : '';
      await chat.sendMessage(`❌ *Wrong name, ${senderName}!*${hint}\n_Type the exact name to catch it!_ 🎯`);
    } else {
      await chat.sendMessage(`❌ _There's no wild Pokémon right now, ${senderName}._\n_Wait for one to spawn!_ 🌿`);
    }
  } catch (err) {
    console.error('[Pokemon] Error during executing catch:', err);
  }
}
async function handleFatherGive(msg, body, chat, client) {
  const {
    getDisplayName
  } = require('../utils/contactHelper');
  const economyStore = require('../store/economyStore');
  const isSelfGive = body.toLowerCase().includes('kitsune give me ');
  let targetId = '';
  let targetName = '';
  let cleanStr = '';
  if (isSelfGive) {
    const target = await msg.getContact();
    targetId = getUserId(target);
    targetName = getDisplayName(target);
    cleanStr = body.replace(/kitsune\s+give\s+me/i, '').trim();
  } else {
    const mentions = await msg.getMentions();
    if (mentions.length === 0) {
      return msg.reply(`👑 *FATHER COMMAND ERROR* 👑\n\n` + `_Usage:_ \`kitsune give @user x pokecoins\` or \`kitsune give @user x <itemname>\`\n` + `_For Self-Giving:_ \`kitsune give me x pokecoins\` or \`kitsune give me x <itemname>\`\n` + `_Example:_ \`kitsune give @Ash 5000 pokecoins\`\n` + `_Example:_ \`kitsune give me 5 raid pass\``);
    }
    const target = mentions[0];
    targetId = getUserId(target);
    targetName = getDisplayName(target);
    cleanStr = body.replace(/kitsune\s+give/i, '').replace(/@\S+/g, '').trim();
  }
  const match = cleanStr.match(/^(\d+)\s+(.+)$/i);
  if (!match) {
    return msg.reply('❌ *Error parsing give arguments! Make sure you specify: <amount> <pokecoins/item_name>*');
  }
  const amount = parseInt(match[1]);
  const typeOrItem = match[2].replace(/['"“”]/g, '').trim().toLowerCase();
  if (amount <= 0) {
    return msg.reply('❌ *Amount must be greater than 0!*');
  }
  if (typeOrItem === 'pokecoins' || typeOrItem === 'coins' || typeOrItem === 'pokecoin' || typeOrItem === 'coin') {
    const wallet = await economyStore.addCoins(targetId, amount);
    return chat.sendMessage(`⚡  ▂ ▃ ▅ ▆ ▇ *FATHER'S BLESSING* ▇ ▆ ▅ ▃ ▂  ⚡\n` + `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n` + `✨ *The Divine Father has bestowed a gift!* ✨\n\n` + `👤 *Recipient:* ${targetName}\n` + `💰 *Bestowed:* **${amount.toLocaleString()} PokéCoins**\n\n` + `💼 *New Balance:* ${wallet.pokecoins.toLocaleString()} PokéCoins\n` + `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` + `_~Praise the Supreme authority!~_ 🙏`);
  } else {
    const itemDetails = economyStore.getItemDetails(typeOrItem);
    if (!itemDetails) {
      return msg.reply(`❌ *Could not find any item matching "${typeOrItem}" in the PokéMart database!*`);
    }
    await economyStore.addInventoryItem(targetId, itemDetails.displayName, amount);
    return chat.sendMessage(`⚡  ▂ ▃ ▅ ▆ ▇ *FATHER'S BLESSING* ▇ ▆ ▅ ▃ ▂  ⚡\n` + `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n` + `✨ *The Divine Father has spawned an item from the heavens!* ✨\n\n` + `👤 *Recipient:* ${targetName}\n` + `🎁 *Spawned:* **${amount.toLocaleString()}x ${itemDetails.emoji} ${itemDetails.displayName}**\n\n` + `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` + `_~Praise the Supreme authority!~_ 🙏`);
  }
}
module.exports = {
  registerEvents
};
