"""
APEX Question Generator — Auto-generates MCQ from curriculum exercises
Uses LLM (Anthropic Claude) to transform bare exercise labels into
rich multiple-choice questions with Bloom's taxonomy classification.

Gap closure: Previously exercises from PDF were just labels like "Exercise 5"
with no options or correct answers. This module generates full MCQ questions.
"""
import os
import json
import re
import hashlib
from typing import List, Dict, Optional, Tuple


# ═══════════════════════════════════════════
# Bloom's Taxonomy levels for question classification
# ═══════════════════════════════════════════
BLOOM_LEVELS = {
    "remember": {"ar": "تذكر", "verbs": ["عرّف", "اذكر", "صنّف"]},
    "understand": {"ar": "فهم", "verbs": ["اشرح", "وضّح", "قارن"]},
    "apply": {"ar": "تطبيق", "verbs": ["احسب", "طبّق", "حل"]},
    "analyze": {"ar": "تحليل", "verbs": ["حلّل", "ميّز", "استنتج"]},
    "evaluate": {"ar": "تقييم", "verbs": ["قيّم", "برّر", "انقد"]},
    "create": {"ar": "إبداع", "verbs": ["صمّم", "ابتكر", "اقترح"]},
}


def generate_mcq_for_concept(
    concept_name: str,
    concept_description: str = "",
    section_title: str = "",
    difficulty: str = "medium",
    num_questions: int = 3,
    existing_exercises: List[str] = None,
) -> List[dict]:
    """
    Generate MCQ questions for a concept using LLM.
    
    Args:
        concept_name: Name of the mathematical concept
        concept_description: Optional description
        section_title: Section this concept belongs to
        difficulty: easy/medium/hard
        num_questions: How many questions to generate
        existing_exercises: Exercise labels from PDF for context
    
    Returns:
        List of question dicts with text, options, correct_answer, bloom_level
    """
    api_key = os.environ.get("ANTHROPIC_API_KEY", "")
    if not api_key:
        # Fallback: generate template-based questions
        return generate_template_questions(
            concept_name, difficulty, num_questions, existing_exercises
        )
    
    try:
        import httpx
        
        exercise_context = ""
        if existing_exercises:
            exercise_context = f"\nالتمارين الموجودة في الكتاب: {', '.join(existing_exercises[:5])}"
        
        prompt = f"""أنت خبير في الرياضيات ومصمم أسئلة. أنشئ {num_questions} أسئلة MCQ عن المفهوم التالي.

المفهوم: {concept_name}
القسم: {section_title}
الصعوبة: {difficulty}
{exercise_context}

لكل سؤال أعط:
1. نص السؤال (واضح ومحدد)
2. 4 خيارات (A, B, C, D)
3. الإجابة الصحيحة
4. مستوى Bloom (remember/understand/apply/analyze)
5. شرح مختصر

أجب بـ JSON فقط بدون أي نص إضافي:
[
  {{
    "text": "نص السؤال",
    "options": ["خيار A", "خيار B", "خيار C", "خيار D"],
    "correct_answer": "خيار A",
    "bloom_level": "apply",
    "explanation": "شرح مختصر"
  }}
]"""
        
        resp = httpx.post(
            "https://api.anthropic.com/v1/messages",
            headers={
                "x-api-key": api_key,
                "anthropic-version": "2023-06-01",
                "content-type": "application/json",
            },
            json={
                "model": "claude-sonnet-4-20250514",
                "max_tokens": 2000,
                "messages": [{"role": "user", "content": prompt}],
            },
            timeout=30.0,
        )
        
        if resp.status_code == 200:
            data = resp.json()
            text = data["content"][0]["text"]
            # Extract JSON from response
            json_match = re.search(r'\[[\s\S]*\]', text)
            if json_match:
                questions = json.loads(json_match.group())
                # Add IDs
                for i, q in enumerate(questions):
                    q["id"] = _make_q_id(concept_name, i)
                    q["concept_name"] = concept_name
                    q["difficulty"] = difficulty
                    q["generated"] = True
                return questions
    except Exception as e:
        print(f"[QuestionGen] LLM error: {e}")
    
    return generate_template_questions(
        concept_name, difficulty, num_questions, existing_exercises
    )


