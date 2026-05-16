"""
APEX — Legacy Curricula Router (PDF pipeline)
Endpoints: list, get, stats, concepts, diagnostic-questions, upload, delete, section-questions
"""

import os
import re
import json
import random
from typing import Optional
from datetime import datetime

from fastapi import APIRouter, HTTPException, UploadFile, File, Form, Depends

from api.utils import get_db, slugify, UPLOAD_DIR, get_current_student

router = APIRouter(prefix="/api/curricula", tags=["Curricula"])


def _infer_question_type(text: str, options: list, explicit_type: str = "") -> str:
    """Infer question type from content when not explicitly specified by AI."""
    if explicit_type:
        type_map = {"mcq": "mcq", "true_false": "true_false", "text_input": "text_input",
                     "image_upload": "image_upload", "calculation": "text_input", "proof": "text_input",
                     "conceptual": "text_input", "open_ended": "text_input"}
        return type_map.get(explicit_type.lower(), "mcq")
    if isinstance(options, list) and len(options) > 2:
        return "mcq"
    if isinstance(options, list) and len(options) == 2:
        flat = " ".join(str(o).lower() for o in options)
        if any(kw in flat for kw in ["صح", "خطأ", "true", "false", "نعم", "لا"]):
            return "true_false"
        return "mcq"
    text_lower = text.lower() if text else ""
    text_ar = text or ""
    open_kw = ["اشرح", "وضّح", "ناقش", "حلل", "قارن", "صف", "اكتب", "اذكر",
               "explain", "describe", "discuss", "how", "why"]
    if any(kw in text_ar or kw in text_lower for kw in open_kw):
        return "text_input"
    if not options or len(options) == 0:
        return "text_input"
    return "mcq"


@router.get("")
def list_curricula(current_student: str = Depends(get_current_student)):
    with get_db() as conn:
        sql = """SELECT id, slug, name, book_title, language, pdf_filename,
                       total_chapters, total_sections, total_concepts, total_exercises,
                       status, error_message, created_at, updated_at FROM curricula"""
        rows = conn.execute(sql + " WHERE student_id = ? ORDER BY created_at DESC", (current_student,)).fetchall()
    return [dict(r) for r in rows]


@router.get("/{slug}")
def get_curriculum(slug: str, current_student: str = Depends(get_current_student)):
    with get_db() as conn:
        row = conn.execute(
            "SELECT * FROM curricula WHERE slug = ? AND student_id = ?", (slug, current_student)
        ).fetchone()
    if not row:
        raise HTTPException(404, "Curriculum not found")
    result = dict(row)
    try:
        result["curriculum_json"] = json.loads(result.get("curriculum_json", "{}"))
    except json.JSONDecodeError:
        result["curriculum_json"] = {}
    return result


@router.get("/{slug}/stats")
def get_curriculum_stats(slug: str, current_student: str = Depends(get_current_student)):
    with get_db() as conn:
        cur = conn.execute(
            "SELECT id, name, book_title, total_concepts, total_exercises, total_sections, curriculum_json FROM curricula WHERE slug = ? AND student_id = ?",
            (slug, current_student)).fetchone()
        if not cur:
            raise HTTPException(404, "Curriculum not found")
        concepts = conn.execute("SELECT * FROM concepts WHERE curriculum_id = ?", (cur["id"],)).fetchall()

    total = len(concepts)
    core = sum(1 for c in concepts if c["is_core"])
    prereq_count = sum(1 for c in concepts if json.loads(c["prerequisites"] or "[]"))
    diff_sum = sum(c["difficulty_level"] for c in concepts)
    easy = sum(1 for c in concepts if c["difficulty_level"] < 0.35)
    medium = sum(1 for c in concepts if 0.35 <= c["difficulty_level"] < 0.65)
    hard = sum(1 for c in concepts if c["difficulty_level"] >= 0.65)

    sections_data = []
    try:
        curriculum = json.loads(cur["curriculum_json"] or "{}")
        for ch in curriculum.get("chapters", []):
            for sec in ch.get("sections", []):
                sec_concepts = sec.get("concepts", [])
                sections_data.append({
                    "id": sec.get("id", ""), "title": sec.get("title", ""),
                    "concept_count": len(sec_concepts), "exercise_count": sec.get("total_exercises", 0),
                    "concept_ids": [c.get("id", "") for c in sec_concepts],
                })
    except (json.JSONDecodeError, TypeError):
        sections_map: dict = {}
        for c in concepts:
            st = c["section_title"]
            if st not in sections_map:
                sections_map[st] = {"title": st, "concept_count": 0, "exercise_count": 0, "concept_ids": []}
            sections_map[st]["concept_count"] += 1
            sections_map[st]["exercise_count"] += c["exercise_count"]
            sections_map[st]["concept_ids"].append(c["concept_id"])
        sections_data = [{"id": f"sec_{i}", **v} for i, v in enumerate(sections_map.values())]

    return {
        "book_title": cur["book_title"] or cur["name"], "chapters": 1,
        "sections": cur["total_sections"], "concepts": total, "exercises": cur["total_exercises"],
        "core_concepts": core, "prerequisites_count": prereq_count,
        "difficulty_avg": diff_sum / max(total, 1), "sections_data": sections_data,
        "difficulty_distribution": {"easy": easy, "medium": medium, "hard": hard},
    }


