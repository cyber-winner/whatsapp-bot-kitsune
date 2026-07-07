const { OWNER_NAME } = require('../../config');
const {
  getDisplayName
} = require('../../utils/contactHelper');
const {
  isFather
} = require('../../utils/permissions');
const {
  fetchGif
} = require('../../utils/gifApi');
const {
  sendAnimatedGif
} = require('../../utils/mediaHelper');
const ownerStore = require('../../store/ownerStore');
const knownUserStore = require('../../store/knownUserStore');
const { getUserId } = require('../../utils/getUserId');
module.exports = {
  name: 'removeowner',
  aliases: ['delowner'],
  description: 'Revoke owner status from a user. (Father only)',
  adminOnly: true,
  async execute(msg, args, client) {
    const chat = await msg.getChat();
    if (!(await isFather(msg, client))) {
      const deniedPhrases = [`👑 *This is Father's privilege.*\n\n_Only ${OWNER_NAME} can strip ownership._\n\n> _You lack the authority._ 🌑`, `⛔ *Access Denied*\n\n_Ownership is granted and revoked by Father alone._\n_Step aside._ ✨`, `🚫 *Forbidden*\n\n_Only ${OWNER_NAME} holds this power._\n_The hierarchy is absolute._ 👑`];
      const deniedMsg = deniedPhrases[Math.floor(Math.random() * deniedPhrases.length)];
      await chat.sendMessage(deniedMsg);
      try {
        const gif = await fetchGif('nope');
        if (gif) await sendAnimatedGif({
          chat,
          gifUrl: gif.url,
          caption: '_Father\'s domain._ 👑',
          label: 'Denied'
        });
      } catch (e) {}
      return;
    }
    const mentions = await msg.getMentions();
    if (mentions.length === 0) {
      return msg.reply(`⚔️ *Revoke Ownership*\n\n` + `_Usage:_ \`-removeowner @user\`\n\n` + `_As Father, you can strip ownership_\n` + `_from anyone you've previously appointed._`);
    }
    const target = mentions[0];
    const targetRawId = getUserId(target);
    const targetName = knownUserStore.getName(targetRawId) || getDisplayName(target);
    const wasRemoved = await ownerStore.removeOwner(targetRawId);
    if (wasRemoved) {
      const revokePhrases = [`\n` + `    ⚔️ *OWNERSHIP REVOKED* ⚔️    \n` + `\n\n` + `*${OWNER_NAME}* has spoken.\n\n` + `*${targetName}* has been stripped\n` + `of their Owner privileges.\n\n` + `_All privileged access — gone._ 💨\n\n` + `> _Father giveth, Father taketh away._ 👑`, `\n` + `    💀 *FALLEN FROM GRACE* 💀    \n` + `\n\n` + `By *${OWNER_NAME}'s* decree,\n` + `*${targetName}* is no longer an Owner.\n\n` + `_Their power has been revoked._\n` + `_The hierarchy shifts._ ⚡\n\n` + `> _To restore:_ \`-addowner @user\``];
      const selectedMsg = revokePhrases[Math.floor(Math.random() * revokePhrases.length)];
      await chat.sendMessage(selectedMsg);
      try {
        const gif = await fetchGif('wave');
        if (gif) {
          await sendAnimatedGif({
            chat,
            gifUrl: gif.url,
            caption: `_⚔️ ${targetName} is no longer an Owner ⚔️_`,
            label: 'RemoveOwner'
          });
        }
      } catch (gifErr) {
        console.warn('[RemoveOwner] GIF send failed:', gifErr.message);
      }
    } else {
      await chat.sendMessage(`❌ *${targetName}* _wasn't an Owner to begin with, Father._`);
    }
  }
};