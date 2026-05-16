"""
APEX — Shared Utilities
Common helpers used across all router modules.
"""

import os
import re
import json
import secrets
import sqlite3
from contextlib import contextmanager
from datetime import datetime, timedelta
from typing import Optional

from fastapi import Header, HTTPException

DB_PATH = os.path.join(os.path.dirname(__file__), "apex_data.db")
UPLOAD_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), "data", "uploads")


@contextmanager
def get_db():
    """Context manager for database connections — auto-closes on exit."""
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode=WAL")
    conn.execute("PRAGMA foreign_keys=ON")
    try:
        yield conn
    finally:
        conn.close()


def slugify(text: str) -> str:
    """Convert text to URL-safe slug."""
    text = text.lower().strip()
    text = re.sub(r'[^\w\s-]', '', text)
    text = re.sub(r'[\s_]+', '-', text)
    text = re.sub(r'-+', '-', text)
    return text[:60] or "unnamed"


def parse_json_field(value: str, default=None):
    """Safely parse a JSON string field, returning default on failure."""
    if default is None:
        default = {}
    try:
        return json.loads(value or json.dumps(default))
    except (json.JSONDecodeError, TypeError):
        return default


# ─── Token Auth ─────────────────────────────────────────────────────────────

def generate_token() -> str:
    return secrets.token_urlsafe(32)


def get_token_expiry() -> str:
    return (datetime.now() + timedelta(days=30)).isoformat()


def get_current_student(authorization: Optional[str] = Header(default=None)) -> str:
    if not authorization:
        raise HTTPException(status_code=401, detail="Authorization header required")
    if not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Invalid authorization format")
    token = authorization[7:]
    with get_db() as conn:
        row = conn.execute(
            "SELECT student_id, expires_at FROM auth_tokens WHERE token = ?", (token,)
        ).fetchone()
    if not row:
        raise HTTPException(status_code=401, detail="Invalid or expired token")
    try:
        if datetime.fromisoformat(row["expires_at"]) < datetime.now():
            raise HTTPException(status_code=401, detail="Token expired")
    except ValueError:
        raise HTTPException(status_code=401, detail="Invalid token data")
    return row["student_id"]
