"""
APEX — Windows Encoding Fix
Forces UTF-8 on stdout/stderr to prevent 'charmap' codec errors
with emoji characters (✅, ❌, etc.) and Arabic text on Windows.

Import this module early in any entry point:
    import src.encoding_fix  # noqa: F401
"""

import sys
import io
import os


def fix_encoding() -> None:
    """Force UTF-8 encoding on stdout/stderr for Windows compatibility."""
    # Set environment variable for child processes
    os.environ.setdefault("PYTHONIOENCODING", "utf-8")

    if sys.stdout and hasattr(sys.stdout, "buffer"):
        try:
            sys.stdout.flush()
            sys.stdout = io.TextIOWrapper(
                sys.stdout.buffer, encoding="utf-8", errors="replace"
            )
        except Exception:
            pass

    if sys.stderr and hasattr(sys.stderr, "buffer"):
        try:
            sys.stderr.flush()
            sys.stderr = io.TextIOWrapper(
                sys.stderr.buffer, encoding="utf-8", errors="replace"
            )
        except Exception:
            pass


# Auto-fix on import
fix_encoding()
