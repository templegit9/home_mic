# Batch Transcription Deployment Guide

Deploy the batch transcription feature to your Proxmox server and Raspberry Pi nodes.

---

## Prerequisites

- Proxmox server running (or GCP e2-medium)
- Raspberry Pi 5 with USB microphone
- External storage mounted (for audio files)
- Git access to the repository

---

## 1. Server Deployment (Proxmox/GCP)

### Pull the Latest Code

```bash
ssh user@your-server
cd /opt/homemic
git fetch origin
git checkout feature/batch-transcription
git pull origin feature/batch-transcription
```

### Configure External Storage (Optional)

If using external storage for audio files:

```bash
# Mount external drive (example: /mnt/audio-storage)
sudo mkdir -p /mnt/audio-storage
sudo mount /dev/sdb1 /mnt/audio-storage

# Set environment variable
echo 'HOMEMIC_AUDIO_STORAGE=/mnt/audio-storage/homemic' | sudo tee -a /etc/environment
```

### Install/Update Dependencies

```bash
cd /opt/homemic/backend
pip3 install -r requirements.txt
```

### Migrate Database

The new `batch_clips` and `transcript_segments` tables will be created automatically on first startup.

### Restart Backend Service

```bash
sudo systemctl restart homemic
sudo systemctl status homemic

# Check logs
journalctl -u homemic -f
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
git fetch origin
git checkout feature/batch-transcription
git pull origin feature/batch-transcription
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
