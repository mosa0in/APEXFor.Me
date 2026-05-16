"""
APEX — Learn Router v2
AI-generated lesson slides (cached) + mandatory 20-question concept mastery test (cached).
"""
import json
import re

from fastapi import APIRouter, Depends, HTTPException

from api.utils import get_db, get_current_student
from src.config import settings

router = APIRouter(prefix="/api/learn", tags=["Learn"])

# ─── Prompts ─────────────────────────────────────────────────────────────────

_SLIDE_PROMPT = """\
أنت مصمم محتوى تعليمي خبير. أنشئ درساً احترافياً جذاباً.

الكتاب: {book_title}
القسم: {section_title}
المفهوم: {concept_name}
الوصف المستخرج: {description}
الصعوبة: {difficulty}

أعد JSON فقط (بدون أي نص إضافي):
{{
  "headline": "عنوان جذاب للمفهوم يبدأ بـ 'ما هو' أو 'فهم' أو 'أسرار' — 5-7 كلمات",
  "intro_text": "جملتان تمهيديتان تربط المفهوم بحياة الطالب وتثيران فضوله",
  "explanation": "شرح وافٍ في 2-3 فقرات قصيرة (كل فقرة 2-3 جمل)، أسلوب واضح ومشوّق",
  "formula": "الصيغة أو المعادلة أو الكود الأساسي إن وجد، أو null",
  "formula_explanation": "شرح مختصر لأجزاء الصيغة أو null",
  "key_points": ["نقطة 1", "نقطة 2", "نقطة 3", "نقطة 4"],
  "real_example": "مثال عملي من الحياة أو من البرمجة/العلوم يوضح المفهوم",
  "ai_insight": "إضاءة ذكية: خطأ شائع أو سر مهم يخطئ فيه معظم الطلاب في هذا المفهوم",
  "apex_prediction": "جملة واحدة: ما الذي سيختبرك عليه الامتحان في هذا المفهوم بالتحديد؟"
}}"""

_TEST_PROMPT = """\
أنت ممتحن خبير لمادة: {book_title}

المفهوم: {concept_name}
الوصف: {description}

أنشئ بالضبط 20 سؤالاً اختبارياً متنوعاً لقياس الإتقان الحقيقي:
- 10 أسئلة اختيار من متعدد (question_type: "mcq") — 4 خيارات لكل سؤال
- 5 أسئلة صح أو خطأ (question_type: "true_false") — options: []
- 5 أسئلة مقالية (question_type: "text_input") — options: []

قاعدة صارمة: 10 + 5 + 5 = 20 سؤالاً بالضبط. لا أكثر ولا أقل.
توزيع الصعوبة: 7 easy، 9 medium، 4 hard.
الأسئلة بنفس لغة الكتاب (عربي أو إنجليزي حسب الكتاب).

أعد JSON array فقط:
[
  {{
    "question_text": "نص السؤال",
    "question_type": "mcq",
    "options": ["الخيار أ", "الخيار ب", "الخيار ج", "الخيار د"],
    "correct_answer": "الخيار الصحيح كاملاً",
    "answer_hint": "تلميح مفيد",
    "difficulty": "easy"
  }},
  ...
]"""


def _call_claude(prompt: str, max_tokens: int = 3000, timeout: int = 180) -> str:
    import anthropic
    client = anthropic.Anthropic(api_key=settings.ANTHROPIC_API_KEY, timeout=timeout)
    msg = client.messages.create(
        model=settings.LLM_MODEL,
        max_tokens=max_tokens,
        messages=[{"role": "user", "content": prompt}],
    )
    return msg.content[0].text.strip()


def _extract_json(raw: str):
    match = re.search(r'(\{[\s\S]*\}|\[[\s\S]*\])', raw)
    if not match:
        raise ValueError("No JSON found in response")
    return json.loads(match.group(1))


def _ensure_tables(conn):
    conn.executescript("""
        CREATE TABLE IF NOT EXISTS lesson_slides (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            curriculum_id INTEGER NOT NULL,
            concept_id TEXT NOT NULL,
            slides_json TEXT NOT NULL,
            created_at TEXT DEFAULT (datetime('now')),
            UNIQUE(curriculum_id, concept_id)
        );
        CREATE TABLE IF NOT EXISTS concept_tests (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            curriculum_id INTEGER NOT NULL,
            concept_id TEXT NOT NULL,
            questions_json TEXT NOT NULL,
            created_at TEXT DEFAULT (datetime('now')),
            UNIQUE(curriculum_id, concept_id)
        );
    """)


