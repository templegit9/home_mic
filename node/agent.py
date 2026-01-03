#!/usr/bin/env python3
"""
HomeMic Node Agent - Batch Mode
Continuously records 10-minute audio clips and uploads them to server for transcription.

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
    HEARTBEAT_INTERVAL, DATA_DIR, CONFIG_FILE, LOG_FILE,
    LOCAL_STORAGE_DIR, BATCH_DURATION
)
from audio_capture import AudioCapture, BatchRecorder
from server_client import ServerClient
from batch_uploader import BatchUploader

# Ensure directories exist
Path(DATA_DIR).mkdir(parents=True, exist_ok=True)
Path(LOCAL_STORAGE_DIR).mkdir(parents=True, exist_ok=True)

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
    """
    Batch recording node agent.
    Records 10-minute clips and uploads them to server for transcription.
    """
    
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
        self.client = ServerClient(server_url)
        self.recorder = BatchRecorder()
        self.uploader = BatchUploader(server_url=server_url)
        
        # State
        self.is_running = False
        self.is_muted = False
        self.last_heartbeat = 0
        
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
    
    def handle_audio_level(self, rms: float):
        """Send audio level for real-time visualization"""
        self.client.send_audio_level(rms)
    
    def handle_clip_complete(self, clip_path: str):
        """Called when a new clip is finished recording"""
        logger.info(f"New clip ready for upload: {clip_path}")
        # Uploader will automatically pick it up from storage directory
    
    def handle_upload_complete(self, filename: str, result: dict):
        """Called when upload succeeds"""
        status = result.get('status', 'unknown')
        if status == 'transcribed':
            text = result.get('text', '')[:100]  # First 100 chars
            logger.info(f"Transcribed [{filename}]: {text}...")
        elif status == 'processing':
            logger.info(f"Server processing: {filename}")
        else:
            logger.info(f"Upload complete: {filename} (status: {status})")
    
    def run(self):
        """Main run loop"""
        logger.info("=" * 60)
        logger.info("HomeMic Node Agent (Batch Mode)")
        logger.info("=" * 60)
        logger.info(f"Server: {self.server_url}")
        logger.info(f"Node: {self.node_name} ({self.node_location})")
        logger.info(f"Clip duration: {BATCH_DURATION} seconds ({BATCH_DURATION//60} minutes)")
        logger.info(f"Storage: {LOCAL_STORAGE_DIR}")
        
        # Load saved config
        self.load_config()
        
        # Register with server
        if not self.register():
            logger.error("Failed to register with server. Will retry in offline mode.")
            # Continue anyway - uploader will queue clips
        else:
            logger.info(f"Registered with node ID: {self.client.node_id}")
        
        # Setup callbacks
        self.recorder.on_audio_level = self.handle_audio_level
        self.recorder.on_clip_complete = self.handle_clip_complete
        self.uploader.on_upload_complete = self.handle_upload_complete
        
        # Start uploader (will watch for clips)
        if self.client.node_id:
            self.uploader.start(self.client.node_id)
        
        # Start recorder
        try:
            self.recorder.start()
        except Exception as e:
            logger.error(f"Failed to start audio recording: {e}")
            return
        
        self.is_running = True
        logger.info("Agent running. Recording will save to local storage.")
        logger.info("Press Ctrl+C to stop.")
        
        # Main loop
        try:
            while self.is_running:
                self.send_heartbeat()
                
                # Log status periodically
                if int(time.time()) % 60 == 0:
                    pending = self.uploader.get_pending_count()
                    logger.info(
                        f"Status: Clips recorded: {self.recorder.clips_recorded}, "
                        f"Uploaded: {self.uploader.clips_uploaded}, "
                        f"Pending: {pending}"
                    )
                    # Clean up uploaded files to free local disk space
                    self.uploader.cleanup_uploaded(keep_days=0)
                
                time.sleep(1)
                
        except KeyboardInterrupt:
            logger.info("Interrupted by user")
        finally:
            self.stop()
    
    def stop(self):
        """Stop the agent"""
        self.is_running = False
        self.recorder.stop()
        self.uploader.stop()
        
        logger.info("=" * 60)
        logger.info("Agent stopped.")
        logger.info(f"Clips recorded: {self.recorder.clips_recorded}")
        logger.info(f"Clips uploaded: {self.uploader.clips_uploaded}")
        logger.info(f"Pending uploads: {self.uploader.get_pending_count()}")
        logger.info("=" * 60)


def main():
    parser = argparse.ArgumentParser(
        description='HomeMic Node Agent - Batch Recording Mode'
    )
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
            default = " (default)" if device.get('default') else ""
            print(f"  [{device['index']}] {device['name']} "
                  f"({device['channels']}ch, {device['sample_rate']}Hz){default}")
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
