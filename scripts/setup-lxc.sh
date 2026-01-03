#!/bin/bash
#
# HomeMic LXC Setup Script for Proxmox
# Run this on your Proxmox host to create a fresh LXC container with all dependencies
#
# Usage: bash setup-lxc.sh [-y]
#   -y  Skip confirmation prompts (auto-yes)
#

set -e

# Parse arguments
AUTO_YES=false
while getopts "y" opt; do
    case $opt in
        y) AUTO_YES=true ;;
        *) echo "Usage: $0 [-y]"; exit 1 ;;
    esac
done

# Configuration
CTID=113
CT_NAME="homemic"
CT_TEMPLATE="local:vztmpl/ubuntu-22.04-standard_22.04-1_amd64.tar.zst"
CT_STORAGE="local-lvm"
CT_MEMORY=2048
CT_CORES=2
CT_DISK=16
CT_BRIDGE="vmbr0"

echo "============================================"
echo "HomeMic LXC Container Setup"
echo "============================================"

# Check if running as root
if [ "$EUID" -ne 0 ]; then
    echo "Please run as root on Proxmox host"
    exit 1
fi

# Check if container exists
if pct status $CTID &>/dev/null; then
    echo ""
    echo "Container $CTID ($CT_NAME) exists."
    if [ "$AUTO_YES" = true ]; then
        confirm="y"
    else
        read -p "Delete and recreate? (y/N): " confirm
    fi
    if [[ "$confirm" =~ ^[Yy]$ ]]; then
        echo "Stopping container..."
        pct stop $CTID --force 2>/dev/null || true
        sleep 2
        echo "Destroying container..."
        pct destroy $CTID --force
        echo "Container $CTID deleted."
    else
        echo "Aborted."
        exit 0
    fi
fi

# Check if template exists
if ! pveam list local | grep -q "ubuntu-22.04"; then
    echo "Downloading Ubuntu 22.04 template..."
    pveam download local ubuntu-22.04-standard_22.04-1_amd64.tar.zst
fi

echo ""
echo "Creating LXC container $CTID ($CT_NAME)..."

# Create container
pct create $CTID $CT_TEMPLATE \
    --hostname $CT_NAME \
    --storage $CT_STORAGE \
    --rootfs $CT_STORAGE:$CT_DISK \
    --memory $CT_MEMORY \
    --cores $CT_CORES \
    --net0 name=eth0,bridge=$CT_BRIDGE,ip=dhcp \
    --unprivileged 1 \
    --features nesting=1 \
    --start 0

echo "Container created."

# Start container
echo "Starting container..."
pct start $CTID
sleep 5

# Wait for network
echo "Waiting for network..."
for i in {1..30}; do
    if pct exec $CTID -- ping -c1 8.8.8.8 &>/dev/null; then
        break
    fi
    sleep 1
done

echo ""
echo "Installing dependencies..."

# Run setup commands inside container
pct exec $CTID -- bash -c '
set -e

echo "Updating system..."
apt update && apt upgrade -y

echo "Installing base packages..."
apt install -y \
    python3 \
    python3-pip \
    python3-venv \
    git \
    ffmpeg \
    curl \
    wget \
    build-essential \
    sqlite3

echo "Creating HomeMic directories..."
mkdir -p /opt/homemic
mkdir -p /opt/homemic/data/audio

echo "Cloning HomeMic repository..."
cd /opt
git clone https://github.com/templegit9/home_mic.git homemic-repo
mv homemic-repo/* homemic/
rm -rf homemic-repo

echo "Setting up Python virtual environment..."
cd /opt/homemic/backend
python3 -m venv venv
source venv/bin/activate

echo "Installing Python dependencies..."
pip install --upgrade pip
pip install -r requirements.txt

echo "Installing faster-whisper for transcription..."
pip install faster-whisper

echo "Creating systemd service..."
cat > /etc/systemd/system/homemic.service << EOF
[Unit]
Description=HomeMic Backend Server
After=network.target

[Service]
Type=simple
User=root
WorkingDirectory=/opt/homemic/backend
Environment="PATH=/opt/homemic/backend/venv/bin"
ExecStart=/opt/homemic/backend/venv/bin/python -m uvicorn app.main:app --host 0.0.0.0 --port 8420
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
EOF

systemctl daemon-reload
systemctl enable homemic

echo ""
echo "============================================"
echo "HomeMic setup complete!"
echo "============================================"
'

# Get container IP
echo ""
echo "Getting container IP..."
sleep 2
CT_IP=$(pct exec $CTID -- ip -4 addr show eth0 | grep -oP '(?<=inet\s)\d+(\.\d+){3}')

echo ""
echo "============================================"
echo "LXC Container $CTID ($CT_NAME) is ready!"
echo "============================================"
echo ""
echo "Container IP: $CT_IP"
echo "SSH Access:   ssh root@$CT_IP"
echo "API URL:      http://$CT_IP:8420"
echo ""
echo "To start HomeMic:"
echo "  pct exec $CTID -- systemctl start homemic"
echo ""
echo "To check logs:"
echo "  pct exec $CTID -- journalctl -u homemic -f"
echo ""
echo "To enter container:"
echo "  pct enter $CTID"
echo ""
