#!/bin/bash
# HomeMic GCP Deployment Script
# Creates a Compute Engine VM and deploys the HomeMic backend

set -e

# Configuration (customize these)
PROJECT_ID="${GCP_PROJECT_ID:-your-project-id}"
ZONE="${GCP_ZONE:-us-central1-a}"
INSTANCE_NAME="${GCP_INSTANCE_NAME:-homemic-server}"
MACHINE_TYPE="${GCP_MACHINE_TYPE:-e2-medium}"  # 2 vCPU, 4GB RAM

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo -e "${GREEN}HomeMic GCP Deployment${NC}"
echo "================================"

# Check gcloud is installed
if ! command -v gcloud &> /dev/null; then
    echo -e "${RED}Error: gcloud CLI not found. Install from: https://cloud.google.com/sdk/docs/install${NC}"
    exit 1
fi

# Check authentication
if ! gcloud auth list --filter=status:ACTIVE --format="value(account)" | head -1 > /dev/null 2>&1; then
    echo -e "${YELLOW}Not authenticated. Running gcloud auth login...${NC}"
    gcloud auth login
fi

# Set project
echo -e "${YELLOW}Setting project to: ${PROJECT_ID}${NC}"
gcloud config set project "$PROJECT_ID"

# Enable required APIs
echo -e "${YELLOW}Enabling required APIs...${NC}"
gcloud services enable compute.googleapis.com

# Check if instance exists
if gcloud compute instances describe "$INSTANCE_NAME" --zone="$ZONE" &> /dev/null; then
    echo -e "${YELLOW}Instance $INSTANCE_NAME already exists.${NC}"
    read -p "Delete and recreate? (y/N): " confirm
    if [[ "$confirm" == "y" || "$confirm" == "Y" ]]; then
        gcloud compute instances delete "$INSTANCE_NAME" --zone="$ZONE" --quiet
    else
        echo "Exiting."
        exit 0
    fi
fi

# Create the VM
echo -e "${GREEN}Creating VM: $INSTANCE_NAME ($MACHINE_TYPE)${NC}"
gcloud compute instances create "$INSTANCE_NAME" \
    --zone="$ZONE" \
    --machine-type="$MACHINE_TYPE" \
    --image-family=ubuntu-2204-lts \
    --image-project=ubuntu-os-cloud \
    --boot-disk-size=30GB \
    --boot-disk-type=pd-ssd \
    --tags=homemic-server,http-server \
    --metadata-from-file=startup-script=gcp/startup-script.sh

# Create firewall rule for HomeMic port
echo -e "${YELLOW}Creating firewall rule for port 8420...${NC}"
gcloud compute firewall-rules create allow-homemic \
    --allow=tcp:8420 \
    --target-tags=homemic-server \
    --description="Allow HomeMic dashboard access" \
    --quiet 2>/dev/null || echo "Firewall rule already exists"

# Get external IP
EXTERNAL_IP=$(gcloud compute instances describe "$INSTANCE_NAME" \
    --zone="$ZONE" \
    --format='get(networkInterfaces[0].accessConfigs[0].natIP)')

echo ""
echo -e "${GREEN}================================${NC}"
echo -e "${GREEN}Deployment complete!${NC}"
echo -e "${GREEN}================================${NC}"
echo ""
echo -e "Instance:    ${YELLOW}$INSTANCE_NAME${NC}"
echo -e "Zone:        ${YELLOW}$ZONE${NC}"
echo -e "External IP: ${YELLOW}$EXTERNAL_IP${NC}"
echo ""
echo -e "HomeMic will be available at: ${GREEN}http://$EXTERNAL_IP:8420${NC}"
echo ""
echo -e "${YELLOW}Note: It may take 2-3 minutes for the startup script to complete.${NC}"
echo -e "Check status with: gcloud compute ssh $INSTANCE_NAME --zone=$ZONE -- 'sudo journalctl -u homemic -f'"
