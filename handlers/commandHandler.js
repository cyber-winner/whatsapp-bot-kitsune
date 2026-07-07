const fs = require('fs');
const path = require('path');
function loadCommands(client) {
  client.commands = new Map();
  client.categories = new Map();
  const commandsDir = path.join(__dirname, '..', 'commands');
  if (!fs.existsSync(commandsDir)) {
    console.warn('[CommandHandler] commands/ directory not found.');
    return;
  }
  const categories = fs.readdirSync(commandsDir).filter(f => fs.statSync(path.join(commandsDir, f)).isDirectory());
  for (const category of categories) {
    const categoryPath = path.join(commandsDir, category);
    const commandFiles = fs.readdirSync(categoryPath).filter(f => f.endsWith('.js'));
    const categoryCommands = [];
    for (const file of commandFiles) {
      try {
        const exported = require(path.join(categoryPath, file));
        const commandsToRegister = Array.isArray(exported) ? exported : [exported];
        for (const command of commandsToRegister) {
          if (!command.name || !command.execute) {
            console.warn(`[CommandHandler] Skipping in ${file}: missing name or execute.`);
            continue;
          }
          command.category = category;
          client.commands.set(command.name, command);
          categoryCommands.push(command.name);
          if (command.aliases && Array.isArray(command.aliases)) {
            for (const alias of command.aliases) {
              client.commands.set(alias, command);
            }
          }
          console.log(`  ✓ Loaded: -${command.name} [${category}]`);
        }
      } catch (err) {
        console.error(`[CommandHandler] Failed to load ${file}:`, err.message);
      }
    }
    client.categories.set(category, categoryCommands);
  }
  console.log(`\n📦 Loaded ${client.commands.size} commands across ${categories.length} categories.\n`);
}

function unloadCategory(client, category) {
  const commandsDir = path.join(__dirname, '..', 'commands', category);
  if (!fs.existsSync(commandsDir)) return;

  const categoryCommands = client.categories.get(category) || [];
  
  for (const cmdName of categoryCommands) {
    const command = client.commands.get(cmdName);
    if (command && command.aliases) {
      for (const alias of command.aliases) {
        client.commands.delete(alias);
      }
    }
    client.commands.delete(cmdName);
  }
  
  client.categories.delete(category);

  const commandFiles = fs.readdirSync(commandsDir).filter(f => f.endsWith('.js'));
  for (const file of commandFiles) {
    const filePath = path.join(commandsDir, file);
    delete require.cache[require.resolve(filePath)];
  }
  
  console.log(`[CommandHandler] Unloaded category: ${category} and purged from memory.`);
}

function reloadCategory(client, category) {
  const categoryPath = path.join(__dirname, '..', 'commands', category);
  if (!fs.existsSync(categoryPath)) return;
  
  unloadCategory(client, category);
  
  const categoryCommands = [];
  const commandFiles = fs.readdirSync(categoryPath).filter(f => f.endsWith('.js'));
  
  for (const file of commandFiles) {
    try {
      const exported = require(path.join(categoryPath, file));
      const commandsToRegister = Array.isArray(exported) ? exported : [exported];
      for (const command of commandsToRegister) {
        if (!command.name || !command.execute) continue;
        command.category = category;
        client.commands.set(command.name, command);
        categoryCommands.push(command.name);
        if (command.aliases && Array.isArray(command.aliases)) {
          for (const alias of command.aliases) {
            client.commands.set(alias, command);
          }
        }
      }
    } catch (err) {
      console.error(`[CommandHandler] Failed to load ${file}:`, err.message);
    }
  }
  
  client.categories.set(category, categoryCommands);
  console.log(`[CommandHandler] Reloaded category: ${category}`);
}

module.exports = {
  loadCommands,
  unloadCategory,
  reloadCategory
};