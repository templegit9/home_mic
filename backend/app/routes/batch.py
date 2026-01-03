"""
Batch Clip Routes - Upload, History, and Playback
"""
from fastapi import APIRouter, UploadFile, File, Query, Depends, HTTPException, BackgroundTasks
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session
from sqlalchemy import desc
from datetime import datetime
from pathlib import Path
import shutil
import wave
import logging
from typing import Optional, List

from ..database import get_db, BatchClip, TranscriptSegment, Node
from ..config import AUDIO_STORAGE_DIR, MAX_BATCH_FILE_SIZE, SAMPLE_RATE

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/batch", tags=["batch"])


def get_audio_duration(file_path: Path) -> float:
    """Get duration of a WAV file in seconds"""
    try:
        with wave.open(str(file_path), 'rb') as wav:
            frames = wav.getnframes()
            rate = wav.getframerate()
            return frames / rate
    except Exception as e:
        logger.warning(f"Could not read WAV duration: {e}")
        return 0.0


def process_clip_transcription(clip_id: str, db: Session):
    """Background task to transcribe a clip"""
    from ..services.transcription import get_transcription_service
    
    clip = db.query(BatchClip).filter(BatchClip.id == clip_id).first()
    if not clip:
        logger.error(f"Clip not found for processing: {clip_id}")
        return
    
    try:
        clip.status = "processing"
        db.commit()
        
        start_time = datetime.utcnow()
        
        # Get transcription service
        service = get_transcription_service()
        
        # Transcribe with word-level timestamps
        text, segments = service.transcribe_file_with_timestamps(Path(clip.file_path))
        
        end_time = datetime.utcnow()
        processing_ms = int((end_time - start_time).total_seconds() * 1000)
        
        # Update clip
        clip.transcript_text = text
        clip.word_count = len(text.split()) if text else 0
        clip.status = "transcribed"
        clip.processed_at = end_time
        clip.processing_duration_ms = processing_ms
        
        # Add segments
        for seg in segments:
            segment = TranscriptSegment(
                clip_id=clip.id,
                start_time=seg['start'],
                end_time=seg['end'],
                text=seg['text'],
                confidence=seg.get('confidence', 0.0)
            )
            db.add(segment)
        
        db.commit()
        logger.info(f"Clip {clip_id} transcribed in {processing_ms}ms: {clip.word_count} words")
        
    except Exception as e:
        logger.error(f"Transcription failed for clip {clip_id}: {e}")
        clip.status = "failed"
        clip.error_message = str(e)
        db.commit()


