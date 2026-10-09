"""
netrescue/core/db.py

Database session factory and helpers.
Uses SQLAlchemy 2.x synchronous engine backed by psycopg3.
"""

from __future__ import annotations

from contextlib import contextmanager
from typing import Generator

from sqlalchemy import create_engine, event
from sqlalchemy.orm import Session, sessionmaker

from netrescue.core.config import settings
from netrescue.core.models import Base


# ---------------------------------------------------------------------------
# Engine
# ---------------------------------------------------------------------------

engine = create_engine(
    settings.database_url,
    pool_pre_ping=True,       # reconnect after DB restart
    pool_size=5,
    max_overflow=10,
    echo=False,
)


# ---------------------------------------------------------------------------
# Session factory
# ---------------------------------------------------------------------------

SessionLocal = sessionmaker(bind=engine, autocommit=False, autoflush=False)


@contextmanager
def get_session() -> Generator[Session, None, None]:
    """Context-managed database session.

    Usage::

        with get_session() as session:
            session.add(obj)
            session.commit()
    """
    session = SessionLocal()
    try:
        yield session
        session.commit()
    except Exception:
        session.rollback()
        raise
    finally:
        session.close()


# ---------------------------------------------------------------------------
# Schema helpers
# ---------------------------------------------------------------------------


def create_all_tables() -> None:
    """Create all tables defined in models.py if they do not already exist."""
    Base.metadata.create_all(bind=engine)


def drop_all_tables() -> None:
    """Drop ALL tables — use only in tests or initial setup."""
    Base.metadata.drop_all(bind=engine)
