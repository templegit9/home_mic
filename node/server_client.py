"""
HomeMic Node Agent - Server Communication
Handles API calls and WebSocket connection to HomeMic server
"""
import requests
import asyncio
import websockets
import json
import logging
import threading
import wave
import io
from typing import Optional, Callable, Dict, Any
from datetime import datetime

from config import (
    SERVER_URL, NODE_ID, NODE_NAME, NODE_LOCATION,
    HEARTBEAT_INTERVAL, RETRY_DELAY, MAX_RETRIES, SAMPLE_RATE
)

logger = logging.getLogger(__name__)


class ServerClient:
    """HTTP client for HomeMic server API"""
    
    def __init__(self, server_url: str = SERVER_URL):
        self.server_url = server_url.rstrip('/')
        self.node_id: Optional[str] = NODE_ID or None
        self.session = requests.Session()
    
    def health_check(self) -> bool:
        """Check if server is reachable"""
        try:
            response = self.session.get(f"{self.server_url}/", timeout=5)
            return response.status_code == 200
        except Exception as e:
            logger.error(f"Health check failed: {e}")
            return False
    
    def register_node(self, name: str = NODE_NAME, location: str = NODE_LOCATION) -> Optional[str]:
        """Register this node with the server"""
        try:
            response = self.session.post(
                f"{self.server_url}/api/nodes",
                json={"name": name, "location": location},
                timeout=10
            )
            
            if response.status_code == 200:
                data = response.json()
                self.node_id = data['id']
                logger.info(f"Node registered with ID: {self.node_id}")
                return self.node_id
            else:
                logger.error(f"Failed to register node: {response.text}")
                return None
                
        except Exception as e:
            logger.error(f"Node registration error: {e}")
            return None
    
    def send_heartbeat(self, latency: float = 0) -> bool:
        """Send heartbeat to server with current IP address"""
        if not self.node_id:
            logger.warning("Cannot send heartbeat: node not registered")
            return False
        
        try:
            # Get local IP address for SSH restart capability
            import socket
            local_ip = None
            try:
                # Create a socket to determine the outgoing IP
                s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
                s.connect(("8.8.8.8", 80))
                local_ip = s.getsockname()[0]
                s.close()
            except Exception:
                pass
            
            params = {"latency": latency}
            if local_ip:
                params["ip_address"] = local_ip
            
            response = self.session.post(
                f"{self.server_url}/api/nodes/{self.node_id}/heartbeat",
                params=params,
                timeout=5
            )
            return response.status_code == 200
        except Exception as e:
            logger.error(f"Heartbeat failed: {e}")
            return False
    
    @staticmethod
    def pcm_to_wav(audio_data: bytes, sample_rate: int = SAMPLE_RATE, channels: int = 1) -> bytes:
        """Convert raw PCM audio to WAV format"""
        buffer = io.BytesIO()
        with wave.open(buffer, 'wb') as wav_file:
            wav_file.setnchannels(channels)
            wav_file.setsampwidth(2)  # 16-bit audio
            wav_file.setframerate(sample_rate)
            wav_file.writeframes(audio_data)
        return buffer.getvalue()
    
    def send_audio(self, audio_data: bytes, sample_rate: int = SAMPLE_RATE) -> Dict[str, Any]:
        """Send audio data for transcription"""
        if not self.node_id:
            logger.warning("Cannot send audio: node not registered")
            return {"status": "error", "message": "Node not registered"}
        
        try:
            # Convert raw PCM to WAV format
            wav_data = self.pcm_to_wav(audio_data, sample_rate)
            
            files = {
                'audio': ('audio.wav', wav_data, 'audio/wav')
            }
            
            response = self.session.post(
                f"{self.server_url}/api/transcriptions/ingest",
                params={"node_id": self.node_id},
                files=files,
                timeout=30
            )
            
            if response.status_code == 200:
                return response.json()
            else:
                logger.error(f"Audio send failed: {response.text}")
                return {"status": "error", "message": response.text}
                
        except Exception as e:
            logger.error(f"Audio send error: {e}")
            return {"status": "error", "message": str(e)}
    
    def send_audio_level(self, level: float) -> bool:
        """Send audio level for real-time visualization on dashboard"""
        if not self.node_id:
            return False
        
        try:
            response = self.session.post(
                f"{self.server_url}/api/nodes/{self.node_id}/audio-level",
                params={"level": level},
                timeout=1  # Short timeout for real-time updates
            )
            return response.status_code == 200
        except Exception:
            return False  # Silently fail for audio level updates
    
    def get_privacy_status(self) -> bool:
        """Check if this node is muted"""
        if not self.node_id:
            return False
        
        try:
            response = self.session.get(
                f"{self.server_url}/api/privacy/status/{self.node_id}",
                timeout=5
            )
            
            if response.status_code == 200:
                data = response.json()
                return data.get('muted', False)
            return False
            
        except Exception as e:
            logger.error(f"Privacy status check failed: {e}")
            return False


