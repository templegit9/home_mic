"""
Whisper Transcription Service
Uses whisper.cpp for local speech-to-text
"""
import subprocess
import tempfile
import os
import wave
import numpy as np
from pathlib import Path
from typing import Optional, Tuple
import logging

from ..config import WHISPER_MAIN, WHISPER_MODEL, SAMPLE_RATE

logger = logging.getLogger(__name__)


class TranscriptionService:
    """Handles audio transcription using whisper.cpp"""
    
    def __init__(self):
        self.whisper_main = WHISPER_MAIN
        self.model_path = WHISPER_MODEL
        self._validate_installation()
    
    def _validate_installation(self):
        """Verify whisper.cpp is properly installed"""
        if not self.whisper_main.exists():
            raise RuntimeError(f"whisper.cpp main binary not found at {self.whisper_main}")
        if not self.model_path.exists():
            raise RuntimeError(f"Whisper model not found at {self.model_path}")
        logger.info(f"Whisper.cpp initialized with model: {self.model_path.name}")
    
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
            # Run whisper.cpp
            result = subprocess.run(
                [
                    str(self.whisper_main),
                    "-m", str(self.model_path),
                    "-f", tmp_path,
                    "--no-timestamps",
                    "--language", "en",
                    "--output-txt"
                ],
                capture_output=True,
                text=True,
                timeout=60  # 60 second timeout
            )
            
            if result.returncode != 0:
                logger.error(f"Whisper error: {result.stderr}")
                return "", 0.0
            
            # Parse output - whisper.cpp outputs to stdout
            text = result.stdout.strip()
            
            # Clean up common artifacts
            text = self._clean_transcription(text)
            
            # Estimate confidence based on output (whisper.cpp doesn't provide confidence directly)
            confidence = self._estimate_confidence(text, audio_data)
            
            return text, confidence
            
        except subprocess.TimeoutExpired:
            logger.error("Whisper transcription timed out")
            return "", 0.0
        except Exception as e:
            logger.error(f"Transcription error: {e}")
            return "", 0.0
        finally:
            # Clean up temp file
            if os.path.exists(tmp_path):
                os.unlink(tmp_path)
            # Also remove .txt output file if created
            txt_path = tmp_path.replace(".wav", ".txt")
            if os.path.exists(txt_path):
                os.unlink(txt_path)
    
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
            result = subprocess.run(
                [
                    str(self.whisper_main),
                    "-m", str(self.model_path),
                    "-f", str(file_path),
                    "--no-timestamps",
                    "--language", "en"
                ],
                capture_output=True,
                text=True,
                timeout=120
            )
            
            if result.returncode != 0:
                logger.error(f"Whisper error: {result.stderr}")
                return "", 0.0
            
            text = self._clean_transcription(result.stdout.strip())
            confidence = 0.9 if text else 0.0  # Simple confidence for file transcription
            
            return text, confidence
            
        except Exception as e:
            logger.error(f"File transcription error: {e}")
            return "", 0.0
    
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
        ]
        
        for artifact in artifacts:
            text = text.replace(artifact, "")
        
        # Clean whitespace
        text = " ".join(text.split())
        
        return text.strip()
    
    def _estimate_confidence(self, text: str, audio_data: bytes) -> float:
        """
        Estimate transcription confidence.
        Since whisper.cpp doesn't provide confidence scores, we estimate based on:
        - Audio energy (louder = more confident)
        - Text length relative to audio length
        """
        if not text:
            return 0.0
        
        try:
            # Convert bytes to numpy array
            audio_array = np.frombuffer(audio_data, dtype=np.int16).astype(np.float32)
            
            # Calculate RMS energy
            rms = np.sqrt(np.mean(audio_array ** 2))
            
            # Normalize RMS to 0-1 range (assuming 16-bit audio)
            normalized_rms = min(rms / 10000.0, 1.0)
            
            # Base confidence on audio energy
            confidence = 0.7 + (normalized_rms * 0.25)
            
            # Adjust based on text length
            audio_duration = len(audio_data) / (SAMPLE_RATE * 2)  # 2 bytes per sample
            words_per_second = len(text.split()) / audio_duration if audio_duration > 0 else 0
            
            # Normal speech is 2-4 words per second
            if 1.5 <= words_per_second <= 5.0:
                confidence += 0.05
            
            return min(confidence, 0.99)
            
        except Exception:
            return 0.85  # Default confidence


# Singleton instance
_transcription_service: Optional[TranscriptionService] = None


def get_transcription_service() -> TranscriptionService:
    """Get or create the transcription service singleton"""
    global _transcription_service
    if _transcription_service is None:
        _transcription_service = TranscriptionService()
    return _transcription_service
