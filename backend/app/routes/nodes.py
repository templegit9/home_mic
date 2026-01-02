"""
Node management routes
"""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from datetime import datetime
from typing import List
from pydantic import BaseModel

from ..database import get_db, Node

router = APIRouter(prefix="/api/nodes", tags=["nodes"])


class NodeCreate(BaseModel):
    name: str
    location: str


class NodeUpdate(BaseModel):
    name: str | None = None
    location: str | None = None
    audio_filtering: bool | None = None


class NodeResponse(BaseModel):
    id: str
    name: str
    location: str
    status: str
    audio_filtering: bool
    latency: float
    last_seen: datetime
    
    class Config:
        from_attributes = True


@router.get("", response_model=List[NodeResponse])
def list_nodes(db: Session = Depends(get_db)):
    """Get all registered nodes"""
    nodes = db.query(Node).all()
    return nodes


@router.get("/{node_id}", response_model=NodeResponse)
def get_node(node_id: str, db: Session = Depends(get_db)):
    """Get a specific node"""
    node = db.query(Node).filter(Node.id == node_id).first()
    if not node:
        raise HTTPException(status_code=404, detail="Node not found")
    return node


@router.post("", response_model=NodeResponse)
def create_node(node_data: NodeCreate, db: Session = Depends(get_db)):
    """Register a new node"""
    node = Node(
        name=node_data.name,
        location=node_data.location,
        status="online",
        last_seen=datetime.utcnow()
    )
    db.add(node)
    db.commit()
    db.refresh(node)
    return node


@router.put("/{node_id}", response_model=NodeResponse)
def update_node(node_id: str, node_data: NodeUpdate, db: Session = Depends(get_db)):
    """Update a node's settings"""
    node = db.query(Node).filter(Node.id == node_id).first()
    if not node:
        raise HTTPException(status_code=404, detail="Node not found")
    
    if node_data.name is not None:
        node.name = node_data.name
    if node_data.location is not None:
        node.location = node_data.location
    if node_data.audio_filtering is not None:
        node.audio_filtering = node_data.audio_filtering
    
    db.commit()
    db.refresh(node)
    return node


@router.delete("/{node_id}")
def delete_node(node_id: str, db: Session = Depends(get_db)):
    """Remove a node"""
    node = db.query(Node).filter(Node.id == node_id).first()
    if not node:
        raise HTTPException(status_code=404, detail="Node not found")
    
    db.delete(node)
    db.commit()
    return {"status": "deleted", "node_id": node_id}


@router.post("/{node_id}/heartbeat")
def node_heartbeat(node_id: str, latency: float = 0, db: Session = Depends(get_db)):
    """Update node's last seen timestamp and latency"""
    node = db.query(Node).filter(Node.id == node_id).first()
    if not node:
        raise HTTPException(status_code=404, detail="Node not found")
    
    node.last_seen = datetime.utcnow()
    node.latency = latency
    node.status = "online"
    
    db.commit()
    return {"status": "ok"}
