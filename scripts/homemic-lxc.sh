#!/usr/bin/env bash

# HomeMic LXC Container Setup Script for Proxmox VE
# Inspired by tteck/Proxmox helper scripts format
# Run from Proxmox shell: bash -c "$(curl -fsSL https://raw.githubusercontent.com/templegit9/home_mic/main/scripts/homemic-lxc.sh)"

set -euo pipefail
shopt -s expand_aliases
alias die='EXIT=$? LINE=$LINENO error_exit'
trap die ERR

# ============================================================================
# CONFIGURATION
# ============================================================================
APP="HomeMic"
NSAPP=$(echo ${APP,,} | tr -d ' ')
GITHUB_REPO="https://github.com/templegit9/home_mic.git"

var_disk="16"
var_cpu="2"
var_ram="2048"
var_os="ubuntu"
var_version="22.04"
var_unprivileged="1"

# Colors
YW=$(echo "\033[33m")
BL=$(echo "\033[36m")
RD=$(echo "\033[01;31m")
BGN=$(echo "\033[4;92m")
GN=$(echo "\033[1;92m")
DGN=$(echo "\033[32m")
CL=$(echo "\033[m")
CM="${GN}✓${CL}"
CROSS="${RD}✗${CL}"
BFR="\\r\\033[K"
HOLD=" "

# ============================================================================
# HELPER FUNCTIONS
# ============================================================================
function msg_info() {
  local msg="$1"
  echo -ne " ${HOLD} ${YW}${msg}..."
}

function msg_ok() {
  local msg="$1"
  echo -e "${BFR} ${CM} ${GN}${msg}${CL}"
}

function msg_error() {
  local msg="$1"
  echo -e "${BFR} ${CROSS} ${RD}${msg}${CL}"
}

function error_exit() {
  trap - ERR
  local reason="Unknown failure occurred."
  local msg="${1:-$reason}"
  local flag="${RD}‼ ERROR ${CL}$EXIT@$LINE"
  echo -e "$flag $msg" 1>&2
  exit $EXIT
}

function check_root() {
  if [[ "$(id -u)" -ne 0 || $(ps -o comm= -p $PPID) == "sudo" ]]; then
    clear
    msg_error "Please run this script as root."
    echo -e "\nExiting..."
    sleep 2
    exit
  fi
}

function pve_check() {
  if ! pveversion | grep -Eq "pve-manager/(7|8)\.[0-9]"; then
    msg_error "This version of Proxmox VE is not supported."
    echo -e "Requires Proxmox VE 7.0 or later."
    echo -e "Exiting..."
    sleep 2
    exit
  fi
}

function arch_check() {
  if [ "$(dpkg --print-architecture)" != "amd64" ]; then
    msg_error "This script only supports AMD64 architecture."
    echo -e "Exiting..."
    sleep 2
    exit
  fi
}

