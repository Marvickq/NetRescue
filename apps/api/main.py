"""apps/api/main.py — NetRescue FastAPI application factory."""

from __future__ import annotations

import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from netrescue.core.config import settings
from netrescue.core.db import DatabaseUnavailable, create_all_tables
from netrescue.core.models import Base

from apps.api.routers import (
    benchmarks,
    emulation,
    experiments,
    lab,
    metrics,
    nodes,
    playground,
    recovery,
    system,
    traffic,
    transfers,
    xfer,
)

# ---------------------------------------------------------------------------
# Logging
# ---------------------------------------------------------------------------

logging.basicConfig(
    level=getattr(logging, settings.log_level.upper(), logging.INFO),
    format="%(asctime)s %(levelname)-8s %(name)s: %(message)s",
)
log = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Lifespan (startup / shutdown)
# ---------------------------------------------------------------------------


@asynccontextmanager
async def lifespan(app: FastAPI):
    """
    Startup / shutdown.

    Schema creation is best-effort. If PostgreSQL is not reachable the API still
    starts and serves every endpoint that does not need the database —
    benchmarks, traffic lab, recovery lab, sweeps, comparisons and /health.
    Database-backed routes fail individually until the server is up (PRD §2.2
    rule 3: visible degraded mode rather than a dead process).

    The Recovery Lab's live topology is started and stopped here so its sockets
    are released cleanly, and bound to the event broker so node and delivery
    events reach WebSocket subscribers.
    """
    log.info("NetRescue API starting — creating tables if needed.")
    try:
        create_all_tables()
        log.info("Database reachable; schema ensured.")
    except DatabaseUnavailable as exc:
        log.warning(
            "Database unavailable at startup (%s). Starting in DEGRADED mode — "
            "benchmark, traffic and recovery lab endpoints work; database-backed "
            "routes need PostgreSQL running.", exc,
        )

    # Wire the live lab to the event stream.
    from apps.api.runtime import lab_service, playground_service, transfer_lab
    from apps.api.routers.system import broker
    from netrescue.security.audit import default_auditor

    import asyncio

    lab_service.attach(broker)
    lab_service.set_loop(asyncio.get_running_loop())
    await lab_service.start()
    # The playground journals lab events as they happen, so its timeline shows
    # detector transitions and delivery confirmations rather than only the
    # steps the browser happened to click.
    lab_service.attach_observer(playground_service.observe)

    # Start the audit flusher so records reach PostgreSQL.
    auditor = default_auditor()

    yield

    # Drain anything still queued before the process goes away. A failure here
    # must not stop the server exiting — the records are already counted as lost
    # by the auditor, which is the honest outcome.
    try:
        auditor._stop.set()
        auditor.flush_now()
    except Exception as exc:  # pragma: no cover - shutdown path
        log.warning("audit flush on shutdown failed: %s", exc)

    await lab_service.stop()
    # Drop any uploaded bytes the transfer lab is still holding. Shutdown is the
    # other place, besides reset and expiry, where an upload stops existing.
    transfer_lab.reset()
    log.info("NetRescue API shutting down.")


# ---------------------------------------------------------------------------
# App factory
# ---------------------------------------------------------------------------

app = FastAPI(
    title="NetRescue API",
    version="1.0.0",
    description=(
        "Control plane for NetRescue — self-healing recovery (Feature A), "
        "multipath transfer (Feature C), and network emulation (Feature D)."
    ),
    lifespan=lifespan,
    docs_url="/docs",
    redoc_url="/redoc",
)

# CORS — loopback only by default (PRD §2.2 rule 4)
#
# The origin list must not be a hardcoded pair of ports. The console's dev server
# picks a port, and a port that is not listed fails the preflight with a bare
# 400 that the browser reports as an opaque network error — which reads to an
# operator as "the API is down" when the API is running perfectly. So: any
# loopback origin by default, and an explicit list when CORS_ORIGINS is set.
_cors = [o.strip() for o in settings.cors_origins.split(",") if o.strip()]

if _cors:
    _allow_origins = _cors
    logger_note = f"explicit origins: {', '.join(_cors)}"
else:
    # Regex form: matches http://localhost:<port> and http://127.0.0.1:<port>,
    # and nothing else. A non-loopback origin is still rejected.
    _allow_origins = [r"^https?://(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$"]
    logger_note = "any loopback origin (set CORS_ORIGINS to restrict)"

app.add_middleware(
    CORSMiddleware,
    allow_origin_regex=_allow_origins[0] if not settings.cors_origins else None,
    allow_origins=_allow_origins if settings.cors_origins else [],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
log.info("CORS: %s", logger_note)

# Routers
app.include_router(nodes.router)
app.include_router(experiments.router)
app.include_router(transfers.router)
app.include_router(metrics.router)
app.include_router(recovery.router)
app.include_router(benchmarks.router)
app.include_router(emulation.router)
app.include_router(system.router)
app.include_router(lab.router)
app.include_router(playground.router)
app.include_router(xfer.router)
app.include_router(traffic.router)


# ---------------------------------------------------------------------------
# Health endpoints
# ---------------------------------------------------------------------------


@app.get("/health", tags=["health"])
def health():
    """Sanitised health check — no secrets returned."""
    return {"status": "ok", "version": "1.0.0"}


@app.get("/ready", tags=["health"])
def ready():
    """Readiness check — verify DB connectivity."""
    from netrescue.core.db import get_session
    try:
        with get_session() as session:
            session.execute(__import__("sqlalchemy").text("SELECT 1"))
        return {"status": "ready"}
    except Exception as exc:
        from fastapi import HTTPException
        raise HTTPException(status_code=503, detail=f"Database not ready: {exc}")
