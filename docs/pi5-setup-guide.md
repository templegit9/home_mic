# Raspberry Pi 5 Fresh Setup Guide for HomeMic

Complete guide to set up a fresh Raspberry Pi 5 as a HomeMic audio node.

---

## What You Need

- Raspberry Pi 5 (any RAM size)
- MicroSD card (32GB+ recommended)
- USB-C power supply (27W/5.1V 5A recommended)
- USB microphone
- Ethernet cable or WiFi access
- Another computer to flash the SD card

---

## Step 1: Flash Raspberry Pi OS

### On Your Computer (Mac/Windows/Linux)

1. **Download Raspberry Pi Imager**
   - https://www.raspberrypi.com/software/

2. **Insert your MicroSD card**

3. **Open Raspberry Pi Imager and configure:**
   - **Device**: Raspberry Pi 5
   - **OS**: Raspberry Pi OS (64-bit) — the default Debian-based
   - **Storage**: Your SD card

4. **Click the gear icon (⚙️) for settings:**
   - ✅ Set hostname: `homemic-node`
   - ✅ Enable SSH (Use password authentication)
   - ✅ Set username: `pi`
   - ✅ Set password: `your-secure-password`
   - ✅ Configure WiFi (if not using Ethernet):
     - SSID: `your-wifi-name`
     - Password: `your-wifi-password`
     - Country: `US` (or your country)
   - ✅ Set locale: Your timezone

5. **Click "Write"** and wait for it to finish

---

## Step 2: First Boot

1. **Insert the SD card** into the Pi 5
2. **Connect USB microphone**
3. **Connect Ethernet** (or WiFi will connect automatically)
4. **Connect power**
5. **Wait 2-3 minutes** for first boot

---

## Step 3: Find Your Pi's IP Address

### Option A: From your router
Check your router's admin page for a device named `homemic-node`

### Option B: From your Mac
```bash
# Scan local network
arp -a | grep -i "raspberry\|homemic"

# Or use ping
ping homemic-node.local
```

### Option C: Connect a monitor temporarily
```bash
hostname -I
```

---

## Step 4: SSH Into Your Pi

From your Mac Terminal:

```bash
ssh pi@YOUR_PI_IP
# Or if mDNS works:
ssh pi@homemic-node.local
```

Enter the password you set in Step 1.

---

## Step 5: Update the System

```bash
sudo apt update && sudo apt upgrade -y
sudo reboot
```

Wait 1 minute, then SSH back in.

---

## Step 6: Install HomeMic Node Agent

Run the automated installer:

```bash
curl -fsSL https://raw.githubusercontent.com/templegit9/home_mic/main/node/setup.sh | bash
```

This installs:
- Python 3 + virtual environment
- PyAudio and audio dependencies
- HomeMic node agent
- Systemd service

---

## Step 7: Configure the Agent

Edit the config file:

```bash
nano ~/homemic-node/node/config.py
```

Change these lines:

```python
SERVER_URL = "http://10.0.0.120:8420"  # Your HomeMic server IP
NODE_NAME = "Living Room"              # Name for this node
NODE_LOCATION = "Living Room"          # Location description
```

Save: `Ctrl+O`, `Enter`, `Ctrl+X`

---

## Step 8: Test the USB Microphone

```bash
# Check if USB mic is detected
lsusb

# List ALSA audio devices
arecord -l

# Test recording (5 seconds)
arecord -d 5 -f cd test.wav
aplay test.wav
rm test.wav
```

If you don't see your USB mic, try unplugging and replugging it.

---

## Step 9: Test the Agent Manually

```bash
cd ~/homemic-node/node
source venv/bin/activate

# List detected audio devices
python agent.py --list-devices

# Run the agent (Ctrl+C to stop)
python agent.py
```

You should see:
```
HomeMic Node Agent starting...
Server: http://10.0.0.120:8420
Node: Living Room (Living Room)
Registered with node ID: xxxxxxxx-xxxx-xxxx-xxxx
Agent running. Press Ctrl+C to stop.
```

Speak into the microphone — you should see transcriptions appear!

---

## Step 10: Enable Auto-Start

```bash
sudo systemctl enable homemic-node
sudo systemctl start homemic-node
```

Check status:
```bash
sudo systemctl status homemic-node
```

View live logs:
```bash
journalctl -u homemic-node -f
```

---

## Troubleshooting

### "No audio input device found"

```bash
# Check USB devices
lsusb

# Check ALSA devices
arecord -l

# Make sure user is in audio group
sudo usermod -a -G audio pi
# Then logout and login again
```

### "Server unreachable"

```bash
# Test server connectivity
curl http://10.0.0.120:8420/

# Check Pi's network
ping 10.0.0.120
```

### Agent crashes on startup

```bash
# Check logs
journalctl -u homemic-node -n 50

# Run manually to see errors
cd ~/homemic-node/node
source venv/bin/activate
python agent.py
```

### Low audio quality

Edit `~/homemic-node/node/config.py`:
```python
SILENCE_THRESHOLD = 300  # Lower = more sensitive (default 500)
CHUNK_DURATION = 5.0     # Longer chunks = better transcription quality
```

---

## Optional: Headless Setup Tips

### Set Static IP (if needed)

```bash
sudo nano /etc/dhcpcd.conf
```

Add at the bottom:
```
interface eth0
static ip_address=10.0.0.150/24
static routers=10.0.0.1
static domain_name_servers=10.0.0.1
```

### Enable VNC (remote desktop)

```bash
sudo raspi-config
# → Interface Options → VNC → Enable
```

---

## Summary

Your Pi 5 is now:
- ✅ Running Raspberry Pi OS
- ✅ HomeMic node agent installed
- ✅ Connected to your HomeMic server
- ✅ Auto-starting on boot
- ✅ Capturing and transcribing audio!
