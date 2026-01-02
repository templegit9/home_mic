"""
Audio Processing Utilities
"""
import numpy as np
from typing import Optional
import logging
import io
import wave

logger = logging.getLogger(__name__)


class AudioProcessor:
    """Utilities for audio processing"""
    
    @staticmethod
    def normalize_audio(audio_data: bytes, target_db: float = -20.0) -> bytes:
        """
        Normalize audio to target dB level.
        
        Args:
            audio_data: Raw PCM audio bytes (16-bit, mono)
            target_db: Target dB level (default -20 dB)
        
        Returns:
            Normalized audio bytes
        """
        audio_array = np.frombuffer(audio_data, dtype=np.int16).astype(np.float32)
        
        # Calculate current RMS
        rms = np.sqrt(np.mean(audio_array ** 2))
        if rms == 0:
            return audio_data
        
        # Calculate target RMS from dB
        target_rms = 10 ** (target_db / 20) * 32768
        
        # Scale audio
        scale = target_rms / rms
        normalized = audio_array * scale
        
        # Clip to valid range
        normalized = np.clip(normalized, -32768, 32767)
        
        return normalized.astype(np.int16).tobytes()
    
    @staticmethod
    def apply_noise_gate(
        audio_data: bytes, 
        threshold_db: float = -40.0,
        sample_rate: int = 16000
    ) -> bytes:
        """
        Apply noise gate to reduce background noise.
        
        Args:
            audio_data: Raw PCM audio bytes
            threshold_db: Gate threshold in dB
            sample_rate: Audio sample rate
        
        Returns:
            Gated audio bytes
        """
        audio_array = np.frombuffer(audio_data, dtype=np.int16).astype(np.float32)
        
        # Calculate threshold in linear scale
        threshold = 10 ** (threshold_db / 20) * 32768
        
        # Window size for envelope detection (50ms)
        window_size = int(sample_rate * 0.05)
        
        # Calculate envelope
        envelope = np.zeros_like(audio_array)
        for i in range(0, len(audio_array) - window_size, window_size // 2):
            envelope[i:i + window_size] = np.max(np.abs(audio_array[i:i + window_size]))
        
        # Apply gate
        gate_mask = envelope > threshold
        gated = audio_array * gate_mask
        
        return gated.astype(np.int16).tobytes()
    
    @staticmethod
    def calculate_energy(audio_data: bytes) -> float:
        """
        Calculate the energy (RMS) of audio data.
        
        Args:
            audio_data: Raw PCM audio bytes
        
        Returns:
            RMS energy value
        """
        audio_array = np.frombuffer(audio_data, dtype=np.int16).astype(np.float32)
        return np.sqrt(np.mean(audio_array ** 2))
    
    @staticmethod
    def is_speech(
        audio_data: bytes, 
        energy_threshold: float = 500.0,
        zero_crossing_threshold: float = 0.1
    ) -> bool:
        """
        Simple voice activity detection based on energy and zero-crossing rate.
        
        Args:
            audio_data: Raw PCM audio bytes
            energy_threshold: Minimum RMS energy for speech
            zero_crossing_threshold: Minimum zero-crossing rate for speech
        
        Returns:
            True if audio likely contains speech
        """
        audio_array = np.frombuffer(audio_data, dtype=np.int16).astype(np.float32)
        
        # Check energy
        rms = np.sqrt(np.mean(audio_array ** 2))
        if rms < energy_threshold:
            return False
        
        # Check zero-crossing rate
        zero_crossings = np.sum(np.abs(np.diff(np.sign(audio_array)))) / 2
        zcr = zero_crossings / len(audio_array)
        
        # Speech typically has ZCR between 0.01 and 0.2
        return 0.01 < zcr < 0.3
    
    @staticmethod
    def bytes_to_wav(audio_data: bytes, sample_rate: int = 16000) -> bytes:
        """
        Convert raw PCM bytes to WAV format.
        
        Args:
            audio_data: Raw PCM audio bytes (16-bit, mono)
            sample_rate: Sample rate
        
        Returns:
            WAV file bytes
        """
        buffer = io.BytesIO()
        with wave.open(buffer, 'wb') as wav_file:
            wav_file.setnchannels(1)
            wav_file.setsampwidth(2)
            wav_file.setframerate(sample_rate)
            wav_file.writeframes(audio_data)
        return buffer.getvalue()
    
    @staticmethod
    def wav_to_bytes(wav_data: bytes) -> tuple[bytes, int]:
        """
        Extract raw PCM bytes from WAV format.
        
        Args:
            wav_data: WAV file bytes
        
        Returns:
            Tuple of (raw PCM bytes, sample rate)
        """
        buffer = io.BytesIO(wav_data)
        with wave.open(buffer, 'rb') as wav_file:
            sample_rate = wav_file.getframerate()
            audio_data = wav_file.readframes(wav_file.getnframes())
        return audio_data, sample_rate
    
    @staticmethod
    def resample(
        audio_data: bytes, 
        from_rate: int, 
        to_rate: int
    ) -> bytes:
        """
        Resample audio to different sample rate.
        
        Args:
            audio_data: Raw PCM audio bytes
            from_rate: Original sample rate
            to_rate: Target sample rate
        
        Returns:
            Resampled audio bytes
        """
        if from_rate == to_rate:
            return audio_data
        
        audio_array = np.frombuffer(audio_data, dtype=np.int16).astype(np.float32)
        
        # Simple linear interpolation resampling
        duration = len(audio_array) / from_rate
        new_length = int(duration * to_rate)
        
        old_indices = np.arange(len(audio_array))
        new_indices = np.linspace(0, len(audio_array) - 1, new_length)
        
        resampled = np.interp(new_indices, old_indices, audio_array)
        
        return resampled.astype(np.int16).tobytes()
