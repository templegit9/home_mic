# HomeMic Scripts

## Proxmox LXC Setup

### Prerequisites
- Proxmox VE 8.0 or later
- Internet connection for downloading dependencies

### Installation

#### Option 1: Copy script to Proxmox and run
```bash
# From your local machine
scp scripts/homemic-lxc.sh root@YOUR_PROXMOX_IP:/tmp/

# SSH into Proxmox and run
ssh root@YOUR_PROXMOX_IP
bash /tmp/homemic-lxc.sh
```

#### Option 2: Run directly from Proxmox shell
```bash
# Copy content of homemic-lxc.sh to Proxmox shell and execute
```

### What Gets Installed

The script creates an Ubuntu 22.04 LXC container with:

| Component | Details |
|-----------|---------|
| **Container** | 8GB disk, 2 cores, 2GB RAM |
| **Whisper.cpp** | `/opt/whisper.cpp` with small model |
| **Python 3** | Virtual env at `/opt/homemic/venv` |
| **FastAPI** | Placeholder API on port 8420 |
| **Dependencies** | ffmpeg, sqlite3, speechbrain, etc. |

### Post-Installation

After the script completes:

```bash
# Start the HomeMic service
pct exec <CONTAINER_ID> -- systemctl start homemic
pct exec <CONTAINER_ID> -- systemctl enable homemic

# Access the container shell
pct enter <CONTAINER_ID>

# Check the API is running
curl http://<CONTAINER_IP>:8420/
```

### Container Details

- **API URL**: `http://<container-ip>:8420`
- **WebSocket**: `ws://<container-ip>:8420/ws`
- **App Directory**: `/opt/homemic`
- **Whisper**: `/opt/whisper.cpp`