def generate_template_questions(
    concept_name: str,
    difficulty: str,
    num_questions: int,
    exercises: Optional[List[str]] = None,
) -> List[dict]:
    """
    Generate template-based questions when LLM is unavailable.
    Uses concept name to create meaningful question structures.
    """
    templates = {
        "easy": [
            {
                "template": "ما هو تعريف {concept}؟",
                "bloom": "remember",
                "options_gen": lambda c: [
                    f"دالة تصف العلاقة بين {c}",
                    f"عملية حسابية عشوائية",
                    f"نوع من المعادلات التربيعية فقط",
                    f"مفهوم غير رياضي",
                ],
            },
            {
                "template": "أي مما يلي يُعدّ مثالاً على {concept}؟",
                "bloom": "understand",
                "options_gen": lambda c: [
                    f"f(x) = x² + 1",
                    f"أحمد ذهب للمدرسة",
                    f"اللون الأزرق",
                    f"3 + = 5",
                ],
            },
        ],
        "medium": [
            {
                "template": "عند تطبيق مفهوم {concept}، ما الخطوة الأولى؟",
                "bloom": "apply",
                "options_gen": lambda c: [
                    f"تحديد المعطيات والمطلوب",
                    f"كتابة الإجابة مباشرة",
                    f"تجاهل الشروط",
                    f"استخدام آلة حاسبة فقط",
                ],
            },
            {
                "template": "ما الفرق بين {concept} والمفاهيم المشابهة؟",
                "bloom": "analyze",
                "options_gen": lambda c: [
                    f"يختلف في الشروط والخصائص الأساسية",
                    f"لا يوجد فرق",
                    f"الاختلاف في الاسم فقط",
                    f"يُستخدم في مجال مختلف تماماً",
                ],
            },
        ],
        "hard": [
            {
                "template": "حلّل العلاقة بين {concept} والمتطلبات السابقة له.",
                "bloom": "analyze",
                "options_gen": lambda c: [
                    f"يعتمد على المفاهيم الأساسية ويبني عليها",
                    f"مستقل تماماً عن أي مفهوم آخر",
                    f"يتناقض مع المفاهيم السابقة",
                    f"لا علاقة له بالرياضيات",
                ],
            },
        ],
    }
    
    selected = templates.get(difficulty, templates["medium"])
    questions = []
    
    for i in range(min(num_questions, len(selected))):
        t = selected[i % len(selected)]
        text = t["template"].format(concept=concept_name)
        options = t["options_gen"](concept_name)
        
        questions.append({
            "id": _make_q_id(concept_name, i),
            "text": text,
            "options": options,
            "correct_answer": options[0],
            "bloom_level": t["bloom"],
            "explanation": f"هذا السؤال يختبر مفهوم {concept_name}",
            "concept_name": concept_name,
            "difficulty": difficulty,
            "generated": True,
        })
    
    return questions


def classify_bloom_level(question_text: str) -> str:
    """Classify a question's Bloom's taxonomy level from its text."""
    text = question_text.lower()
    
    if any(w in text for w in ["عرّف", "اذكر", "ما هو", "ما هي", "سمّ"]):
        return "remember"
    elif any(w in text for w in ["اشرح", "وضّح", "قارن", "لماذا", "فسّر"]):
        return "understand"
    elif any(w in text for w in ["احسب", "طبّق", "حل", "أوجد", "عيّن"]):
        return "apply"
    elif any(w in text for w in ["حلّل", "ميّز", "استنتج", "قسّم"]):
        return "analyze"
    elif any(w in text for w in ["قيّم", "برّر", "انقد", "هل"]):
        return "evaluate"
    elif any(w in text for w in ["صمّم", "ابتكر", "اقترح", "أنشئ"]):
        return "create"
    
    return "apply"  # Default


def _make_q_id(concept: str, index: int) -> str:
    """Generate a stable question ID from concept name and index."""
    h = hashlib.md5(concept.encode()).hexdigest()[:6]
    return f"gen_{h}_q{index}"
