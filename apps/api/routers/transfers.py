"""apps/api/routers/transfers.py — Multipath transfer initiation and status."""

from __future__ import annotations

import asyncio
import uuid
from datetime import datetime
from typing import Optional

from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel

from apps.api.deps import DbSession
from netrescue.core.models import Chunk, Transfer
from netrescue.transfer.scheduler import PathState
from netrescue.transfer.session import MultipathTransferSession

router = APIRouter(prefix="/api", tags=["transfers"])


class PathConfig(BaseModel):
    path_id: str
    fd_estimate_ms: float = 10.0
    tp_estimate_bps: float = 1_000_000.0
    loss_rate: float = 0.0


class TransferCreate(BaseModel):
    run_id: str
    data_b64: str  # base64-encoded payload
    scheduler_variant: str = "DB-DSP"
    chunk_size_bytes: int = 4096
    max_retries: int = 3
    paths: list[PathConfig]


class ChunkOut(BaseModel):
    chunk_index: int
    status: str
    path_id: Optional[str]
    attempts: int

    class Config:
        from_attributes = True


class TransferOut(BaseModel):
    transfer_id: str
    run_id: str
    scheduler_variant: str
    total_chunks: int
    status: str
    integrity_ok: Optional[bool]
    source_sha256: Optional[str]
    receiver_sha256: Optional[str]
    started_at: Optional[datetime]
    ended_at: Optional[datetime]

    class Config:
        from_attributes = True


class TransferDetailOut(TransferOut):
    chunks: list[ChunkOut]


@router.post("/transfers", response_model=TransferOut, status_code=status.HTTP_201_CREATED)
async def initiate_transfer(body: TransferCreate, db: DbSession):
    """
    Initiate a multipath file transfer.

    The payload is provided as a base64-encoded string for API simplicity.
    In production, use a streaming multipart upload; this endpoint is sized
    for benchmark data volumes, not large files.
    """
    import base64

    if not body.paths:
        raise HTTPException(status_code=422, detail="At least one path is required.")

    try:
        data = base64.b64decode(body.data_b64)
    except Exception:
        raise HTTPException(status_code=422, detail="data_b64 is not valid base64.")

    transfer_id = str(uuid.uuid4())
    paths = [
        PathState(
            path_id=p.path_id,
            fd_estimate_ms=p.fd_estimate_ms,
            tp_estimate_bps=p.tp_estimate_bps,
            loss_rate=p.loss_rate,
        )
        for p in body.paths
    ]

    session = MultipathTransferSession(
        run_id=body.run_id,
        transfer_id=transfer_id,
        paths=paths,
        chunk_size_bytes=body.chunk_size_bytes,
        scheduler_variant=body.scheduler_variant,
        max_retries=body.max_retries,
        db_session=db,
    )

    result = await session.transfer(data=data)

    # Fetch the persisted Transfer row
    xfer = db.query(Transfer).filter(Transfer.transfer_id == transfer_id).first()
    if not xfer:
        # Return the in-memory result if DB persist failed (degraded mode)
        return {
            "transfer_id": transfer_id,
            "run_id": body.run_id,
            "scheduler_variant": body.scheduler_variant,
            "total_chunks": result.total_chunks,
            "status": "COMPLETE" if result.integrity_ok else "FAILED",
            "integrity_ok": result.integrity_ok,
            "source_sha256": result.source_sha256,
            "receiver_sha256": result.receiver_sha256,
            "started_at": result.started_at,
            "ended_at": result.ended_at,
        }
    return xfer


@router.get("/transfers/{transfer_id}", response_model=TransferDetailOut)
def get_transfer(transfer_id: str, db: DbSession):
    """Get transfer status and chunk breakdown."""
    xfer = db.query(Transfer).filter(Transfer.transfer_id == transfer_id).first()
    if not xfer:
        raise HTTPException(status_code=404, detail="Transfer not found.")
    chunks = db.query(Chunk).filter(Chunk.transfer_id == transfer_id).order_by(Chunk.chunk_index).all()
    return {**xfer.__dict__, "chunks": chunks}