function header_info() {
  clear
  cat <<"EOF"
    __  __                     __  ____     
   / / / /___  ____ ___  ___  /  |/  (_)____
  / /_/ / __ \/ __ `__ \/ _ \/ /|_/ / / ___/
 / __  / /_/ / / / / / /  __/ /  / / / /__  
/_/ /_/\____/_/ /_/ /_/\___/_/  /_/_/\___/  
                                            
     Privacy-First Smart Microphone System
EOF
}

function default_settings() {
  CT_TYPE="1"
  PASSWORD=""
  CT_ID=$(pvesh get /cluster/nextid)
  HN="$NSAPP"
  DISK_SIZE="$var_disk"
  CORE_COUNT="$var_cpu"
  RAM_SIZE="$var_ram"
  BRG="vmbr0"
  NET="dhcp"
  GATE=""
  APT_CACHER=""
  APT_CACHER_IP=""
  DISABLEIP6="no"
  MTU=""
  SD=""
  NS=""
  MAC=""
  VLAN=""
  SSH="no"
  VERB="no"
  echo_default
}

function echo_default() {
  echo -e "${DGN}Using Container Type: ${BGN}Unprivileged${CL}"
  echo -e "${DGN}Using Container ID: ${BGN}${CT_ID}${CL}"
  echo -e "${DGN}Using Hostname: ${BGN}${HN}${CL}"
  echo -e "${DGN}Using Disk Size: ${BGN}${DISK_SIZE}GB${CL}"
  echo -e "${DGN}Using CPU Cores: ${BGN}${CORE_COUNT}${CL}"
  echo -e "${DGN}Using RAM: ${BGN}${RAM_SIZE}MB${CL}"
  echo -e "${DGN}Using Bridge: ${BGN}${BRG}${CL}"
  echo -e "${DGN}Using Network: ${BGN}DHCP${CL}"
  echo -e "${DGN}Using SSH: ${BGN}No${CL}"
  echo -e "${BL}Creating ${APP} LXC using above default settings${CL}"
}

# ============================================================================
# MAIN INSTALLATION FUNCTIONS
# ============================================================================
function build_container() {
  msg_info "Getting Ubuntu Template"
  
  local TEMPLATE="ubuntu-22.04-standard_22.04-1_amd64.tar.zst"
  local TEMPLATE_STORAGE="local"
  
  # Check if template exists, download if not
  if ! pveam list $TEMPLATE_STORAGE | grep -q "ubuntu-22.04"; then
    pveam update
    pveam download $TEMPLATE_STORAGE $TEMPLATE
  fi
  msg_ok "Got Ubuntu Template"
  
  msg_info "Creating LXC Container"
  
  pct create $CT_ID ${TEMPLATE_STORAGE}:vztmpl/${TEMPLATE} \
    --hostname $HN \
    --memory $RAM_SIZE \
    --cores $CORE_COUNT \
    --rootfs local-lvm:${DISK_SIZE} \
    --net0 name=eth0,bridge=${BRG},ip=${NET} \
    --unprivileged $CT_TYPE \
    --features nesting=1 \
    --onboot 1 \
    --start 1
  
  msg_ok "Created LXC Container ${CT_ID}"
}

function install_dependencies() {
  msg_info "Waiting for container to start"
  sleep 5
  msg_ok "Container is running"
  
  msg_info "Updating container OS"
  pct exec $CT_ID -- bash -c "apt-get update && apt-get upgrade -y"
  msg_ok "Updated container OS"
  
  msg_info "Installing base dependencies"
  pct exec $CT_ID -- bash -c "apt-get install -y \
    curl \
    git \
    wget \
    build-essential \
    cmake \
    ffmpeg \
    python3 \
    python3-pip \
    python3-venv \
    sqlite3 \
    supervisor"
  msg_ok "Installed base dependencies"
}

function install_whisper() {
  msg_info "Installing whisper.cpp (this may take a few minutes)"
  pct exec $CT_ID -- bash -c "
    cd /opt
    git clone https://github.com/ggerganov/whisper.cpp.git
    cd whisper.cpp
    make -j\$(nproc)
    bash ./models/download-ggml-model.sh small
  "
  msg_ok "Installed whisper.cpp with small model"
}

function install_homemic() {
  msg_info "Cloning HomeMic repository"
  pct exec $CT_ID -- bash -c "
    cd /opt
    git clone ${GITHUB_REPO} homemic
  "
  msg_ok "Cloned HomeMic repository"
  
  msg_info "Creating Python virtual environment"
  pct exec $CT_ID -- bash -c "
    cd /opt/homemic/backend
    python3 -m venv venv
    source venv/bin/activate
    pip install --upgrade pip wheel
  "
  msg_ok "Created Python virtual environment"
  
  msg_info "Installing Python dependencies (this may take several minutes)"
  pct exec $CT_ID -- bash -c "
    cd /opt/homemic/backend
    source venv/bin/activate
    pip install -r requirements.txt
  "
  msg_ok "Installed Python dependencies"
  
  msg_info "Creating data directories"
  pct exec $CT_ID -- bash -c "
    mkdir -p /opt/homemic/data
    mkdir -p /opt/homemic/logs
    mkdir -p /opt/homemic/models
  "
  msg_ok "Created data directories"
}

function create_service() {
  msg_info "Creating HomeMic systemd service"
  pct exec $CT_ID -- bash -c "cat > /etc/systemd/system/homemic.service << 'SERVICEEOF'
[Unit]
Description=HomeMic Smart Microphone Server
After=network.target

[Service]
Type=simple
User=root
WorkingDirectory=/opt/homemic/backend
Environment=PATH=/opt/homemic/backend/venv/bin:/usr/local/bin:/usr/bin:/bin
ExecStart=/opt/homemic/backend/venv/bin/uvicorn app.main:app --host 0.0.0.0 --port 8420
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
SERVICEEOF
systemctl daemon-reload
systemctl enable homemic
systemctl start homemic
"
  msg_ok "Created and started HomeMic service"
}

function create_update_script() {
  msg_info "Creating update script"
  pct exec $CT_ID -- bash -c "cat > /opt/homemic/update.sh << 'UPDATEEOF'
#!/bin/bash
# HomeMic Update Script
cd /opt/homemic
git pull origin main
cd backend
source venv/bin/activate
pip install -r requirements.txt
systemctl restart homemic
echo 'HomeMic updated successfully!'
UPDATEEOF
chmod +x /opt/homemic/update.sh
"
  msg_ok "Created update script"
}

function show_completion() {
  # Wait for service to start
  sleep 3
  
  local IP=$(pct exec $CT_ID -- hostname -I | awk '{print $1}')
  
  echo ""
  echo -e "${GN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${CL}"
  echo -e "${GN}               HomeMic LXC Container Created Successfully!              ${CL}"
  echo -e "${GN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${CL}"
  echo ""
  echo -e "${YW}Container ID:${CL}   ${CT_ID}"
  echo -e "${YW}Container IP:${CL}   ${IP}"
  echo ""
  echo -e "${YW}API URL:${CL}        http://${IP}:8420"
  echo -e "${YW}API Docs:${CL}       http://${IP}:8420/docs"
  echo -e "${YW}WebSocket:${CL}      ws://${IP}:8420/ws"
  echo ""
  echo -e "${YW}Whisper.cpp:${CL}    /opt/whisper.cpp (small model)"
  echo -e "${YW}App Directory:${CL}  /opt/homemic"
  echo -e "${YW}Database:${CL}       /opt/homemic/data/homemic.db"
  echo ""
  echo -e "${BL}Management Commands:${CL}"
  echo -e "  pct enter ${CT_ID}                    # Access container shell"
  echo -e "  pct exec ${CT_ID} -- systemctl status homemic  # Check service status"
  echo -e "  pct exec ${CT_ID} -- /opt/homemic/update.sh    # Update HomeMic"
  echo ""
  echo -e "${BL}API Endpoints:${CL}"
  echo -e "  GET  /api/nodes          - List microphone nodes"
  echo -e "  GET  /api/speakers       - List enrolled speakers"
  echo -e "  GET  /api/transcriptions - Get transcription history"
  echo -e "  POST /api/transcriptions/ingest - Submit audio for transcription"
  echo -e "  GET  /api/status         - System metrics"
  echo -e "  WS   /ws                 - Real-time transcription feed"
  echo ""
  echo -e "${GN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${CL}"
}

# ============================================================================
# MAIN EXECUTION
# ============================================================================
function main() {
  header_info
  check_root
  pve_check
  arch_check
  
  echo ""
  echo -e "${BL}This script will create a ${APP} LXC container on Proxmox VE.${CL}"
  echo -e "${BL}Includes: whisper.cpp, FastAPI backend, speaker identification${CL}"
  echo ""
  
  # Prompt for settings
  while true; do
    read -p "Use default settings? (y/n): " yn
    case $yn in
      [Yy]* ) 
        default_settings
        break
        ;;
      [Nn]* )
        echo -e "${YW}Advanced settings not yet implemented. Using defaults.${CL}"
        default_settings
        break
        ;;
      * )
        echo "Please answer yes or no."
        ;;
    esac
  done
  
  echo ""
  read -p "Press Enter to create the container, or Ctrl+C to cancel..."
  
  build_container
  install_dependencies
  install_whisper
  install_homemic
  create_service
  create_update_script
  show_completion
}

main "$@"
