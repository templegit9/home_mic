"""
HomeMic Node Agent - Batch Uploader Module
Background thread that uploads completed audio clips to server
"""
import os
import time
import threading
import requests
import logging
from pathlib import Path
from typing import Optional, Callable, Dict, Any
from datetime import datetime

from config import (
    SERVER_URL, LOCAL_STORAGE_DIR,
    UPLOAD_RETRY_COUNT, UPLOAD_RETRY_DELAY
)

logger = logging.getLogger(__name__)


class BatchUploader:
    """Background uploader for completed audio clips"""
    
    def __init__(
        self,
        server_url: str = SERVER_URL,
        storage_dir: str = LOCAL_STORAGE_DIR,
        node_id: Optional[str] = None
    ):
        self.server_url = server_url.rstrip('/')
        self.storage_dir = Path(storage_dir)
        self.node_id = node_id
        
        self.session = requests.Session()
        self.is_running = False
        self._thread: Optional[threading.Thread] = None
        
        # Callbacks
        self.on_upload_complete: Optional[Callable[[str, Dict], None]] = None
        self.on_upload_failed: Optional[Callable[[str, str], None]] = None
        
        # Stats
        self.clips_uploaded = 0
        self.clips_failed = 0
        self.bytes_uploaded = 0
    
    def start(self, node_id: str):
        """Start the background uploader thread"""
        self.node_id = node_id
        
        if self.is_running:
            logger.warning("Uploader already running")
            return
        
        # Ensure storage directory exists
        self.storage_dir.mkdir(parents=True, exist_ok=True)
        
        self.is_running = True
        self._thread = threading.Thread(target=self._upload_loop, daemon=True)
        self._thread.start()
        
        logger.info(f"Batch uploader started, watching: {self.storage_dir}")
    
    def stop(self):
        """Stop the uploader thread"""
        self.is_running = False
        if self._thread:
            self._thread.join(timeout=5.0)
        logger.info(f"Uploader stopped. Uploaded: {self.clips_uploaded}, Failed: {self.clips_failed}")
    
    def _upload_loop(self):
        """Main loop - watches for .wav files ready to upload"""
        while self.is_running:
            try:
                # Look for completed clips (.wav files, not .recording)
                wav_files = list(self.storage_dir.glob("*.wav"))
                
                for wav_file in wav_files:
                    if not self.is_running:
                        break
                    
                    # Skip files currently being written
                    if wav_file.with_suffix('.recording').exists():
                        continue
                    
                    # Skip already uploaded files
                    if wav_file.with_suffix('.uploaded').exists():
                        continue
                    
                    # Upload this file
                    success = self._upload_file(wav_file)
                    
                    if success:
                        self.clips_uploaded += 1
                        # Create marker file
                        wav_file.with_suffix('.uploaded').touch()
                        logger.info(f"Uploaded: {wav_file.name}")
                    else:
                        self.clips_failed += 1
                        logger.error(f"Failed to upload: {wav_file.name}")
                
                # Sleep before checking again
                time.sleep(5)
                
            except Exception as e:
                logger.error(f"Upload loop error: {e}")
                time.sleep(10)
    
    def _upload_file(self, file_path: Path) -> bool:
        """Upload a single audio file to server"""
        if not self.node_id:
            logger.error("Cannot upload: node_id not set")
            return False
        
        for attempt in range(UPLOAD_RETRY_COUNT):
            try:
                file_size = file_path.stat().st_size
                
                # Extract timestamp from filename (format: clip_YYYYMMDD_HHMMSS.wav)
                filename = file_path.stem
                recorded_at = None
                if filename.startswith("clip_"):
                    try:
                        timestamp_str = filename[5:]  # Remove "clip_"
                        recorded_at = datetime.strptime(timestamp_str, "%Y%m%d_%H%M%S")
                    except ValueError:
                        pass
                
                with open(file_path, 'rb') as f:
                    files = {
                        'audio': (file_path.name, f, 'audio/wav')
                    }
                    params = {
                        'node_id': self.node_id,
                    }
                    if recorded_at:
                        params['recorded_at'] = recorded_at.isoformat()
                    
                    response = self.session.post(
                        f"{self.server_url}/api/batch/upload",
                        files=files,
                        params=params,
                        timeout=120  # 2 min timeout for large files
                    )
                
                if response.status_code == 200:
                    self.bytes_uploaded += file_size
                    result = response.json()
                    
                    if self.on_upload_complete:
                        self.on_upload_complete(file_path.name, result)
                    
                    return True
                else:
                    logger.warning(f"Upload attempt {attempt + 1} failed: {response.status_code} - {response.text}")
                    
            except requests.exceptions.Timeout:
                logger.warning(f"Upload attempt {attempt + 1} timed out")
            except requests.exceptions.ConnectionError:
                logger.warning(f"Upload attempt {attempt + 1}: connection error")
            except Exception as e:
                logger.error(f"Upload attempt {attempt + 1} error: {e}")
            
            if attempt < UPLOAD_RETRY_COUNT - 1:
                time.sleep(UPLOAD_RETRY_DELAY)
        
        # All retries failed
        if self.on_upload_failed:
            self.on_upload_failed(file_path.name, "Max retries exceeded")
        
        return False
    
    def get_pending_count(self) -> int:
        """Get number of files waiting to be uploaded"""
        if not self.storage_dir.exists():
            return 0
        
        pending = 0
        for wav_file in self.storage_dir.glob("*.wav"):
            if not wav_file.with_suffix('.uploaded').exists():
                if not wav_file.with_suffix('.recording').exists():
                    pending += 1
        return pending
    
    def cleanup_uploaded(self, keep_days: int = 0):
        """
        Clean up successfully uploaded files.
        If keep_days=0, delete immediately after upload.
        If keep_days>0, keep files for that many days.
        """
        if not self.storage_dir.exists():
            return
        
        now = datetime.now()
        cleaned = 0
        
        for uploaded_marker in self.storage_dir.glob("*.uploaded"):
            wav_file = uploaded_marker.with_suffix('.wav')
            
            if keep_days > 0:
                # Check file age
                mtime = datetime.fromtimestamp(uploaded_marker.stat().st_mtime)
                age_days = (now - mtime).days
                if age_days < keep_days:
                    continue
            
            # Delete both files
            if wav_file.exists():
                wav_file.unlink()
            uploaded_marker.unlink()
            cleaned += 1
        
        if cleaned > 0:
            logger.info(f"Cleaned up {cleaned} uploaded clips")


if __name__ == "__main__":
    # Test uploader
    logging.basicConfig(level=logging.INFO)
    
    uploader = BatchUploader()
    print(f"Storage directory: {uploader.storage_dir}")
    print(f"Pending uploads: {uploader.get_pending_count()}")
