# Batch Transcription Deployment Guide

Deploy the batch transcription feature to your Proxmox LXC container and Raspberry Pi nodes.

---

## Prerequisites

- Proxmox LXC container 113 (homemic) running
- Raspberry Pi 5 with USB microphone
- External storage mounted (for audio files)
- Git access to the repository

---

## 1. Backend Deployment (Proxmox LXC Container 113)

### LXC Container Specs
- **Container ID**: 113 (homemic)
- **OS**: Ubuntu
- **CPU**: 2 cores
- **RAM**: 2 GB
- **Disk**: 15.58 GB

### SSH into the LXC Container

```bash
# Option 1: SSH directly (if network is configured)
ssh root@<LXC_IP_ADDRESS>

# Option 2: Via Proxmox host
ssh root@<PROXMOX_HOST_IP>
pct enter 113

# Option 3: Via Proxmox Web Console
# Go to Proxmox UI → Container 113 → Console
```

> **Find LXC IP**: In Proxmox UI, click Container 113 → Network, or run `pct exec 113 -- ip addr`

### First-Time Setup (if not already done)

```bash
# Update system
apt update && apt upgrade -y

# Install dependencies
apt install -y python3 python3-pip python3-venv git ffmpeg

# Clone repository
mkdir -p /opt
cd /opt
git clone https://github.com/templegit9/home_mic.git homemic
cd homemic

# Create virtual environment
cd backend
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt

# Create data directories
mkdir -p /opt/homemic/data/audio
```

### Pull Latest Code

```bash
cd /opt/homemic

# Stash any local changes
git stash

# Pull batch-transcription branch
git fetch origin
git checkout feature/batch-transcription
git pull origin feature/batch-transcription

# Update dependencies
cd backend
source venv/bin/activate
pip install -r requirements.txt
```

### Create Systemd Service

```bash
cat > /etc/systemd/system/homemic.service << 'EOF'
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
systemctl start homemic
```

### Verify Backend is Running

```bash
systemctl status homemic
journalctl -u homemic -f

# Test API
curl http://localhost:8420/
```

---

## 2. Raspberry Pi Node Deployment

### SSH to Each Node

```bash
ssh homemic-node@homemic-node.local
# or use IP: ssh homemic-node@10.0.0.XXX
```

### Update Node Code

```bash
cd ~/homemic-node

# Stash any local changes (config customizations etc.)
git stash

# Pull latest changes
git fetch origin
git checkout feature/batch-transcription
git pull origin feature/batch-transcription

# Optionally restore local config changes
# git stash pop
```

### Install Dependencies

```bash
cd ~/homemic-node/node
source venv/bin/activate
pip install -r requirements.txt
```

### Configure Storage (External USB Drive)

```bash
# Create mount point
sudo mkdir -p /mnt/audio-clips

# Find your USB drive
lsblk

# Mount external drive (example: /dev/sda1)
sudo mount /dev/sda1 /mnt/audio-clips

# Auto-mount on boot (add to /etc/fstab)
echo '/dev/sda1 /mnt/audio-clips ext4 defaults,nofail 0 2' | sudo tee -a /etc/fstab

# Set storage path
export HOMEMIC_STORAGE_DIR=/mnt/audio-clips
```

### Update Systemd Service

```bash
sudo cp ~/homemic-node/node/homemic-node.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl restart homemic-node
sudo systemctl status homemic-node
```

### Verify Recording

```bash
# Watch logs
journalctl -u homemic-node -f

# After 10 minutes, check for clips
ls -la /mnt/audio-clips/
# or
ls -la ~/.homemic/clips/
```

---

## 3. Frontend Deployment

### Build for Production

```bash
# On your development machine
cd /Users/Temple/Documents/SelfProjects/SmartMicrophoneSystem
npm run build
```

### Deploy to Web Server

Copy the `dist/` folder to your web server or serve via the backend.

---

## 4. Verification Checklist

- [ ] Server starts without errors
- [ ] Node connects and registers with server
- [ ] First 10-minute clip is recorded
- [ ] Clip is uploaded to server
- [ ] Transcription completes (check logs)
- [ ] Audio plays in frontend
- [ ] Transcript segments sync with playback

---

## Troubleshooting

### Node Not Recording

```bash
# Check audio device
arecord -l

# Test recording manually
arecord -d 10 -f cd test.wav && aplay test.wav
```

### Upload Failing

```bash
# Check server connectivity
curl http://YOUR_SERVER:8420/

# Check pending uploads
ls ~/.homemic/clips/*.wav
```

### Transcription Stuck

```bash
# Check server logs
journalctl -u homemic -n 100

# Check database
sqlite3 /opt/homemic/data/homemic.db "SELECT status, COUNT(*) FROM batch_clips GROUP BY status"
```

---

## Environment Variables Reference

| Variable | Default | Description |
|----------|---------|-------------|
| `HOMEMIC_SERVER` | `http://10.0.0.120:8420` | Backend server URL |
| `HOMEMIC_STORAGE_DIR` | `~/.homemic/clips` | Node local clip storage |
| `HOMEMIC_AUDIO_STORAGE` | `/opt/homemic/data/audio` | Server audio storage |

---

## Quick Commands

```bash
# Server: restart and follow logs
sudo systemctl restart homemic && journalctl -u homemic -f

# Node: restart and follow logs
sudo systemctl restart homemic-node && journalctl -u homemic-node -f

# Check clip count on server
sqlite3 /opt/homemic/data/homemic.db "SELECT COUNT(*) FROM batch_clips"
```
