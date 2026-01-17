"""
HomeMic Transcription Service for Mac Mini
Receives audio files from Proxmox server, transcribes using faster-whisper,
stores audio on external drive, returns transcripts.
"""
from fastapi import FastAPI, File, UploadFile, HTTPException, BackgroundTasks
from fastapi.responses import FileResponse, JSONResponse
from pydantic import BaseModel
from pathlib import Path
import uuid
import logging
import time
from typing import Optional
import shutil

# Configuration
AUDIO_STORAGE = Path("/Volumes/MacMini_Ext/audio")
MODELS_DIR = Path("/Volumes/MacMini_Ext/models")
API_PORT = 8421
# Use MLX-optimized large-v3-turbo model
WHISPER_MODEL = "mlx-community/whisper-large-v3-turbo" 

# Ensure directories exist
AUDIO_STORAGE.mkdir(parents=True, exist_ok=True)
MODELS_DIR.mkdir(parents=True, exist_ok=True)

# Logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s"
)
logger = logging.getLogger(__name__)

# Job storage (in production, use Redis or SQLite)
transcription_jobs = {}

# Lazy-loaded whisper model placeholder
# MLX loads efficiently on demand, but we track status here
_model_loaded = False


class TranscriptionJob(BaseModel):
    job_id: str
    status: str  # pending, processing, completed, failed
    clip_id: Optional[str] = None
    audio_path: Optional[str] = None
    transcript: Optional[str] = None
    segments: Optional[list] = None
    error: Optional[str] = None
    created_at: float
    completed_at: Optional[float] = None


app = FastAPI(
    title="HomeMic Transcription Service (MLX)",
    description="Mac Mini transcription worker for HomeMic (Optimized for M4)",
    version="2.0.0"
)


@app.get("/")
def root():
    return {"service": "homemic-transcription-mlx", "status": "running"}


@app.get("/health")
def health():
    """Health check with model status"""
    storage_free = shutil.disk_usage(AUDIO_STORAGE).free // (1024**3)  # GB
    
    return {
        "status": "ok",
        "backend": "mlx-whisper",
        "model_loaded": _model_loaded,
        "model_size": WHISPER_MODEL,
        "storage_path": str(AUDIO_STORAGE),
        "storage_free_gb": storage_free,
        "pending_jobs": sum(1 for j in transcription_jobs.values() if j["status"] == "pending"),
        "processing_jobs": sum(1 for j in transcription_jobs.values() if j["status"] == "processing")
    }


@app.post("/transcribe")
async def transcribe_audio(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    clip_id: Optional[str] = None
):
    """
    Upload audio file for transcription.
    Returns job_id immediately, transcription happens in background.
    """
    job_id = str(uuid.uuid4())
    
    # Generate clip_id if not provided
    if not clip_id:
        clip_id = f"clip_{int(time.time())}_{job_id[:8]}"
    
    # Save audio file
    audio_path = AUDIO_STORAGE / f"{clip_id}.wav"
    
    try:
        with open(audio_path, "wb") as f:
            content = await file.read()
            f.write(content)
        
        logger.info(f"Saved audio file: {audio_path} ({len(content)} bytes)")
    except Exception as e:
        logger.error(f"Failed to save audio: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to save audio: {e}")
    
    # Create job
    job = {
        "job_id": job_id,
        "status": "pending",
        "clip_id": clip_id,
        "audio_path": str(audio_path),
        "transcript": None,
        "segments": None,
        "error": None,
        "created_at": time.time(),
        "completed_at": None
    }
    transcription_jobs[job_id] = job
    
    # Start background transcription
    background_tasks.add_task(process_transcription, job_id)
    
    return {"job_id": job_id, "clip_id": clip_id, "status": "pending"}


def process_transcription(job_id: str):
    """Background task to process transcription using MLX-Whisper"""
    global _model_loaded
    job = transcription_jobs.get(job_id)
    if not job:
        return
    
    try:
        job["status"] = "processing"
        logger.info(f"Processing transcription for job {job_id} using MLX")
        
        audio_path = str(job["audio_path"])
        
        # Import here to avoid loading on startup if not needed immediately
        import mlx_whisper
        
        # Transcribe using MLX
        # automatically handles ANE/GPU dispatch on Apple Silicon
        start_time = time.time()
        result = mlx_whisper.transcribe(
            audio_path,
            path_or_hf_repo=WHISPER_MODEL,
            verbose=False,
            word_timestamps=True
        )
        
        _model_loaded = True
        
        # Extract results
        full_text = result.get("text", "").strip()
        segments = result.get("segments", [])
        
        # Clean and format segments
        cleaned_segments = []
        full_text_parts = []
        
        for segment in segments:
            text = segment.get("text", "").strip()
            if not text:
                continue
                
            cleaned = clean_transcription(text)
            if not cleaned:
                continue
                
            full_text_parts.append(cleaned)
            
            cleaned_segments.append({
                "start": segment.get("start"),
                "end": segment.get("end"),
                "text": cleaned,
                "confidence": 1.0 # MLX doesn't always populate avg_logprob clearly in all versions, defaulting to 1.0 for now
            })
            
        final_text = " ".join(full_text_parts) if full_text_parts else full_text
        
        job["status"] = "completed"
        job["transcript"] = final_text
        job["segments"] = cleaned_segments
        job["completed_at"] = time.time()
        
        duration = job["completed_at"] - start_time
        logger.info(f"Completed MLX job {job_id}: {len(cleaned_segments)} segments in {duration:.1f}s")
        
    except Exception as e:
        logger.error(f"Transcription failed for job {job_id}: {e}")
        job["status"] = "failed"
        job["error"] = str(e)
        job["completed_at"] = time.time()


