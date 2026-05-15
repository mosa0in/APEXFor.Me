"""
APEX Content Renderer — Converts LLM explanations to visual content
Transforms plain-text AI explanations into structured, renderable
content blocks (markdown, LaTeX, step-by-step, visual diagrams).

Gap closure: Previously AI coach responses were raw text only.
This module structures them for rich frontend rendering.
"""
import re
import json
from typing import List, Dict, Optional


# ═══════════════════════════════════════════
# Content Block Types
# ═══════════════════════════════════════════
BLOCK_TYPES = {
    "text": "نص عادي",
    "math": "معادلة رياضية (LaTeX)",
    "steps": "خطوات متسلسلة",
    "hint": "تلميح",
    "example": "مثال",
    "diagram": "رسم توضيحي (ASCII/SVG)",
    "comparison": "مقارنة",
    "warning": "تنبيه",
    "summary": "ملخص",
}


def render_explanation(raw_text: str, concept_name: str = "") -> dict:
    """
    Parse raw LLM explanation into structured content blocks.
    
    Args:
        raw_text: Raw text from AI coach or explanation
        concept_name: Optional concept name for context
    
    Returns:
        {
            "blocks": [...],
            "has_math": bool,
            "has_steps": bool,
            "estimated_read_time_seconds": int
        }
    """
    if not raw_text or not raw_text.strip():
        return {
            "blocks": [{"type": "text", "content": "لا يوجد شرح متاح حالياً"}],
            "has_math": False,
            "has_steps": False,
            "estimated_read_time_seconds": 2,
        }
    
    blocks = []
    text = raw_text.strip()
    
    # Extract math expressions (LaTeX-style or inline)
    has_math = bool(re.search(r'[\$\\]|[a-z]\(x\)|f\(|g\(|\d+x[\²³]?', text))
    
    # Detect step-by-step patterns
    step_pattern = re.compile(
        r'(?:^|\n)\s*(?:الخطوة\s*\d+|خطوة\s*\d+|\d+[\.\)]\s|Step\s*\d+)',
        re.MULTILINE
    )
    has_steps = bool(step_pattern.search(text))
    
    # Parse into blocks
    if has_steps:
        blocks.extend(_parse_steps(text))
    else:
        blocks.extend(_parse_paragraphs(text))
    
    # Extract math blocks
    math_blocks = _extract_math(text)
    if math_blocks:
        blocks.extend(math_blocks)
    
    # Add concept context if available
    if concept_name:
        blocks.insert(0, {
            "type": "hint",
            "content": f"📌 المفهوم: {concept_name}",
        })
    
    # Deduplicate
    seen = set()
    unique_blocks = []
    for b in blocks:
        key = f"{b['type']}:{b['content'][:50]}"
        if key not in seen:
            seen.add(key)
            unique_blocks.append(b)
    
    # Estimate read time (~200 words/minute for Arabic)
    word_count = len(text.split())
    read_time = max(5, int(word_count / 3.3))
    
    return {
        "blocks": unique_blocks,
        "has_math": has_math,
        "has_steps": has_steps,
        "estimated_read_time_seconds": read_time,
    }


def render_solution(
    question_text: str,
    correct_answer: str,
    student_answer: str = "",
    explanation: str = "",
) -> dict:
    """
    Render a structured solution view for a question.
    Shows what was wrong, what's right, and the explanation.
    """
    blocks = []
    is_correct = student_answer == correct_answer
    
    # Result header
    blocks.append({
        "type": "text",
        "content": "✅ إجابة صحيحة!" if is_correct else "❌ إجابة خاطئة",
        "style": "success" if is_correct else "error",
    })
    
    # Show correct answer
    if not is_correct:
        blocks.append({
            "type": "comparison",
            "content": json.dumps({
                "student": student_answer or "—",
                "correct": correct_answer,
            }, ensure_ascii=False),
        })
    
    # Explanation
    if explanation:
        rendered = render_explanation(explanation)
        blocks.extend(rendered["blocks"])
    
    return {"blocks": blocks, "is_correct": is_correct}


