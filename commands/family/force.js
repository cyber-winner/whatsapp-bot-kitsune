const { OWNER_NAME } = require('../../config');
const familyStore = require('../../store/familyStore');
const { getUserId } = require('../../utils/getUserId');
const {
  getDisplayName
} = require('../../utils/contactHelper');
const {
  fetchGif
} = require('../../utils/gifApi');
const {
  sendAnimatedGif
} = require('../../utils/mediaHelper');
const {
  isFather
} = require('../../utils/permissions');
const knownUserStore = require('../../store/knownUserStore');
module.exports = {
  name: 'force',
  description: 'Force family actions. Usage: -force adopt/marry/divorce/disown self/@user1 and @user2 (Father only)',
  async execute(msg, args, client) {
    const chat = await msg.getChat();
    if (!chat.isGroup) return msg.reply('❌ _This command only works in groups._');
    const isFatherUser = await isFather(msg, client);
    if (!isFatherUser) {
      return msg.reply('❌ _Only ' + OWNER_NAME + ' can use this command._');
    }
    if (args.length < 2) {
      return msg.reply('❌ _Usage:_ \n`-force adopt/marry/divorce/disown self @user` or `@user1 and @user2`');
    }
    const action = args[0].toLowerCase();
    if (action !== 'adopt' && action !== 'marry' && action !== 'divorce' && action !== 'disown') {
      return msg.reply('❌ _Invalid action. Use `adopt`, `marry`, `divorce`, or `disown`._');
    }
    const mentions = await msg.getMentions();
    const sender = await msg.getContact();
    const senderId = getUserId(sender);
    let entity1Id = null,
      entity2Id = null;
    let entity1Contact = null,
      entity2Contact = null;
    const actionIdx = msg.body.toLowerCase().indexOf(action);
    const targetText = actionIdx !== -1 ? msg.body.substring(actionIdx + action.length).trim() : '';
    const parts = targetText.split(/\s+and\s+/i);
    if (parts.length === 2) {
      const part1 = parts[0].toLowerCase();
      const part2 = parts[1].toLowerCase();
      const matchesPart = (contact, index, part) => {
        const searchTerms = [];
        if (contact.number) searchTerms.push(contact.number);
        if (contact.id && contact.id.user) searchTerms.push(contact.id.user);
        if (contact.name) searchTerms.push(contact.name);
        if (contact.pushname) searchTerms.push(contact.pushname);
        try {
          const disp = getDisplayName(contact);
          if (disp) searchTerms.push(disp);
        } catch (e) {}
        if (msg.mentionedIds && msg.mentionedIds[index]) {
          const rawId = msg.mentionedIds[index];
          searchTerms.push(rawId);
          const rawUser = rawId.split('@')[0];
          searchTerms.push(rawUser);
        }
        return searchTerms.some(term => term && part.includes(term.toLowerCase()));
      };
      if (part1.includes('self')) {
        entity1Contact = sender;
        entity1Id = senderId;
      } else {
        for (let i = 0; i < mentions.length; i++) {
          if (matchesPart(mentions[i], i, part1)) {
            entity1Contact = mentions[i];
            entity1Id = getUserId(entity1Contact);
            break;
          }
        }
      }
      if (part2.includes('self')) {
        entity2Contact = sender;
        entity2Id = senderId;
      } else {
        for (let i = 0; i < mentions.length; i++) {
          if (matchesPart(mentions[i], i, part2)) {
            entity2Contact = mentions[i];
            entity2Id = getUserId(entity2Contact);
            break;
          }
        }
      }
    }
    if (!entity1Id || !entity2Id) {
      const getContactIndexInBody = (contact, body, indexInMentions, mentionedIds) => {
        const searchTerms = [];
        if (contact.number) searchTerms.push(contact.number);
        if (contact.id && contact.id.user) searchTerms.push(contact.id.user);
        if (contact.name) searchTerms.push(contact.name);
        if (contact.pushname) searchTerms.push(contact.pushname);
        try {
          const disp = getDisplayName(contact);
          if (disp) searchTerms.push(disp);
        } catch (e) {}
        if (mentionedIds && mentionedIds[indexInMentions]) {
          const rawId = mentionedIds[indexInMentions];
          searchTerms.push(rawId);
          const rawUser = rawId.split('@')[0];
          searchTerms.push(rawUser);
        }
        let earliestIndex = Infinity;
        for (const term of searchTerms) {
          if (!term) continue;
          const idx = body.toLowerCase().indexOf(term.toLowerCase());
          if (idx !== -1 && idx < earliestIndex) {
            earliestIndex = idx;
          }
        }
        return earliestIndex === Infinity ? -1 : earliestIndex;
      };
      const mentionsWithIndex = mentions.map((contact, index) => ({
        contact,
        originalIndex: index
      }));
      mentionsWithIndex.sort((a, b) => {
        const idxA = getContactIndexInBody(a.contact, msg.body, a.originalIndex, msg.mentionedIds);
        const idxB = getContactIndexInBody(b.contact, msg.body, b.originalIndex, msg.mentionedIds);
        if (idxA === -1 && idxB === -1) return 0;
        if (idxA === -1) return 1;
        if (idxB === -1) return -1;
        return idxA - idxB;
      });
      const sortedMentions = mentionsWithIndex.map(item => item.contact);
      const hasSelf = args[1] && args[1].toLowerCase() === 'self';
      if (hasSelf) {
        if (mentions.length === 0) {
          return msg.reply(`❌ _You must mention someone to force ${action} with self!_`);
        }
        entity1Id = senderId;
        entity1Contact = sender;
        entity2Contact = sortedMentions[0];
        entity2Id = getUserId(entity2Contact);
      } else if (sortedMentions.length >= 2) {
        entity1Contact = sortedMentions[0];
        entity2Contact = sortedMentions[1];
        entity1Id = getUserId(entity1Contact);
        entity2Id = getUserId(entity2Contact);
      } else if (sortedMentions.length === 1) {
        const bodyLower = msg.body.toLowerCase();
        const andIdx = bodyLower.indexOf(' and ');
        const selfIdx = bodyLower.indexOf('self');
        if (selfIdx !== -1 && andIdx !== -1 && selfIdx < andIdx) {
          entity1Id = senderId;
          entity1Contact = sender;
          entity2Contact = sortedMentions[0];
          entity2Id = getUserId(entity2Contact);
        } else if (selfIdx !== -1 && andIdx !== -1 && selfIdx > andIdx) {
          entity1Contact = sortedMentions[0];
          entity1Id = getUserId(entity1Contact);
          entity2Contact = sender;
          entity2Id = senderId;
        } else {
          entity1Id = senderId;
          entity1Contact = sender;
          entity2Contact = sortedMentions[0];
          entity2Id = getUserId(entity2Contact);
        }
      } else {
        return msg.reply(`❌ _You must mention at least one user to force ${action}!_`);
      }
    }
    if (entity1Id === entity2Id) {
      return msg.reply(`❌ _A user cannot ${action} themselves!_`);
    }
    const senderName = knownUserStore.getName(senderId) || getDisplayName(sender);
    if (action === 'adopt') {
      const result = await familyStore.forceAdopt(entity1Id, entity2Id);
      if (result === 'already_adopted') {
        return msg.reply(`❌ _@${entity2Id} is already the child of @${entity1Id}!_`, null, {
          mentions: [entity1Contact.id._serialized, entity2Contact.id._serialized]
        });
      }
      const phrases = [`👑 *FATHER'S ABSOLUTE DECREE!* 👑\n\n` + `*Father ${senderName}* has invoked his divine authority!\n` + `*@${entity2Id}* has been *FORCIBLY ADOPTED* by *@${entity1Id}*! 🍼\n\n` + `> _You have no choice. Welcome to the family._ 🏠`, `⚡ *DIVINE ADOPTION!* ⚡\n\n` + `By *Father ${senderName}'s* supreme command,\n` + `*@${entity2Id}* is now officially the child of *@${entity1Id}*! 👶\n\n` + `> _Resistance is futile. Obey the decree._ 🧸`];
      const phrase = phrases[Math.floor(Math.random() * phrases.length)];
      const mediaData = await fetchGif('pat');
      const caption = phrase + (mediaData ? `\n\n_Anime: ${mediaData.anime_name}_` : '');
      if (mediaData) {
        const sent = await sendAnimatedGif({
          chat,
          gifUrl: mediaData.url,
          caption,
          mentions: [entity1Contact.id._serialized, entity2Contact.id._serialized],
          label: 'FORCE_ADOPT'
        });
        if (sent) return;
      }
      return msg.reply(caption, null, {
        mentions: [entity1Contact.id._serialized, entity2Contact.id._serialized]
      });
    } else if (action === 'marry') {
      const result = await familyStore.forceMarry(entity1Id, entity2Id);
      if (result === 'already_married') {
        return msg.reply(`❌ _@${entity1Id} and @${entity2Id} are already married!_`, null, {
          mentions: [entity1Contact.id._serialized, entity2Contact.id._serialized]
        });
      }
      const phrases = [`👑 *FATHER'S ABSOLUTE DECREE!* 👑\n\n` + `*Father ${senderName}* has invoked his divine authority!\n` + `*@${entity1Id}* and *@${entity2Id}* have been *FORCIBLY MARRIED*! 💍\n\n` + `> _You are now bound to each other forever._ 💒`, `💍 *DIVINE UNION BY FORCE!* 💍\n\n` + `By *Father ${senderName}'s* supreme command,\n` + `*@${entity1Id}* and *@${entity2Id}* are now officially married! 💖\n\n` + `> _Your hands have been taken. No proposal needed._ ✨`];
      const phrase = phrases[Math.floor(Math.random() * phrases.length)];
      const mediaData = await fetchGif('kiss');
      const caption = phrase + (mediaData ? `\n\n_Anime: ${mediaData.anime_name}_` : '');
      if (mediaData) {
        const sent = await sendAnimatedGif({
          chat,
          gifUrl: mediaData.url,
          caption,
          mentions: [entity1Contact.id._serialized, entity2Contact.id._serialized],
          label: 'FORCE_MARRY'
        });
        if (sent) return;
      }
      return msg.reply(caption, null, {
        mentions: [entity1Contact.id._serialized, entity2Contact.id._serialized]
      });
    } else if (action === 'divorce') {
      const result = await familyStore.divorce(entity1Id, entity2Id, true);
      if (!result) {
        return msg.reply(`❌ _@${entity1Id} and @${entity2Id} are not married!_`, null, {
          mentions: [entity1Contact.id._serialized, entity2Contact.id._serialized]
        });
      }
      const phrases = [`👑 *FATHER'S ABSOLUTE DECREE!* 👑\n\n` + `*Father ${senderName}* has invoked his divine authority!\n` + `*@${entity1Id}* and *@${entity2Id}* have been *FORCIBLY DIVORCED*! 💔\n\n` + `> _The contract is severed. You are free._ 🥀`, `⚡ *DIVINE SEPARATION BY FORCE!* ⚡\n\n` + `By *Father ${senderName}'s* supreme command,\n` + `*@${entity1Id}* and *@${entity2Id}* are now officially divorced! ⚖️\n\n` + `> _The papers are signed and stamped. No discussion._ 👋`];
      const phrase = phrases[Math.floor(Math.random() * phrases.length)];
      const mediaData = await fetchGif('slap');
      const caption = phrase + (mediaData ? `\n\n_Anime: ${mediaData.anime_name}_` : '');
      if (mediaData) {
        const sent = await sendAnimatedGif({
          chat,
          gifUrl: mediaData.url,
          caption,
          mentions: [entity1Contact.id._serialized, entity2Contact.id._serialized],
          label: 'FORCE_DIVORCE'
        });
        if (sent) return;
      }
      return msg.reply(caption, null, {
        mentions: [entity1Contact.id._serialized, entity2Contact.id._serialized]
      });
    } else if (action === 'disown') {
      const result = await familyStore.disown(entity1Id, entity2Id, true);
      if (!result) {
        return msg.reply(`❌ _@${entity2Id} is not a child of @${entity1Id}!_`, null, {
          mentions: [entity1Contact.id._serialized, entity2Contact.id._serialized]
        });
      }
      const phrases = [`👑 *FATHER'S ABSOLUTE DECREE!* 👑\n\n` + `*Father ${senderName}* has invoked his divine authority!\n` + `*@${entity1Id}* has *FORCIBLY DISOWNED* *@${entity2Id}*! 🗑️\n\n` + `> _You are cut off from the inheritance and the family._ 🚪`, `⚡ *DIVINE DISOWNMENT BY FORCE!* ⚡\n\n` + `By *Father ${senderName}'s* supreme command,\n` + `*@${entity1Id}* has officially disowned *@${entity2Id}*! ⛔\n\n` + `> _Pack your bags and get out. The tie is broken._ 🧳`];
      const phrase = phrases[Math.floor(Math.random() * phrases.length)];
      const mediaData = await fetchGif('kick');
      const caption = phrase + (mediaData ? `\n\n_Anime: ${mediaData.anime_name}_` : '');
      if (mediaData) {
        const sent = await sendAnimatedGif({
          chat,
          gifUrl: mediaData.url,
          caption,
          mentions: [entity1Contact.id._serialized, entity2Contact.id._serialized],
          label: 'FORCE_DISOWN'
        });
        if (sent) return;
      }
      return msg.reply(caption, null, {
        mentions: [entity1Contact.id._serialized, entity2Contact.id._serialized]
      });
    }
  }
};