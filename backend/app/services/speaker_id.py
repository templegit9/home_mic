"""
Speaker Identification Service
Uses SpeechBrain for voice embeddings and speaker matching
"""
import numpy as np
from typing import Optional, List, Tuple
import logging
from pathlib import Path
import pickle
from scipy.spatial.distance import cosine

logger = logging.getLogger(__name__)

# Lazy load SpeechBrain to avoid slow startup
_classifier = None


def get_speaker_classifier():
    """Lazy load the speaker embedding model"""
    global _classifier
    if _classifier is None:
        try:
            from speechbrain.inference.speaker import EncoderClassifier
            _classifier = EncoderClassifier.from_hparams(
                source="speechbrain/spkrec-ecapa-voxceleb",
                savedir="/opt/homemic/models/spkrec-ecapa-voxceleb",
                run_opts={"device": "cpu"}
            )
            logger.info("SpeechBrain speaker classifier loaded")
        except Exception as e:
            logger.error(f"Failed to load SpeechBrain: {e}")
            raise
    return _classifier


class SpeakerIdentificationService:
    """Handles speaker identification using voice embeddings"""
    
    def __init__(self):
        self.embeddings_cache: dict[str, np.ndarray] = {}
        self.similarity_threshold = 0.75  # Cosine similarity threshold for matching
    
    def extract_embedding(self, audio_data: bytes, sample_rate: int = 16000) -> Optional[np.ndarray]:
        """
        Extract voice embedding from audio data.
        
        Args:
            audio_data: Raw PCM audio bytes (16-bit, mono)
            sample_rate: Sample rate of the audio
        
        Returns:
            Numpy array of the voice embedding, or None if extraction fails
        """
        try:
            import torch
            import torchaudio
            
            # Convert bytes to tensor
            audio_array = np.frombuffer(audio_data, dtype=np.int16).astype(np.float32) / 32768.0
            audio_tensor = torch.tensor(audio_array).unsqueeze(0)
            
            # Resample if needed (SpeechBrain expects 16kHz)
            if sample_rate != 16000:
                resampler = torchaudio.transforms.Resample(sample_rate, 16000)
                audio_tensor = resampler(audio_tensor)
            
            # Extract embedding
            classifier = get_speaker_classifier()
            embedding = classifier.encode_batch(audio_tensor)
            
            return embedding.squeeze().numpy()
            
        except Exception as e:
            logger.error(f"Embedding extraction error: {e}")
            return None
    
    def identify_speaker(
        self, 
        audio_data: bytes, 
        known_speakers: List[Tuple[str, bytes]]
    ) -> Tuple[Optional[str], float]:
        """
        Identify the speaker from audio data.
        
        Args:
            audio_data: Raw PCM audio bytes
            known_speakers: List of (speaker_id, embedding_bytes) tuples
        
        Returns:
            Tuple of (speaker_id, confidence) or (None, 0.0) if no match
        """
        if not known_speakers:
            return None, 0.0
        
        # Extract embedding from input audio
        input_embedding = self.extract_embedding(audio_data)
        if input_embedding is None:
            return None, 0.0
        
        best_match_id = None
        best_similarity = 0.0
        
        for speaker_id, embedding_bytes in known_speakers:
            try:
                # Deserialize stored embedding
                stored_embedding = pickle.loads(embedding_bytes)
                
                # Calculate cosine similarity (1 - cosine distance)
                similarity = 1 - cosine(input_embedding, stored_embedding)
                
                if similarity > best_similarity and similarity >= self.similarity_threshold:
                    best_similarity = similarity
                    best_match_id = speaker_id
                    
            except Exception as e:
                logger.error(f"Error comparing with speaker {speaker_id}: {e}")
                continue
        
        return best_match_id, best_similarity
    
    def create_embedding(self, audio_samples: List[bytes]) -> Optional[bytes]:
        """
        Create a speaker embedding from multiple audio samples.
        Averages embeddings for more robust identification.
        
        Args:
            audio_samples: List of audio data bytes
        
        Returns:
            Serialized embedding bytes, or None if creation fails
        """
        if not audio_samples:
            return None
        
        embeddings = []
        for sample in audio_samples:
            embedding = self.extract_embedding(sample)
            if embedding is not None:
                embeddings.append(embedding)
        
        if not embeddings:
            return None
        
        # Average all embeddings
        avg_embedding = np.mean(embeddings, axis=0)
        
        # Normalize
        avg_embedding = avg_embedding / np.linalg.norm(avg_embedding)
        
        return pickle.dumps(avg_embedding)
    
    def update_embedding(
        self, 
        existing_embedding_bytes: bytes, 
        new_audio: bytes, 
        weight: float = 0.1
    ) -> bytes:
        """
        Update an existing embedding with new audio (incremental learning).
        
        Args:
            existing_embedding_bytes: Current serialized embedding
            new_audio: New audio sample
            weight: Weight for new embedding (0-1, default 0.1 = 10% influence)
        
        Returns:
            Updated serialized embedding
        """
        existing = pickle.loads(existing_embedding_bytes)
        new_embedding = self.extract_embedding(new_audio)
        
        if new_embedding is None:
            return existing_embedding_bytes
        
        # Weighted average
        updated = (1 - weight) * existing + weight * new_embedding
        
        # Normalize
        updated = updated / np.linalg.norm(updated)
        
        return pickle.dumps(updated)


# Singleton instance
_speaker_service: Optional[SpeakerIdentificationService] = None


def get_speaker_service() -> SpeakerIdentificationService:
    """Get or create the speaker identification service singleton"""
    global _speaker_service
    if _speaker_service is None:
        _speaker_service = SpeakerIdentificationService()
    return _speaker_service
