"""
APEX — Intelligence Router
Endpoints: learning-path, next-questions, section-progress, student-analysis, results, stats, coach
"""

import json
import sqlite3
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from datetime import datetime

from api.utils import get_db, DB_PATH, get_current_student
from src.question_selector import select_next_questions, get_learning_path
from src.chapter_transition import check_section_completion
from src.coach_analyzer import analyze_student_behavior
from src.mastery_tracker import get_mastery_level
from src.question_generator import generate_mcq_for_concept
from src.content_renderer import render_explanation, render_solution

router = APIRouter(tags=["Intelligence"])


@router.get("/api/learning-path/{student_id}/{curriculum_slug}")
def api_learning_path(student_id: str, curriculum_slug: str, current_student: str = Depends(get_current_student)):
    """Get the full adaptive learning path for a student."""
    if current_student != student_id:
        raise HTTPException(403, "Access denied")
    with get_db() as conn:
        return get_learning_path(conn, student_id, curriculum_slug)


@router.get("/api/next-questions/{student_id}/{curriculum_slug}")
def api_next_questions(student_id: str, curriculum_slug: str, count: int = 3, current_student: str = Depends(get_current_student)):
    """Get the next best questions for adaptive learning."""
    if current_student != student_id:
        raise HTTPException(403, "Access denied")
    with get_db() as conn:
        questions = select_next_questions(conn, student_id, curriculum_slug, count=count)
    return {"next_questions": questions}


@router.get("/api/section-progress/{student_id}/{curriculum_slug}")
def api_section_progress(student_id: str, curriculum_slug: str, current_student: str = Depends(get_current_student)):
    """Check section completion status and gate passages."""
    if current_student != student_id:
        raise HTTPException(403, "Access denied")
    with get_db() as conn:
        return check_section_completion(conn, student_id, curriculum_slug)


@router.get("/api/student-analysis/{student_id}")
def api_student_analysis(student_id: str, current_student: str = Depends(get_current_student)):
    """Get full behavioral analysis + coaching recommendations."""
    if current_student != student_id:
        raise HTTPException(403, "Access denied")
    with get_db() as conn:
        return analyze_student_behavior(conn, student_id)


@router.get("/api/results/{student_id}")
def api_results(student_id: str, slug: str = "", current_student: str = Depends(get_current_student)):
    """Get diagnostic results, optionally filtered by curriculum slug."""
    if current_student != student_id:
        raise HTTPException(403, "Access denied")
    with get_db() as conn:
        curriculum_concept_ids = set()
        if slug:
            concept_rows = conn.execute("""
                SELECT c.concept_id FROM concepts c
                JOIN curricula cu ON c.curriculum_id = cu.id WHERE cu.slug = ?
            """, (slug,)).fetchall()
            curriculum_concept_ids = {r["concept_id"] for r in concept_rows}

        interactions = conn.execute(
            "SELECT * FROM interactions WHERE student_id = ? ORDER BY timestamp",
            (student_id,)).fetchall()
        if not interactions:
            raise HTTPException(404, "No results found for this student")

        if slug and curriculum_concept_ids:
            interactions = [i for i in interactions if i["concept_id"] in curriculum_concept_ids]
            if not interactions:
                raise HTTPException(404, "No results found for this curriculum")

        total = len(interactions)
        correct = sum(1 for i in interactions if i["correct"])
        accuracy = round(correct / total * 100) if total > 0 else 0

        if slug and curriculum_concept_ids:
            mastery_rows = conn.execute("""
                SELECT ms.concept_id, ms.mastery_estimate FROM mastery_snapshots ms
                JOIN concepts c ON ms.concept_id = c.concept_id
                JOIN curricula cu ON c.curriculum_id = cu.id
                WHERE ms.student_id = ? AND cu.slug = ?
            """, (student_id, slug)).fetchall()
        else:
            mastery_rows = conn.execute(
                "SELECT concept_id, mastery_estimate FROM mastery_snapshots WHERE student_id = ?",
                (student_id,)).fetchall()

        if slug:
            name_rows = conn.execute("""
                SELECT c.concept_id, c.name FROM concepts c
                JOIN curricula cu ON c.curriculum_id = cu.id WHERE cu.slug = ?
            """, (slug,)).fetchall()
        else:
            concept_ids = list({r["concept_id"] for r in mastery_rows})
            if concept_ids:
                ph = ",".join("?" * len(concept_ids))
                name_rows = conn.execute(f"SELECT concept_id, name FROM concepts WHERE concept_id IN ({ph})", concept_ids).fetchall()
            else:
                name_rows = []
        concept_name_map = {r["concept_id"]: r["name"] for r in name_rows}

    concepts, strengths, weaknesses = [], [], []
    for r in mastery_rows:
        m, cid = r["mastery_estimate"], r["concept_id"]
        name = concept_name_map.get(cid, cid)
        concepts.append({"concept_id": cid, "name": name, "mastery": round(m, 3),
                         "mastery_pct": round(m * 100), "level": get_mastery_level(m)})
        if m >= 0.7: strengths.append(name)
        elif m < 0.4: weaknesses.append(name)

    gaps = []
    for i in interactions:
        if i["session_end_type"] and i["session_end_type"] not in ("none", ""):
            gaps.append({"concept": concept_name_map.get(i["concept_id"], i["concept_id"]),
                         "gap_type": i["session_end_type"], "confidence_class": i["coach_interaction_type"]})

    return {
        "student_id": student_id, "accuracy": accuracy, "total_questions": total,
        "correct_count": correct, "time_minutes": max(1, round(total * 30 / 60)),
        "concepts": concepts, "strengths": strengths, "weaknesses": weaknesses,
        "mindset_gaps": gaps,
        "overall_mastery": round(sum(r["mastery_estimate"] for r in mastery_rows) / len(mastery_rows), 3) if mastery_rows else 0,
    }