def render_concept_card(
    concept_name: str,
    description: str = "",
    prerequisites: List[str] = None,
    mastery: float = 0.0,
    difficulty: str = "medium",
) -> dict:
    """
    Render a visual concept card for the learning path.
    """
    blocks = []
    
    # Header
    blocks.append({
        "type": "text",
        "content": concept_name,
        "style": "heading",
    })
    
    # Mastery indicator
    mastery_pct = int(mastery * 100)
    mastery_emoji = "🟢" if mastery_pct >= 70 else "🟡" if mastery_pct > 30 else "🔴"
    blocks.append({
        "type": "text",
        "content": f"{mastery_emoji} الإتقان: {mastery_pct}%",
        "style": "badge",
    })
    
    # Description
    if description:
        blocks.append({"type": "text", "content": description})
    
    # Prerequisites
    if prerequisites:
        blocks.append({
            "type": "hint",
            "content": "📋 المتطلبات: " + " ← ".join(prerequisites),
        })
    
    # Difficulty
    diff_map = {"easy": "⭐", "medium": "⭐⭐", "hard": "⭐⭐⭐"}
    blocks.append({
        "type": "text",
        "content": f"الصعوبة: {diff_map.get(difficulty, '⭐⭐')}",
        "style": "muted",
    })
    
    return {"blocks": blocks}


# ═══════════════════════════════════════════
# Internal Parsers
# ═══════════════════════════════════════════

def _parse_steps(text: str) -> List[dict]:
    """Parse step-by-step content into ordered blocks."""
    blocks = []
    # Split by numbered patterns
    parts = re.split(r'(?:^|\n)\s*(?:الخطوة\s*(\d+)|(\d+)[\.\)])\s*', text)
    
    step_num = 0
    for part in parts:
        if not part or part.strip().isdigit():
            continue
        content = part.strip()
        if not content:
            continue
        step_num += 1
        blocks.append({
            "type": "steps",
            "content": content,
            "step_number": step_num,
        })
    
    if not blocks:
        # Fallback — couldn't parse steps
        blocks.append({"type": "text", "content": text})
    
    return blocks


def _parse_paragraphs(text: str) -> List[dict]:
    """Parse text into paragraph blocks."""
    blocks = []
    paragraphs = text.split('\n\n')
    
    for p in paragraphs:
        p = p.strip()
        if not p:
            continue
        
        # Detect special patterns
        if p.startswith('⚠') or p.startswith('تنبيه') or p.startswith('ملاحظة'):
            blocks.append({"type": "warning", "content": p})
        elif p.startswith('مثال') or p.startswith('💡'):
            blocks.append({"type": "example", "content": p})
        elif p.startswith('ملخص') or p.startswith('📝'):
            blocks.append({"type": "summary", "content": p})
        else:
            blocks.append({"type": "text", "content": p})
    
    if not blocks:
        blocks.append({"type": "text", "content": text})
    
    return blocks


def _extract_math(text: str) -> List[dict]:
    """Extract mathematical expressions from text."""
    blocks = []
    
    # LaTeX-style: $...$  or  $$...$$
    latex_patterns = re.findall(r'\$\$(.+?)\$\$|\$(.+?)\$', text)
    for match in latex_patterns:
        expr = match[0] or match[1]
        if expr.strip():
            blocks.append({"type": "math", "content": expr.strip()})
    
    # Inline math: f(x) = ..., y = mx + b, etc.
    inline_math = re.findall(
        r'([a-zA-Z]\([a-zA-Z]\)\s*=\s*[^,\n]+)',
        text
    )
    for expr in inline_math:
        if len(expr) > 3:
            blocks.append({"type": "math", "content": expr.strip()})
    
    return blocks
