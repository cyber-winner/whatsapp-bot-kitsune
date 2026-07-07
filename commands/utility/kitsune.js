const { OWNER_NAME } = require('../../config');
const {
  getDisplayName
} = require('../../utils/contactHelper');
const {
  isFather
} = require('../../utils/permissions');
const economyStore = require('../../store/economyStore');
const knownUserStore = require('../../store/knownUserStore');
const { getUserId } = require('../../utils/getUserId');
module.exports = {
  name: 'kitsune',
  description: 'Admin commands for Kitsune. Usage: -kitsune remove/give cd @user (Father only)',
  adminOnly: true,
  async execute(msg, args, client) {
    const chat = await msg.getChat();
    if (!(await isFather(msg, client))) {
      return msg.reply('❌ _Only ' + OWNER_NAME + ' can use this command._');
    }
    if (args.length >= 2 && args[0].toLowerCase() === 'remove' && args[1].toLowerCase() === 'cd') {
      const mentions = await msg.getMentions();
      if (mentions.length === 0) {
        return msg.reply('❌ _Please mention a user to remove cooldowns for._\nUsage: `-kitsune remove cd @user`');
      }
      const target = mentions[0];
      const targetId = getUserId(target);
      const targetName = knownUserStore.getName(targetId) || getDisplayName(target);
      await economyStore.setCooldownBypass(targetId, true);
      const text = `\n` + `  ✨ *COOLDOWNS BYPASSED* ✨  \n` + `\n\n` + `*${OWNER_NAME}* has spoken. ⋆.˚ ᡣ𐭩 \n\n` + `*${targetName}* is now free from the bounds of time.\n` + `_Catching and Summoning cooldowns have been permanently bypassed._\n\n` + `> _Only the chosen ones hold such power._ 🎀 ⋆ ˚｡⋆୨୧˚`;
      await chat.sendMessage(text);
    } else if (args.length >= 2 && args[0].toLowerCase() === 'give' && args[1].toLowerCase() === 'cd') {
      const mentions = await msg.getMentions();
      if (mentions.length === 0) {
        return msg.reply('❌ _Please mention a user to restore cooldowns for._ ૮ ˶ᵔ ᵕ ᵔ˶ ა\nUsage: `-kitsune give cd @user`');
      }
      const target = mentions[0];
      const targetId = getUserId(target);
      const targetName = knownUserStore.getName(targetId) || getDisplayName(target);
      await economyStore.setCooldownBypass(targetId, false);
      const text = `\n` + `    ⏳ *COOLDOWNS RESTORED* ⏳   \n` + `\n\n` + `*${OWNER_NAME}* has spoken. ⋆.˚ ᡣ𐭩\n\n` + `*${targetName}* is bound by the rules of time once more.\n` + `_Catching and Summoning cooldowns have been fully restored._\n\n` + `> _Balance is restored to the realm._ ⚖️ 𓍢ִ໋🌷͙֒`;
      await chat.sendMessage(text);
    } else {
      return msg.reply('❌ _Unknown kitsune command._\nUsage:\n`-kitsune remove cd @user`\n`-kitsune give cd @user`');
    }
  }
};