@router.get("/api/stats")
def get_stats():
    with get_db() as conn:
        overview = conn.execute("""
            SELECT COUNT(DISTINCT student_id) as total_students,
                   COUNT(DISTINCT session_id) as total_sessions,
                   COUNT(*) as total_interactions, SUM(correct) as total_correct,
                   ROUND(AVG(correct) * 100, 1) as accuracy_pct
            FROM interactions
        """).fetchone()
        concept_stats = conn.execute("""
            SELECT concept_id, COUNT(*) as total_attempts, SUM(correct) as correct_count,
                   ROUND(AVG(correct) * 100, 1) as accuracy_pct
            FROM interactions GROUP BY concept_id ORDER BY accuracy_pct ASC
        """).fetchall()
    return {"overview": dict(overview), "conceptBreakdown": [dict(c) for c in concept_stats]}


@router.get("/api/health")
def health():
    return {"status": "healthy", "db": DB_PATH, "version": "4.0.0", "timestamp": datetime.now().isoformat()}


# ═══ Question Generator API ═══
@router.post("/api/generate-questions/{concept_id}")
def api_generate_questions(concept_id: str, num: int = 3):
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    concept = conn.execute("SELECT * FROM concepts WHERE concept_id = ?", (concept_id,)).fetchone()
    conn.close()
    if not concept:
        raise HTTPException(404, "Concept not found")
    questions = generate_mcq_for_concept(
        concept_name=concept["name"], section_title=concept["section_title"],
        difficulty=concept["difficulty_level"] or "medium", num_questions=num)
    return {"concept_id": concept_id, "questions": questions, "count": len(questions)}


# ═══ Content Renderer API ═══
class RenderRequest(BaseModel):
    text: str
    concept_name: str = ""

@router.post("/api/render-explanation")
def api_render_explanation(req: RenderRequest):
    return render_explanation(req.text, req.concept_name)

@router.post("/api/render-solution")
def api_render_solution(question_text: str = "", correct_answer: str = "", student_answer: str = "", explanation: str = ""):
    return render_solution(question_text, correct_answer, student_answer, explanation)


# ═══ Socratic Coach ═══
@router.post("/api/coach/socratic")
def api_coach_socratic(data: dict):
    concept_name = data.get("concept_name", "")
    gap_type = data.get("gap_type", "conceptual")
    student_explanation = data.get("student_explanation", "")
    from langchain_anthropic import ChatAnthropic
    from langchain_core.messages import SystemMessage, HumanMessage
    llm = ChatAnthropic(model="claude-sonnet-4-6", timeout=30, max_tokens=300)
    sys_prompt = "أنت مدرب تعليمي يستخدم أسلوب سقراط. مهمتك: اطرح سؤالاً واحداً يدفع الطالب للتفكير العميق — لا تعطِ الإجابة مباشرة."
    gap_label = "مفاهيمي" if gap_type == "conceptual" else "إجرائي"
    user_msg = f"المفهوم: {concept_name}\nنوع الفجوة: {gap_label}\nتفسير الطالب: {student_explanation or 'لم يقدم تفسيراً'}\n\nاطرح سؤالاً سقراطياً واحداً."
    try:
        resp = llm.invoke([SystemMessage(content=sys_prompt), HumanMessage(content=user_msg)])
        question = resp.content.strip()
    except Exception as e:
        print(f"[Coach] Socratic LLM error: {e}")
        question = f"كيف تصف مفهوم '{concept_name}' بكلماتك الخاصة؟"
    return {"socratic_question": question, "concept": concept_name, "gap_type": gap_type}
