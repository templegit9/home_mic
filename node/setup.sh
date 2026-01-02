#!/bin/bash
# HomeMic Node Agent Setup Script for Raspberry Pi 5
# Run: curl -fsSL https://raw.githubusercontent.com/templegit9/home_mic/main/node/setup.sh | bash

set -e

echo "=================================="
echo "  HomeMic Node Agent Setup"
echo "  For Raspberry Pi 5"
echo "=================================="
echo ""

# Check if running on Raspberry Pi
if ! grep -q "Raspberry Pi" /proc/cpuinfo 2>/dev/null; then
    echo "Warning: This doesn't appear to be a Raspberry Pi."
    echo "Continuing anyway..."
fi

# Update system
echo "➤ Updating system packages..."
sudo apt-get update
sudo apt-get upgrade -y

# Install dependencies
echo "➤ Installing system dependencies..."
sudo apt-get install -y \
    python3 \
    python3-pip \
    python3-venv \
    python3-pyaudio \
    portaudio19-dev \
    libportaudio2 \
    git

# Clone repository
echo "➤ Cloning HomeMic repository..."
cd ~
if [ -d "homemic-node" ]; then
    echo "Directory exists, updating..."
    cd homemic-node
    git pull
else
    git clone https://github.com/templegit9/home_mic.git homemic-node
    cd homemic-node
fi

# Create virtual environment
echo "➤ Creating Python virtual environment..."
cd node
python3 -m venv venv
source venv/bin/activate

# Install Python dependencies
echo "➤ Installing Python dependencies..."
pip install --upgrade pip
pip install -r requirements.txt

# Create systemd service
echo "➤ Creating systemd service..."
sudo tee /etc/systemd/system/homemic-node.service > /dev/null << 'EOF'
[Unit]
Description=HomeMic Node Agent
After=network-online.target sound.target
Wants=network-online.target

[Service]
Type=simple
User=pi
WorkingDirectory=/home/pi/homemic-node/node
Environment=PATH=/home/pi/homemic-node/node/venv/bin:/usr/bin:/bin
ExecStart=/home/pi/homemic-node/node/venv/bin/python agent.py
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
EOF

# Reload systemd
sudo systemctl daemon-reload

echo ""
echo "=================================="
echo "  Setup Complete!"
echo "=================================="
echo ""
echo "Next steps:"
echo ""
echo "1. Edit the config file to set your server IP:"
echo "   nano ~/homemic-node/node/config.py"
echo "   Change SERVER_URL to: http://YOUR_PROXMOX_CONTAINER_IP:8420"
echo ""
echo "2. Test the agent manually:"
echo "   cd ~/homemic-node/node"
echo "   source venv/bin/activate"
echo "   python agent.py --list-devices"
echo "   python agent.py"
echo ""
echo "3. Enable automatic startup:"
echo "   sudo systemctl enable homemic-node"
echo "   sudo systemctl start homemic-node"
echo ""
echo "4. Check status:"
echo "   sudo systemctl status homemic-node"
echo "   journalctl -u homemic-node -f"
echo ""
