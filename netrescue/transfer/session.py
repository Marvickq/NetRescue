"""
netrescue/transfer/session.py

MultipathTransferSession — orchestrates a full multipath file transfer.

Steps:
  1. Split payload into fixed-size chunks; compute per-chunk SHA-256.
  2. Dispatch each chunk via DBDSPScheduler.select_path() (or a chosen
     scheduler variant).
  3. Simulate delivery (loopback for prototype); on failure retry via
     RTX-CL.
  4. Reassemble; verify full-file SHA-256.
  5. Write Transfer + Chunk ORM rows to DB (batched, ≥ 1 Hz rule).

Scheduler variants supported at session level:
  - DB-DSP     (default, DBDSPScheduler)
  - RR         (round-robin)
  - WRR        (weighted round-robin by TP estimate)
  - SINGLE     (always lowest-FD path)
  - NAIVE_DELAY (forward-delay only, no TP)

Usage::

    paths = [PathState("p1", fd_ms=10), PathState("p2", fd_ms=50)]
    session = MultipathTransferSession(
        run_id="run-1",
        transfer_id="xfer-1",
        paths=paths,
        chunk_size_bytes=4096,
        scheduler_variant="DB-DSP",
    )
    result = asyncio.run(session.transfer(data=my_bytes))
    assert result.integrity_ok
"""

from __future__ import annotations

import asyncio
import hashlib
import itertools
import logging
import time
from dataclasses import dataclass, field
from datetime import datetime
from enum import Enum
from typing import Optional

from netrescue.transfer.scheduler import DBDSPScheduler, PathState, PathStatus

log = logging.getLogger(__name__)

# Max retries per chunk before reporting bounded failure
_DEFAULT_MAX_RETRIES = 3

# Simulated path latency for loopback delivery (ms)
_LOOPBACK_BASE_LATENCY_MS = 2.0


class SchedulerVariant(str, Enum):
    DB_DSP = "DB-DSP"
    ROUND_ROBIN = "RR"
    WEIGHTED_RR = "WRR"
    SINGLE_PATH = "SINGLE"
    NAIVE_DELAY = "NAIVE_DELAY"


@dataclass
class ChunkRecord:
    chunk_index: int
    total_chunks: int
    data: bytes
    sha256: str
    path_id: str | None = None
    attempts: int = 0
    status: str = "PENDING"  # PENDING | IN_FLIGHT | DELIVERED | FAILED


@dataclass
class TransferResult:
    transfer_id: str
    run_id: str
    scheduler_variant: str
    total_chunks: int
    delivered_chunks: int
    failed_chunks: int
    source_sha256: str
    receiver_sha256: str | None
    integrity_ok: bool
    started_at: datetime
    ended_at: datetime
    duration_s: float
    out_of_order_count: int
    retransmission_count: int
    per_path_utilisation: dict[str, int]  # path_id → delivered chunk count