@router.get("/{slug}/concepts")
def get_curriculum_concepts(slug: str, student_id: Optional[str] = None, current_student: str = Depends(get_current_student)):
    """Return concepts with resolved prerequisites and optional per-student accuracy."""
    with get_db() as conn:
        cur = conn.execute("SELECT id FROM curricula WHERE slug = ? AND student_id = ?", (slug, current_student)).fetchone()
        if not cur:
            raise HTTPException(404, "Curriculum not found")
        curriculum_id = cur["id"]

        rows = conn.execute("""
            SELECT concept_id as id, name, description, section_title,
                   difficulty_level, is_core, exercise_count, prerequisites,
                   COALESCE(external_prerequisites, '[]') as external_prerequisites
            FROM concepts WHERE curriculum_id = ? ORDER BY rowid
        """, (curriculum_id,)).fetchall()

        # Build lookup: concept_id → name (for resolving prerequisites)
        name_lookup = {r["id"]: r["name"] for r in rows}

        # Fetch mastery for this student + curriculum if requested
        mastery_lookup: dict[str, dict] = {}
        if student_id:
            ms_rows = conn.execute("""
                SELECT ms.concept_id, ms.mastery_estimate, ms.accuracy_rate
                FROM mastery_snapshots ms
                JOIN concepts c ON ms.concept_id = c.concept_id
                WHERE ms.student_id = ? AND c.curriculum_id = ?
            """, (student_id, curriculum_id)).fetchall()
            mastery_lookup = {
                r["concept_id"]: {
                    "mastery_estimate": r["mastery_estimate"],
                    "accuracy_rate": r["accuracy_rate"],
                }
                for r in ms_rows
            }

    result = []
    for r in rows:
        d = dict(r)
        prereq_ids: list[str] = json.loads(d.get("prerequisites", "[]") or "[]")
        d["prerequisites"] = [
            {"id": pid, "name": name_lookup.get(pid, pid)}
            for pid in prereq_ids
        ]
        # Parse external prerequisites (CON_EXT nodes)
        try:
            d["external_prerequisites"] = json.loads(d.get("external_prerequisites", "[]") or "[]")
        except (json.JSONDecodeError, TypeError):
            d["external_prerequisites"] = []
        d["is_core"] = bool(d.get("is_core", 1))
        if student_id:
            m = mastery_lookup.get(d["id"], {})
            d["mastery_estimate"] = m.get("mastery_estimate", None)
            d["accuracy_rate"] = m.get("accuracy_rate", None)
        result.append(d)
    return result


