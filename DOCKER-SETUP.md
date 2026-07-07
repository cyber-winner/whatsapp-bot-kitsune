# 🦊 Kitsune Bot — Docker Setup Guide

## Prerequisites

- **Docker** and **Docker Compose** installed on the target machine
- A **MongoDB Atlas** URI (or any MongoDB connection string)
- **Groq API Key** (for AI chat)
- A WhatsApp account to scan the QR code

---

## Quick Start (3 steps)

### 1. Create your `.env` file

Copy the example and fill in your credentials:

```bash
cp .env.example .env
nano .env    # or use any text editor
```

Fill in these **required** values:
```env
MONGODB_URI=mongodb+srv://<user>:<pass>@<cluster>.mongodb.net/celestia
GROQ_API_KEY=<your-groq-api-key>
GROQ_MODEL=llama-3.3-70b-versatile
CONTROL_CENTRE_PASSWORD=<pick-a-strong-password>
INTERNAL_API_TOKEN=<generate-a-random-token>
ENABLE_REMOTE_LOGGING=true
```

> 💡 Generate a random token: `openssl rand -base64 32`

### 2. Build & Start

```bash
docker compose up -d --build
```

### 3. Scan the QR Code

Watch the logs for the QR code:

```bash
docker compose logs -f kitsune-bot
```

Scan the QR code with your WhatsApp. Once authenticated, the bot is live!

---

## What's Running Inside the Container

The container uses **PM2** to run all these services simultaneously:

| Service | Port | Description |
|---------|------|-------------|
| `celestia-wa-bot` | — | Main WhatsApp bot (headless Chrome) |
| `kitsune-brain` | 3100 | AI Brain API (Groq/LLM integration) |
| `kitsune-receiver` | 3200 | **Global Message Receiver** (logs all messages) |
| `kitsune-control-centre` | 8000 | Web dashboard for bot management |
| `kitsune-watchdog` | — | File watcher & power management |
| `kitsune-pokemon` | 3401 | Pokémon module API |
| `kitsune-fun` | 3402 | Fun commands module |
| `kitsune-moderation` | 3403 | Moderation module |
| `kitsune-family` | 3404 | Family system module |
| `kitsune-meme` | 3405 | Meme commands module |
| `kitsune-reactions` | 3406 | Reaction GIFs module |
| `kitsune-snipe` | 3407 | Message snipe module |
| `kitsune-utility` | 3408 | Utility commands module |

---

## Ports Exposed

| Port | Purpose | Who connects |
|------|---------|-------------|
| `3100` | Brain API | Other bot instances (for AI features) |
| `3200` | Global Message Receiver | Remote bot instances send message logs here |
| `8000` | Control Centre | You — open `http://your-server-ip:8000` in browser |

---

## Global Message Receiver

The **Global Message Receiver** runs on port `3200` and logs every message from all chats.

### How it works:
1. The bot intercepts every incoming message
2. It sends the message data to `http://localhost:3200/api/log`
3. The receiver stores messages as JSON files organized by chat
4. Media files (images, videos, etc.) are saved alongside

### Storage structure:
```
global-messages/
├── group/
│   ├── messages/
│   │   └── GroupName.json
│   └── media/
│       └── GroupName/
│           └── SenderName.png
└── chats/
    └── ContactName/
        ├── messages/
        │   └── ContactName.json
        └── media/
            └── SenderName.jpg
```

### Sending logs from another bot instance:
If your friend has their own bot and wants to send logs to YOUR receiver:
```env
RECEIVER_URL=http://your-server-ip:3200
ENABLE_REMOTE_LOGGING=true
```

---

## Common Commands

```bash
# Start the bot
docker compose up -d --build

# View live logs
docker compose logs -f kitsune-bot

# Stop the bot
docker compose down

# Restart the bot
docker compose restart

# Check PM2 process status inside container
docker compose exec kitsune-bot pm2 status

# View specific service logs
docker compose exec kitsune-bot pm2 logs celestia-wa-bot --lines 50
docker compose exec kitsune-bot pm2 logs kitsune-brain --lines 50
docker compose exec kitsune-bot pm2 logs kitsune-receiver --lines 50

# Restart a specific service
docker compose exec kitsune-bot pm2 restart kitsune-brain

# Shell into the container
docker compose exec kitsune-bot bash
```

---

## Persistent Data

These directories are mounted as volumes so your data survives container restarts:

| Volume | Purpose |
|--------|---------|
| `.wwebjs_auth` | WhatsApp session (keeps you logged in) |
| `.wwebjs_cache` | WhatsApp web cache |
| `data/` | Pokémon data, items, phrases, images |
| `db/` | SQLite databases |
| `logs/` | Application logs |
| `store-data-for-use/` | Kitsune memory & persona data |
| `global-messages/` | All logged messages from the receiver |

---

## Sending the Container to Your Friend

### Option A: Share the code (recommended)
1. Zip the project (excluding sensitive files):
   ```bash
   zip -r kitsune-bot.zip . -x "*.git*" "*node_modules*" "*.wwebjs_auth*" "*.wwebjs_cache*" "*.env" "global-messages/*" "store-data-for-use/*" "logs/*"
   ```
2. Send the zip to your friend
3. They create their own `.env` and run `docker compose up -d --build`

### Option B: Export the Docker image
```bash
# Build the image
docker build -t kitsune-bot:latest .

# Save as a tar file
docker save kitsune-bot:latest | gzip > kitsune-bot.tar.gz

# Send kitsune-bot.tar.gz to your friend
# They load it with:
docker load < kitsune-bot.tar.gz

# Then run with docker-compose (they still need the docker-compose.yml and .env)
docker compose up -d
```

---

## Troubleshooting

### Bot crashes with "Protocol error" or Chromium issues
- Increase `shm_size` in `docker-compose.yml` (default is `1gb`)
- Ensure the container has enough RAM (minimum 2GB recommended)

### QR code not showing
```bash
docker compose logs -f kitsune-bot 2>&1 | grep -A 20 "QR"
```

### Session expired / need to re-scan
```bash
# Remove old session and restart
rm -rf .wwebjs_auth/*
docker compose restart
```

### Container using too much memory
```bash
# Check memory usage
docker stats kitsune-bot
```

---

## Environment Variables Reference

| Variable | Required | Description |
|----------|----------|-------------|
| `MONGODB_URI` | ✅ | MongoDB connection string |
| `GROQ_API_KEY` | ✅ | Groq API key for AI chat |
| `GROQ_MODEL` | ❌ | LLM model (default: `llama-3.3-70b-versatile`) |
| `CONTROL_CENTRE_PASSWORD` | ✅ | Password for admin web dashboard |
| `INTERNAL_API_TOKEN` | ✅ | Token for internal service-to-service auth |
| `ENABLE_REMOTE_LOGGING` | ❌ | Set `true` to enable global message receiver |
| `RECEIVER_URL` | ❌ | URL of receiver server (default: `http://localhost:3200`) |
| `GEMINI_API_KEY` | ❌ | Google Gemini API key (optional) |
| `ALLOW_HOST_POWER_CONTROL` | ❌ | Allow shutdown/reboot from dashboard |
