#!/bin/bash
# Helper script to Switch Raspberry Pi Node to Cloud Server
# Run this on your Raspberry Pi

CLOUD_IP="35.224.111.227"
CLOUD_URL="http://${CLOUD_IP}:8420"
SERVICE_FILE="/etc/systemd/system/homemic-node.service"

echo "=== Switching HomeMic Node to Cloud Server ==="
echo "New Server URL: $CLOUD_URL"

# 1. Update systemd service if it exists
if [ -f "$SERVICE_FILE" ]; then
    echo "Updating systemd service..."
    
    # Check if Environment line exists
    if grep -q "Environment=\"HOMEMIC_SERVER=" "$SERVICE_FILE"; then
        # Replace existing entry
        sudo sed -i "s|Environment=\"HOMEMIC_SERVER=.*\"|Environment=\"HOMEMIC_SERVER=$CLOUD_URL\"|g" "$SERVICE_FILE"
    else
        # Add new entry after [Service]
        sudo sed -i "/\[Service\]/a Environment=\"HOMEMIC_SERVER=$CLOUD_URL\"" "$SERVICE_FILE"
    fi
    
    echo "Reloading systemd..."
    sudo systemctl daemon-reload
    sudo systemctl restart homemic-node
    echo "✅ Service restarted pointing to cloud!"
    
    # Check status
    sudo systemctl status homemic-node --no-pager | head -n 10

else
    echo "⚠️ Systemd service file not found at $SERVICE_FILE"
    echo "If you are running the agent manually, restart with a command like:"
    echo ""
    echo "export HOMEMIC_SERVER=\"$CLOUD_URL\""
    echo "python3 agent.py"
fi
