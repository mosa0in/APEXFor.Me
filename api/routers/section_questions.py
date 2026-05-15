"""
APEX — Section Questions Router
"""
import re
import json
from fastapi import APIRouter, HTTPException
from api.utils import get_db

router = APIRouter(tags=["Section Questions"])


@router.get("/api/section-questions/{slug}/{section_id}")
def get_section_questions(slug: str, section_id: str, student_id: str = ""):
    """Get questions for a specific section, ordered by adaptive score."""
    from src.question_generator import generate_template_questions

    with get_db() as conn:
        cur = conn.execute("SELECT id, curriculum_json FROM curricula WHERE slug = ?", (slug,)).fetchone()
        if not cur:
            raise HTTPException(404, "Curriculum not found")
        try:
            curriculum = json.loads(cur["curriculum_json"])
        except Exception:
            raise HTTPException(500, "Invalid curriculum data")

        target_section = None
        for ch in curriculum.get("chapters", []):
            for sec in ch.get("sections", []):
                if sec.get("id") == section_id:
                    target_section = sec
                    break
            if target_section:
                break
        if not target_section:
            raise HTTPException(404, f"Section {section_id} not found")

        mastery_map = {}
        if student_id:
            rows = conn.execute(
                "SELECT concept_id, mastery_estimate FROM mastery_snapshots WHERE student_id = ?",
                (student_id,)).fetchall()
            mastery_map = {r["concept_id"]: r["mastery_estimate"] for r in rows}

    questions = []
    for concept in target_section.get("concepts", []):
        cid, cname = concept.get("id", ""), concept.get("name", "")
        for q in concept.get("questions", []):
            questions.append({
                "id": q.get("id", ""), "text": q.get("text", ""),
                "options": q.get("options", []), "correct_answer": q.get("correct_answer", ""),
                "difficulty": q.get("difficulty", "medium"), "concept_id": cid,
                "concept_name": cname, "section_title": target_section.get("title", ""),
                "student_mastery": round(mastery_map.get(cid, 0.3), 3),
            })
    questions.sort(key=lambda q: (q["student_mastery"], q["difficulty"] == "easy"))

    _stub_re = re.compile(r'^Exercise\s+\d+$', re.IGNORECASE)
    real_qs = [q for q in questions if q.get("options") and not _stub_re.match((q.get("text") or "").strip())]
    if not real_qs:
        for concept in target_section.get("concepts", [])[:5]:
            cid, cname = concept.get("id", ""), concept.get("name", "")
            for q in generate_template_questions(cname, "medium", 2, None):
                questions.append({
                    "id": q.get("id", ""), "text": q.get("text", ""),
                    "options": q.get("options", []), "correct_answer": q.get("correct_answer", ""),
                    "difficulty": "medium", "concept_id": cid, "concept_name": cname,
                    "section_title": target_section.get("title", ""),
                    "student_mastery": round(mastery_map.get(cid, 0.3), 3), "generated": True,
                })

    return {"section_id": section_id, "section_title": target_section.get("title", ""),
            "total_questions": len(questions), "questions": questions}
