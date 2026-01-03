"""
System Control Routes
Health checks and log streaming for system monitoring
"""
import os
import asyncio
import logging
from datetime import datetime
from typing import List, Optional
from collections import deque
from pathlib import Path

from fastapi import APIRouter, WebSocket, WebSocketDisconnect, HTTPException
from pydantic import BaseModel

from ..database import get_db, Node

router = APIRouter(prefix="/api/control", tags=["control"])
logger = logging.getLogger(__name__)

# In-memory log buffer for streaming
LOG_BUFFER_SIZE = 500
log_buffer: deque = deque(maxlen=LOG_BUFFER_SIZE)
log_subscribers: List[WebSocket] = []


class LogEntry(BaseModel):
    timestamp: str
    level: str
    source: str
    message: str


class HealthStatus(BaseModel):
    server: dict
    nodes: List[dict]
    overall: str  # "healthy", "degraded", "offline"


class LogHandler(logging.Handler):
    """Custom handler to capture logs for streaming"""
    
    def emit(self, record):
        entry = {
            "timestamp": datetime.now().isoformat(),
            "level": record.levelname,
            "source": record.name,
            "message": record.getMessage()
        }
        log_buffer.append(entry)
        
        # Broadcast to WebSocket subscribers
        asyncio.create_task(broadcast_log(entry))


async def broadcast_log(entry: dict):
    """Send log entry to all connected WebSocket clients"""
    disconnected = []
    for ws in log_subscribers:
        try:
            await ws.send_json(entry)
        except:
            disconnected.append(ws)
    
    # Clean up disconnected clients
    for ws in disconnected:
        if ws in log_subscribers:
            log_subscribers.remove(ws)


# Install log handler on root logger
log_handler = LogHandler()
log_handler.setLevel(logging.INFO)
logging.getLogger().addHandler(log_handler)


@router.get("/health")
async def get_system_health() -> HealthStatus:
    """Check health of server and all registered nodes"""
    db = next(get_db())
    
    try:
        # Server health
        import psutil
        server_status = {
            "status": "online",
            "uptime": int(psutil.boot_time()),
            "cpu_percent": psutil.cpu_percent(),
            "memory_percent": psutil.virtual_memory().percent,
            "disk_percent": psutil.disk_usage('/').percent
        }
        
        # Get all nodes and their status
        nodes = db.query(Node).all()
        node_statuses = []
        
        now = datetime.utcnow()
        online_count = 0
        
        for node in nodes:
            # Consider node online if last_seen within 2 minutes
            is_online = False
            if node.last_seen:
                age_seconds = (now - node.last_seen).total_seconds()
                is_online = age_seconds < 120
            
            if is_online:
                online_count += 1
            
            node_statuses.append({
                "id": node.id,
                "name": node.name,
                "location": node.location,
                "status": "online" if is_online else "offline",
                "last_seen": node.last_seen.isoformat() if node.last_seen else None
            })
        
        # Overall health
        if len(nodes) == 0:
            overall = "degraded"  # No nodes registered
        elif online_count == len(nodes):
            overall = "healthy"
        elif online_count > 0:
            overall = "degraded"
        else:
            overall = "offline"
        
        return HealthStatus(
            server=server_status,
            nodes=node_statuses,
            overall=overall
        )
        
    finally:
        db.close()


@router.get("/logs")
async def get_logs(limit: int = 100) -> List[dict]:
    """Get recent log entries from buffer"""
    logs = list(log_buffer)
    return logs[-limit:] if len(logs) > limit else logs


@router.websocket("/logs/stream")
async def stream_logs(websocket: WebSocket):
    """WebSocket endpoint for live log streaming"""
    await websocket.accept()
    log_subscribers.append(websocket)
    
    logger.info("Log streaming client connected")
    
    try:
        # Send recent logs first
        recent = list(log_buffer)[-50:]
        for entry in recent:
            await websocket.send_json(entry)
        
        # Keep connection alive
        while True:
            try:
                # Wait for ping/pong or disconnect
                data = await asyncio.wait_for(
                    websocket.receive_text(),
                    timeout=30.0
                )
                # Client can send "ping" to keep alive
                if data == "ping":
                    await websocket.send_text("pong")
            except asyncio.TimeoutError:
                # Send heartbeat
                await websocket.send_json({
                    "type": "heartbeat",
                    "timestamp": datetime.now().isoformat()
                })
                
    except WebSocketDisconnect:
        logger.info("Log streaming client disconnected")
    finally:
        if websocket in log_subscribers:
            log_subscribers.remove(websocket)


