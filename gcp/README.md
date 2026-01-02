# Deploy HomeMic to Google Cloud Platform

This guide deploys the HomeMic backend to a GCP Compute Engine VM with sufficient resources for Whisper transcription.

## Recommended VM Specs

| Whisper Model | VM Type | vCPU | RAM | Cost/month |
|---------------|---------|------|-----|------------|
| tiny | e2-small | 2 | 2GB | ~$15 |
| **base** | **e2-medium** | 2 | **4GB** | **~$25** |
| small | e2-standard-2 | 2 | 8GB | ~$50 |
| medium | e2-standard-4 | 4 | 16GB | ~$100 |

## Prerequisites

1. [Google Cloud account](https://cloud.google.com/)
2. [gcloud CLI installed](https://cloud.google.com/sdk/docs/install)
3. A GCP project with billing enabled

## Quick Deploy

```bash
# Set your project ID
export GCP_PROJECT_ID="your-project-id"

# Optional: customize zone and instance name
export GCP_ZONE="us-central1-a"
export GCP_INSTANCE_NAME="homemic-server"

# Run deployment
chmod +x gcp/deploy.sh
./gcp/deploy.sh
```

## Manual Deploy

### 1. Create the VM

```bash
gcloud compute instances create homemic-server \
    --zone=us-central1-a \
    --machine-type=e2-medium \
    --image-family=ubuntu-2204-lts \
    --image-project=ubuntu-os-cloud \
    --boot-disk-size=30GB \
    --tags=homemic-server
```

### 2. SSH and Install

```bash
gcloud compute ssh homemic-server --zone=us-central1-a

# On the VM:
sudo apt update && sudo apt install -y python3-pip git ffmpeg
git clone https://github.com/templegit9/home_mic.git
cd home_mic/backend
pip3 install -r requirements.txt
python3 -m uvicorn app.main:app --host 0.0.0.0 --port 8420
```

### 3. Open Firewall

```bash
gcloud compute firewall-rules create allow-homemic \
    --allow=tcp:8420 \
    --target-tags=homemic-server
```

## Update Pi Nodes

Once deployed, update your Pi nodes to point to the GCP server:

```bash
# On each Raspberry Pi
export HOMEMIC_SERVER="http://YOUR_GCP_IP:8420"
```

Or edit `/etc/systemd/system/homemic-node.service` and update the server URL.

## Costs

- **e2-medium VM**: ~$0.034/hour = ~$25/month
- **30GB SSD**: ~$5/month
- **Egress**: First 1GB free, then $0.12/GB

**Total**: ~$30/month for always-on transcription server

## Stop to Save Money

```bash
# Stop VM (no compute charges while stopped)
gcloud compute instances stop homemic-server --zone=us-central1-a

# Start VM
gcloud compute instances start homemic-server --zone=us-central1-a
```
