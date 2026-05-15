"""
APEX — Curriculum Content Router (new table)
Endpoints: GET/POST/bulk curriculum-content
"""

import json
from typing import Optional
from fastapi import APIRouter
from pydantic import BaseModel

from api.utils import get_db

router = APIRouter(prefix="/api/curriculum-content", tags=["Curriculum Content"])


class CurriculumEntry(BaseModel):
    concept_id: str
    question_id: str
    book_id: str = ""
    chapter_id: str = ""
    section_id: str = ""
    concept_name: str = ""
    subject: str = ""
    prerequisites: list = []
    question_text: str = ""
    question_type: str = "MCQ"
    difficulty_level: int = 1
    correct_answer: str = ""


@router.get("")
def get_curriculum_content(subject: Optional[str] = None, concept_id: Optional[str] = None):
    """Get curriculum entries, optionally filtered."""
    with get_db() as conn:
        q = "SELECT * FROM curriculum WHERE 1=1"
        params: list = []
        if subject:
            q += " AND subject = ?"
            params.append(subject)
        if concept_id:
            q += " AND concept_id = ?"
            params.append(concept_id)
        q += " ORDER BY concept_id, question_id"
        rows = conn.execute(q, params).fetchall()
    result = []
    for r in rows:
        d = dict(r)
        try:
            d["prerequisites"] = json.loads(d.get("prerequisites", "[]") or "[]")
        except json.JSONDecodeError:
            d["prerequisites"] = []
        result.append(d)
    return result


@router.post("")
def add_curriculum_entry(data: CurriculumEntry):
    """Add a single curriculum entry (concept+question)."""
    with get_db() as conn:
        conn.execute("""
            INSERT OR REPLACE INTO curriculum
            (concept_id, question_id, book_id, chapter_id, section_id,
             concept_name, subject, prerequisites, question_text,
             question_type, difficulty_level, correct_answer)
            VALUES (?,?,?,?,?,?,?,?,?,?,?,?)
        """, (
            data.concept_id, data.question_id, data.book_id,
            data.chapter_id, data.section_id, data.concept_name,
            data.subject, json.dumps(data.prerequisites, ensure_ascii=False),
            data.question_text, data.question_type,
            data.difficulty_level, data.correct_answer,
        ))
        conn.commit()
    return {"status": "ok"}


@router.post("/bulk")
def add_curriculum_bulk(entries: list[CurriculumEntry]):
    """Add multiple curriculum entries at once."""
    with get_db() as conn:
        for data in entries:
            conn.execute("""
                INSERT OR REPLACE INTO curriculum
                (concept_id, question_id, book_id, chapter_id, section_id,
                 concept_name, subject, prerequisites, question_text,
                 question_type, difficulty_level, correct_answer)
                VALUES (?,?,?,?,?,?,?,?,?,?,?,?)
            """, (
                data.concept_id, data.question_id, data.book_id,
                data.chapter_id, data.section_id, data.concept_name,
                data.subject, json.dumps(data.prerequisites, ensure_ascii=False),
                data.question_text, data.question_type,
                data.difficulty_level, data.correct_answer,
            ))
        conn.commit()
    return {"status": "ok", "count": len(entries)}