def _find_concept(data: dict, concept_id: str):
    """Locate a concept in curriculum_json and return (concept, section_title, chapter_title)."""
    for ch in data.get("chapters", []):
        for sec in ch.get("sections", []):
            for con in sec.get("concepts", []):
                if con.get("id") == concept_id:
                    return con, sec.get("title", ""), ch.get("title", "")
    return None, "", ""


# ─── Section overview (fast — no Claude) ─────────────────────────────────────

@router.get("/{slug}/section/{section_id}")
def get_section_overview(
    slug: str,
    section_id: str,
    current_student: str = Depends(get_current_student),
):
    """Return concept list for a section without generating slides (fast)."""
    with get_db() as conn:
        cur = conn.execute(
            "SELECT id, book_title, curriculum_json FROM curricula WHERE slug=? AND student_id=?",
            (slug, current_student),
        ).fetchone()
        if not cur:
            raise HTTPException(404, "Curriculum not found")

        data = json.loads(cur["curriculum_json"] or "{}")
        target_sec = None
        chapter_title = ""
        for ch in data.get("chapters", []):
            for sec in ch.get("sections", []):
                if sec.get("id") == section_id or sec.get("title") == section_id:
                    target_sec = sec
                    chapter_title = ch.get("title", "")
                    break
            if target_sec:
                break

        if not target_sec:
            raise HTTPException(404, "Section not found")

        concepts = [
            {
                "id": c.get("id", ""),
                "name": c.get("name", ""),
                "description": (c.get("description") or "")[:180],
                "is_core": c.get("is_core", True),
                "difficulty_level": c.get("difficulty_level", 0.5),
            }
            for c in target_sec.get("concepts", [])
            if c.get("id")
        ]

        return {
            "slug": slug,
            "section_id": section_id,
            "section_title": target_sec.get("title", ""),
            "chapter_title": chapter_title,
            "book_title": cur["book_title"],
            "concepts": concepts,
        }


# ─── Concept slides (AI-generated, cached) ───────────────────────────────────

@router.get("/{slug}/concept/{concept_id}/slides")
def get_concept_slides(
    slug: str,
    concept_id: str,
    ext_name: str = "",
    ext_desc: str = "",
    current_student: str = Depends(get_current_student),
):
    """Return AI lesson slides for one concept. Generates + caches on first call.
    ext_name / ext_desc: fallback for external AI concepts not in curriculum JSON."""
    with get_db() as conn:
        cur = conn.execute(
            "SELECT id, book_title, curriculum_json FROM curricula WHERE slug=? AND student_id=?",
            (slug, current_student),
        ).fetchone()
        if not cur:
            raise HTTPException(404, "Curriculum not found")

        cid, book_title = cur["id"], cur["book_title"]
        data = json.loads(cur["curriculum_json"] or "{}")
        _ensure_tables(conn)

        # ── Cache hit ──
        cached = conn.execute(
            "SELECT slides_json FROM lesson_slides WHERE curriculum_id=? AND concept_id=?",
            (cid, concept_id),
        ).fetchone()

        if cached:
            slides = json.loads(cached["slides_json"])
        else:
            # ── Find concept ──
            concept, section_title, chapter_title = _find_concept(data, concept_id)
            if not concept:
                # External / AI-generated concept — use provided name+desc
                if ext_name:
                    concept = {"id": concept_id, "name": ext_name,
                               "description": ext_desc, "difficulty_level": 0.5, "is_core": False}
                    section_title = "مفاهيم تكميلية"
                    chapter_title = book_title
                else:
                    raise HTTPException(404, f"Concept {concept_id} not found")

            prompt = _SLIDE_PROMPT.format(
                book_title=book_title,
                section_title=section_title,
                concept_name=concept["name"],
                description=(concept.get("description") or "")[:400],
                difficulty=f"{concept.get('difficulty_level', 0.5):.0%}",
            )
            try:
                raw = _call_claude(prompt, max_tokens=2000)
                slides = _extract_json(raw)
            except Exception:
                slides = {
                    "headline": concept["name"],
                    "intro_text": concept.get("description", "")[:200],
                    "explanation": concept.get("description", ""),
                    "formula": None,
                    "formula_explanation": None,
                    "key_points": [],
                    "real_example": "",
                    "ai_insight": "",
                    "apex_prediction": "",
                }

            slides.update({
                "concept_id": concept_id,
                "concept_name": concept["name"],
                "section_title": section_title,
                "chapter_title": chapter_title,
                "is_core": concept.get("is_core", True),
                "difficulty_level": concept.get("difficulty_level", 0.5),
            })

            conn.execute(
                "INSERT OR REPLACE INTO lesson_slides (curriculum_id, concept_id, slides_json) VALUES (?,?,?)",
                (cid, concept_id, json.dumps(slides, ensure_ascii=False)),
            )
            conn.commit()

        # ── Always attach live BKT mastery ──
        snap = conn.execute(
            "SELECT mastery_estimate FROM mastery_snapshots WHERE student_id=? AND concept_id=?",
            (current_student, concept_id),
        ).fetchone()
        slides["mastery_estimate"] = snap["mastery_estimate"] if snap else 0.0

        # ── Quick-check question from AI diagnostic pool ──
        qrow = conn.execute(
            """SELECT question_text, question_type, options_json, correct_answer, answer_hint
               FROM diagnostic_questions_ai
               WHERE curriculum_id=? AND concept_id=? AND source='internal'
               ORDER BY id LIMIT 1""",
            (cid, concept_id),
        ).fetchone()
        slides["quick_check"] = None
        if qrow:
            slides["quick_check"] = {
                "question_text": qrow["question_text"],
                "question_type": qrow["question_type"],
                "options": json.loads(qrow["options_json"] or "[]"),
                "correct_answer": qrow["correct_answer"],
                "answer_hint": qrow["answer_hint"],
            }

    return slides


