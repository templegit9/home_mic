"""
HomeMic Configuration
"""
import os
from pathlib import Path

# Paths
BASE_DIR = Path("/opt/homemic")
DATA_DIR = BASE_DIR / "data"
LOGS_DIR = BASE_DIR / "logs"
WHISPER_DIR = Path("/opt/whisper.cpp")
WHISPER_MODEL = WHISPER_DIR / "models" / "ggml-small.bin"
WHISPER_MAIN = WHISPER_DIR / "build" / "bin" / "main"

# Database
DATABASE_URL = f"sqlite:///{DATA_DIR}/homemic.db"

# Audio settings
SAMPLE_RATE = 16000  # Whisper requires 16kHz
CHANNELS = 1  # Mono
CHUNK_DURATION_SECONDS = 5  # Process audio in 5-second chunks

# Server
API_HOST = "0.0.0.0"
API_PORT = 8420

# Ensure directories exist
DATA_DIR.mkdir(parents=True, exist_ok=True)
LOGS_DIR.mkdir(parents=True, exist_ok=True)