def clean_transcription(text: str) -> str:
    """Clean common whisper artifacts"""
    if not text:
        return ""
    
    artifacts = [
        "[BLANK_AUDIO]", "(silence)", "[silence]",
        "(inaudible)", "[inaudible]", "[MUSIC]", "(music)",
        "Thank you.", "Thanks for watching!",
    ]
    
    for artifact in artifacts:
        text = text.replace(artifact, "")
    
    return " ".join(text.split()).strip()


@app.get("/transcribe/{job_id}")
def get_transcription_status(job_id: str):
    """Get status and result of a transcription job"""
    job = transcription_jobs.get(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    
    return job


@app.get("/audio/{clip_id}")
def get_audio_file(clip_id: str):
    """Stream audio file by clip_id"""
    audio_path = AUDIO_STORAGE / f"{clip_id}.wav"
    
    if not audio_path.exists():
        raise HTTPException(status_code=404, detail="Audio file not found")
    
    return FileResponse(
        audio_path,
        media_type="audio/wav",
        filename=f"{clip_id}.wav"
    )


@app.delete("/audio/{clip_id}")
def delete_audio_file(clip_id: str):
    """Delete audio file by clip_id"""
    audio_path = AUDIO_STORAGE / f"{clip_id}.wav"
    
    if audio_path.exists():
        audio_path.unlink()
        logger.info(f"Deleted audio file: {clip_id}")
        return {"status": "deleted", "clip_id": clip_id}
    
    raise HTTPException(status_code=404, detail="Audio file not found")


@app.post("/transcribe-local/{clip_id}")
async def transcribe_local_file(
    clip_id: str,
    background_tasks: BackgroundTasks
):
    """
    Transcribe an audio file that already exists on the Mac Mini.
    Used for re-transcription with new model.
    """
    audio_path = AUDIO_STORAGE / f"{clip_id}.wav"
    
    if not audio_path.exists():
        raise HTTPException(status_code=404, detail=f"Audio file not found: {clip_id}")
    
    job_id = str(uuid.uuid4())
    
    job = {
        "job_id": job_id,
        "status": "pending",
        "clip_id": clip_id,
        "audio_path": str(audio_path),
        "transcript": None,
        "segments": None,
        "error": None,
        "created_at": time.time(),
        "completed_at": None
    }
    transcription_jobs[job_id] = job
    
    background_tasks.add_task(process_transcription, job_id)
    
    return {"job_id": job_id, "clip_id": clip_id, "status": "pending"}


@app.post("/retranscribe-all")
async def retranscribe_all_files(
    background_tasks: BackgroundTasks,
    batch_size: int = 5
):
    """
    Queue all existing audio files for re-transcription with the new model.
    Returns list of job IDs.
    """
    audio_files = list(AUDIO_STORAGE.glob("*.wav"))[:batch_size]
    
    jobs = []
    for audio_path in audio_files:
        clip_id = audio_path.stem  # filename without extension
        job_id = str(uuid.uuid4())
        
        job = {
            "job_id": job_id,
            "status": "pending",
            "clip_id": clip_id,
            "audio_path": str(audio_path),
            "transcript": None,
            "segments": None,
            "error": None,
            "created_at": time.time(),
            "completed_at": None
        }
        transcription_jobs[job_id] = job
        background_tasks.add_task(process_transcription, job_id)
        jobs.append({"job_id": job_id, "clip_id": clip_id})
    
    return {
        "status": "queued",
        "count": len(jobs),
        "total_files": len(list(AUDIO_STORAGE.glob("*.wav"))),
        "jobs": jobs
    }


@app.get("/storage/stats")
def storage_stats():
    """Get storage statistics"""
    usage = shutil.disk_usage(AUDIO_STORAGE)
    
    audio_files = list(AUDIO_STORAGE.glob("*.wav"))
    total_audio_size = sum(f.stat().st_size for f in audio_files)
    
    return {
        "total_gb": usage.total // (1024**3),
        "used_gb": usage.used // (1024**3),
        "free_gb": usage.free // (1024**3),
        "audio_files_count": len(audio_files),
        "audio_files_size_mb": total_audio_size // (1024**2)
    }


if __name__ == "__main__":
    import uvicorn
    
    # Pre-load model on startup
    logger.info("Pre-loading Whisper model...")
    get_whisper_model()
    
    uvicorn.run(app, host="0.0.0.0", port=API_PORT)
