# Kitsune WhatsApp Bot

This is a WhatsApp bot built using Node.js and `whatsapp-web.js`. It functions as a participant in group chats and provides an AI conversational agent (using Groq LLMs), a Pokemon mini-game, and various utility commands.

## Table of Contents
1. [How to Set It Up](#how-to-set-it-up)
2. [Environment Variables Guide](#environment-variables-guide)
3. [Architecture Overview](#architecture-overview)
4. [Detailed Component Breakdown](#detailed-component-breakdown)
5. [The Flow of a Message](#the-flow-of-a-message)
6. [Command Reference List](#command-reference-list)
7. [Data Structures & Schemas](#data-structures--schemas)
8. [Advanced Deployment Options](#advanced-deployment-options)
9. [Guide for Developers](#guide-for-developers)
10. [Troubleshooting & FAQ](#troubleshooting--faq)
11. [License](#license)

---

## How to Set It Up

### Requirements
- **Node.js**: Version 18 or above is required for compatibility with modern JavaScript features.
- **Database**: A MongoDB database connection is required for persistent state (e.g., MongoDB Atlas).
- **LLM Key**: A Groq API key is required to power the AI conversational brain.

### Installation Steps
1. Clone this repository to your local machine:
   ```bash
   git clone https://github.com/your-username/Kitsune-WhatsApp-Bot.git
   cd Kitsune-WhatsApp-Bot
   ```
2. Install all required packages:
   ```bash
   npm install
   ```
   *(If you are on Linux, you might need to install Puppeteer dependencies like `libnss3`, `libatk1.0-0`, `libcups2`, `libxss1`, etc., so the headless Chrome browser can run properly).*
3. Copy the `.env.example` file and rename it to `.env`:
   ```bash
   cp .env.example .env
   ```
4. Open the `.env` file and fill in your details (see the Environment Variables Guide below).
5. Run the bot by typing:
   ```bash
   npm start
   ```
6. A QR code will appear in your terminal. Scan it using the WhatsApp app on your phone (under Linked Devices) to log in. The session will be saved locally in `.wwebjs_auth/` so you do not need to scan the QR code again unless you log out from your phone.

---

## Environment Variables Guide

Here is a complete breakdown of every configuration variable available in your `.env` file:

- `MONGODB_URI`: The connection string for your MongoDB instance. It usually looks like `mongodb+srv://username:password@cluster.mongodb.net/dbname`.
- `GROQ_API_KEY`: The API key you generated from the Groq console. Used to make LLM requests.
- `GROQ_MODEL`: The specific model to use (default is `llama-3.3-70b-versatile`).
- `CONTROL_CENTRE_PASSWORD`: An admin password used to log into the web dashboard API.
- `INTERNAL_API_TOKEN`: A secure token used for internal microservice communication (e.g., between the web dashboard and the WhatsApp client).
- `BOT_OWNER_NAME`: Your personal name. The AI uses this name to refer to its owner and creator.
- `BOT_NAME`: The name of the bot itself (e.g., "Kitsune").
- `BOT_PREFIX`: The character that triggers commands (default is `-`).
- `BOT_FATHER`: A comma-separated list of the phone numbers of the admins (with country codes, like `919876543210`).
- `ALLOWED_ORIGIN`: The production domain for CORS checks on the web dashboard API (e.g., `your-domain.site`).
- `DATA_DIR`: Directory where local JSON databases are kept (default is `./data`).

---

## Architecture Overview

The bot is split into two main systems: the **Core API** (handling WhatsApp connection and basic commands) and the **AI Brain** (handling natural language understanding).

```mermaid
graph TD
    User([WhatsApp User]) <-->|Messages| CoreAPI[core-api.js]
    
    subgraph Core System
        CoreAPI --> EventHandler[handlers/eventHandler.js]
        EventHandler --> CommandRouter{Is it a command?}
        CommandRouter -->|Yes| CommandFiles[commands/]
        CommandFiles --> Store[store/ - Local JSON state]
    end
    
    subgraph AI System
        CommandRouter -->|No| AIBrain[kitsune-brain/server.js]
        AIBrain <--> GroqAPI([Groq LLM])
        AIBrain <--> Tools[utils/ - Weather, News, Math]
        AIBrain <--> MemoryDB[(kitsune_persona.db)]
    end
```

---

## Detailed Component Breakdown

### 1. Main Entry Points
- **`core-api.js`**: The main entry point for the application. It starts the primary Express server, connects to MongoDB, and initializes the `whatsapp-web.js` client.
- **`wa_api_server.js`**: An internal API server that allows other scripts (like the dashboard) to send messages through the WhatsApp client programmatically.
- **`config.js`**: Parses all environment variables from `.env` and exports them as a central configuration object used across the app.

### 2. Message Handling
- **`handlers/eventHandler.js`**: The core router. Every incoming message passes through here. It checks the sender's permissions, handles rate limiting, enforces anti-link rules, and decides whether a message is a command or an AI chat message.

### 3. The Command System
Located in the **`commands/`** folder. Commands are triggered by a prefix (like `-`).
- **`pokemon/`**: Contains the logic for the Pokémon RPG (e.g. `catch.js`, `battle.js`, `exchange.js`, `trade.js`, `use.js`).
- **`utility/`**: Contains helpful commands like `ping.js`, `weather.js`, or `immune.js`.
- **`family/`**: Contains fun, social group commands like `tree.js` or `adopt.js`.
- **`admin/`**: Contains group moderation tools (`kick.js`, `ban.js`, `warn.js`) which check for `BOT_FATHER` permissions.
- **`meme/`**: Contains commands to generate or fetch memes (`drake.js`, `son.js`, `reddit.js`).

### 4. The AI Brain (`kitsune-brain/`)
- **`server.js`**: The separate Express server for the AI. It builds the prompt context (time, news, memory), talks to the Groq API, processes tool calls, and returns text.
- **`ingest-datasets.js`**: A utility script used to load conversational datasets into the AI's persona engine.

### 5. Utility & Tooling (`utils/`)
- **`weatherTool.js`**: Contains the schemas and functions the AI uses to fetch real-time data (Open-Meteo, Google News RSS, DuckDuckGo, Wikipedia, MathJS).
- **`introspectTool.js`**: Gives the AI the ability to read its own source code files and perform self-diagnosis.
- **`internalAuth.js`**: Express middleware that secures the internal APIs using a token.
- **`permissions.js`**: Helper functions to verify if a user is the owner (`BOT_FATHER`) or an admin.
- **`pokemonCache.js`**: Caches Pokémon JSON data in memory so the game runs quickly.
- **`redditMemeHelper.js`**: Fetches random memes from Reddit for the meme commands.

### 6. Data Storage & State (`store/`)
- **`db.js`**: Handles the connection to MongoDB.
- **`pokemonStore.js`**: Manages all MongoDB database operations for the Pokémon game (saving players, updating wallets, checking items).
- **`messageLogger.js`**: Logs group and private chat histories to local JSON files so the AI can read recent context.
- **`kitsuneMemory.js`**: Interfaces with the SQLite database to save and retrieve long-term AI conversational memory.
- **`personaEngine.js`**: Interfaces with SQLite to query personality traits and knowledge blocks for the AI.

### 7. Background Scripts (`scripts/`)
- **`control-centre-api.js`**: The backend API for the external web dashboard (allowing remote control of the bot).
- **`network-watchdog.js`**: A background script that monitors the server's internet and power status. It pauses bot activities if the network drops.
- **`receiver.js`**: Receives remote logs and webhook events.
- **`setup-pm2.sh`**: A shell script to easily deploy the bot processes using PM2.

---

## The Flow of a Message

To understand how everything works together, here is a detailed sequence of what happens when a user sends a message.

```mermaid
sequenceDiagram
    participant U as User
    participant W as whatsapp-web.js
    participant E as eventHandler.js
    participant C as commands/
    participant B as kitsune-brain
    participant G as Groq API

    U->>W: Sends text message
    W->>E: Passes message object
    
    alt Is a Command (e.g. "-ping")
        E->>C: Routes to specific command file
        C-->>E: Executes logic (e.g. math or database check)
        E->>W: Sends exact response text
        W->>U: Delivers message
    else Is a Normal Chat
        E->>B: Sends HTTP POST with message text
        B->>B: Loads recent chat history from memory
        B->>G: Sends context to LLM
        G-->>B: Returns generated conversational text
        B-->>E: Returns text to Core API
        E->>W: Sends AI text
        W->>U: Delivers message
    end
```

---

## Command Reference List

This section lists the various commands available to end-users inside the WhatsApp chat.

### Utility Commands
- **`-ping`**: Responds with "Pong!" and the latency speed.
- **`-weather [city]`**: Returns the current weather conditions for the specified location.
- **`-math [expression]`**: Calculates complex mathematical expressions safely.
- **`-immune`**: Temporarily grants the user immunity from automated moderation kicks.

### Pokemon RPG Commands
- **`-catch [name]`**: Attempts to catch a spawned Pokémon if the guessed name is correct.
- **`-battle [@user]`**: Challenges another user to a turn-based Pokémon battle.
- **`-exchange [card]`**: Sells a duplicate Pokémon card for in-game currency.
- **`-trade [@user] [offer]`**: Initiates a card trading sequence with another player.
- **`-inventory`**: Displays the user's caught Pokémon and items.
- **`-use [item]`**: Applies an item (like a healing potion) to an active Pokémon.

### Meme Commands
- **`-drake [text1] | [text2]`**: Generates a standard two-panel Drake meme.
- **`-reddit [subreddit]`**: Fetches a random top meme image from the specified subreddit.

### Admin Commands
- **`-kick [@user]`**: Removes a user from the WhatsApp group.
- **`-ban [@user]`**: Removes a user and prevents them from rejoining.
- **`-warn [@user] [reason]`**: Issues an official warning to a user and logs it in the database.

---

## Data Structures & Schemas

To help developers understand the underlying data, here are examples of how information is stored.

### Pokemon Database (Local JSON)
The bot reads static data from `data/pokemon.json`. A typical entry looks like this:
```json
{
  "id": 25,
  "name": "Pikachu",
  "types": ["Electric"],
  "stats": {
    "hp": 35,
    "attack": 55,
    "defense": 40,
    "speed": 90
  },
  "image_url": "https://raw.githubusercontent.com/.../25.png"
}
```

### Player Wallet (MongoDB)
Player progress is saved in MongoDB. The Mongoose schema structure resembles:
```javascript
const playerSchema = new mongoose.Schema({
  userId: { type: String, required: true },
  balance: { type: Number, default: 100 },
  inventory: [{
    itemId: String,
    quantity: Number
  }],
  caughtPokemon: [{
    pokemonId: Number,
    level: Number,
    nickname: String
  }]
});
```

---

## Advanced Deployment Options

### Using PM2 (Recommended for Production)
To ensure the bot stays online 24/7 and restarts automatically if it crashes, use PM2.
1. Install PM2 globally: `npm install -g pm2`
2. Run the included setup script: `./scripts/setup-pm2.sh`
3. Check the logs: `pm2 logs`

### Using Docker
A Dockerfile and `docker-compose.yml` are provided for containerized deployment.
1. Ensure Docker and Docker Compose are installed.
2. Run: `docker-compose up -d --build`
3. View logs with: `docker-compose logs -f`

---

## Guide for Developers

If you want to modify the bot, follow these guidelines:

### Adding a New Command
To add a new command, create a new JavaScript file in the `commands/` folder. Look at existing files for an example. 
Each command file must export an object containing:
- `name`: The trigger word for the command.
- `aliases`: An array of alternative trigger words (optional).
- `execute(message, args, client)`: The function that runs when the user types the command.

Example of a basic command:
```javascript
module.exports = {
    name: 'hello',
    aliases: ['hi', 'hey'],
    execute: async (message, args, client) => {
        await message.reply('Hello there! How can I help you today?');
    }
};
```

### Adding a New AI Tool
If you want the AI to be able to do something new (like check a new API):
1. Write the function inside the `utils/` folder.
2. Define the tool schema required by the LLM in the same file. The schema must match the OpenAI/Groq function calling format.
3. Import the function and schema into `kitsune-brain/server.js`.
4. Add the schema to the tools list sent to the Groq API, and handle the tool call execution inside the response loop in `server.js`.

---

## Troubleshooting & FAQ

**Q: The bot scans the QR code but immediately disconnects.**
A: This usually happens due to unstable internet or out-of-date Puppeteer libraries. Ensure you have the latest version of Node and `whatsapp-web.js`. Try running `npm ci` to cleanly install dependencies.

**Q: The AI is not responding to normal messages.**
A: Check your `GROQ_API_KEY` in the `.env` file. If the key is invalid or your Groq account has hit rate limits, the AI brain will throw an error and fall silent. Check the logs in the terminal for specific HTTP error codes.

**Q: MongoDB connection fails on startup.**
A: Ensure your `MONGODB_URI` is correct and that you have whitelisted your server's IP address in the MongoDB Atlas network access settings.

**Q: How do I change the bot's command prefix?**
A: Edit the `BOT_PREFIX` variable in your `.env` file. For example, setting `BOT_PREFIX=!` will change `-ping` to `!ping`.

**Q: Can I use Gemini instead of Groq?**
A: Yes. The `kitsune-brain/server.js` file has underlying support for multiple LLM providers. You can swap the API endpoint from Groq to Google's generative AI endpoints and supply your `GEMINI_API_KEY`.

## Policies & Documentation

Please review the following documents before using or contributing to the bot:
- **[Code of Conduct](CODE_OF_CONDUCT.md)**: Our standards for community interaction and contribution.
- **[Security Policy](SECURITY.md)**: How to report vulnerabilities and our supported versions.
- **[Privacy Policy](PRIVACY.md)**: How data is collected and handled by the bot.
- **[Terms and Conditions](TERMS.md)**: The rules and disclaimers for using and hosting the bot.

---

## License

This project uses the [MIT License](LICENSE).
