"""
HomeMic API Server
Privacy-First Smart Microphone System
"""
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
import logging

from .config import API_HOST, API_PORT
from .database import init_db

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s"
)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan handler"""
    # Startup
    logger.info("Starting HomeMic API Server...")
    
    # Initialize database
    init_db()
    logger.info("Database initialized")
    
    # Pre-load transcription service (warm up whisper.cpp)
    try:
        from .services import get_transcription_service
        get_transcription_service()
        logger.info("Transcription service ready")
    except Exception as e:
        logger.warning(f"Transcription service not available: {e}")
    
    yield
    
    # Shutdown
    logger.info("Shutting down HomeMic API Server...")


# Create FastAPI app
app = FastAPI(
    title="HomeMic API",
    description="Privacy-First Smart Microphone System - All processing local, no cloud dependencies",
    version="1.0.0",
    lifespan=lifespan
)

# CORS middleware for React frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # In production, restrict to your frontend URL
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Import and include routers
from .routes import (
    nodes_router,
    speakers_router,
    transcriptions_router,
    keywords_privacy_router,
    websocket_router,
    system_router,
    batch_router,
    control_router,
)

app.include_router(nodes_router)
app.include_router(speakers_router)
app.include_router(transcriptions_router)
app.include_router(keywords_privacy_router)
app.include_router(websocket_router)
app.include_router(system_router)
app.include_router(batch_router)
app.include_router(control_router)


@app.get("/")
def root():
    """Health check endpoint"""
    return {
        "name": "HomeMic",
        "version": "1.0.0",
        "status": "running",
        "privacy": "local_only"
    }


@app.get("/health")
def health_check():
    """Detailed health check"""
    from .database import SessionLocal
    
    health = {
        "api": "ok",
        "database": "unknown",
        "whisper": "unknown"
    }
    
    # Check database
    try:
        db = SessionLocal()
        db.execute("SELECT 1")
        db.close()
        health["database"] = "ok"
    except Exception as e:
        health["database"] = f"error: {str(e)}"
    
    # Check whisper
    try:
        from .services import get_transcription_service
        get_transcription_service()
        health["whisper"] = "ok"
    except Exception as e:
        health["whisper"] = f"error: {str(e)}"
    
    return health


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "app.main:app",
        host=API_HOST,
        port=API_PORT,
        reload=True
    )
