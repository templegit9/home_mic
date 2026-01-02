"""
Transcription routes and audio ingestion
"""
import asyncio
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Query
from sqlalchemy.orm import Session
from datetime import datetime, timedelta
from typing import List, Optional
from pydantic import BaseModel

from ..database import get_db, Transcription, Node, Speaker, Keyword, KeywordDetection
from ..services import get_transcription_service, get_speaker_service, AudioProcessor
from .websocket import broadcast_transcription

router = APIRouter(prefix="/api/transcriptions", tags=["transcriptions"])


class TranscriptionResponse(BaseModel):
    id: str
    node_id: Optional[str]
    speaker_id: Optional[str]
    speaker_name: Optional[str] = None
    node_name: Optional[str] = None
    text: str
    confidence: float
    timestamp: datetime
    audio_duration: float
    
    class Config:
        from_attributes = True


class TranscriptionCreate(BaseModel):
    node_id: str
    audio_base64: str  # Base64 encoded audio


@router.get("", response_model=List[TranscriptionResponse])
def list_transcriptions(
    limit: int = Query(50, ge=1, le=500),
    offset: int = Query(0, ge=0),
    speaker_id: Optional[str] = None,
    node_id: Optional[str] = None,
    search: Optional[str] = None,
    from_date: Optional[datetime] = None,
    to_date: Optional[datetime] = None,
    db: Session = Depends(get_db)
):
    """Get transcriptions with optional filtering"""
    query = db.query(Transcription)
    
    if speaker_id:
        query = query.filter(Transcription.speaker_id == speaker_id)
    if node_id:
        query = query.filter(Transcription.node_id == node_id)
    if search:
        query = query.filter(Transcription.text.ilike(f"%{search}%"))
    if from_date:
        query = query.filter(Transcription.timestamp >= from_date)
    if to_date:
        query = query.filter(Transcription.timestamp <= to_date)
    
    transcriptions = query.order_by(Transcription.timestamp.desc()).offset(offset).limit(limit).all()
    
    # Enrich with speaker and node names
    result = []
    for t in transcriptions:
        resp = TranscriptionResponse(
            id=t.id,
            node_id=t.node_id,
            speaker_id=t.speaker_id,
            text=t.text,
            confidence=t.confidence,
            timestamp=t.timestamp,
            audio_duration=t.audio_duration
        )
        if t.speaker:
            resp.speaker_name = t.speaker.name
        if t.node:
            resp.node_name = t.node.location
        result.append(resp)
    
    return result


@router.get("/recent", response_model=List[TranscriptionResponse])
def get_recent_transcriptions(
    minutes: int = Query(5, ge=1, le=60),
    db: Session = Depends(get_db)
):
    """Get transcriptions from the last N minutes"""
    since = datetime.utcnow() - timedelta(minutes=minutes)
    transcriptions = db.query(Transcription).filter(
        Transcription.timestamp >= since
    ).order_by(Transcription.timestamp.desc()).all()
    
    result = []
    for t in transcriptions:
        resp = TranscriptionResponse(
            id=t.id,
            node_id=t.node_id,
            speaker_id=t.speaker_id,
            text=t.text,
            confidence=t.confidence,
            timestamp=t.timestamp,
            audio_duration=t.audio_duration
        )
        if t.speaker:
            resp.speaker_name = t.speaker.name
        if t.node:
            resp.node_name = t.node.location
        result.append(resp)
    
    return result


