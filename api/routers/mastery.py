"""
APEX — Mastery Router
Endpoints: get mastery snapshots, upsert mastery
"""

from fastapi import APIRouter
from pydantic import BaseModel
from datetime import datetime
import json

from api.utils import get_db

router = APIRouter(prefix="/api/mastery", tags=["Mastery"])


# ═══════════════════════════════════════════
# Pydantic Models
# ═══════════════════════════════════════════

class MasteryUpdate(BaseModel):
    mastery_estimate: float = 0.0
    pattern_accuracy: dict = {}
    accuracy_rate: float = 0.0
    sessions_count: int = 0


# ═══════════════════════════════════════════
# Endpoints
# ═══════════════════════════════════════════

@router.get("/{student_id}")
def get_mastery(student_id: str, slug: str = ""):
    """Get mastery snapshots for a student, optionally filtered by curriculum slug."""
    with get_db() as conn:
        if slug:
            # Filter by curriculum: JOIN concepts → curricula to match slug
            rows = conn.execute("""
                SELECT ms.* FROM mastery_snapshots ms
                JOIN concepts c ON ms.concept_id = c.concept_id
                JOIN curricula cu ON c.curriculum_id = cu.id
                WHERE ms.student_id = ? AND cu.slug = ?
                ORDER BY ms.last_updated DESC
            """, (student_id, slug)).fetchall()
        else:
            rows = conn.execute(
                "SELECT * FROM mastery_snapshots WHERE student_id = ? ORDER BY last_updated DESC",
                (student_id,)).fetchall()

    result = []
    for r in rows:
        d = dict(r)
        try:
            d["pattern_accuracy"] = json.loads(d.get("pattern_accuracy", "{}") or "{}")
        except json.JSONDecodeError:
            d["pattern_accuracy"] = {}
        result.append(d)
    return result


@router.put("/{student_id}/{concept_id}")
def update_mastery(student_id: str, concept_id: str, data: MasteryUpdate):
    """Upsert a mastery snapshot."""
    with get_db() as conn:
        conn.execute("""
            INSERT INTO mastery_snapshots (student_id, concept_id, mastery_estimate,
                pattern_accuracy, accuracy_rate, sessions_count, last_updated)
            VALUES (?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(student_id, concept_id) DO UPDATE SET
                mastery_estimate = excluded.mastery_estimate,
                pattern_accuracy = excluded.pattern_accuracy,
                accuracy_rate = excluded.accuracy_rate,
                sessions_count = excluded.sessions_count,
                last_updated = excluded.last_updated
        """, (
            student_id, concept_id, data.mastery_estimate,
            json.dumps(data.pattern_accuracy, ensure_ascii=False),
            data.accuracy_rate, data.sessions_count,
            datetime.now().isoformat(),
        ))
        conn.commit()
    return {"status": "ok"}