@router.post("/node/{node_id}/ping")
async def ping_node(node_id: str):
    """Check if a specific node is reachable"""
    db = next(get_db())
    
    try:
        node = db.query(Node).filter(Node.id == node_id).first()
        if not node:
            raise HTTPException(status_code=404, detail="Node not found")
        
        # Check last heartbeat
        now = datetime.utcnow()
        if node.last_seen:
            age = (now - node.last_seen).total_seconds()
            is_online = age < 120
        else:
            is_online = False
        
        return {
            "node_id": node_id,
            "name": node.name,
            "status": "online" if is_online else "offline",
            "last_seen": node.last_seen.isoformat() if node.last_seen else None,
            "age_seconds": int(age) if node.last_seen else None
        }
        
    finally:
        db.close()


# Node configuration for SSH access
# In production, use environment variables or secure storage
NODE_SSH_CONFIG = {
    "hostname": os.environ.get("NODE_SSH_HOST", "10.0.0.28"),
    "username": os.environ.get("NODE_SSH_USER", "homemic-node"),
    # Password-based or key-based auth - configure as needed
}


@router.post("/backend/update")
async def update_backend():
    """Pull latest code and restart backend service"""
    import subprocess
    
    logger.info("Backend update requested from dashboard")
    
    try:
        # Git pull
        result = subprocess.run(
            ["/usr/bin/git", "pull", "origin", "feature/batch-transcription"],
            cwd="/opt/homemic",
            capture_output=True,
            text=True,
            timeout=30
        )
        
        git_output = result.stdout + result.stderr
        logger.info(f"Git pull: {git_output}")
        
        if result.returncode != 0:
            return {
                "success": False,
                "action": "git_pull",
                "error": git_output
            }
        
        # Schedule restart (happens after response is sent)
        asyncio.create_task(restart_backend_service())
        
        return {
            "success": True,
            "action": "update_and_restart",
            "message": "Update pulled, restarting backend...",
            "git_output": git_output.strip()
        }
        
    except subprocess.TimeoutExpired:
        return {"success": False, "error": "Git pull timed out"}
    except Exception as e:
        logger.error(f"Backend update failed: {e}")
        return {"success": False, "error": str(e)}


async def restart_backend_service():
    """Restart the backend service after a brief delay"""
    import subprocess
    
    await asyncio.sleep(1)  # Let response complete
    logger.info("Restarting homemic service...")
    
    try:
        subprocess.run(
            ["/usr/bin/systemctl", "restart", "homemic"],
            timeout=10
        )
    except Exception as e:
        logger.error(f"Service restart failed: {e}")


@router.post("/node/update")
async def update_node():
    """SSH to node and pull updates + restart service"""
    import subprocess
    
    logger.info("Node update requested from dashboard")
    
    hostname = NODE_SSH_CONFIG["hostname"]
    username = NODE_SSH_CONFIG["username"]
    
    # SSH command to update and restart node
    ssh_command = [
        "/usr/bin/ssh", "-o", "StrictHostKeyChecking=no", "-o", "ConnectTimeout=10",
        f"{username}@{hostname}",
        "cd ~/homemic-node && git pull origin feature/batch-transcription && sudo systemctl restart homemic-node"
    ]
    
    try:
        result = subprocess.run(
            ssh_command,
            capture_output=True,
            text=True,
            timeout=60
        )
        
        output = result.stdout + result.stderr
        logger.info(f"Node update result: {output}")
        
        if result.returncode == 0:
            return {
                "success": True,
                "action": "node_update_restart",
                "message": "Node updated and restarted",
                "output": output.strip()
            }
        else:
            return {
                "success": False,
                "error": output.strip() or "SSH command failed"
            }
            
    except subprocess.TimeoutExpired:
        return {"success": False, "error": "SSH connection timed out"}
    except Exception as e:
        logger.error(f"Node update failed: {e}")
        return {"success": False, "error": str(e)}


@router.post("/node/restart")
async def restart_node():
    """SSH to node and restart the service only (no git pull)"""
    import subprocess
    
    logger.info("Node restart requested from dashboard")
    
    hostname = NODE_SSH_CONFIG["hostname"]
    username = NODE_SSH_CONFIG["username"]
    
    ssh_command = [
        "/usr/bin/ssh", "-o", "StrictHostKeyChecking=no", "-o", "ConnectTimeout=10",
        f"{username}@{hostname}",
        "sudo systemctl restart homemic-node"
    ]
    
    try:
        result = subprocess.run(
            ssh_command,
            capture_output=True,
            text=True,
            timeout=30
        )
        
        if result.returncode == 0:
            logger.info("Node restart successful")
            return {
                "success": True,
                "action": "node_restart",
                "message": "Node service restarted"
            }
        else:
            return {
                "success": False,
                "error": result.stderr.strip() or "Restart failed"
            }
            
    except subprocess.TimeoutExpired:
        return {"success": False, "error": "SSH connection timed out"}
    except Exception as e:
        logger.error(f"Node restart failed: {e}")
        return {"success": False, "error": str(e)}

