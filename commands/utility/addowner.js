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
  name: 'addowner',
  aliases: ['setowner'],
  description: 'Appoint a user as a bot owner. (Father only)',
  adminOnly: true,
  async execute(msg, args, client) {
    const chat = await msg.getChat();
    if (!(await isFather(msg, client))) {
      const deniedPhrases = [`👑 *This is Father's privilege.*\n\n_Only ${OWNER_NAME} — the supreme authority — can appoint Owners._\n\n> _You dare try to crown someone?_ 😤`, `⛔ *Access Denied*\n\n_The power to appoint Owners flows from Father alone._\n_You are not ${OWNER_NAME}._ 🌑\n\n> _Know the hierarchy._ 👑`, `🚫 *Forbidden*\n\n_Only the Father can bestow ownership._\n_This is beyond your authority._ ✨`];
      const deniedMsg = deniedPhrases[Math.floor(Math.random() * deniedPhrases.length)];
      await chat.sendMessage(deniedMsg);
      try {
        const gif = await fetchGif('nope');
        if (gif) await sendAnimatedGif({
          chat,
          gifUrl: gif.url,
          caption: '_Only Father commands here._ 👑',
          label: 'Denied'
        });
      } catch (e) {}
      return;
    }
    const mentions = await msg.getMentions();
    if (mentions.length === 0) {
      return msg.reply(`👑 *Appoint an Owner*\n\n` + `_Usage:_ \`-addowner @user\`\n\n` + `_As Father, you can grant ownership_\n` + `_to trusted individuals. They'll gain_\n` + `_access to all privileged commands._\n\n` + `> _Revoke with_ \`-removeowner @user\``);
    }
    const target = mentions[0];
    const targetRawId = getUserId(target);
    const targetName = knownUserStore.getName(targetRawId) || getDisplayName(target);
    const extraIds = [];
    if (target.number && target.number !== targetRawId) extraIds.push(target.number);
    if (target.id?.user && target.id.user !== targetRawId) extraIds.push(target.id.user);
    const wasNew = await ownerStore.addOwner(targetRawId, targetName, extraIds);
    if (wasNew) {
      const appointPhrases = [`\n` + `    👑 *OWNER APPOINTED* 👑      \n` + `\n\n` + `By the word of *${OWNER_NAME}*,\n` + `*${targetName}* has ascended.\n\n` + `━━━━━━━━━━━━━━━━━━━━\n` + `✅ _Bot activation/deactivation_\n` + `✅ _Immunity management_\n` + `✅ _User registration_\n` + `━━━━━━━━━━━━━━━━━━━━\n\n` + `> _Father's will is absolute._ 🌟`, `\n` + `    ⚡ *NEW OWNER RISES* ⚡      \n` + `\n\n` + `*${OWNER_NAME}* extends his trust.\n\n` + `*${targetName}* now holds the power\n` + `of an Owner. Serve well.\n\n` + `🌟 _All privileged commands unlocked._ 🌟\n\n` + `> _Only Father can revoke this._ 👑`];
      const selectedMsg = appointPhrases[Math.floor(Math.random() * appointPhrases.length)];
      await chat.sendMessage(selectedMsg);
      try {
        const gif = await fetchGif('happy');
        if (gif) {
          await sendAnimatedGif({
            chat,
            gifUrl: gif.url,
            caption: `_👑 ${targetName} is now an Owner 👑_`,
            label: 'AddOwner'
          });
        }
      } catch (gifErr) {
        console.warn('[AddOwner] GIF send failed:', gifErr.message);
      }
    } else {
      await chat.sendMessage(`👑 *${targetName}* _is already an Owner, Father._`);
    }
  }
};