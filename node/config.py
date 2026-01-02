"""
HomeMic Node Agent Configuration
"""
import os

# Server Configuration
SERVER_URL = os.environ.get("HOMEMIC_SERVER", "http://10.0.0.120:8420")
NODE_ID = os.environ.get("HOMEMIC_NODE_ID", "")  # Set after registration
NODE_NAME = os.environ.get("HOMEMIC_NODE_NAME", "Living Room")
NODE_LOCATION = os.environ.get("HOMEMIC_LOCATION", "Living Room")

# Audio Configuration
SAMPLE_RATE = 16000  # Whisper requires 16kHz
CHANNELS = 1  # Mono
CHUNK_DURATION = 3.0  # Seconds per chunk to send
SILENCE_THRESHOLD = 500  # RMS threshold for silence detection
MIN_SPEECH_DURATION = 0.5  # Minimum seconds of speech to trigger send

# VAD Configuration
VAD_AGGRESSIVENESS = 2  # 0-3, higher = more aggressive filtering

# Network
HEARTBEAT_INTERVAL = 30  # Seconds between heartbeat pings
RETRY_DELAY = 5  # Seconds to wait before retrying failed requests
MAX_RETRIES = 3

# Paths
DATA_DIR = os.path.expanduser("~/.homemic")
LOG_FILE = os.path.join(DATA_DIR, "node.log")
CONFIG_FILE = os.path.join(DATA_DIR, "config.json")