# ─── Concept test: 20 questions (AI-generated, cached) ───────────────────────

@router.get("/{slug}/concept/{concept_id}/test")
def get_concept_test(
    slug: str,
    concept_id: str,
    current_student: str = Depends(get_current_student),
):
    """Generate or retrieve the 20-question concept mastery test (10 MCQ + 5 T/F + 5 essay)."""
    with get_db() as conn:
        cur = conn.execute(
            "SELECT id, book_title, curriculum_json FROM curricula WHERE slug=? AND student_id=?",
            (slug, current_student),
        ).fetchone()
        if not cur:
            raise HTTPException(404, "Curriculum not found")

        cid, book_title = cur["id"], cur["book_title"]
        data = json.loads(cur["curriculum_json"] or "{}")
        _ensure_tables(conn)

        # Cache hit
        cached = conn.execute(
            "SELECT questions_json FROM concept_tests WHERE curriculum_id=? AND concept_id=?",
            (cid, concept_id),
        ).fetchone()
        if cached:
            questions = json.loads(cached["questions_json"])
            return {"slug": slug, "concept_id": concept_id, "questions": questions, "total": len(questions)}

        concept, _, _ = _find_concept(data, concept_id)
        if not concept:
            concept = {"id": concept_id, "name": concept_id, "description": "", "difficulty_level": 0.5}

        prompt = _TEST_PROMPT.format(
            book_title=book_title,
            concept_name=concept["name"],
            description=(concept.get("description") or "")[:300],
        )

        try:
            raw = _call_claude(prompt, max_tokens=5000, timeout=240)
            questions = _extract_json(raw)
            if not isinstance(questions, list):
                raise ValueError("Not a list")
        except Exception as e:
            raise HTTPException(500, f"Test generation failed: {e}")

        # Enforce exact split: 10 MCQ + 5 T/F + 5 essay
        mcq   = [q for q in questions if q.get("question_type") == "mcq"][:10]
        tf    = [q for q in questions if q.get("question_type") == "true_false"][:5]
        essay = [q for q in questions if q.get("question_type") == "text_input"][:5]

        cn = concept.get("name", concept_id)
        while len(mcq) < 10:
            mcq.append({"question_text": f"Which best describes {cn}?", "question_type": "mcq",
                         "options": ["A", "B", "C", "D"], "correct_answer": "A", "answer_hint": "", "difficulty": "medium"})
        while len(tf) < 5:
            tf.append({"question_text": f"{cn} is an important concept in this field.", "question_type": "true_false",
                        "options": [], "correct_answer": "صح", "answer_hint": "", "difficulty": "easy"})
        while len(essay) < 5:
            essay.append({"question_text": f"اشرح مفهوم {cn} بكلماتك.", "question_type": "text_input",
                           "options": [], "correct_answer": "", "answer_hint": "", "difficulty": "medium"})

        final = mcq[:10] + tf[:5] + essay[:5]

        conn.execute(
            "INSERT OR REPLACE INTO concept_tests (curriculum_id, concept_id, questions_json) VALUES (?,?,?)",
            (cid, concept_id, json.dumps(final, ensure_ascii=False)),
        )
        conn.commit()

    return {"slug": slug, "concept_id": concept_id, "questions": final, "total": len(final)}


