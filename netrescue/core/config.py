"""
netrescue/core/config.py

Environment-driven settings for NetRescue.
Loaded once at import; values read from environment variables or .env file.
"""

from __future__ import annotations

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Application settings — all values can be overridden by environment variables."""

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    # --- Database ---
    database_url: str = Field(
        default="postgresql+psycopg://netrescue:netrescue@localhost:5432/netrescue",
        description="SQLAlchemy async-compatible PostgreSQL URL",
    )

    # --- API ---
    api_bind_host: str = Field(default="127.0.0.1", description="Host to bind FastAPI to (loopback by default)")
    api_bind_port: int = Field(default=8000, description="Port for the FastAPI server")
    api_secret_key: str = Field(default="change-me", description="Secret key for session / token signing")

    # --- TLS / mTLS ---
    tls_ca_cert: str = Field(default="certs/ca.crt", description="Path to CA certificate")
    tls_node_cert: str = Field(default="certs/node.crt", description="Path to node certificate")
    tls_node_key: str = Field(default="certs/node.key", description="Path to node private key")

    # --- Heartbeat defaults ---
    heartbeat_interval_s: float = Field(default=1.0, description="Default UDP heartbeat interval in seconds")
    heartbeat_timeout_s: float = Field(default=5.0, description="Heartbeat receive timeout in seconds")

    # --- Hysteresis defaults ---
    default_f_thresh: int = Field(default=3, description="Missed heartbeats to enter SUSPECT")
    default_n: int = Field(default=5, description="Missed heartbeats to enter FAILED")
    default_r_thresh: int = Field(default=5, description="Consecutive successes to return to HEALTHY")

    # --- Feature flags ---
    enable_emulation: bool = Field(default=True, description="Enable tc/netem emulation module")
    enable_security: bool = Field(default=True, description="Enable mTLS and HMAC security")

    # --- PostgreSQL (Docker Compose) ---
    postgres_user: str = Field(default="netrescue")
    postgres_password: str = Field(default="netrescue")
    postgres_db: str = Field(default="netrescue")

    # --- Logging ---
    log_level: str = Field(default="INFO", description="Python logging level")


# Module-level singleton — import this everywhere
settings = Settings()
