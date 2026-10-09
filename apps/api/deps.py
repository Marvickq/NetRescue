"""apps/api/deps.py — shared FastAPI dependencies."""

from __future__ import annotations

from typing import Annotated, Generator

from fastapi import Depends
from sqlalchemy.orm import Session

from netrescue.core.db import get_session


def get_db() -> Generator[Session, None, None]:
    with get_session() as session:
        yield session


DbSession = Annotated[Session, Depends(get_db)]
