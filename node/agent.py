#!/usr/bin/env python3
"""
HomeMic Node Agent
Captures audio from USB microphone and sends to HomeMic server for transcription.

Usage:
    python agent.py [--server URL] [--name NAME] [--location LOCATION]
"""
import argparse
import logging
import signal
import sys
import time
import json
import os
from pathlib import Path

from config import (
    SERVER_URL, NODE_NAME, NODE_LOCATION,
    HEARTBEAT_INTERVAL, DATA_DIR, CONFIG_FILE, LOG_FILE
)
from audio_capture import AudioCapture
from server_client import ServerClient

# Setup logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.StreamHandler(),
        logging.FileHandler(LOG_FILE) if os.path.exists(DATA_DIR) else logging.NullHandler()
    ]
)
logger = logging.getLogger(__name__)


class HomeMicAgent:
    """Main node agent that coordinates audio capture and server communication"""
    
    def __init__(
        self,
        server_url: str = SERVER_URL,
        node_name: str = NODE_NAME,
        node_location: str = NODE_LOCATION
    ):
        self.server_url = server_url
        self.node_name = node_name
        self.node_location = node_location
        
        # Components
        self.audio = AudioCapture()
        self.client = ServerClient(server_url)
        
        # State
        self.is_running = False
        self.is_muted = False
        self.last_heartbeat = 0
        self.chunks_sent = 0
        self.transcriptions_received = 0
        
        # Ensure data directory exists
        Path(DATA_DIR).mkdir(parents=True, exist_ok=True)
    
    def load_config(self):
        """Load saved configuration (node ID, etc.)"""
        if os.path.exists(CONFIG_FILE):
            try:
                with open(CONFIG_FILE, 'r') as f:
                    config = json.load(f)
                    self.client.node_id = config.get('node_id')
                    logger.info(f"Loaded saved node ID: {self.client.node_id}")
            except Exception as e:
                logger.warning(f"Failed to load config: {e}")
    
    def save_config(self):
        """Save configuration"""
        try:
            config = {
                'node_id': self.client.node_id,
                'server_url': self.server_url,
                'node_name': self.node_name,
                'node_location': self.node_location
            }
            with open(CONFIG_FILE, 'w') as f:
                json.dump(config, f, indent=2)
            logger.info("Configuration saved")
        except Exception as e:
            logger.error(f"Failed to save config: {e}")
    
    def register(self) -> bool:
        """Register node with server"""
        # Check server health
        if not self.client.health_check():
            logger.error("Server unreachable")
            return False
        
        # Register if no saved node ID
        if not self.client.node_id:
            node_id = self.client.register_node(self.node_name, self.node_location)
            if not node_id:
                logger.error("Failed to register with server")
                return False
            self.save_config()
        else:
            # Verify existing registration with heartbeat
            if not self.client.send_heartbeat():
                # Re-register if heartbeat fails
                logger.warning("Heartbeat failed, re-registering...")
                self.client.node_id = None
                node_id = self.client.register_node(self.node_name, self.node_location)
                if not node_id:
                    return False
                self.save_config()
        
        return True
    
    def send_heartbeat(self):
        """Send periodic heartbeat"""
        now = time.time()
        if now - self.last_heartbeat >= HEARTBEAT_INTERVAL:
            self.client.send_heartbeat()
            self.last_heartbeat = now
            
            # Also check privacy/mute status
            self.is_muted = self.client.get_privacy_status()
            if self.is_muted:
                logger.info("Node is currently muted")
    
    def handle_audio(self, audio_data: bytes):
        """Process and send audio chunk"""
        # Calculate and send audio level for real-time visualization
        rms = AudioCapture.calculate_rms(audio_data)
        self.client.send_audio_level(rms)
        
        # Skip transcription if muted
        if self.is_muted:
            return
        
        # Check for speech using simple VAD
        if not AudioCapture.is_speech(audio_data):
            return
        
        # Send to server for transcription
        result = self.client.send_audio(audio_data)
        
        if result.get('status') == 'transcribed':
            self.chunks_sent += 1
            self.transcriptions_received += 1
            
            text = result.get('text', '')
            speaker = result.get('speaker_name', 'Unknown')
            
            logger.info(f"[{speaker}]: {text}")
            
            # Check for detected keywords
            keywords = result.get('keywords_detected', [])
            if keywords:
                logger.warning(f"Keywords detected: {keywords}")
        
        elif result.get('status') == 'no_speech':
            pass  # Expected when VAD on server rejects
        elif result.get('status') == 'empty':
            pass  # No transcription result
        else:
            logger.warning(f"Unexpected result: {result}")
    
    def run(self):
        """Main run loop"""
        logger.info(f"HomeMic Node Agent starting...")
        logger.info(f"Server: {self.server_url}")
        logger.info(f"Node: {self.node_name} ({self.node_location})")
        
        # Load saved config
        self.load_config()
        
        # Register with server
        if not self.register():
            logger.error("Failed to register with server. Exiting.")
            return
        
        logger.info(f"Registered with node ID: {self.client.node_id}")
        
        # Start audio capture
        try:
            self.audio.start(callback=self.handle_audio)
        except Exception as e:
            logger.error(f"Failed to start audio capture: {e}")
            return
        
        self.is_running = True
        logger.info("Agent running. Press Ctrl+C to stop.")
        
        # Main loop
        try:
            while self.is_running:
                self.send_heartbeat()
                time.sleep(1)
        except KeyboardInterrupt:
            logger.info("Interrupted by user")
        finally:
            self.stop()
    
    def stop(self):
        """Stop the agent"""
        self.is_running = False
        self.audio.stop()
        logger.info(f"Agent stopped. Sent {self.chunks_sent} chunks, received {self.transcriptions_received} transcriptions.")


def main():
    parser = argparse.ArgumentParser(description='HomeMic Node Agent')
    parser.add_argument('--server', '-s', default=SERVER_URL,
                        help=f'HomeMic server URL (default: {SERVER_URL})')
    parser.add_argument('--name', '-n', default=NODE_NAME,
                        help=f'Node name (default: {NODE_NAME})')
    parser.add_argument('--location', '-l', default=NODE_LOCATION,
                        help=f'Node location (default: {NODE_LOCATION})')
    parser.add_argument('--list-devices', action='store_true',
                        help='List available audio devices and exit')
    
    args = parser.parse_args()
    
    # List devices mode
    if args.list_devices:
        capture = AudioCapture()
        print("Available audio input devices:")
        for device in capture.list_devices():
            print(f"  [{device['index']}] {device['name']} ({device['channels']}ch, {device['sample_rate']}Hz)")
        return
    
    # Create and run agent
    agent = HomeMicAgent(
        server_url=args.server,
        node_name=args.name,
        node_location=args.location
    )
    
    # Handle signals
    def signal_handler(sig, frame):
        agent.stop()
        sys.exit(0)
    
    signal.signal(signal.SIGINT, signal_handler)
    signal.signal(signal.SIGTERM, signal_handler)
    
    agent.run()


if __name__ == "__main__":
    main()
