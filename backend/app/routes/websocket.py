"""
WebSocket handler for real-time transcription streaming
"""
from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Depends
from sqlalchemy.orm import Session
from typing import List, Dict, Any
import asyncio
import json
import logging
from datetime import datetime

from ..database import get_db, SessionLocal, Transcription, Node, Speaker

logger = logging.getLogger(__name__)

router = APIRouter()


class ConnectionManager:
    """Manages WebSocket connections for real-time updates"""
    
    def __init__(self):
        self.active_connections: List[WebSocket] = []
        self.node_connections: Dict[str, WebSocket] = {}  # node_id -> WebSocket
    
    async def connect(self, websocket: WebSocket, client_type: str = "dashboard"):
        """Accept a new WebSocket connection"""
        await websocket.accept()
        self.active_connections.append(websocket)
        logger.info(f"New {client_type} WebSocket connection. Total: {len(self.active_connections)}")
    
    async def connect_node(self, websocket: WebSocket, node_id: str):
        """Accept a WebSocket connection from a microphone node"""
        await websocket.accept()
        self.node_connections[node_id] = websocket
        self.active_connections.append(websocket)
        logger.info(f"Node {node_id} connected via WebSocket")
    
    def disconnect(self, websocket: WebSocket):
        """Remove a WebSocket connection"""
        if websocket in self.active_connections:
            self.active_connections.remove(websocket)
        # Remove from node connections if present
        for node_id, ws in list(self.node_connections.items()):
            if ws == websocket:
                del self.node_connections[node_id]
                logger.info(f"Node {node_id} disconnected")
                break
        logger.info(f"WebSocket disconnected. Total: {len(self.active_connections)}")
    
    async def broadcast(self, message: Dict[str, Any]):
        """Send a message to all connected dashboard clients"""
        disconnected = []
        for connection in self.active_connections:
            if connection not in self.node_connections.values():
                try:
                    await connection.send_json(message)
                except Exception as e:
                    logger.error(f"Error broadcasting: {e}")
                    disconnected.append(connection)
        
        # Clean up disconnected clients
        for conn in disconnected:
            self.disconnect(conn)
    
    async def send_to_node(self, node_id: str, message: Dict[str, Any]):
        """Send a message to a specific node"""
        if node_id in self.node_connections:
            try:
                await self.node_connections[node_id].send_json(message)
            except Exception as e:
                logger.error(f"Error sending to node {node_id}: {e}")


# Global connection manager
manager = ConnectionManager()


def get_manager() -> ConnectionManager:
    """Get the connection manager instance"""
    return manager


@router.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    """
    Main WebSocket endpoint for dashboard clients.
    Receives real-time transcription updates.
    """
    await manager.connect(websocket, "dashboard")
    
    try:
        # Send initial state
        db = SessionLocal()
        try:
            # Get recent transcriptions
            recent = db.query(Transcription).order_by(
                Transcription.timestamp.desc()
            ).limit(20).all()
            
            transcriptions = []
            for t in recent:
                transcriptions.append({
                    "id": t.id,
                    "text": t.text,
                    "speaker_id": t.speaker_id,
                    "speaker_name": t.speaker.name if t.speaker else None,
                    "node_id": t.node_id,
                    "node_name": t.node.location if t.node else None,
                    "confidence": t.confidence,
                    "timestamp": t.timestamp.isoformat()
                })
            
            await websocket.send_json({
                "type": "initial_state",
                "transcriptions": transcriptions
            })
        finally:
            db.close()
        
        # Keep connection alive and handle incoming messages
        while True:
            try:
                data = await asyncio.wait_for(websocket.receive_text(), timeout=30.0)
                message = json.loads(data)
                
                # Handle ping/pong for keepalive
                if message.get("type") == "ping":
                    await websocket.send_json({"type": "pong"})
                
            except asyncio.TimeoutError:
                # Send keepalive ping
                try:
                    await websocket.send_json({"type": "ping"})
                except:
                    break
                    
    except WebSocketDisconnect:
        manager.disconnect(websocket)
    except Exception as e:
        logger.error(f"WebSocket error: {e}")
        manager.disconnect(websocket)


@router.websocket("/ws/node/{node_id}")
async def node_websocket_endpoint(websocket: WebSocket, node_id: str):
    """
    WebSocket endpoint for microphone nodes.
    Nodes send audio data and receive commands.
    """
    await manager.connect_node(websocket, node_id)
    
    # Update node status in database
    db = SessionLocal()
    try:
        node = db.query(Node).filter(Node.id == node_id).first()
        if node:
            node.status = "online"
            node.last_seen = datetime.utcnow()
            db.commit()
    finally:
        db.close()
    
    try:
        while True:
            # Receive data from node
            data = await websocket.receive_bytes()
            
            # Process audio data
            # This is handled by the transcription service
            from ..services import get_transcription_service, get_speaker_service, AudioProcessor
            
            # Check for speech
            if not AudioProcessor.is_speech(data):
                continue
            
            # Transcribe
            transcription_service = get_transcription_service()
            text, confidence = transcription_service.transcribe_audio(data)
            
            if not text:
                continue
            
            # Get database session
            db = SessionLocal()
            try:
                # Identify speaker
                speaker_id = None
                speakers = db.query(Speaker).filter(Speaker.voice_embedding.isnot(None)).all()
                if speakers:
                    speaker_service = get_speaker_service()
                    known_speakers = [(s.id, s.voice_embedding) for s in speakers]
                    speaker_id, _ = speaker_service.identify_speaker(data, known_speakers)
                
                # Get speaker and node names
                speaker_name = None
                if speaker_id:
                    speaker = db.query(Speaker).filter(Speaker.id == speaker_id).first()
                    if speaker:
                        speaker_name = speaker.name
                
                node = db.query(Node).filter(Node.id == node_id).first()
                node_name = node.location if node else None
                
                # Save transcription
                transcription = Transcription(
                    node_id=node_id,
                    speaker_id=speaker_id,
                    text=text,
                    confidence=confidence,
                    audio_duration=len(data) / (16000 * 2),
                    timestamp=datetime.utcnow()
                )
                db.add(transcription)
                db.commit()
                db.refresh(transcription)
                
                # Broadcast to all dashboard clients
                await manager.broadcast({
                    "type": "transcription",
                    "data": {
                        "id": transcription.id,
                        "text": text,
                        "speaker_id": speaker_id,
                        "speaker_name": speaker_name,
                        "node_id": node_id,
                        "node_name": node_name,
                        "confidence": confidence,
                        "timestamp": transcription.timestamp.isoformat()
                    }
                })
            finally:
                db.close()
                
    except WebSocketDisconnect:
        manager.disconnect(websocket)
        # Update node status
        db = SessionLocal()
        try:
            node = db.query(Node).filter(Node.id == node_id).first()
            if node:
                node.status = "offline"
                db.commit()
        finally:
            db.close()
    except Exception as e:
        logger.error(f"Node WebSocket error: {e}")
        manager.disconnect(websocket)


async def broadcast_transcription(transcription_data: Dict[str, Any]):
    """
    Broadcast a new transcription to all connected clients.
    Called by the transcription ingest endpoint.
    """
    await manager.broadcast({
        "type": "transcription",
        "data": transcription_data
    })


async def broadcast_system_event(event_type: str, data: Dict[str, Any]):
    """Broadcast a system event (node status change, etc.)"""
    await manager.broadcast({
        "type": event_type,
        "data": data
    })