@router.post("/ingest")
async def ingest_audio(
    node_id: str,
    audio: UploadFile = File(...),
    db: Session = Depends(get_db)
):
    """
    Ingest audio from a node and transcribe it.
    This is the main endpoint called by Raspberry Pi nodes.
    
    Audio should be:
    - 16-bit PCM, mono, 16kHz (raw) or WAV format
    """
    # Verify node exists
    node = db.query(Node).filter(Node.id == node_id).first()
    if not node:
        raise HTTPException(status_code=404, detail="Node not found")
    
    # Read audio data
    audio_data = await audio.read()
    
    # Handle WAV format
    if audio.filename and audio.filename.endswith(".wav"):
        audio_data, sample_rate = AudioProcessor.wav_to_bytes(audio_data)
        if sample_rate != 16000:
            audio_data = AudioProcessor.resample(audio_data, sample_rate, 16000)
    
    # Check if audio contains speech
    if not AudioProcessor.is_speech(audio_data):
        return {"status": "no_speech", "message": "No speech detected in audio"}
    
    # Transcribe
    transcription_service = get_transcription_service()
    text, confidence = transcription_service.transcribe_audio(audio_data)
    
    if not text:
        return {"status": "empty", "message": "Transcription returned empty"}
    
    # Identify speaker
    speaker_id = None
    speaker_confidence = 0.0
    
    speakers = db.query(Speaker).filter(Speaker.voice_embedding.isnot(None)).all()
    if speakers:
        speaker_service = get_speaker_service()
        known_speakers = [(s.id, s.voice_embedding) for s in speakers]
        speaker_id, speaker_confidence = speaker_service.identify_speaker(audio_data, known_speakers)
    
    # Calculate audio duration
    audio_duration = len(audio_data) / (16000 * 2)  # 16kHz, 16-bit (2 bytes per sample)
    
    # Create transcription record
    transcription = Transcription(
        node_id=node_id,
        speaker_id=speaker_id,
        text=text,
        confidence=confidence,
        audio_duration=audio_duration,
        timestamp=datetime.utcnow()
    )
    db.add(transcription)
    
    # Check for keyword matches
    keywords = db.query(Keyword).filter(Keyword.enabled == True).all()
    detected_keywords = []
    
    for keyword in keywords:
        search_text = text if keyword.case_sensitive else text.lower()
        search_phrase = keyword.phrase if keyword.case_sensitive else keyword.phrase.lower()
        
        if search_phrase in search_text:
            keyword.detection_count += 1
            keyword.last_detected = datetime.utcnow()
            
            detection = KeywordDetection(
                keyword_id=keyword.id,
                transcription_id=transcription.id
            )
            db.add(detection)
            detected_keywords.append(keyword.phrase)
    
    # Update node status
    node.last_seen = datetime.utcnow()
    node.status = "online"
    
    db.commit()
    db.refresh(transcription)
    
    # Get speaker name for response
    speaker_name = None
    if speaker_id:
        speaker = db.query(Speaker).filter(Speaker.id == speaker_id).first()
        if speaker:
            speaker_name = speaker.name
    
    # Broadcast to all connected WebSocket clients for live updates
    asyncio.create_task(broadcast_transcription({
        "transcription_id": transcription.id,
        "node_id": node_id,
        "node_name": node.location if node else None,
        "speaker_id": speaker_id,
        "speaker_name": speaker_name,
        "text": text,
        "confidence": confidence,
        "timestamp": transcription.timestamp.isoformat(),
        "keywords_detected": detected_keywords
    }))

    return {
        "status": "transcribed",
        "transcription_id": transcription.id,
        "text": text,
        "confidence": confidence,
        "speaker_id": speaker_id,
        "speaker_name": speaker_name,
        "speaker_confidence": speaker_confidence,
        "keywords_detected": detected_keywords,
        "audio_duration": audio_duration
    }


@router.delete("/{transcription_id}")
def delete_transcription(transcription_id: str, db: Session = Depends(get_db)):
    """Delete a specific transcription"""
    transcription = db.query(Transcription).filter(Transcription.id == transcription_id).first()
    if not transcription:
        raise HTTPException(status_code=404, detail="Transcription not found")
    
    db.delete(transcription)
    db.commit()
    return {"status": "deleted", "transcription_id": transcription_id}


@router.delete("")
def delete_transcriptions(
    before_date: Optional[datetime] = None,
    speaker_id: Optional[str] = None,
    node_id: Optional[str] = None,
    db: Session = Depends(get_db)
):
    """Bulk delete transcriptions with optional filtering"""
    query = db.query(Transcription)
    
    if before_date:
        query = query.filter(Transcription.timestamp < before_date)
    if speaker_id:
        query = query.filter(Transcription.speaker_id == speaker_id)
    if node_id:
        query = query.filter(Transcription.node_id == node_id)
    
    count = query.count()
    query.delete(synchronize_session=False)
    db.commit()
    
    return {"status": "deleted", "count": count}
