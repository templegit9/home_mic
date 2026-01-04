"""
HomeMic Configuration
"""
import os
from pathlib import Path

# Paths
BASE_DIR = Path("/opt/homemic")
DATA_DIR = BASE_DIR / "data"
LOGS_DIR = BASE_DIR / "logs"
AUDIO_STORAGE_DIR = Path(os.environ.get("HOMEMIC_AUDIO_STORAGE", "/mnt/audio"))
WHISPER_DIR = Path("/opt/whisper.cpp")
WHISPER_MODEL = WHISPER_DIR / "models" / "ggml-small.bin"
WHISPER_MAIN = WHISPER_DIR / "build" / "bin" / "whisper-cli"

# Database
DATABASE_URL = f"sqlite:///{DATA_DIR}/homemic.db"

# Audio settings
SAMPLE_RATE = 16000  # Whisper requires 16kHz
CHANNELS = 1  # Mono
CHUNK_DURATION_SECONDS = 5  # Process audio in 5-second chunks

# Batch processing settings
MAX_BATCH_FILE_SIZE = 100 * 1024 * 1024  # 100 MB max upload
BATCH_CLIP_DURATION = 600  # Expected 10-minute clips

# Server
API_HOST = "0.0.0.0"
API_PORT = 8420

# Ensure directories exist
DATA_DIR.mkdir(parents=True, exist_ok=True)
LOGS_DIR.mkdir(parents=True, exist_ok=True)
AUDIO_STORAGE_DIR.mkdir(parents=True, exist_ok=True)

