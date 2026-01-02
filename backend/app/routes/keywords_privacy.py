"""
Keywords and privacy routes
"""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from datetime import datetime
from typing import List, Optional
from pydantic import BaseModel

from ..database import get_db, Keyword, PrivacyZone, Node

router = APIRouter(tags=["keywords", "privacy"])


# ============================================================================
# Keywords
# ============================================================================

class KeywordCreate(BaseModel):
    phrase: str
    alert_type: str = "notification"  # notification, sound, both
    case_sensitive: bool = False


class KeywordResponse(BaseModel):
    id: str
    phrase: str
    enabled: bool
    alert_type: str
    case_sensitive: bool
    detection_count: int
    last_detected: Optional[datetime]
    
    class Config:
        from_attributes = True


@router.get("/api/keywords", response_model=List[KeywordResponse])
def list_keywords(db: Session = Depends(get_db)):
    """Get all keywords"""
    return db.query(Keyword).all()


@router.post("/api/keywords", response_model=KeywordResponse)
def create_keyword(data: KeywordCreate, db: Session = Depends(get_db)):
    """Create a new keyword to detect"""
    keyword = Keyword(
        phrase=data.phrase,
        alert_type=data.alert_type,
        case_sensitive=data.case_sensitive
    )
    db.add(keyword)
    db.commit()
    db.refresh(keyword)
    return keyword


@router.put("/api/keywords/{keyword_id}/toggle")
def toggle_keyword(keyword_id: str, db: Session = Depends(get_db)):
    """Enable/disable a keyword"""
    keyword = db.query(Keyword).filter(Keyword.id == keyword_id).first()
    if not keyword:
        raise HTTPException(status_code=404, detail="Keyword not found")
    
    keyword.enabled = not keyword.enabled
    db.commit()
    return {"id": keyword_id, "enabled": keyword.enabled}


@router.delete("/api/keywords/{keyword_id}")
def delete_keyword(keyword_id: str, db: Session = Depends(get_db)):
    """Delete a keyword"""
    keyword = db.query(Keyword).filter(Keyword.id == keyword_id).first()
    if not keyword:
        raise HTTPException(status_code=404, detail="Keyword not found")
    
    db.delete(keyword)
    db.commit()
    return {"status": "deleted", "keyword_id": keyword_id}


# ============================================================================
# Privacy Zones (Muting)
# ============================================================================

class PrivacyZoneCreate(BaseModel):
    node_id: str
    duration_minutes: Optional[int] = None  # None = indefinite
    reason: Optional[str] = None


class PrivacyZoneResponse(BaseModel):
    id: str
    node_id: str
    reason: Optional[str]
    start_time: datetime
    end_time: Optional[datetime]
    active: bool
    
    class Config:
        from_attributes = True


@router.get("/api/privacy/zones", response_model=List[PrivacyZoneResponse])
def list_privacy_zones(active_only: bool = True, db: Session = Depends(get_db)):
    """Get privacy zones (active mutes)"""
    query = db.query(PrivacyZone)
    if active_only:
        query = query.filter(PrivacyZone.active == True)
    return query.all()


@router.post("/api/privacy/mute", response_model=PrivacyZoneResponse)
def mute_node(data: PrivacyZoneCreate, db: Session = Depends(get_db)):
    """Mute a node (create privacy zone)"""
    node = db.query(Node).filter(Node.id == data.node_id).first()
    if not node:
        raise HTTPException(status_code=404, detail="Node not found")
    
    # Deactivate any existing active zones for this node
    db.query(PrivacyZone).filter(
        PrivacyZone.node_id == data.node_id,
        PrivacyZone.active == True
    ).update({"active": False})
    
    # Calculate end time if duration specified
    end_time = None
    if data.duration_minutes:
        from datetime import timedelta
        end_time = datetime.utcnow() + timedelta(minutes=data.duration_minutes)
    
    zone = PrivacyZone(
        node_id=data.node_id,
        reason=data.reason,
        end_time=end_time,
        active=True
    )
    db.add(zone)
    db.commit()
    db.refresh(zone)
    return zone


@router.post("/api/privacy/unmute/{node_id}")
def unmute_node(node_id: str, db: Session = Depends(get_db)):
    """Unmute a node (deactivate privacy zone)"""
    updated = db.query(PrivacyZone).filter(
        PrivacyZone.node_id == node_id,
        PrivacyZone.active == True
    ).update({"active": False, "end_time": datetime.utcnow()})
    
    db.commit()
    return {"status": "unmuted", "node_id": node_id, "zones_deactivated": updated}


@router.post("/api/privacy/mute-all")
def mute_all_nodes(reason: Optional[str] = None, db: Session = Depends(get_db)):
    """Mute all nodes (global mute)"""
    nodes = db.query(Node).all()
    
    for node in nodes:
        # Deactivate existing zones
        db.query(PrivacyZone).filter(
            PrivacyZone.node_id == node.id,
            PrivacyZone.active == True
        ).update({"active": False})
        
        # Create new zone
        zone = PrivacyZone(
            node_id=node.id,
            reason=reason or "Global mute",
            active=True
        )
        db.add(zone)
    
    db.commit()
    return {"status": "all_muted", "node_count": len(nodes)}


@router.post("/api/privacy/unmute-all")
def unmute_all_nodes(db: Session = Depends(get_db)):
    """Unmute all nodes"""
    updated = db.query(PrivacyZone).filter(
        PrivacyZone.active == True
    ).update({"active": False, "end_time": datetime.utcnow()})
    
    db.commit()
    return {"status": "all_unmuted", "zones_deactivated": updated}


@router.get("/api/privacy/status/{node_id}")
def get_node_privacy_status(node_id: str, db: Session = Depends(get_db)):
    """Check if a node is currently muted"""
    zone = db.query(PrivacyZone).filter(
        PrivacyZone.node_id == node_id,
        PrivacyZone.active == True
    ).first()
    
    # Check if zone has expired
    if zone and zone.end_time and zone.end_time < datetime.utcnow():
        zone.active = False
        db.commit()
        zone = None
    
    return {
        "node_id": node_id,
        "muted": zone is not None,
        "zone": PrivacyZoneResponse.model_validate(zone) if zone else None
    }
