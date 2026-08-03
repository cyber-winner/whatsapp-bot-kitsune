# Kitsune WhatsApp Bot

This is a powerful, microservice-based WhatsApp bot built using Node.js and `whatsapp-web.js`. It functions as an active participant in group chats, offering an AI conversational agent (using Groq LLMs), a fully-featured Pokémon mini-game, an interactive UNO game, and various administrative/utility commands.

## Features

- **🧠 Conversational AI (Kitsune):** Powered by Groq LLMs, the bot adapts, learns from the group chat, and converses naturally with users using memory and context.
- **⚡ Pokémon RPG:** Catch, battle, and trade Pokémon right in your WhatsApp chat. Features a full inventory system and interactive battles.
- **🃏 UNO Multiplayer:** Play UNO with your friends! Features custom lobbys, AI bot opponents, playable cards, visual hands, and auto-draw penalties.
- **🛠️ Microservice Architecture:** The bot is split into over 15 individual, independent modules running on PM2. If one module (like UNO or Memes) crashes or restarts, the rest of the bot stays online seamlessly!
- **🛡️ Moderation & Utilities:** Ping stats, math solving, weather lookups, warnings, kicks, bans, and anti-link tools.

## Architecture & Modules

The bot uses a **decentralized microservice architecture** powered by local HTTP APIs and PM2. 

### Core Modules:
- `celestia-wa-bot`: The central WhatsApp connection client. It handles all incoming and outgoing messages and broadcasts them to the other modules.
- `kitsune-brain`: The AI persona engine that manages conversational context, memory, and LLM requests.
- `kitsune-receiver`: A central log/webhook receiver for network events.
- `kitsune-watchdog`: Monitors network health and restarts modules if things go wrong.

### Feature Modules:
Each feature has its own dedicated PM2 process to ensure maximum stability:
- `kitsune-uno`
- `kitsune-pokemon`
- `kitsune-meme`
- `kitsune-fun`
- `kitsune-family`
- `kitsune-moderation`
- `kitsune-utility`
- `kitsune-reactions`
- `kitsune-snipe`

## How to Set It Up

### Requirements

- **Node.js**: Version 18+
- **Database**: MongoDB (Atlas)
- **API Keys**: Groq API Key

### Installation

1. Clone this repository:
   ```bash
   git clone https://github.com/your-username/Kitsune-WhatsApp-Bot.git
   cd Kitsune-WhatsApp-Bot
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Setup environment variables:
   ```bash
   cp .env.example .env
   ```
   *Edit `.env` to include your `MONGODB_URI`, `GROQ_API_KEY`, etc.*

4. Start the bot using PM2 (Required for Microservices):
   ```bash
   npm install -g pm2
   ./scripts/setup-pm2.sh
   # Or manually start all processes in ecosystem.config.js
   ```

5. Scan the QR code that appears in the logs of `celestia-wa-bot` to link your WhatsApp account.

## Command Reference

*Note: Default prefix is `-`.*

- **Utility:** `-ping`, `-weather [city]`, `-math [expr]`, `-help`
- **UNO:** `-uno create`, `-uno join`, `-uno addbot`, `-uno start`, `-uno play [card]`, `-uno hand`
- **Pokemon:** `-spawn`, `-catch [name]`, `-battle [@user]`, `-inventory`
- **Memes:** `-drake [text1] | [text2]`, `-reddit [subreddit]`
- **Admin:** `-kick [@user]`, `-ban [@user]`, `-warn [@user]`

## Developers & Contributions

Want to build your own module?
Because the bot uses a microservice architecture, you can simply create a new folder for your feature, spin up a local Express server on a new port, and have it listen to webhook broadcasts from `celestia-wa-bot` and send replies via `http://127.0.0.1:3300/api/reply`.

### Policies
- [Code of Conduct](CODE_OF_CONDUCT.md)
- [Security Policy](SECURITY.md)
- [Privacy Policy](PRIVACY.md)
- [Terms and Conditions](TERMS.md)

---
*License: MIT*