class WebSocketClient:
    """WebSocket client for real-time communication"""
    
    def __init__(self, server_url: str = SERVER_URL):
        # Convert HTTP URL to WebSocket URL
        ws_url = server_url.replace('http://', 'ws://').replace('https://', 'wss://')
        self.ws_url = ws_url.rstrip('/')
        self.node_id: Optional[str] = None
        self.websocket: Optional[websockets.WebSocketClientProtocol] = None
        self.is_connected = False
        self.on_message: Optional[Callable[[Dict], None]] = None
        self._loop: Optional[asyncio.AbstractEventLoop] = None
        self._thread: Optional[threading.Thread] = None
    
    def connect(self, node_id: str, on_message: Optional[Callable[[Dict], None]] = None):
        """Start WebSocket connection in background thread"""
        self.node_id = node_id
        self.on_message = on_message
        
        self._thread = threading.Thread(target=self._run_loop, daemon=True)
        self._thread.start()
    
    def _run_loop(self):
        """Run asyncio event loop in thread"""
        self._loop = asyncio.new_event_loop()
        asyncio.set_event_loop(self._loop)
        self._loop.run_until_complete(self._connect_loop())
    
    async def _connect_loop(self):
        """Main WebSocket connection loop with reconnection"""
        while True:
            try:
                url = f"{self.ws_url}/ws/node/{self.node_id}"
                logger.info(f"Connecting to WebSocket: {url}")
                
                async with websockets.connect(url) as websocket:
                    self.websocket = websocket
                    self.is_connected = True
                    logger.info("WebSocket connected")
                    
                    # Listen for messages
                    async for message in websocket:
                        try:
                            data = json.loads(message)
                            if self.on_message:
                                self.on_message(data)
                        except json.JSONDecodeError:
                            logger.warning(f"Invalid JSON received: {message}")
                            
            except websockets.exceptions.ConnectionClosed:
                logger.warning("WebSocket connection closed")
            except Exception as e:
                logger.error(f"WebSocket error: {e}")
            
            self.is_connected = False
            logger.info(f"Reconnecting in {RETRY_DELAY} seconds...")
            await asyncio.sleep(RETRY_DELAY)
    
    async def _send_audio(self, audio_data: bytes):
        """Send audio data via WebSocket"""
        if self.websocket and self.is_connected:
            await self.websocket.send(audio_data)
    
    def send_audio(self, audio_data: bytes):
        """Send audio data (thread-safe)"""
        if self._loop and self.is_connected:
            asyncio.run_coroutine_threadsafe(
                self._send_audio(audio_data),
                self._loop
            )
    
    def disconnect(self):
        """Close WebSocket connection"""
        self.is_connected = False
        if self._loop:
            self._loop.call_soon_threadsafe(self._loop.stop)


if __name__ == "__main__":
    # Test server connection
    logging.basicConfig(level=logging.INFO)
    
    client = ServerClient()
    
    print(f"Testing connection to {client.server_url}...")
    if client.health_check():
        print("✓ Server is reachable")
        
        print("Registering node...")
        node_id = client.register_node("Test Node", "Test Location")
        if node_id:
            print(f"✓ Node registered: {node_id}")
            
            print("Sending heartbeat...")
            if client.send_heartbeat(100):
                print("✓ Heartbeat sent")
            else:
                print("✗ Heartbeat failed")
        else:
            print("✗ Node registration failed")
    else:
        print("✗ Server unreachable")
