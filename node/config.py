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
SAMPLE_RATE = 48000  # USB mic native rate (server will resample to 16kHz for Whisper)
CHANNELS = 1  # Mono
SILENCE_THRESHOLD = 500  # RMS threshold for silence detection

# Batch Recording Configuration (replaces real-time streaming)
BATCH_DURATION = 600  # 10 minutes in seconds
BATCH_OVERLAP = 0  # Seconds of overlap between clips (0 = no overlap)
MIN_AUDIO_LEVEL = 100  # Minimum RMS to consider as non-silence

# Local Storage for batch clips
LOCAL_STORAGE_DIR = os.environ.get(
    "HOMEMIC_STORAGE_DIR",
    os.path.expanduser("~/.homemic/clips")
)
UPLOAD_RETRY_COUNT = 3
UPLOAD_RETRY_DELAY = 10  # Seconds between retries

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

