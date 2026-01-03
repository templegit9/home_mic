"""
HomeMic Node Agent - Audio Capture Module
Captures audio from USB microphone on Raspberry Pi
Records 10-minute batch clips for server transcription
"""
import pyaudio
import numpy as np
import threading
import queue
import wave
import os
import logging
from datetime import datetime
from pathlib import Path
from typing import Optional, Callable

from config import (
    SAMPLE_RATE, CHANNELS, SILENCE_THRESHOLD,
    BATCH_DURATION, LOCAL_STORAGE_DIR
)

logger = logging.getLogger(__name__)

logger = logging.getLogger(__name__)


class AudioCapture:
    """Captures audio from USB microphone"""
    
    def __init__(
        self,
        sample_rate: int = SAMPLE_RATE,
        channels: int = CHANNELS,
        chunk_duration: float = 0.5,  # Default 0.5s chunks (legacy, not used in batch mode)
        device_index: Optional[int] = None
    ):
        self.sample_rate = sample_rate
        self.channels = channels
        self.chunk_duration = chunk_duration
        self.device_index = device_index
        
        # Calculate chunk size in frames
        self.chunk_size = int(sample_rate * chunk_duration)
        
        # PyAudio instance
        self.pa: Optional[pyaudio.PyAudio] = None
        self.stream: Optional[pyaudio.Stream] = None
        
        # Threading
        self.audio_queue: queue.Queue = queue.Queue()
        self.is_running = False
        self.capture_thread: Optional[threading.Thread] = None
        
    def list_devices(self) -> list:
        """List available audio input devices"""
        pa = pyaudio.PyAudio()
        devices = []
        
        for i in range(pa.get_device_count()):
            info = pa.get_device_info_by_index(i)
            if info['maxInputChannels'] > 0:
                devices.append({
                    'index': i,
                    'name': info['name'],
                    'channels': info['maxInputChannels'],
                    'sample_rate': int(info['defaultSampleRate'])
                })
        
        pa.terminate()
        return devices
    
    def find_usb_microphone(self) -> Optional[int]:
        """Auto-detect USB microphone"""
        devices = self.list_devices()
        
        # Look for USB audio devices
        usb_keywords = ['usb', 'USB', 'seeed', 'respeaker', 'ReSpeaker']
        
        for device in devices:
            for keyword in usb_keywords:
                if keyword.lower() in device['name'].lower():
                    logger.info(f"Found USB microphone: {device['name']} (index {device['index']})")
                    return device['index']
        
        # Fall back to first available input device
        if devices:
            logger.warning(f"No USB mic found, using: {devices[0]['name']}")
            return devices[0]['index']
        
        return None
    
    def start(self, callback: Optional[Callable[[bytes], None]] = None):
        """Start audio capture"""
        if self.is_running:
            logger.warning("Audio capture already running")
            return
        
        # Auto-detect device if not specified
        if self.device_index is None:
            self.device_index = self.find_usb_microphone()
            if self.device_index is None:
                raise RuntimeError("No audio input device found")
        
        # Initialize PyAudio
        self.pa = pyaudio.PyAudio()
        
        # Open stream
        try:
            self.stream = self.pa.open(
                format=pyaudio.paInt16,
                channels=self.channels,
                rate=self.sample_rate,
                input=True,
                input_device_index=self.device_index,
                frames_per_buffer=1024
            )
        except Exception as e:
            logger.error(f"Failed to open audio stream: {e}")
            self.pa.terminate()
            raise
        
        self.is_running = True
        
        # Start capture thread
        self.capture_thread = threading.Thread(
            target=self._capture_loop,
            args=(callback,),
            daemon=True
        )
        self.capture_thread.start()
        
        logger.info(f"Audio capture started (device {self.device_index}, {self.sample_rate}Hz)")
    
    def stop(self):
        """Stop audio capture"""
        self.is_running = False
        
        if self.capture_thread:
            self.capture_thread.join(timeout=2.0)
        
        if self.stream:
            self.stream.stop_stream()
            self.stream.close()
            self.stream = None
        
        if self.pa:
            self.pa.terminate()
            self.pa = None
        
        logger.info("Audio capture stopped")
    
    def _capture_loop(self, callback: Optional[Callable[[bytes], None]]):
        """Main capture loop - runs in separate thread"""
        buffer = []
        frames_needed = self.chunk_size
        
        while self.is_running:
            try:
                # Read audio data
                data = self.stream.read(1024, exception_on_overflow=False)
                buffer.append(data)
                
                # Calculate total frames in buffer
                total_frames = sum(len(d) // 2 for d in buffer)  # 2 bytes per sample
                
                if total_frames >= frames_needed:
                    # Combine buffer into single chunk
                    audio_bytes = b''.join(buffer)
                    buffer = []
                    
                    # Put in queue or call callback
                    if callback:
                        callback(audio_bytes)
                    else:
                        self.audio_queue.put(audio_bytes)
                        
            except Exception as e:
                logger.error(f"Audio capture error: {e}")
                if not self.is_running:
                    break
    
    def get_chunk(self, timeout: float = 5.0) -> Optional[bytes]:
        """Get next audio chunk from queue"""
        try:
            return self.audio_queue.get(timeout=timeout)
        except queue.Empty:
            return None
    
    @staticmethod
    def calculate_rms(audio_data: bytes) -> float:
        """Calculate RMS energy of audio data"""
        audio_array = np.frombuffer(audio_data, dtype=np.int16).astype(np.float32)
        return np.sqrt(np.mean(audio_array ** 2))
    
    @staticmethod
    def is_speech(audio_data: bytes, threshold: float = SILENCE_THRESHOLD) -> bool:
        """Simple VAD based on RMS energy"""
        rms = AudioCapture.calculate_rms(audio_data)
        return rms > threshold


class BatchRecorder:
    """
    Records continuous audio streams to 10-minute WAV files.
    Files are saved with timestamps and coordinated with BatchUploader.
    """
    
    def __init__(
        self,
        storage_dir: str = LOCAL_STORAGE_DIR,
        batch_duration: float = BATCH_DURATION,
        sample_rate: int = SAMPLE_RATE,
        channels: int = CHANNELS,
        device_index: Optional[int] = None
    ):
        self.storage_dir = Path(storage_dir)
        self.batch_duration = batch_duration
        self.sample_rate = sample_rate
        self.channels = channels
        self.device_index = device_index
        
        # Calculate frames per batch
        self.frames_per_batch = int(sample_rate * batch_duration)
        
        # Audio components
        self.pa: Optional[pyaudio.PyAudio] = None
        self.stream: Optional[pyaudio.Stream] = None
        
        # Recording state
        self.is_running = False
        self._thread: Optional[threading.Thread] = None
        self.current_clip_path: Optional[Path] = None
        
        # Callbacks
        self.on_clip_complete: Optional[Callable[[str], None]] = None
        self.on_audio_level: Optional[Callable[[float], None]] = None
        
        # Stats
        self.clips_recorded = 0
        self.total_seconds = 0.0
    
    def _find_device(self) -> Optional[int]:
        """Auto-detect USB microphone"""
        capture = AudioCapture()
        return capture.find_usb_microphone()
    
    def start(self):
        """Start batch recording"""
        if self.is_running:
            logger.warning("Batch recorder already running")
            return
        
        # Ensure storage directory exists
        self.storage_dir.mkdir(parents=True, exist_ok=True)
        
        # Auto-detect device if not specified
        if self.device_index is None:
            self.device_index = self._find_device()
            if self.device_index is None:
                raise RuntimeError("No audio input device found")
        
        # Initialize PyAudio
        self.pa = pyaudio.PyAudio()
        
        try:
            self.stream = self.pa.open(
                format=pyaudio.paInt16,
                channels=self.channels,
                rate=self.sample_rate,
                input=True,
                input_device_index=self.device_index,
                frames_per_buffer=1024
            )
        except Exception as e:
            logger.error(f"Failed to open audio stream: {e}")
            self.pa.terminate()
            raise
        
        self.is_running = True
        
        # Start recording thread
        self._thread = threading.Thread(target=self._record_loop, daemon=True)
        self._thread.start()
        
        logger.info(f"Batch recorder started (device {self.device_index}, {self.batch_duration}s clips)")
    
    def stop(self):
        """Stop batch recording"""
        self.is_running = False
        
        if self._thread:
            self._thread.join(timeout=5.0)
        
        if self.stream:
            self.stream.stop_stream()
            self.stream.close()
            self.stream = None
        
        if self.pa:
            self.pa.terminate()
            self.pa = None
        
        logger.info(f"Batch recorder stopped. Clips: {self.clips_recorded}, Total: {self.total_seconds:.0f}s")
    
    def _generate_filename(self) -> Path:
        """Generate timestamped filename for new clip"""
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        return self.storage_dir / f"clip_{timestamp}.wav"
    
    def _record_loop(self):
        """Main recording loop - creates 10-minute WAV files"""
        while self.is_running:
            try:
                # Start new clip
                clip_path = self._generate_filename()
                recording_marker = clip_path.with_suffix('.recording')
                
                # Create marker to indicate recording in progress
                recording_marker.touch()
                self.current_clip_path = clip_path
                
                logger.info(f"Recording new clip: {clip_path.name}")
                
                # Open WAV file for writing
                wav_file = wave.open(str(clip_path), 'wb')
                wav_file.setnchannels(self.channels)
                wav_file.setsampwidth(2)  # 16-bit
                wav_file.setframerate(self.sample_rate)
                
                frames_recorded = 0
                level_check_interval = self.sample_rate  # Check level every second
                frames_since_level_check = 0
                level_samples = []
                
                try:
                    while self.is_running and frames_recorded < self.frames_per_batch:
                        # Read audio chunk
                        try:
                            data = self.stream.read(1024, exception_on_overflow=False)
                        except Exception as e:
                            logger.warning(f"Audio read error: {e}")
                            continue
                        
                        # Write to file
                        wav_file.writeframes(data)
                        
                        # Update counters
                        chunk_frames = len(data) // 2  # 2 bytes per sample (16-bit)
                        frames_recorded += chunk_frames
                        frames_since_level_check += chunk_frames
                        
                        # Calculate and report audio level periodically
                        level_samples.append(data)
                        if frames_since_level_check >= level_check_interval:
                            combined = b''.join(level_samples)
                            rms = AudioCapture.calculate_rms(combined)
                            if self.on_audio_level:
                                self.on_audio_level(rms)
                            level_samples = []
                            frames_since_level_check = 0
                    
                finally:
                    wav_file.close()
                
                # Remove recording marker
                if recording_marker.exists():
                    recording_marker.unlink()
                
                self.current_clip_path = None
                self.clips_recorded += 1
                self.total_seconds += frames_recorded / self.sample_rate
                
                logger.info(f"Clip complete: {clip_path.name} ({frames_recorded / self.sample_rate:.1f}s)")
                
                # Notify callback
                if self.on_clip_complete:
                    self.on_clip_complete(str(clip_path))
                    
            except Exception as e:
                logger.error(f"Recording loop error: {e}")
                time.sleep(1)


if __name__ == "__main__":
    # Test audio capture
    import time
    logging.basicConfig(level=logging.INFO)
    
    capture = AudioCapture()
    print("Available audio devices:")
    for device in capture.list_devices():
        print(f"  [{device['index']}] {device['name']}")
    
    print("\nTesting BatchRecorder for 30 seconds (short test)...")
    
    # For testing, use a shorter duration
    recorder = BatchRecorder(batch_duration=30)  # 30 seconds for testing
    
    def on_level(rms):
        bars = int(rms / 100)
        print(f"Level: {'█' * min(bars, 50):<50} ({rms:.0f})")
    
    recorder.on_audio_level = on_level
    recorder.start()
    
    time.sleep(35)  # Wait for one clip to complete
    
    recorder.stop()
    print(f"\nRecorded {recorder.clips_recorded} clips")
    print(f"Check: {recorder.storage_dir}")

