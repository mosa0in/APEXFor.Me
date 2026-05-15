"""
APEX — Shared Utilities
Common helpers used across all router modules.
"""

import os
import re
import json
import sqlite3
from contextlib import contextmanager
from datetime import datetime

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