def _sha256(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def _chunk_data(data: bytes, chunk_size: int) -> list[bytes]:
    return [data[i: i + chunk_size] for i in range(0, len(data), chunk_size)]


class MultipathTransferSession:
    """
    Orchestrates a multipath file transfer using a pluggable scheduler variant.

    For the prototype, delivery is simulated over loopback with configurable
    per-path failure injection (loss_rate on each PathState).
    """

    def __init__(
        self,
        run_id: str,
        transfer_id: str,
        paths: list[PathState],
        chunk_size_bytes: int = 4096,
        scheduler_variant: str = "DB-DSP",
        max_retries: int = _DEFAULT_MAX_RETRIES,
        db_session=None,  # optional SQLAlchemy session for persistence
    ):
        self.run_id = run_id
        self.transfer_id = transfer_id
        self.chunk_size_bytes = chunk_size_bytes
        self.variant = SchedulerVariant(scheduler_variant)
        self.max_retries = max_retries
        self._db_session = db_session

        # Build primary DBDSPScheduler (used directly for DB-DSP, as base for others)
        self._scheduler = DBDSPScheduler(paths, max_consecutive_failures=3)
        self._paths = {p.path_id: p for p in paths}

        # Round-robin cursor
        self._rr_cycle = itertools.cycle(list(self._paths.keys()))

    # ------------------------------------------------------------------
    # Main transfer entry
    # ------------------------------------------------------------------

    async def transfer(self, data: bytes) -> TransferResult:
        """
        Execute the full transfer.

        Returns a TransferResult with integrity verification.
        """
        started_at = datetime.utcnow()
        t0 = time.monotonic()

        source_sha256 = _sha256(data)
        chunks = _chunk_data(data, self.chunk_size_bytes)
        total_chunks = len(chunks)

        log.info(
            "[%s] Starting %s transfer: %d bytes → %d chunks (variant=%s)",
            self.transfer_id, self.variant.value, len(data), total_chunks, self.variant.value,
        )

        records: list[ChunkRecord] = [
            ChunkRecord(
                chunk_index=i,
                total_chunks=total_chunks,
                data=c,
                sha256=_sha256(c),
            )
            for i, c in enumerate(chunks)
        ]

        # Delivery tracking
        delivered: dict[int, bytes] = {}  # chunk_index → raw bytes (for reassembly)
        retransmission_count = 0
        per_path_utilisation: dict[str, int] = {pid: 0 for pid in self._paths}

        # Dispatch and deliver
        for record in records:
            success = False
            for attempt in range(1, self.max_retries + 2):
                record.attempts = attempt

                if attempt == 1:
                    path_id = self._select_path(record.chunk_index, exclude=set())
                else:
                    # RTX-CL retransmission
                    tried = {record.path_id} if record.path_id else set()
                    path_id = self._scheduler.select_rtx_path(
                        chunk_size_bytes=self.chunk_size_bytes, exclude=tried
                    )
                    retransmission_count += 1

                if path_id is None:
                    log.error(
                        "[%s] Chunk %d: no path available (attempt %d)",
                        self.transfer_id, record.chunk_index, attempt,
                    )
                    break

                record.path_id = path_id
                record.status = "IN_FLIGHT"

                delivered_data, rtt_ms = await self._simulate_delivery(
                    record.data, path_id
                )

                if delivered_data is not None:
                    # Verify chunk integrity
                    if _sha256(delivered_data) == record.sha256:
                        record.status = "DELIVERED"
                        delivered[record.chunk_index] = delivered_data
                        per_path_utilisation[path_id] = per_path_utilisation.get(path_id, 0) + 1
                        self._scheduler.record_ack(path_id, rtt_ms, len(record.data))
                        success = True
                        break
                    else:
                        log.warning(
                            "[%s] Chunk %d integrity fail on path %s",
                            self.transfer_id, record.chunk_index, path_id,
                        )
                        self._scheduler.record_failure(path_id)
                else:
                    # Simulate loss
                    self._scheduler.record_failure(path_id)
                    log.debug(
                        "[%s] Chunk %d lost on path %s (attempt %d)",
                        self.transfer_id, record.chunk_index, path_id, attempt,
                    )

            if not success:
                record.status = "FAILED"
                log.error(
                    "[%s] Chunk %d FAILED after %d attempts.",
                    self.transfer_id, record.chunk_index, record.attempts,
                )

        # Reassemble
        delivered_chunks = len(delivered)
        failed_chunks = total_chunks - delivered_chunks

        receiver_sha256: str | None = None
        integrity_ok = False
        out_of_order_count = 0

        if delivered_chunks == total_chunks:
            # Compute out-of-order count (chunks arriving before their predecessor)
            delivery_order = sorted(delivered.keys())
            out_of_order_count = sum(
                1 for i, idx in enumerate(delivery_order) if idx != i
            )

            reassembled = b"".join(delivered[i] for i in range(total_chunks))
            receiver_sha256 = _sha256(reassembled)
            integrity_ok = receiver_sha256 == source_sha256
            if integrity_ok:
                log.info("[%s] Transfer complete. SHA-256 match ✓", self.transfer_id)
            else:
                log.error(
                    "[%s] Transfer complete but SHA-256 MISMATCH! src=%s rx=%s",
                    self.transfer_id, source_sha256[:16], (receiver_sha256 or "")[:16],
                )
        else:
            log.error(
                "[%s] Bounded failure: %d/%d chunks undelivered.",
                self.transfer_id, failed_chunks, total_chunks,
            )

        ended_at = datetime.utcnow()
        result = TransferResult(
            transfer_id=self.transfer_id,
            run_id=self.run_id,
            scheduler_variant=self.variant.value,
            total_chunks=total_chunks,
            delivered_chunks=delivered_chunks,
            failed_chunks=failed_chunks,
            source_sha256=source_sha256,
            receiver_sha256=receiver_sha256,
            integrity_ok=integrity_ok,
            started_at=started_at,
            ended_at=ended_at,
            duration_s=time.monotonic() - t0,
            out_of_order_count=out_of_order_count,
            retransmission_count=retransmission_count,
            per_path_utilisation=per_path_utilisation,
        )

        # Persist to DB
        await self._persist(result, records)

        return result

    # ------------------------------------------------------------------
    # Scheduler variant dispatch
    # ------------------------------------------------------------------

    def _select_path(self, chunk_index: int, exclude: set[str]) -> str | None:
        """Dispatch to the configured scheduler variant."""
        if self.variant == SchedulerVariant.DB_DSP:
            return self._scheduler.select_path(
                chunk_size_bytes=self.chunk_size_bytes, exclude=exclude
            )
        elif self.variant == SchedulerVariant.ROUND_ROBIN:
            return self._select_rr(exclude)
        elif self.variant == SchedulerVariant.WEIGHTED_RR:
            return self._select_wwr(exclude)
        elif self.variant == SchedulerVariant.SINGLE_PATH:
            return self._select_single(exclude)
        elif self.variant == SchedulerVariant.NAIVE_DELAY:
            return self._select_naive_delay(exclude)
        return self._scheduler.select_path(chunk_size_bytes=self.chunk_size_bytes, exclude=exclude)

    def _select_rr(self, exclude: set[str]) -> str | None:
        """Round-robin across UP paths."""
        up = self._scheduler.up_path_ids
        if not up:
            return None
        for _ in range(len(up)):
            pid = next(self._rr_cycle)
            if pid in up and pid not in exclude:
                return pid
        return up[0] if up else None

    def _select_wwr(self, exclude: set[str]) -> str | None:
        """Weighted round-robin proportional to TP estimate."""
        candidates = [
            p for p in self._paths.values()
            if p.status == PathStatus.UP and p.path_id not in exclude
        ]
        if not candidates:
            return None
        total_tp = sum(p.tp_estimate_bps for p in candidates) or 1.0
        # Select proportional to weight (deterministic: highest relative TP)
        return max(candidates, key=lambda p: p.tp_estimate_bps / total_tp).path_id

    def _select_single(self, exclude: set[str]) -> str | None:
        """Always pick the path with lowest forward-delay estimate."""
        candidates = [
            p for p in self._paths.values()
            if p.status == PathStatus.UP and p.path_id not in exclude
        ]
        if not candidates:
            return None
        return min(candidates, key=lambda p: p.fd_estimate_ms).path_id

    def _select_naive_delay(self, exclude: set[str]) -> str | None:
        """Naïve delay-aware: lowest FD only, ignore TP (DB-DSP ablation)."""
        return self._select_single(exclude)

    # ------------------------------------------------------------------
    # Simulated delivery (loopback prototype)
    # ------------------------------------------------------------------

    async def _simulate_delivery(
        self, data: bytes, path_id: str
    ) -> tuple[bytes | None, float]:
        """
        Simulate chunk delivery over path_id.

        Returns (data_received, rtt_ms) on success, (None, 0) on simulated loss.
        Loss is probabilistic from PathState.loss_rate.
        RTT is 2 × FD + small jitter.
        """
        import random

        path = self._paths[path_id]

        # Simulate loss
        if random.random() < path.loss_rate:
            return None, 0.0

        # Simulate RTT
        rtt_ms = path.fd_estimate_ms * 2 + _LOOPBACK_BASE_LATENCY_MS + random.gauss(0, 1)
        rtt_ms = max(rtt_ms, 0.5)
        await asyncio.sleep(rtt_ms / 1000.0)

        return data, rtt_ms

    # ------------------------------------------------------------------
    # Persistence
    # ------------------------------------------------------------------

    async def _persist(self, result: TransferResult, records: list[ChunkRecord]) -> None:
        """Write Transfer + Chunk ORM rows to DB if a session is provided."""
        if self._db_session is None:
            return
        try:
            from netrescue.core.models import Transfer, Chunk

            xfer = Transfer(
                transfer_id=result.transfer_id,
                run_id=result.run_id,
                source_node_id="local",
                dest_node_id="local",
                filename=f"transfer_{result.transfer_id[:8]}",
                file_size_bytes=sum(len(r.data) for r in records),
                total_chunks=result.total_chunks,
                scheduler_variant=result.scheduler_variant,
                source_sha256=result.source_sha256,
                receiver_sha256=result.receiver_sha256,
                integrity_ok=result.integrity_ok,
                started_at=result.started_at,
                ended_at=result.ended_at,
                status="COMPLETE" if result.integrity_ok else ("FAILED" if result.failed_chunks > 0 else "COMPLETE"),
            )
            self._db_session.add(xfer)

            for r in records:
                chunk = Chunk(
                    transfer_id=result.transfer_id,
                    chunk_index=r.chunk_index,
                    total_chunks=r.total_chunks,
                    sha256=r.sha256,
                    size_bytes=len(r.data),
                    path_id=r.path_id,
                    attempts=r.attempts,
                    status=r.status,
                )
                self._db_session.add(chunk)

            self._db_session.commit()
            log.info("[%s] Transfer persisted to DB.", result.transfer_id)
        except Exception as exc:
            log.warning("[%s] DB persist failed (degraded mode): %s", result.transfer_id, exc)
