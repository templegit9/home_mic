#!/bin/bash
# HomeMic GCP VM Startup Script
# Runs on first boot to install and configure HomeMic

set -e

LOG_FILE="/var/log/homemic-setup.log"
exec > >(tee -a "$LOG_FILE") 2>&1

echo "=== HomeMic Server Setup Starting ==="
echo "Timestamp: $(date)"

# Update system
apt-get update
apt-get upgrade -y

# Install dependencies
apt-get install -y \
    python3 \
    python3-pip \
    python3-venv \
    git \
    ffmpeg \
    libsndfile1 \
    portaudio19-dev

# Create homemic user
if ! id "homemic" &>/dev/null; then
    useradd -m -s /bin/bash homemic
fi

# Clone repository
REPO_URL="https://github.com/templegit9/home_mic.git"
INSTALL_DIR="/opt/homemic"

if [ -d "$INSTALL_DIR" ]; then
    cd "$INSTALL_DIR"
    git pull
else
    git clone "$REPO_URL" "$INSTALL_DIR"
fi

chown -R homemic:homemic "$INSTALL_DIR"

# Setup Python virtual environment
cd "$INSTALL_DIR/backend"
sudo -u homemic python3 -m venv venv
sudo -u homemic ./venv/bin/pip install --upgrade pip
sudo -u homemic ./venv/bin/pip install -r requirements.txt

# Create data directory
mkdir -p /var/lib/homemic
chown homemic:homemic /var/lib/homemic

# Create systemd service
cat > /etc/systemd/system/homemic.service << 'EOF'
[Unit]
Description=HomeMic Server
After=network.target

[Service]
Type=simple
User=homemic
Group=homemic
WorkingDirectory=/opt/homemic/backend
Environment="PATH=/opt/homemic/backend/venv/bin:/usr/bin"
Environment="WHISPER_MODEL_SIZE=base"
Environment="DATABASE_URL=sqlite:////var/lib/homemic/homemic.db"
ExecStart=/opt/homemic/backend/venv/bin/uvicorn app.main:app --host 0.0.0.0 --port 8420
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
EOF

# Start service
systemctl daemon-reload
systemctl enable homemic
systemctl start homemic

echo "=== HomeMic Server Setup Complete ==="
echo "Service status:"
systemctl status homemic --no-pager || true
