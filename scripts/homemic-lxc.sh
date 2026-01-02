#!/usr/bin/env bash

# HomeMic LXC Container Setup Script for Proxmox VE
# Inspired by tteck/Proxmox helper scripts format
# Run from Proxmox shell: bash -c "$(wget -qLO - https://raw.githubusercontent.com/YOUR_REPO/homemic-lxc.sh)"

set -euo pipefail
shopt -s expand_aliases
alias die='EXIT=$? LINE=$LINENO error_exit'
trap die ERR

# ============================================================================
# CONFIGURATION
# ============================================================================
APP="HomeMic"
NSAPP=$(echo ${APP,,} | tr -d ' ')
var_disk="8"
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
  if ! pveversion | grep -Eq "pve-manager/8\.[0-9]"; then
    msg_error "This version of Proxmox VE is not supported."
    echo -e "Requires Proxmox VE 8.0 or later."
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
  if ! pveam list $TEMPLATE_STORAGE | grep -q "$TEMPLATE"; then
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
    ffmpeg \
    python3 \
    python3-pip \
    python3-venv \
    sqlite3 \
    supervisor"
  msg_ok "Installed base dependencies"
  
  msg_info "Installing whisper.cpp"
  pct exec $CT_ID -- bash -c "
    cd /opt
    git clone https://github.com/ggerganov/whisper.cpp.git
    cd whisper.cpp
    make -j\$(nproc)
    bash ./models/download-ggml-model.sh small
  "
  msg_ok "Installed whisper.cpp with small model"
  
  msg_info "Creating HomeMic application directory"
  pct exec $CT_ID -- bash -c "
    mkdir -p /opt/homemic/{data,logs,config}
    cd /opt/homemic
    python3 -m venv venv
    source venv/bin/activate
    pip install --upgrade pip
    pip install \
      fastapi[all] \
      uvicorn \
      websockets \
      python-multipart \
      aiofiles \
      sqlalchemy \
      speechbrain \
      torchaudio \
      numpy \
      scipy
  "
  msg_ok "Created HomeMic application directory"
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
WorkingDirectory=/opt/homemic
Environment=PATH=/opt/homemic/venv/bin:/usr/local/bin:/usr/bin:/bin
ExecStart=/opt/homemic/venv/bin/uvicorn app.main:app --host 0.0.0.0 --port 8420
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
SERVICEEOF
systemctl daemon-reload
"
  msg_ok "Created HomeMic systemd service"
}

function create_placeholder_app() {
  msg_info "Creating placeholder application"
  pct exec $CT_ID -- bash -c "
    mkdir -p /opt/homemic/app
    cat > /opt/homemic/app/__init__.py << 'EOF'
EOF

    cat > /opt/homemic/app/main.py << 'EOF'
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from datetime import datetime
import asyncio
import json

app = FastAPI(
    title=\"HomeMic API\",
    description=\"Privacy-First Smart Microphone System\",
    version=\"0.1.0\"
)

# CORS for React frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=[\"*\"],
    allow_credentials=True,
    allow_methods=[\"*\"],
    allow_headers=[\"*\"],
)

# Store active WebSocket connections
active_connections: list[WebSocket] = []

@app.get(\"/\")
def root():
    return {
        \"name\": \"HomeMic\",
        \"status\": \"running\",
        \"version\": \"0.1.0\",
        \"timestamp\": datetime.now().isoformat()
    }

@app.get(\"/api/status\")
def get_status():
    return {
        \"uptime\": 0,
        \"cpuUsage\": 0,
        \"memoryUsage\": 0,
        \"diskUsage\": 0,
        \"transcriptionLatency\": 0,
        \"speakerAccuracy\": 0,
        \"activeNodes\": 0,
        \"totalNodes\": 0,
    }

@app.get(\"/api/nodes\")
def get_nodes():
    return []

@app.get(\"/api/speakers\")
def get_speakers():
    return []

@app.get(\"/api/transcriptions\")
def get_transcriptions():
    return []

@app.websocket(\"/ws\")
async def websocket_endpoint(websocket: WebSocket):
    await websocket.accept()
    active_connections.append(websocket)
    try:
        while True:
            data = await websocket.receive_text()
            # Echo back for now - will be replaced with real transcription
            await websocket.send_text(json.dumps({
                \"type\": \"transcription\",
                \"data\": {
                    \"text\": data,
                    \"timestamp\": datetime.now().isoformat()
                }
            }))
    except WebSocketDisconnect:
        active_connections.remove(websocket)

if __name__ == \"__main__\":
    import uvicorn
    uvicorn.run(app, host=\"0.0.0.0\", port=8420)
EOF
"
  msg_ok "Created placeholder application"
}

function show_completion() {
  local IP=$(pct exec $CT_ID -- hostname -I | awk '{print $1}')
  
  echo ""
  echo -e "${GN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${CL}"
  echo -e "${GN}               HomeMic LXC Container Created Successfully!              ${CL}"
  echo -e "${GN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${CL}"
  echo ""
  echo -e "${YW}Container ID:${CL} ${CT_ID}"
  echo -e "${YW}Container IP:${CL} ${IP}"
  echo -e "${YW}API URL:${CL}      http://${IP}:8420"
  echo -e "${YW}WebSocket:${CL}    ws://${IP}:8420/ws"
  echo ""
  echo -e "${YW}Whisper.cpp:${CL}  /opt/whisper.cpp (small model)"
  echo -e "${YW}App Dir:${CL}      /opt/homemic"
  echo ""
  echo -e "${BL}To start the service:${CL}"
  echo -e "  pct exec ${CT_ID} -- systemctl start homemic"
  echo -e "  pct exec ${CT_ID} -- systemctl enable homemic"
  echo ""
  echo -e "${BL}To access the container shell:${CL}"
  echo -e "  pct enter ${CT_ID}"
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
  create_placeholder_app
  create_service
  show_completion
}

main "$@"