@router.get("/{slug}/diagnostic-questions")
def get_diagnostic_questions(slug: str, max_questions: int = 30, current_student: str = Depends(get_current_student)):
    """Extract diagnostic questions from curriculum JSON."""
    with get_db() as conn:
        cur = conn.execute("SELECT id, curriculum_json FROM curricula WHERE slug = ? AND student_id = ?", (slug, current_student)).fetchone()
    if not cur:
        raise HTTPException(404, "Curriculum not found")
    try:
        curriculum = json.loads(cur["curriculum_json"] or "{}")
    except json.JSONDecodeError:
        raise HTTPException(500, "Invalid curriculum data")

    all_questions = []
    q_id = 1
    labels = ["أ", "ب", "ج", "د", "هـ", "و"]
    diff_map = {"easy": 1, "medium": 2, "hard": 3}

    for ch in curriculum.get("chapters", []):
        for sec in ch.get("sections", []):
            sec_title = sec.get("title", "")
            for concept in sec.get("concepts", []):
                con_id, con_name = concept.get("id", ""), concept.get("name", "")
                for q in concept.get("questions", []):
                    q_text, q_options = q.get("text", ""), q.get("options", [])
                    q_correct, q_diff = q.get("correct_answer", ""), q.get("difficulty", "medium")
                    q_type = _infer_question_type(q_text, q_options, q.get("question_type", ""))
                    formatted_options, correct_index = [], 0

                    if q_type == "mcq":
                        if isinstance(q_options, list) and len(q_options) > 0:
                            for i, opt in enumerate(q_options):
                                opt_text = opt if isinstance(opt, str) else str(opt)
                                formatted_options.append({"label": labels[i] if i < len(labels) else str(i+1), "content": opt_text})
                                if opt_text.strip() == q_correct.strip():
                                    correct_index = i
                        else:
                            q_type = "text_input"
                    elif q_type == "true_false":
                        formatted_options = [{"label": "✓", "content": "صح"}, {"label": "✗", "content": "خطأ"}]
                        correct_index = 0 if q_correct.lower() in ("true", "صح", "نعم", "correct") else 1

                    all_questions.append({
                        "id": q_id, "text": q_text, "questionType": q_type,
                        "conceptId": con_id, "concept": con_name, "sectionTitle": sec_title,
                        "sectionType": "main", "difficulty": diff_map.get(q_diff, 2),
                        "options": formatted_options, "correctIndex": correct_index, "correctAnswer": q_correct,
                        "answerHint": q.get("answer_hint", ""),
                    })
                    q_id += 1

    # Sample with concept diversity
    if len(all_questions) > max_questions:
        by_concept: dict[str, list] = {}
        for q in all_questions:
            by_concept.setdefault(q["conceptId"], []).append(q)
        sampled = []
        for qs in by_concept.values():
            sampled.extend(qs[:2])
        if len(sampled) > max_questions:
            random.shuffle(sampled)
            sampled = sampled[:max_questions]
        elif len(sampled) < max_questions:
            remaining = [q for q in all_questions if q not in sampled]
            random.shuffle(remaining)
            sampled.extend(remaining[:max_questions - len(sampled)])
        all_questions = sampled

    all_questions.sort(key=lambda q: q["difficulty"])
    return {"slug": slug, "total_questions": len(all_questions), "questions": all_questions}


@router.post("/upload")
async def upload_curriculum(file: UploadFile = File(...), name: str = Form(""), student_id: str = Form(""), current_student: str = Depends(get_current_student)):
    if not file.filename or not file.filename.lower().endswith(".pdf"):
        raise HTTPException(400, "Only PDF files are accepted")
    curriculum_name = name.strip() or file.filename.replace(".pdf", "").replace("_", " ")
    slug = slugify(curriculum_name)
    effective_student_id = current_student  # Always use token identity
    with get_db() as conn:
        existing = conn.execute("SELECT id FROM curricula WHERE slug = ?", (slug,)).fetchone()
        if existing:
            slug = f"{slug}-{int(datetime.now().timestamp()) % 10000}"
        os.makedirs(UPLOAD_DIR, exist_ok=True)
        safe_filename = f"{slug}.pdf"
        file_path = os.path.join(UPLOAD_DIR, safe_filename)
        with open(file_path, "wb") as f:
            content = await file.read()
            f.write(content)
        conn.execute("INSERT INTO curricula (slug, student_id, name, pdf_filename, status) VALUES (?, ?, ?, ?, 'processing')",
                     (slug, effective_student_id, curriculum_name, safe_filename))
        conn.commit()
        cur_id = conn.execute("SELECT last_insert_rowid()").fetchone()[0]
    from api.pipeline import run_pipeline_async
    from api.utils import DB_PATH
    run_pipeline_async(file_path, cur_id, curriculum_name, DB_PATH)
    return {"status": "processing", "slug": slug, "curriculum_id": cur_id}


@router.delete("/{slug}")
def delete_curriculum(slug: str, current_student: str = Depends(get_current_student)):
    with get_db() as conn:
        cur = conn.execute("SELECT id, pdf_filename, student_id FROM curricula WHERE slug = ?", (slug,)).fetchone()
        if not cur:
            raise HTTPException(404, "Curriculum not found")
        if cur["student_id"] != current_student:
            raise HTTPException(403, "Access denied")
        conn.execute("DELETE FROM concepts WHERE curriculum_id = ?", (cur["id"],))
        conn.execute("DELETE FROM curricula WHERE id = ?", (cur["id"],))
        conn.commit()
        pdf_filename = cur["pdf_filename"]
    if pdf_filename:
        pdf_path = os.path.join(UPLOAD_DIR, pdf_filename)
        if os.path.exists(pdf_path):
            os.remove(pdf_path)
    return {"status": "deleted", "slug": slug}
