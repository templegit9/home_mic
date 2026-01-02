#!/bin/bash
# HomeMic LXC Install Script
# Run this from the Proxmox shell

echo "Downloading and running HomeMic LXC setup script..."

# For local testing, copy the script to Proxmox:
# scp scripts/homemic-lxc.sh root@YOUR_PROXMOX_IP:/tmp/
# ssh root@YOUR_PROXMOX_IP bash /tmp/homemic-lxc.sh

# For production (once hosted on GitHub):
# bash -c "$(wget -qLO - https://raw.githubusercontent.com/YOUR_REPO/main/scripts/homemic-lxc.sh)"

bash "$(dirname "$0")/homemic-lxc.sh"
