"""
HomeMic Node Agent - Audio Capture Module
Captures audio from USB microphone on Raspberry Pi
"""
import pyaudio
import numpy as np
import threading
import queue
import logging
from typing import Optional, Callable

from config import SAMPLE_RATE, CHANNELS, CHUNK_DURATION, SILENCE_THRESHOLD

logger = logging.getLogger(__name__)


class AudioCapture:
    """Captures audio from USB microphone"""
    
    def __init__(
        self,
        sample_rate: int = SAMPLE_RATE,
        channels: int = CHANNELS,
        chunk_duration: float = CHUNK_DURATION,
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


if __name__ == "__main__":
    # Test audio capture
    logging.basicConfig(level=logging.INFO)
    
    capture = AudioCapture()
    print("Available audio devices:")
    for device in capture.list_devices():
        print(f"  [{device['index']}] {device['name']}")
    
    print("\nStarting capture for 10 seconds...")
    capture.start()
    
    import time
    for i in range(10):
        chunk = capture.get_chunk(timeout=2.0)
        if chunk:
            rms = AudioCapture.calculate_rms(chunk)
            is_speech = AudioCapture.is_speech(chunk)
            print(f"Chunk {i+1}: {len(chunk)} bytes, RMS: {rms:.0f}, Speech: {is_speech}")
    
    capture.stop()
    print("Done!")
