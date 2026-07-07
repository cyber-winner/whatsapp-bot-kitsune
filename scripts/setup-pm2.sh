#!/usr/bin/env bash
#
# ╔══════════════════════════════════════════════════════════╗
# ║  Kitsune PM2 Setup — One-Time Configuration Script     ║
# ║  Run this ONCE to set up everything.                    ║
# ╚══════════════════════════════════════════════════════════╝
#
# What this does:
#   1. Creates log directories
#   2. Deletes any old PM2 instances of kitsune
#   3. Starts the bot + watchdog via ecosystem.config.js
#   4. Installs pm2-logrotate (prevents log files from eating disk)
#   5. Configures PM2 startup (auto-start on boot / power recovery)
#   6. Saves the PM2 process list

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

echo ""
echo "╔══════════════════════════════════════════════════════════╗"
echo "║  🔧 Kitsune PM2 Setup                                  ║"
echo "╚══════════════════════════════════════════════════════════╝"
echo ""

cd "$PROJECT_DIR"

# ── Step 1: Create log directory ──
echo "📁 Creating log directory..."
mkdir -p logs
echo "   ✓ logs/ directory ready"

# ── Step 2: Clean up old processes ──
echo ""
echo "🧹 Cleaning up old PM2 processes..."
pm2 delete kitsune-wa-bot 2>/dev/null && echo "   ✓ Removed old kitsune-wa-bot" || echo "   ℹ  No old kitsune-wa-bot found"
pm2 delete kitsune-watchdog 2>/dev/null && echo "   ✓ Removed old kitsune-watchdog" || echo "   ℹ  No old kitsune-watchdog found"

# ── Step 3: Start ecosystem ──
echo ""
echo "🚀 Starting Kitsune ecosystem..."
pm2 start ecosystem.config.js
echo "   ✓ Bot and Watchdog started"

# ── Step 4: Install log rotation ──
echo ""
echo "📋 Setting up log rotation..."
if pm2 describe pm2-logrotate > /dev/null 2>&1; then
    echo "   ℹ  pm2-logrotate already installed"
else
    pm2 install pm2-logrotate
    echo "   ✓ pm2-logrotate installed"
fi

# Configure log rotation settings
pm2 set pm2-logrotate:max_size 10M         # Rotate when log exceeds 10MB
pm2 set pm2-logrotate:retain 5             # Keep only 5 rotated logs
pm2 set pm2-logrotate:compress true        # Compress old logs
pm2 set pm2-logrotate:dateFormat YYYY-MM-DD_HH-mm-ss
pm2 set pm2-logrotate:workerInterval 300   # Check every 5 minutes
echo "   ✓ Log rotation configured (max 10MB, keep 5, compressed)"

# ── Step 5: Configure PM2 startup (survives reboot / power outage) ──
echo ""
echo "⚡ Configuring PM2 startup on boot..."
echo "   This will ask for your sudo password to create a systemd service."
echo ""
pm2 startup systemd
echo ""
echo "   ⚠️  If PM2 printed a 'sudo env PATH=...' command above, COPY AND RUN IT NOW."
echo "   Then come back and run: pm2 save"
echo ""

# ── Step 6: Save PM2 process list ──
echo "💾 Saving PM2 process list..."
pm2 save
echo "   ✓ Process list saved (will auto-restore on boot)"

# ── Done ──
echo ""
echo "╔══════════════════════════════════════════════════════════╗"
echo "║  ✅ Setup Complete!                                      ║"
echo "╠══════════════════════════════════════════════════════════╣"
echo "║                                                          ║"
echo "║  📊 View status:    pm2 status                           ║"
echo "║  📝 View bot logs:  pm2 logs kitsune-wa-bot             ║"
echo "║  🐕 Watchdog logs:  pm2 logs kitsune-watchdog           ║"
echo "║  📈 Monitoring:     pm2 monit                            ║"
echo "║  🔄 Manual restart: pm2 restart kitsune-wa-bot          ║"
echo "║  🛑 Stop all:       pm2 stop all                         ║"
echo "║                                                          ║"
echo "╚══════════════════════════════════════════════════════════╝"
echo ""
