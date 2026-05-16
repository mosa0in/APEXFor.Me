"""
APEX — Whisper Voice Transcription Router
POST /api/whisper/transcribe  — transcribe audio to text via OpenAI Whisper API
"""

import os
import tempfile
from fastapi import APIRouter, HTTPException, UploadFile, File, Form
from pydantic import BaseModel

router = APIRouter(prefix="/api/whisper", tags=["Whisper"])

SUPPORTED_FORMATS = {".mp3", ".mp4", ".mpeg", ".mpga", ".m4a", ".wav", ".webm", ".ogg"}


class TranscriptionResult(BaseModel):
    text: str
    language: str = "ar"
    duration_ms: int = 0


@router.post("/transcribe", response_model=TranscriptionResult)
async def transcribe_audio(
    file: UploadFile = File(...),
    language: str = Form(default="ar", description="Expected language: ar | en | auto"),
    prompt: str = Form(default="", description="Optional context hint for better accuracy"),
):
    """
    Transcribe uploaded audio to text using OpenAI Whisper API.

    Accepts: mp3, mp4, m4a, wav, webm, ogg (max 25MB per OpenAI limits).
    Returns: transcribed text + detected language.
    """
    api_key = os.environ.get("OPENAI_API_KEY") or os.environ.get("ANTHROPIC_API_KEY", "")
    if not api_key:
        raise HTTPException(503, "OPENAI_API_KEY not configured — Whisper unavailable")

    # Validate file extension
    filename = file.filename or "audio.webm"
    ext = os.path.splitext(filename)[1].lower()
    if ext not in SUPPORTED_FORMATS:
        raise HTTPException(400, f"Unsupported format '{ext}'. Use: {', '.join(SUPPORTED_FORMATS)}")

    # Read audio bytes
    audio_bytes = await file.read()
    if len(audio_bytes) > 25 * 1024 * 1024:
        raise HTTPException(400, "File too large — Whisper limit is 25MB")
    if len(audio_bytes) < 100:
        raise HTTPException(400, "File too small — likely empty recording")

    # Write to temp file for the OpenAI client
    with tempfile.NamedTemporaryFile(suffix=ext, delete=False) as tmp:
        tmp.write(audio_bytes)
        tmp_path = tmp.name

    try:
        from openai import OpenAI
        client = OpenAI(api_key=api_key)

        with open(tmp_path, "rb") as audio_file:
            kwargs = {
                "model": "whisper-1",
                "file": audio_file,
                "response_format": "verbose_json",
            }
            if language != "auto":
                kwargs["language"] = language
            if prompt:
                kwargs["prompt"] = prompt

            transcript = client.audio.transcriptions.create(**kwargs)

        text = transcript.text.strip()
        detected_lang = getattr(transcript, "language", language)
        duration_ms = int(getattr(transcript, "duration", 0) * 1000)

        return TranscriptionResult(text=text, language=detected_lang, duration_ms=duration_ms)

    except ImportError:
        raise HTTPException(503, "openai package not installed — run: pip install openai")
    except Exception as e:
        err = str(e)
        if "api_key" in err.lower() or "authentication" in err.lower():
            raise HTTPException(401, "Invalid OpenAI API key")
        if "quota" in err.lower() or "rate" in err.lower():
            raise HTTPException(429, "OpenAI rate limit — retry after a moment")
        raise HTTPException(500, f"Whisper error: {err[:200]}")
    finally:
        try:
            os.unlink(tmp_path)
        except OSError:
            pass


@router.get("/status")
def whisper_status():
    """Check if Whisper transcription is available."""
    has_key = bool(os.environ.get("OPENAI_API_KEY"))
    try:
        import openai  # noqa: F401
        has_package = True
    except ImportError:
        has_package = False
    return {
        "available": has_key and has_package,
        "has_api_key": has_key,
        "package_installed": has_package,
        "supported_formats": list(SUPPORTED_FORMATS),
    }
