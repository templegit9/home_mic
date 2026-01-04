"""
Audio Cleanup Service
Automatically deletes audio files older than a specified number of days.
Transcripts are preserved permanently in the database.
"""
import os
import logging
from datetime import datetime, timedelta
from pathlib import Path

from ..config import AUDIO_STORAGE_DIR

logger = logging.getLogger(__name__)


def cleanup_old_audio_files(max_age_days: int = 14) -> dict:
    """
    Delete audio files older than max_age_days.
    Transcripts remain in the database permanently.
    
    Returns:
        dict with count of deleted files and freed space
    """
    cutoff_date = datetime.now() - timedelta(days=max_age_days)
    deleted_count = 0
    freed_bytes = 0
    errors = []
    
    if not AUDIO_STORAGE_DIR.exists():
        logger.warning(f"Audio storage directory does not exist: {AUDIO_STORAGE_DIR}")
        return {"deleted": 0, "freed_bytes": 0, "errors": ["Storage directory not found"]}
    
    logger.info(f"Starting audio cleanup. Deleting files older than {max_age_days} days ({cutoff_date.date()})")
    
    # Find all WAV files
    for audio_file in AUDIO_STORAGE_DIR.glob("*.wav"):
        try:
            # Get file modification time
            mtime = datetime.fromtimestamp(audio_file.stat().st_mtime)
            
            if mtime < cutoff_date:
                file_size = audio_file.stat().st_size
                audio_file.unlink()
                deleted_count += 1
                freed_bytes += file_size
                logger.debug(f"Deleted: {audio_file.name} (modified: {mtime.date()})")
                
        except Exception as e:
            error_msg = f"Error deleting {audio_file.name}: {e}"
            logger.error(error_msg)
            errors.append(error_msg)
    
    freed_mb = freed_bytes / (1024 * 1024)
    logger.info(f"Cleanup complete: deleted {deleted_count} files, freed {freed_mb:.1f} MB")
    
    return {
        "deleted": deleted_count,
        "freed_bytes": freed_bytes,
        "freed_mb": round(freed_mb, 2),
        "errors": errors if errors else None
    }


def get_storage_stats() -> dict:
    """Get current audio storage statistics"""
    if not AUDIO_STORAGE_DIR.exists():
        return {"error": "Storage directory not found"}
    
    total_size = 0
    file_count = 0
    oldest_file = None
    newest_file = None
    
    for audio_file in AUDIO_STORAGE_DIR.glob("*.wav"):
        try:
            stat = audio_file.stat()
            total_size += stat.st_size
            file_count += 1
            
            mtime = datetime.fromtimestamp(stat.st_mtime)
            if oldest_file is None or mtime < oldest_file:
                oldest_file = mtime
            if newest_file is None or mtime > newest_file:
                newest_file = mtime
                
        except Exception:
            pass
    
    # Get disk usage
    try:
        statvfs = os.statvfs(AUDIO_STORAGE_DIR)
        disk_total = statvfs.f_blocks * statvfs.f_frsize
        disk_free = statvfs.f_bavail * statvfs.f_frsize
        disk_used = disk_total - disk_free
    except:
        disk_total = disk_free = disk_used = 0
    
    return {
        "file_count": file_count,
        "total_size_mb": round(total_size / (1024 * 1024), 2),
        "oldest_file": oldest_file.isoformat() if oldest_file else None,
        "newest_file": newest_file.isoformat() if newest_file else None,
        "disk_total_gb": round(disk_total / (1024 ** 3), 2),
        "disk_free_gb": round(disk_free / (1024 ** 3), 2),
        "disk_used_gb": round(disk_used / (1024 ** 3), 2),
        "disk_percent_used": round((disk_used / disk_total) * 100, 1) if disk_total > 0 else 0
    }
