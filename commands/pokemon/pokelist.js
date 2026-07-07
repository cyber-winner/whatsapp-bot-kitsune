const pokemonCmd = require('./pokemon');
module.exports = {
  name: 'pokelist',
  aliases: ['pl', 'plist'],
  description: 'List your caught Pokémon. Usage: -pokelist [tag] [page]',
  adminOnly: false,
  async execute(msg, args, client) {
    return pokemonCmd.execute(msg, ['list', ...args], client);
  }
};