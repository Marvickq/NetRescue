"""apps/api/main.py — NetRescue FastAPI application factory."""

from __future__ import annotations

import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from netrescue.core.config import settings
from netrescue.core.db import engine
from netrescue.core.models import Base

from apps.api.routers import experiments, metrics, nodes, transfers

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
    log.info("NetRescue API starting — creating tables if needed.")
    Base.metadata.create_all(bind=engine)
    yield
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

# CORS — localhost only by default (PRD §2.2 rule 4)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000", "http://localhost:5173", "http://127.0.0.1:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Routers
app.include_router(nodes.router)
app.include_router(experiments.router)
app.include_router(transfers.router)
app.include_router(metrics.router)


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
