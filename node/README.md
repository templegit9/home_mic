# HomeMic Node Agent

Audio capture agent for Raspberry Pi 5 that sends audio to the HomeMic server for transcription.

## Quick Install (Raspberry Pi 5)

```bash
curl -fsSL https://raw.githubusercontent.com/templegit9/home_mic/main/node/setup.sh | bash
```

## Manual Setup

### 1. Install Dependencies

```bash
sudo apt-get update
sudo apt-get install -y python3 python3-pip python3-venv python3-pyaudio portaudio19-dev
```

### 2. Clone Repository

```bash
cd ~
git clone https://github.com/templegit9/home_mic.git homemic-node
cd homemic-node/node
```

### 3. Create Virtual Environment

```bash
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
```

### 4. Configure

Edit `config.py` and set your server IP:

```python
SERVER_URL = "http://10.0.0.120:8420"  # Your HomeMic server
NODE_NAME = "Living Room"
NODE_LOCATION = "Living Room"
```

### 5. Test

```bash
# List available audio devices
python agent.py --list-devices

# Run the agent
python agent.py
```

### 6. Enable Automatic Startup

```bash
sudo systemctl enable homemic-node
sudo systemctl start homemic-node
```

## Command Line Options

```
python agent.py [options]

Options:
  --server, -s    HomeMic server URL (default: from config.py)
  --name, -n      Node name (default: from config.py)
  --location, -l  Node location (default: from config.py)
  --list-devices  List available audio input devices
```

## Troubleshooting

### No audio devices found

```bash
# Check if USB microphone is connected
lsusb

# Check ALSA devices
arecord -l
```

### Permission denied for audio

```bash
# Add user to audio group
sudo usermod -a -G audio $USER
# Logout and login again
```

### Check service logs

```bash
journalctl -u homemic-node -f
```
