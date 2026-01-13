#!/bin/bash
# HomeMic Pi Service Manager
# Run this script from your Mac to set up and manage the Pi node service

PI_HOST="${HOMEMIC_PI_HOST:-10.0.0.28}"  # homemic-node
PI_USER="${HOMEMIC_PI_USER:-homemic-node}"

echo "🔌 Connecting to Pi ($PI_USER@$PI_HOST)..."

ssh "$PI_USER@$PI_HOST" << 'REMOTE_SCRIPT'
set -e

echo ""
echo "📥 Pulling latest code..."
cd /home/homemic-node/homemic-node
git stash
git pull

echo ""
echo "📦 Installing HomeMic Node service..."

# Check if service file exists in repo
SERVICE_FILE="/home/homemic-node/homemic-node/node/homemic-node.service"
if [ ! -f "$SERVICE_FILE" ]; then
    echo "❌ Service file not found at $SERVICE_FILE"
    exit 1
fi

# Copy service file
sudo cp "$SERVICE_FILE" /etc/systemd/system/
sudo systemctl daemon-reload

# Enable and start service
sudo systemctl enable homemic-node
sudo systemctl restart homemic-node

# Wait a moment for service to start
sleep 3

# Check status
echo ""
echo "📊 Service Status:"
echo "=================="
if sudo systemctl is-active --quiet homemic-node; then
    echo "✅ HomeMic Node service is RUNNING"
    sudo systemctl status homemic-node --no-pager | head -15
else
    echo "❌ HomeMic Node service FAILED to start"
    sudo journalctl -u homemic-node -n 20 --no-pager
    exit 1
fi

# Check if communicating with server
echo ""
echo "🌐 Server Connection:"
echo "====================="
SERVER_URL=$(grep -oP 'http://[^"]+' /home/homemic-node/homemic-node/node/config.py | head -1)
if curl -s --connect-timeout 5 "$SERVER_URL/" > /dev/null 2>&1; then
    echo "✅ Server is reachable at $SERVER_URL"
else
    echo "⚠️  Cannot reach server at $SERVER_URL"
fi

echo ""
echo "✨ Done! The HomeMic node agent will auto-restart if it crashes."
echo "   View logs: sudo journalctl -u homemic-node -f"
REMOTE_SCRIPT

# Start local dashboard
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

echo ""
echo "🖥️  Starting Dashboard..."
echo "========================="
cd "$PROJECT_DIR"

# Check if node_modules exists
if [ ! -d "node_modules" ]; then
    echo "📦 Installing npm dependencies..."
    npm install
fi

# Get Mac's IP address for network access
MAC_IP=$(ipconfig getifaddr en0 2>/dev/null || ipconfig getifaddr en1 2>/dev/null || echo "your-mac-ip")

echo "🚀 Starting frontend..."
echo "   Local:   http://localhost:5173"
echo "   Network: http://$MAC_IP:5173"
echo ""
echo "   Press Ctrl+C to stop"
echo ""
npm run dev -- --host
