"""
APEX — Diagnostic Router
Serves AI-generated diagnostic questions (30 total: 15 internal + 15 external).
Also serves external concepts for the curriculum page panel.
"""

import json
import random

from fastapi import APIRouter, Depends, HTTPException

from api.utils import get_db, get_current_student

router = APIRouter(prefix="/api/diagnostic", tags=["Diagnostic"])

LABELS = ["أ", "ب", "ج", "د"]


def _format_question(row: dict, q_id: int) -> dict:
    options_raw = json.loads(row["options_json"] or "[]")
    q_type = row["question_type"]
    formatted_options = []
    correct_index = 0

    if q_type == "mcq":
        for i, opt in enumerate(options_raw):
            formatted_options.append({"label": LABELS[i] if i < len(LABELS) else str(i+1), "content": str(opt)})
            if str(opt).strip() == str(row["correct_answer"]).strip():
                correct_index = i
    elif q_type == "true_false":
        formatted_options = [{"label": "✓", "content": "صح"}, {"label": "✗", "content": "خطأ"}]
        correct_index = 0 if str(row["correct_answer"]).lower() in ("true", "صح", "yes", "correct") else 1

    diff_map = {"easy": 1, "medium": 2, "hard": 3}
    return {
        "id": q_id,
        "text": row["question_text"],
        "questionType": q_type,
        "conceptId": row["concept_id"],
        "concept": row["concept_name"],
        "sectionTitle": row.get("source", "internal"),
        "sectionType": row["source"],           # 'internal' | 'external'
        "difficulty": diff_map.get(row["difficulty"], 2),
        "options": formatted_options,
        "correctIndex": correct_index,
        "correctAnswer": row["correct_answer"],
        "answerHint": row["answer_hint"],
    }


@router.get("/{slug}")
def get_diagnostic_questions(slug: str, max_questions: int = 30, current_student: str = Depends(get_current_student)):
    """
    Return up to max_questions AI-generated diagnostic questions for a curriculum.
    Split: 15 internal (from curriculum concepts) + 15 external (AI-identified).
    Falls back to legacy endpoint data if AI questions not yet generated.
    """
    with get_db() as conn:
        cur = conn.execute(
            "SELECT id FROM curricula WHERE slug = ? AND student_id = ?", (slug, current_student)
        ).fetchone()
        if not cur:
            raise HTTPException(404, "Curriculum not found")
        cid = cur["id"]

        try:
            rows = conn.execute(
                "SELECT * FROM diagnostic_questions_ai WHERE curriculum_id = ? ORDER BY source, id",
                (cid,),
            ).fetchall()
        except Exception:
            rows = []

    if not rows:
        raise HTTPException(404, "AI diagnostic questions not yet generated for this curriculum. Re-upload to trigger generation.")

    internal = [dict(r) for r in rows if r["source"] == "internal"]
    external = [dict(r) for r in rows if r["source"] == "external"]

    half = max_questions // 2
    random.shuffle(internal)
    random.shuffle(external)
    selected = internal[:half] + external[:half]
    random.shuffle(selected)

    questions = [_format_question(q, i + 1) for i, q in enumerate(selected)]
    questions.sort(key=lambda q: q["difficulty"])

    return {
        "slug": slug,
        "total_questions": len(questions),
        "internal_count": len([q for q in questions if q["sectionType"] == "internal"]),
        "external_count": len([q for q in questions if q["sectionType"] == "external"]),
        "questions": questions,
    }


@router.get("/{slug}/external-concepts")
def get_external_concepts(slug: str, current_student: str = Depends(get_current_student)):
    """Return the AI-identified external concepts for the curriculum page panel."""
    with get_db() as conn:
        cur = conn.execute(
            "SELECT id FROM curricula WHERE slug = ? AND student_id = ?", (slug, current_student)
        ).fetchone()
        if not cur:
            raise HTTPException(404, "Curriculum not found")
        cid = cur["id"]

        try:
            rows = conn.execute(
                """SELECT concept_id, name, description, relation_type, priority, insert_after, question_json
                   FROM external_concepts WHERE curriculum_id = ? ORDER BY priority, id""",
                (cid,),
            ).fetchall()
        except Exception:
            rows = []

    result = []
    for r in rows:
        d = dict(r)
        try:
            d["question"] = json.loads(d.pop("question_json") or "{}")
        except Exception:
            d["question"] = {}
        result.append(d)

    return {"slug": slug, "total": len(result), "external_concepts": result}