@router.post("/upload")
async def upload_batch_clip(
    background_tasks: BackgroundTasks,
    audio: UploadFile = File(...),
    node_id: str = Query(...),
    recorded_at: Optional[str] = Query(None),
    db: Session = Depends(get_db)
):
    """
    Upload a batch audio clip for transcription.
    The clip will be saved and queued for background transcription.
    """
    # Validate node exists
    node = db.query(Node).filter(Node.id == node_id).first()
    if not node:
        raise HTTPException(status_code=404, detail="Node not found")
    
    # Validate file
    if not audio.filename.endswith('.wav'):
        raise HTTPException(status_code=400, detail="Only WAV files are supported")
    
    # Parse recorded_at timestamp
    if recorded_at:
        try:
            recorded_time = datetime.fromisoformat(recorded_at.replace('Z', '+00:00'))
        except ValueError:
            recorded_time = datetime.utcnow()
    else:
        recorded_time = datetime.utcnow()
    
    # Generate storage path: /storage/<node_id>/<date>/filename.wav
    date_folder = recorded_time.strftime("%Y-%m-%d")
    clip_folder = AUDIO_STORAGE_DIR / node_id / date_folder
    clip_folder.mkdir(parents=True, exist_ok=True)
    
    # Save file
    file_path = clip_folder / audio.filename
    
    try:
        # Stream file to disk
        with open(file_path, 'wb') as f:
            shutil.copyfileobj(audio.file, f)
        
        file_size = file_path.stat().st_size
        
        # Check file size
        if file_size > MAX_BATCH_FILE_SIZE:
            file_path.unlink()
            raise HTTPException(
                status_code=413, 
                detail=f"File too large. Max size: {MAX_BATCH_FILE_SIZE // 1024 // 1024}MB"
            )
        
        # Get audio duration
        duration = get_audio_duration(file_path)
        
        # Create database record
        clip = BatchClip(
            node_id=node_id,
            filename=audio.filename,
            file_path=str(file_path),
            file_size=file_size,
            duration_seconds=duration,
            recorded_at=recorded_time,
            status="pending"
        )
        db.add(clip)
        db.commit()
        db.refresh(clip)
        
        logger.info(f"Uploaded clip: {audio.filename} ({duration:.1f}s, {file_size} bytes)")
        
        # Queue background transcription
        background_tasks.add_task(process_clip_transcription, clip.id, db)
        
        return {
            "status": "processing",
            "clip_id": clip.id,
            "filename": audio.filename,
            "duration": duration,
            "file_size": file_size
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Upload failed: {e}")
        if file_path.exists():
            file_path.unlink()
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/history")
async def get_clip_history(
    node_id: Optional[str] = Query(None),
    status: Optional[str] = Query(None),
    start_date: Optional[str] = Query(None),
    end_date: Optional[str] = Query(None),
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    db: Session = Depends(get_db)
):
    """Get batch clip history with pagination and filters"""
    query = db.query(BatchClip)
    
    if node_id:
        query = query.filter(BatchClip.node_id == node_id)
    
    if status:
        query = query.filter(BatchClip.status == status)
    
    if start_date:
        try:
            start = datetime.fromisoformat(start_date)
            query = query.filter(BatchClip.recorded_at >= start)
        except ValueError:
            pass
    
    if end_date:
        try:
            end = datetime.fromisoformat(end_date)
            query = query.filter(BatchClip.recorded_at <= end)
        except ValueError:
            pass
    
    # Count total
    total = query.count()
    
    # Get clips ordered by recorded_at desc
    clips = query.order_by(desc(BatchClip.recorded_at)).offset(offset).limit(limit).all()
    
    return {
        "total": total,
        "offset": offset,
        "limit": limit,
        "clips": [
            {
                "id": clip.id,
                "node_id": clip.node_id,
                "filename": clip.filename,
                "duration_seconds": clip.duration_seconds,
                "recorded_at": clip.recorded_at.isoformat() if clip.recorded_at else None,
                "status": clip.status,
                "word_count": clip.word_count,
                "transcript_preview": clip.transcript_text[:200] if clip.transcript_text else None
            }
            for clip in clips
        ]
    }


@router.get("/clips/{clip_id}")
async def get_clip_details(
    clip_id: str,
    db: Session = Depends(get_db)
):
    """Get full clip details including transcript and segments"""
    clip = db.query(BatchClip).filter(BatchClip.id == clip_id).first()
    if not clip:
        raise HTTPException(status_code=404, detail="Clip not found")
    
    segments = db.query(TranscriptSegment).filter(
        TranscriptSegment.clip_id == clip_id
    ).order_by(TranscriptSegment.start_time).all()
    
    return {
        "id": clip.id,
        "node_id": clip.node_id,
        "filename": clip.filename,
        "file_size": clip.file_size,
        "duration_seconds": clip.duration_seconds,
        "recorded_at": clip.recorded_at.isoformat() if clip.recorded_at else None,
        "uploaded_at": clip.uploaded_at.isoformat() if clip.uploaded_at else None,
        "processed_at": clip.processed_at.isoformat() if clip.processed_at else None,
        "status": clip.status,
        "error_message": clip.error_message,
        "processing_duration_ms": clip.processing_duration_ms,
        "transcript_text": clip.transcript_text,
        "word_count": clip.word_count,
        "segments": [
            {
                "id": seg.id,
                "start_time": seg.start_time,
                "end_time": seg.end_time,
                "text": seg.text,
                "confidence": seg.confidence,
                "speaker_id": seg.speaker_id
            }
            for seg in segments
        ]
    }


@router.get("/clips/{clip_id}/audio")
async def get_clip_audio(
    clip_id: str,
    db: Session = Depends(get_db)
):
    """Stream the audio file for playback"""
    clip = db.query(BatchClip).filter(BatchClip.id == clip_id).first()
    if not clip:
        raise HTTPException(status_code=404, detail="Clip not found")
    
    file_path = Path(clip.file_path)
    if not file_path.exists():
        raise HTTPException(status_code=404, detail="Audio file not found")
    
    return FileResponse(
        path=file_path,
        media_type="audio/wav",
        filename=clip.filename
    )


@router.delete("/clips/{clip_id}")
async def delete_clip(
    clip_id: str,
    delete_file: bool = Query(True),
    db: Session = Depends(get_db)
):
    """Delete a clip and optionally its audio file"""
    clip = db.query(BatchClip).filter(BatchClip.id == clip_id).first()
    if not clip:
        raise HTTPException(status_code=404, detail="Clip not found")
    
    file_path = Path(clip.file_path)
    
    # Delete from database
    db.delete(clip)
    db.commit()
    
    # Delete audio file if requested
    if delete_file and file_path.exists():
        try:
            file_path.unlink()
            logger.info(f"Deleted audio file: {file_path}")
        except Exception as e:
            logger.warning(f"Could not delete audio file: {e}")
    
    return {"status": "deleted", "clip_id": clip_id}
