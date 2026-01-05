"""
HomeMic Database Models
"""
from sqlalchemy import create_engine, Column, String, Integer, Float, Boolean, DateTime, Text, LargeBinary, ForeignKey
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker, relationship
from datetime import datetime
import uuid

from .config import DATABASE_URL

engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False})
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


def generate_uuid():
    return str(uuid.uuid4())


class Node(Base):
    """Microphone node (e.g., Raspberry Pi in a room)"""
    __tablename__ = "nodes"
    
    id = Column(String, primary_key=True, default=generate_uuid)
    name = Column(String, nullable=False)
    location = Column(String, nullable=False)
    ip_address = Column(String, nullable=True)  # Node's IP for SSH restart
    status = Column(String, default="offline")  # online, offline, warning
    audio_filtering = Column(Boolean, default=True)
    latency = Column(Float, default=0)
    last_seen = Column(DateTime, default=datetime.utcnow)
    created_at = Column(DateTime, default=datetime.utcnow)
    
    transcriptions = relationship("Transcription", back_populates="node")


class Speaker(Base):
    """Enrolled speaker for voice identification"""
    __tablename__ = "speakers"
    
    id = Column(String, primary_key=True, default=generate_uuid)
    name = Column(String, nullable=False)
    color = Column(String, default="bg-blue-500")
    voice_embedding = Column(LargeBinary, nullable=True)  # Stored as numpy bytes
    voice_samples = Column(Integer, default=0)
    accuracy = Column(Float, default=0.0)
    enrolled_at = Column(DateTime, default=datetime.utcnow)
    
    transcriptions = relationship("Transcription", back_populates="speaker")


class Transcription(Base):
    """A single transcribed utterance"""
    __tablename__ = "transcriptions"
    
    id = Column(String, primary_key=True, default=generate_uuid)
    node_id = Column(String, ForeignKey("nodes.id"), nullable=True)
    speaker_id = Column(String, ForeignKey("speakers.id"), nullable=True)
    text = Column(Text, nullable=False)
    confidence = Column(Float, default=0.0)
    timestamp = Column(DateTime, default=datetime.utcnow)
    audio_duration = Column(Float, default=0.0)  # seconds
    conversation_id = Column(String, nullable=True)  # Group related utterances
    
    node = relationship("Node", back_populates="transcriptions")
    speaker = relationship("Speaker", back_populates="transcriptions")


class Reminder(Base):
    """Voice-triggered reminder"""
    __tablename__ = "reminders"
    
    id = Column(String, primary_key=True, default=generate_uuid)
    title = Column(String, nullable=False)
    description = Column(Text, nullable=True)
    speaker_id = Column(String, ForeignKey("speakers.id"), nullable=True)
    due_date = Column(DateTime, nullable=False)
    recurring = Column(String, nullable=True)  # daily, weekly, monthly
    completed = Column(Boolean, default=False)
    created_by = Column(String, default="voice")
    created_at = Column(DateTime, default=datetime.utcnow)


class Keyword(Base):
    """Keyword/phrase to detect and alert on"""
    __tablename__ = "keywords"
    
    id = Column(String, primary_key=True, default=generate_uuid)
    phrase = Column(String, nullable=False)
    enabled = Column(Boolean, default=True)
    alert_type = Column(String, default="notification")  # notification, sound, both
    case_sensitive = Column(Boolean, default=False)
    detection_count = Column(Integer, default=0)
    last_detected = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)


class KeywordDetection(Base):
    """Record of a keyword being detected"""
    __tablename__ = "keyword_detections"
    
    id = Column(String, primary_key=True, default=generate_uuid)
    keyword_id = Column(String, ForeignKey("keywords.id"), nullable=False)
    transcription_id = Column(String, ForeignKey("transcriptions.id"), nullable=False)
    timestamp = Column(DateTime, default=datetime.utcnow)


class PrivacyZone(Base):
    """Temporary mute zone for a node"""
    __tablename__ = "privacy_zones"
    
    id = Column(String, primary_key=True, default=generate_uuid)
    node_id = Column(String, ForeignKey("nodes.id"), nullable=False)
    reason = Column(String, nullable=True)
    start_time = Column(DateTime, default=datetime.utcnow)
    end_time = Column(DateTime, nullable=True)
    active = Column(Boolean, default=True)


class SystemMetrics(Base):
    """System metrics snapshot"""
    __tablename__ = "system_metrics"
    
    id = Column(String, primary_key=True, default=generate_uuid)
    timestamp = Column(DateTime, default=datetime.utcnow)
    cpu_usage = Column(Float, default=0.0)
    memory_usage = Column(Float, default=0.0)
    disk_usage = Column(Float, default=0.0)
    active_nodes = Column(Integer, default=0)
    transcription_count = Column(Integer, default=0)


class BatchClip(Base):
    """A 10-minute audio clip uploaded for batch transcription"""
    __tablename__ = "batch_clips"
    
    id = Column(String, primary_key=True, default=generate_uuid)
    node_id = Column(String, ForeignKey("nodes.id"), nullable=False)
    
    # File info
    filename = Column(String, nullable=False)
    file_path = Column(String, nullable=False)  # Full path on storage
    file_size = Column(Integer, default=0)  # Bytes
    duration_seconds = Column(Float, default=0.0)
    
    # Timestamps
    recorded_at = Column(DateTime, nullable=False)  # When recorded on node
    uploaded_at = Column(DateTime, default=datetime.utcnow)
    processed_at = Column(DateTime, nullable=True)
    
    # Processing status: pending, processing, transcribed, failed
    status = Column(String, default="pending")
    error_message = Column(Text, nullable=True)
    processing_duration_ms = Column(Integer, nullable=True)
    
    # Transcription result
    transcript_text = Column(Text, nullable=True)
    word_count = Column(Integer, default=0)
    
    # User-customizable metadata
    display_name = Column(String, nullable=True)  # Custom name
    notes = Column(Text, nullable=True)  # User notes/tags
    
    # Relationships
    node = relationship("Node", backref="batch_clips")
    segments = relationship("TranscriptSegment", back_populates="clip", cascade="all, delete-orphan")


class TranscriptSegment(Base):
    """Word-level or phrase-level timestamp segments within a batch clip"""
    __tablename__ = "transcript_segments"
    
    id = Column(String, primary_key=True, default=generate_uuid)
    clip_id = Column(String, ForeignKey("batch_clips.id"), nullable=False)
    
    # Timing within clip
    start_time = Column(Float, nullable=False)  # Seconds from clip start
    end_time = Column(Float, nullable=False)
    
    # Content
    text = Column(Text, nullable=False)
    confidence = Column(Float, default=0.0)
    
    # Optional speaker detection
    speaker_id = Column(String, ForeignKey("speakers.id"), nullable=True)
    
    # Relationships
    clip = relationship("BatchClip", back_populates="segments")
    speaker = relationship("Speaker")


def init_db():
    """Create all tables"""
    Base.metadata.create_all(bind=engine)


def get_db():
    """Dependency for FastAPI routes"""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
