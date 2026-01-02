"""
Speaker management routes
"""
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from sqlalchemy.orm import Session
from datetime import datetime
from typing import List, Optional
from pydantic import BaseModel
import pickle

from ..database import get_db, Speaker
from ..services import get_speaker_service

router = APIRouter(prefix="/api/speakers", tags=["speakers"])


class SpeakerCreate(BaseModel):
    name: str
    color: str = "bg-blue-500"


class SpeakerResponse(BaseModel):
    id: str
    name: str
    color: str
    voice_samples: int
    accuracy: float
    enrolled_at: datetime
    
    class Config:
        from_attributes = True


@router.get("", response_model=List[SpeakerResponse])
def list_speakers(db: Session = Depends(get_db)):
    """Get all enrolled speakers"""
    speakers = db.query(Speaker).all()
    return speakers


@router.get("/{speaker_id}", response_model=SpeakerResponse)
def get_speaker(speaker_id: str, db: Session = Depends(get_db)):
    """Get a specific speaker"""
    speaker = db.query(Speaker).filter(Speaker.id == speaker_id).first()
    if not speaker:
        raise HTTPException(status_code=404, detail="Speaker not found")
    return speaker


@router.post("", response_model=SpeakerResponse)
def create_speaker(speaker_data: SpeakerCreate, db: Session = Depends(get_db)):
    """Create a new speaker (enrollment starts without voice samples)"""
    speaker = Speaker(
        name=speaker_data.name,
        color=speaker_data.color,
        enrolled_at=datetime.utcnow()
    )
    db.add(speaker)
    db.commit()
    db.refresh(speaker)
    return speaker


@router.post("/{speaker_id}/enroll")
async def enroll_voice_sample(
    speaker_id: str,
    audio: UploadFile = File(...),
    db: Session = Depends(get_db)
):
    """
    Add a voice sample for speaker enrollment.
    Upload raw PCM audio (16-bit, mono, 16kHz) or WAV file.
    """
    speaker = db.query(Speaker).filter(Speaker.id == speaker_id).first()
    if not speaker:
        raise HTTPException(status_code=404, detail="Speaker not found")
    
    # Read audio data
    audio_data = await audio.read()
    
    # Handle WAV files
    if audio.filename and audio.filename.endswith(".wav"):
        from ..services.audio_processor import AudioProcessor
        audio_data, _ = AudioProcessor.wav_to_bytes(audio_data)
    
    speaker_service = get_speaker_service()
    
    # If speaker has no embedding yet, create one
    if speaker.voice_embedding is None:
        embedding_bytes = speaker_service.create_embedding([audio_data])
        if embedding_bytes is None:
            raise HTTPException(status_code=400, detail="Failed to extract voice embedding")
        speaker.voice_embedding = embedding_bytes
        speaker.accuracy = 0.75  # Initial accuracy estimate
    else:
        # Update existing embedding with new sample
        speaker.voice_embedding = speaker_service.update_embedding(
            speaker.voice_embedding, 
            audio_data,
            weight=0.15  # New sample has 15% influence
        )
        # Improve accuracy with more samples
        speaker.accuracy = min(0.98, speaker.accuracy + 0.02)
    
    speaker.voice_samples += 1
    db.commit()
    
    return {
        "status": "enrolled",
        "speaker_id": speaker_id,
        "total_samples": speaker.voice_samples,
        "accuracy": speaker.accuracy
    }


@router.delete("/{speaker_id}")
def delete_speaker(speaker_id: str, db: Session = Depends(get_db)):
    """Remove a speaker"""
    speaker = db.query(Speaker).filter(Speaker.id == speaker_id).first()
    if not speaker:
        raise HTTPException(status_code=404, detail="Speaker not found")
    
    db.delete(speaker)
    db.commit()
    return {"status": "deleted", "speaker_id": speaker_id}


@router.post("/{speaker_id}/retrain")
async def retrain_speaker(
    speaker_id: str,
    audio_files: List[UploadFile] = File(...),
    db: Session = Depends(get_db)
):
    """
    Retrain speaker with new voice samples (replaces existing embedding).
    """
    speaker = db.query(Speaker).filter(Speaker.id == speaker_id).first()
    if not speaker:
        raise HTTPException(status_code=404, detail="Speaker not found")
    
    audio_samples = []
    for audio in audio_files:
        data = await audio.read()
        if audio.filename and audio.filename.endswith(".wav"):
            from ..services.audio_processor import AudioProcessor
            data, _ = AudioProcessor.wav_to_bytes(data)
        audio_samples.append(data)
    
    if not audio_samples:
        raise HTTPException(status_code=400, detail="No audio samples provided")
    
    speaker_service = get_speaker_service()
    embedding_bytes = speaker_service.create_embedding(audio_samples)
    
    if embedding_bytes is None:
        raise HTTPException(status_code=400, detail="Failed to create voice embedding")
    
    speaker.voice_embedding = embedding_bytes
    speaker.voice_samples = len(audio_samples)
    speaker.accuracy = 0.75 + min(0.20, len(audio_samples) * 0.02)
    
    db.commit()
    
    return {
        "status": "retrained",
        "speaker_id": speaker_id,
        "samples_used": len(audio_samples),
        "accuracy": speaker.accuracy
    }
