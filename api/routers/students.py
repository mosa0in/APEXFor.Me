"""
APEX — Students Router
Endpoints: get, update student profile; get/set coach personality
"""

from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime
import json

from api.utils import get_db, get_current_student

router = APIRouter(prefix="/api/students", tags=["Students"])


# ═══════════════════════════════════════════
# Pydantic Models
# ═══════════════════════════════════════════

class CoachAvatar(BaseModel):
    style: str = Field(default="humanoid", description="humanoid | robot | animal | abstract")
    primary_color: str = Field(default="#4F46E5", description="Hex color")
    secondary_color: str = Field(default="#818CF8", description="Hex color")
    accessories: list[str] = Field(default_factory=list, description="glasses | hat | scarf | ...")
    expression: str = Field(default="friendly", description="friendly | serious | playful | calm")


class CoachPersonality(BaseModel):
    """Full coach personality schema — stored as JSON in students.coach_personality_json."""
    coach_id: str = Field(default="coach_default")
    name: str = Field(default="المدرب", description="Coach display name")
    avatar: CoachAvatar = Field(default_factory=CoachAvatar)
    # Personality sliders (0.0 = left pole, 1.0 = right pole)
    strictness: float = Field(default=0.5, ge=0.0, le=1.0, description="lenient(0) ↔ strict(1)")
    formality: float = Field(default=0.5, ge=0.0, le=1.0, description="casual(0) ↔ formal(1)")
    encouragement: float = Field(default=0.7, ge=0.0, le=1.0, description="neutral(0) ↔ very encouraging(1)")
    patience: float = Field(default=0.8, ge=0.0, le=1.0, description="quick(0) ↔ patient(1)")
    # Reward style
    reward_style: dict = Field(
        default_factory=lambda: {"type": "stars", "frequency": "per_question", "celebrate_gates": True},
        description="How the coach rewards progress"
    )
    # Interaction preferences
    language_preference: str = Field(default="ar", description="ar | en | mixed")
    hint_style: str = Field(default="socratic", description="socratic | direct | visual")
    explanation_depth: str = Field(default="balanced", description="brief | balanced | detailed")


class StudentUpdate(BaseModel):
    full_name: Optional[str] = None
    coach_id: Optional[str] = None
    coach_name: Optional[str] = None
    coach_personality_json: Optional[dict] = None
    reward_style: Optional[dict] = None
    mastery_gates_passed: Optional[dict] = None
    stars_total: Optional[int] = None
    badges: Optional[list] = None
    diagnostic_done: Optional[bool] = None


# ═══════════════════════════════════════════
# Endpoints
# ═══════════════════════════════════════════

@router.get("/{student_id}")
def get_student(student_id: str, current_student: str = Depends(get_current_student)):
    """Get full student profile including coach personality."""
    if current_student != student_id:
        raise HTTPException(403, "Access denied")
    with get_db() as conn:
        row = conn.execute("SELECT * FROM students WHERE student_id = ?", (student_id,)).fetchone()
    if not row:
        raise HTTPException(404, "الطالب غير موجود")
    d = dict(row)
    d.pop("password_hash", None)
    for k in ("coach_personality_json", "reward_style", "mastery_gates_passed", "badges"):
        try:
            d[k] = json.loads(d.get(k) or "{}" if k != "badges" else d.get(k) or "[]")
        except (json.JSONDecodeError, TypeError):
            d[k] = {} if k != "badges" else []
    return d


@router.get("/{student_id}/coach")
def get_coach_personality(student_id: str, current_student: str = Depends(get_current_student)):
    """Get parsed coach personality schema for a student."""
    if current_student != student_id:
        raise HTTPException(403, "Access denied")
    with get_db() as conn:
        row = conn.execute(
            "SELECT coach_id, coach_name, coach_personality_json, reward_style FROM students WHERE student_id = ?",
            (student_id,)
        ).fetchone()
    if not row:
        raise HTTPException(404, "الطالب غير موجود")
    try:
        personality = json.loads(row["coach_personality_json"] or "{}")
    except (json.JSONDecodeError, TypeError):
        personality = {}
    try:
        reward = json.loads(row["reward_style"] or "{}")
    except (json.JSONDecodeError, TypeError):
        reward = {}
    # Merge reward_style into personality if set separately
    if reward and "reward_style" not in personality:
        personality["reward_style"] = reward
    personality.setdefault("coach_id", row["coach_id"] or "coach_default")
    personality.setdefault("name", row["coach_name"] or "المدرب")
    return personality


@router.post("/{student_id}/coach")
def set_coach_personality(student_id: str, coach: CoachPersonality, current_student: str = Depends(get_current_student)):
    """Set or update coach personality for a student."""
    if current_student != student_id:
        raise HTTPException(403, "Access denied")
    with get_db() as conn:
        row = conn.execute("SELECT student_id FROM students WHERE student_id = ?", (student_id,)).fetchone()
        if not row:
            raise HTTPException(404, "الطالب غير موجود")
        personality_json = coach.model_dump_json()
        reward_json = json.dumps(coach.reward_style, ensure_ascii=False)
        conn.execute("""
            UPDATE students SET
                coach_id = ?,
                coach_name = ?,
                coach_personality_json = ?,
                reward_style = ?,
                updated_at = ?
            WHERE student_id = ?
        """, (coach.coach_id, coach.name, personality_json, reward_json,
              datetime.now().isoformat(), student_id))
        conn.commit()
    return {"status": "ok", "coach_id": coach.coach_id, "name": coach.name}


@router.put("/{student_id}")
def update_student(student_id: str, data: StudentUpdate, current_student: str = Depends(get_current_student)):
    """Update student profile fields."""
    if current_student != student_id:
        raise HTTPException(403, "Access denied")
    with get_db() as conn:
        row = conn.execute("SELECT student_id FROM students WHERE student_id = ?",
                           (student_id,)).fetchone()
        if not row:
            raise HTTPException(404, "الطالب غير موجود")

        updates = []
        vals = []
        for field, value in data.model_dump(exclude_none=True).items():
            if isinstance(value, (dict, list)):
                value = json.dumps(value, ensure_ascii=False)
            if isinstance(value, bool):
                value = int(value)
            updates.append(f"{field} = ?")
            vals.append(value)

        if updates:
            updates.append("updated_at = ?")
            vals.append(datetime.now().isoformat())
            vals.append(student_id)
            conn.execute(f"UPDATE students SET {', '.join(updates)} WHERE student_id = ?", vals)
            conn.commit()

    return {"status": "ok"}
