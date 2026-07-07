const { OWNER_NAME } = require('../../config');
const {
  getDisplayName
} = require('../../utils/contactHelper');
const {
  isBotOwner,
  isFather
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
  name: 'immune',
  aliases: ['shield', 'protect'],
  description: 'Grant immunity to a user. They can\'t be bullied. (Father/Owner only)',
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
      return msg.reply(`🛡️ *Immunity Command*\n\n` + `_Usage:_ \`-immune @user\`\n\n` + `_Grants protection to a user._\n` + `_No one will be able to use aggressive_\n` + `_commands like slap, kick, kill on them._\n\n` + `> _To remove: use_ \`-unimmune @user\``);
    }
    const target = mentions[0];
    const targetLid = getUserId(target);
    const targetName = knownUserStore.getName(targetLid) || getDisplayName(target);
    if (immuneStore.isImmune(targetLid)) {
      return msg.reply(`🛡️ *${targetName}* _already has immunity._`);
    }
    const sender = await msg.getContact();
    const senderLid = getUserId(sender);
    const senderName = knownUserStore.getName(senderLid) || getDisplayName(sender);
    const isFatherUser = await isFather(msg, client);
    const granterName = isFatherUser ? OWNER_NAME : senderName;
    await immuneStore.grantImmune(targetLid, targetName, granterName);
    const grantPhrases = [`\n` + `    🛡️ *DIVINE PROTECTION* 🛡️    \n` + `\n\n` + `By the decree of *${granterName}*,\n` + `*${targetName}* is now shielded from all harm.\n\n` + `━━━━━━━━━━━━━━━━━━━━\n` + `🛡️ _Slap, Kick, Kill_ — *BLOCKED*\n` + `🛡️ _Punch, Shoot, Bonk_ — *BLOCKED*\n` + `🛡️ _Yeet, Bite, Baka_ — *BLOCKED*\n` + `━━━━━━━━━━━━━━━━━━━━\n\n` + `> _Anyone who dares try will answer to ${granterName}._ ⚔️`, `\n` + `    ✨ *IMMUNITY ACTIVATED* ✨    \n` + `\n\n` + `*${granterName}* has spoken.\n\n` + `*${targetName}* now walks under\n` + `*${granterName}'s* impenetrable shield.\n` + `_No aggressive command shall touch them._\n\n` + `🌟 _Protected by ${granterName}._ 🌟\n\n` + `> _Revoke with_ \`-unimmune @user\``, `\n` + `    👑 *${granterName.toUpperCase()}'S BLESSING* 👑\n` + `\n\n` + `*${granterName}* has extended protection.\n\n` + `*${targetName}* is now untouchable.\n` + `_All bullying commands are sealed away._\n\n` + `⚔️ *Try it and face the consequences.* ⚔️\n\n` + `> _To remove:_ \`-unimmune @user\``];
    const selectedMsg = grantPhrases[Math.floor(Math.random() * grantPhrases.length)];
    await chat.sendMessage(selectedMsg);
    try {
      const gif = await fetchGif('thumbsup');
      if (gif) {
        await sendAnimatedGif({
          chat,
          gifUrl: gif.url,
          caption: `_🛡️ ${targetName} is now protected by ${granterName} 🛡️_`,
          label: 'Immune'
        });
      }
    } catch (gifErr) {
      console.warn('[Immune] GIF send failed:', gifErr.message);
    }
  }
};