"""
Whisper Transcription Service
Uses faster-whisper for efficient CPU speech-to-text
"""
import os
import tempfile
import wave
import numpy as np
from pathlib import Path
from typing import Optional, Tuple
import logging

from ..config import SAMPLE_RATE

logger = logging.getLogger(__name__)

# Global model cache
_whisper_model = None


def get_whisper_model():
    """Lazy load the whisper model"""
    global _whisper_model
    if _whisper_model is None:
        try:
            from faster_whisper import WhisperModel
            
            # Use base model for balance of speed and quality
            # Options: tiny, base, small, medium, large
            model_size = os.environ.get("WHISPER_MODEL_SIZE", "base")
            
            logger.info(f"Loading faster-whisper model: {model_size}")
            _whisper_model = WhisperModel(
                model_size,
                device="cpu",
                compute_type="int8",  # Use int8 for faster CPU inference
                cpu_threads=2
            )
            logger.info(f"faster-whisper model loaded successfully")
        except Exception as e:
            logger.error(f"Failed to load faster-whisper: {e}")
            raise
    return _whisper_model


class TranscriptionService:
    """Handles audio transcription using faster-whisper"""
    
    def __init__(self):
        # Pre-load model on init
        try:
            get_whisper_model()
            logger.info("Transcription service initialized with faster-whisper")
        except Exception as e:
            logger.warning(f"Could not pre-load whisper model: {e}")
    
    def transcribe_audio(self, audio_data: bytes, sample_rate: int = SAMPLE_RATE) -> Tuple[str, float]:
        """
        Transcribe audio bytes to text.
        
        Args:
            audio_data: Raw PCM audio bytes (16-bit, mono)
            sample_rate: Sample rate of the audio (default 16kHz)
        
        Returns:
            Tuple of (transcribed_text, confidence_score)
        """
        # Create temporary WAV file
        with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as tmp_file:
            tmp_path = tmp_file.name
            
            # Write WAV file
            with wave.open(tmp_path, 'wb') as wav_file:
                wav_file.setnchannels(1)  # Mono
                wav_file.setsampwidth(2)  # 16-bit
                wav_file.setframerate(sample_rate)
                wav_file.writeframes(audio_data)
        
        try:
            model = get_whisper_model()
            
            # Transcribe with faster-whisper
            segments, info = model.transcribe(
                tmp_path,
                language="en",
                beam_size=5,
                vad_filter=True,  # Use built-in VAD
                vad_parameters=dict(min_silence_duration_ms=500)
            )
            
            # Collect all text segments
            text_parts = []
            total_confidence = 0.0
            segment_count = 0
            
            for segment in segments:
                text_parts.append(segment.text.strip())
                # faster-whisper provides avg_logprob, convert to confidence
                if segment.avg_logprob:
                    # logprob is negative, closer to 0 = more confident
                    confidence = min(1.0, max(0.0, 1.0 + segment.avg_logprob / 5.0))
                    total_confidence += confidence
                    segment_count += 1
            
            text = " ".join(text_parts)
            text = self._clean_transcription(text)
            
            # Average confidence
            if segment_count > 0:
                avg_confidence = total_confidence / segment_count
            else:
                avg_confidence = 0.0 if not text else 0.8
            
            return text, avg_confidence
            
        except Exception as e:
            logger.error(f"Transcription error: {e}")
            return "", 0.0
        finally:
            # Clean up temp file
            if os.path.exists(tmp_path):
                os.unlink(tmp_path)
    
    def transcribe_file(self, file_path: Path) -> Tuple[str, float]:
        """
        Transcribe an audio file directly.
        
        Args:
            file_path: Path to WAV file
        
        Returns:
            Tuple of (transcribed_text, confidence_score)
        """
        if not file_path.exists():
            raise FileNotFoundError(f"Audio file not found: {file_path}")
        
        try:
            model = get_whisper_model()
            
            segments, info = model.transcribe(
                str(file_path),
                language="en",
                beam_size=5,
                vad_filter=True
            )
            
            text_parts = [segment.text.strip() for segment in segments]
            text = " ".join(text_parts)
            text = self._clean_transcription(text)
            
            return text, 0.9 if text else 0.0
            
        except Exception as e:
            logger.error(f"File transcription error: {e}")
            return "", 0.0
    
    def transcribe_file_with_timestamps(self, file_path: Path) -> Tuple[str, list]:
        """
        Transcribe an audio file with segment-level timestamps.
        Used for batch processing 10-minute clips.
        
        Args:
            file_path: Path to WAV file
        
        Returns:
            Tuple of (full_text, segments_list)
            where segments_list contains dicts with {start, end, text, confidence}
        """
        if not file_path.exists():
            raise FileNotFoundError(f"Audio file not found: {file_path}")
        
        try:
            model = get_whisper_model()
            
            # Transcribe with word-level timestamps
            segments_iter, info = model.transcribe(
                str(file_path),
                language="en",
                beam_size=5,
                vad_filter=True,
                vad_parameters=dict(min_silence_duration_ms=500),
                word_timestamps=True  # Enable word-level timestamps
            )
            
            full_text_parts = []
            segment_list = []
            
            for segment in segments_iter:
                text = segment.text.strip()
                if not text:
                    continue
                
                cleaned_text = self._clean_transcription(text)
                if not cleaned_text:
                    continue
                
                full_text_parts.append(cleaned_text)
                
                # Calculate confidence from logprob
                confidence = 0.8  # Default
                if segment.avg_logprob:
                    confidence = min(1.0, max(0.0, 1.0 + segment.avg_logprob / 5.0))
                
                segment_list.append({
                    'start': segment.start,
                    'end': segment.end,
                    'text': cleaned_text,
                    'confidence': confidence
                })
            
            full_text = " ".join(full_text_parts)
            
            logger.info(f"Transcribed {file_path.name}: {len(segment_list)} segments, {len(full_text)} chars")
            
            return full_text, segment_list
            
        except Exception as e:
            logger.error(f"File transcription with timestamps error: {e}")
            return "", []
    
    def _clean_transcription(self, text: str) -> str:
        """Clean up common whisper artifacts"""
        if not text:
            return ""
        
        # Remove common artifacts
        artifacts = [
            "[BLANK_AUDIO]",
            "(silence)",
            "[silence]",
            "(inaudible)",
            "[inaudible]",
            "[MUSIC]",
            "(music)",
            "Thank you.",  # Common whisper hallucination
            "Thanks for watching!",
        ]
        
        for artifact in artifacts:
            text = text.replace(artifact, "")
        
        # Clean whitespace
        text = " ".join(text.split())
        
        return text.strip()


# Singleton instance
_transcription_service: Optional[TranscriptionService] = None


def get_transcription_service() -> TranscriptionService:
    """Get or create the transcription service singleton"""
    global _transcription_service
    if _transcription_service is None:
        _transcription_service = TranscriptionService()
    return _transcription_service
