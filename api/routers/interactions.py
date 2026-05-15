"""
APEX — Interactions Router
Endpoints: submit interaction, get interactions
"""

from fastapi import APIRouter
from pydantic import BaseModel
from typing import Optional

from api.utils import get_db

router = APIRouter(prefix="/api/interactions", tags=["Interactions"])


# ═══════════════════════════════════════════
# Pydantic Models
# ═══════════════════════════════════════════

class InteractionRequest(BaseModel):
    student_id: str
    question_id: str
    concept_id: str
    session_id: str
    session_type: str = "diagnostic"
    correct: bool = False
    attempt_number: int = 1
    prior_attempts: int = 0
    confidence_level: int = 0
    hint_used: bool = False
    explanation_viewed: bool = False
    student_explanation: str = ""
    input_modality: str = "text"
    question_pattern: str = "MCQ"
    question_regenerated: int = 0
    regeneration_reason: str = ""
    rest_requested: bool = False
    coach_called: bool = False
    coach_interaction_type: str = ""
    session_end_type: str = ""
    mastery_gate_passed: bool = False


# ═══════════════════════════════════════════
# Endpoints
# ═══════════════════════════════════════════

@router.post("")
def submit_interaction(data: InteractionRequest):
    """Record a single student interaction."""
    with get_db() as conn:
        conn.execute("""
            INSERT INTO interactions
            (student_id, question_id, concept_id, session_id, session_type,
             correct, attempt_number, prior_attempts, confidence_level,
             hint_used, explanation_viewed, student_explanation,
             input_modality, question_pattern, question_regenerated,
             regeneration_reason, rest_requested, coach_called,
             coach_interaction_type, session_end_type, mastery_gate_passed)
            VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
        """, (
            data.student_id, data.question_id, data.concept_id, data.session_id,
            data.session_type, int(data.correct), data.attempt_number,
            data.prior_attempts, data.confidence_level,
            int(data.hint_used), int(data.explanation_viewed),
            data.student_explanation, data.input_modality, data.question_pattern,
            data.question_regenerated, data.regeneration_reason,
            int(data.rest_requested), int(data.coach_called),
            data.coach_interaction_type, data.session_end_type,
            int(data.mastery_gate_passed),
        ))
        iid = conn.execute("SELECT last_insert_rowid()").fetchone()[0]
        conn.commit()
    return {"status": "ok", "interaction_id": iid}


@router.get("/{student_id}")
def get_interactions(student_id: str, session_id: Optional[str] = None, limit: int = 100):
    """Get interactions for a student, optionally filtered by session."""
    with get_db() as conn:
        if session_id:
            rows = conn.execute(
                "SELECT * FROM interactions WHERE student_id = ? AND session_id = ? ORDER BY timestamp DESC LIMIT ?",
                (student_id, session_id, limit)).fetchall()
        else:
            rows = conn.execute(
                "SELECT * FROM interactions WHERE student_id = ? ORDER BY timestamp DESC LIMIT ?",
                (student_id, limit)).fetchall()
    return [dict(r) for r in rows]
