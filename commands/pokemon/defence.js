const battleStore = require('../../store/battleStore');
const { getUserId } = require('../../utils/getUserId');

module.exports = {
  name: 'defence',
  aliases: ['defense'],
  description: 'Defend during a Pokémon battle.',
  category: 'pokemon',
  adminOnly: false,
  async execute(msg, args, client) {
    const chat = await msg.getChat();
    if (!chat || !chat.isGroup) return;
    
    const groupId = chat.id && chat.id._serialized ? chat.id._serialized : chat.id || msg.from;
    const sender = await msg.getContact();
    const senderId = getUserId(sender);
    
    const body = msg.body || '';
    
    battleStore.handleBattleInput(groupId, senderId, body);
  }
};
