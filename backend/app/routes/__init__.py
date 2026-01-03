"""Routes package"""
from .nodes import router as nodes_router
from .speakers import router as speakers_router
from .transcriptions import router as transcriptions_router
from .keywords_privacy import router as keywords_privacy_router
from .websocket import router as websocket_router
from .system import router as system_router
from .batch import router as batch_router
from .control import router as control_router

__all__ = [
    "nodes_router",
    "speakers_router", 
    "transcriptions_router",
    "keywords_privacy_router",
    "websocket_router",
    "system_router",
    "batch_router",
    "control_router",
]

