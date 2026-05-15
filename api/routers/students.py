"""
APEX — Students Router
Endpoints: update student profile
"""

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional
from datetime import datetime
import json

from api.utils import get_db

router = APIRouter(prefix="/api/students", tags=["Students"])


# ═══════════════════════════════════════════
# Pydantic Models
# ═══════════════════════════════════════════

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

@router.put("/{student_id}")
def update_student(student_id: str, data: StudentUpdate):
    """Update student profile fields."""
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