# ─── Lesson Coach Chat ────────────────────────────────────────────────────────

_COACH_SYSTEM = """\
أنت كوتش تعليمي ذكي اسمك "{coach_name}". شخصيتك: {personality_label}.

محتوى الدرس الحالي:
المفهوم: {concept_name}
الشرح: {explanation}
{formula_line}
{key_points_line}

قواعد الرد:
- أجب بـ JSON array من 2-4 رسائل قصيرة متسلسلة (مثل رسائل واتساب)
- كل رسالة جملة أو جملتان فقط
- ابنِ على محتوى الدرس وساعد الطالب يفهم أعمق
- لا تعطِ الإجابة مباشرة — اسأل سؤالاً توجيهياً
- استخدم إيموجي باعتدال
- أعد فقط JSON array صالح: ["رسالة 1", "رسالة 2"]"""

_PERSONALITY_LABELS = {
    "motivator": "محفّز ومتحمس، تستخدم كلمات تشجيع كثيرة",
    "socratic": "سقراطي، تطرح أسئلة بدلاً من إعطاء إجابات",
    "friendly": "صديقي ودافئ، كأنك صديق يشرح",
    "strict": "مباشر وحازم، تركز على الدقة",
    "default": "متوازن ومفيد",
}


@router.post("/coach-chat")
def learn_coach_chat(
    data: dict,
    current_student: str = Depends(get_current_student),
):
    """Lesson-context coach chat. Returns 2-4 short coach messages as JSON array."""
    concept_name = data.get("concept_name", "")
    explanation = (data.get("explanation") or "")[:400]
    formula = data.get("formula") or ""
    key_points = data.get("key_points") or []
    message = (data.get("message") or "").strip()

    if not message:
        return {"messages": ["كيف يمكنني مساعدتك في هذا الدرس؟ 😊"]}

    with get_db() as conn:
        row = conn.execute(
            "SELECT coach_name, coach_personality_json FROM students WHERE student_id=?",
            (current_student,),
        ).fetchone()

    coach_name = "المدرب"
    personality = "default"
    if row:
        coach_name = row["coach_name"] or "المدرب"
        try:
            pj = json.loads(row["coach_personality_json"] or "{}")
            personality = pj.get("style", "default")
        except Exception:
            pass

    formula_line = f"الصيغة: {formula}" if formula else ""
    key_points_line = f"النقاط: {' | '.join(key_points[:3])}" if key_points else ""

    system = _COACH_SYSTEM.format(
        coach_name=coach_name,
        personality_label=_PERSONALITY_LABELS.get(personality, _PERSONALITY_LABELS["default"]),
        concept_name=concept_name,
        explanation=explanation,
        formula_line=formula_line,
        key_points_line=key_points_line,
    )

    try:
        import anthropic, re as _re
        client = anthropic.Anthropic(api_key=settings.ANTHROPIC_API_KEY, timeout=30)
        msg = client.messages.create(
            model=settings.LLM_MODEL,
            max_tokens=600,
            system=system,
            messages=[{"role": "user", "content": message}],
        )
        raw = msg.content[0].text.strip()
        match = _re.search(r'\[[\s\S]*\]', raw)
        if match:
            msgs = json.loads(match.group(0))
            if isinstance(msgs, list) and msgs:
                return {"messages": [str(m) for m in msgs[:4]]}
        return {"messages": [raw[:300]]}
    except Exception as e:
        return {"messages": [f"تعذّر الرد الآن، لكن فكّر في: كيف يرتبط {concept_name} بما تعرفه؟ 💭"]}
