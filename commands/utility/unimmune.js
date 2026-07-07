const { OWNER_NAME } = require('../../config');
const {
  getDisplayName
} = require('../../utils/contactHelper');
const {
  isBotOwner
} = require('../../utils/permissions');
const {
  fetchGif
} = require('../../utils/gifApi');
const {
  sendAnimatedGif
} = require('../../utils/mediaHelper');
const immuneStore = require('../../store/immuneStore');
const knownUserStore = require('../../store/knownUserStore');
const { getUserId } = require('../../utils/getUserId');
module.exports = {
  name: 'unimmune',
  aliases: ['unshield', 'unprotect'],
  description: 'Remove immunity from a user. (Father/Owner only)',
  adminOnly: true,
  async execute(msg, args, client) {
    const chat = await msg.getChat();
    if (!chat.isGroup) return msg.reply('❌ _This command only works in groups._');
    if (!(await isBotOwner(msg, client))) {
      const deniedPhrases = [`🚫 *Access Denied*\n\n_This power belongs to Father and his chosen Owners only._\n\n> _You're not on the list, sorry~_ 💫`, `⛔ *Unauthorized*\n\n_Only Father (${OWNER_NAME}) or appointed Owners can wield this command._\n\n> _Know your place~_ 🌙`, `🔒 *Restricted Command*\n\n_This is reserved for the hierarchy above you._\n_Father and Owners only._ ✨`];
      const deniedMsg = deniedPhrases[Math.floor(Math.random() * deniedPhrases.length)];
      await chat.sendMessage(deniedMsg);
      try {
        const gif = await fetchGif('nope');
        if (gif) await sendAnimatedGif({
          chat,
          gifUrl: gif.url,
          caption: '_Not today~_ 🚫',
          label: 'Denied'
        });
      } catch (e) {}
      return;
    }
    const mentions = await msg.getMentions();
    if (mentions.length === 0) {
      return msg.reply(`⚔️ *Remove Immunity*\n\n` + `_Usage:_ \`-unimmune @user\`\n\n` + `_Removes divine protection from a user._\n` + `_They can be targeted by aggressive commands again._`);
    }
    const target = mentions[0];
    const targetLid = getUserId(target);
    const targetName = knownUserStore.getName(targetLid) || getDisplayName(target);
    if (!immuneStore.isImmune(targetLid)) {
      return msg.reply(`❌ *${targetName}* _doesn't have immunity to remove._`);
    }
    await immuneStore.toggleImmune(targetLid, targetName);
    const revokePhrases = [`\n` + `    ⚔️ *PROTECTION REVOKED* ⚔️    \n` + `\n\n` + `*${OWNER_NAME}* has withdrawn his protection.\n\n` + `*${targetName}* is now vulnerable once more.\n` + `_All aggressive commands are back on the table._ 💀\n\n` + `> _Good luck out there~_ 🗡️`, `\n` + `    💔 *SHIELD SHATTERED* 💔     \n` + `\n\n` + `The divine barrier around *${targetName}*\n` + `has been broken by *${OWNER_NAME}'s* command.\n\n` + `_They are now fair game._ ⚔️\n\n` + `> _Re-protect with_ \`-immune @user\``, `\n` + `    🔓 *IMMUNITY LIFTED* 🔓      \n` + `\n\n` + `*${targetName}* has lost ${OWNER_NAME}'s blessing.\n\n` + `_The shield is gone. The hunt is on._ 🎯\n\n` + `> _To restore:_ \`-immune @user\``];
    const selectedMsg = revokePhrases[Math.floor(Math.random() * revokePhrases.length)];
    await chat.sendMessage(selectedMsg);
    try {
      const gif = await fetchGif('smug');
      if (gif) {
        await sendAnimatedGif({
          chat,
          gifUrl: gif.url,
          caption: `_⚔️ ${targetName} is no longer protected ⚔️_`,
          label: 'Unimmune'
        });
      }
    } catch (gifErr) {
      console.warn('[Unimmune] GIF send failed:', gifErr.message);
    }
  }
};