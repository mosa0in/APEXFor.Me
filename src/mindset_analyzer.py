"""
APEX Mindset Gap Detection ★ — ORIGINAL CONTRIBUTION
Analyzes the gap between student's answer and their explanation.

Layer 3: Compares correct/wrong with student_explanation to classify:
- conceptual gap: student can't explain WHY (even if correct)
- procedural gap: student knows concept but makes mechanical errors
- none: student demonstrates understanding matching their answer

Uses LLM (Gemini) when available, falls back to heuristic analysis.
"""
import os
import re
import json
from typing import Optional, Tuple


def analyze_mindset_gap(
    correct: bool,
    confidence: int,
    student_explanation: str,
    concept_name: str = "",
    correct_answer: str = "",
) -> dict:
    """
    Analyze the gap between answer correctness and student explanation.
    
    Returns:
        {
            "gap_type": "conceptual" | "procedural" | "none" | "insufficient_data",
            "confidence_answer_class": "true_mastery" | "conceptual_error" | "lucky_guess" | "knowledge_gap",
            "explanation_quality": "rich" | "minimal" | "empty",
            "needs_socratic_probe": bool,
            "insight": str  # Human-readable insight
        }
    """
    # Classify confidence × answer
    if confidence >= 4:
        ca_class = 'true_mastery' if correct else 'conceptual_error'
    elif confidence <= 2:
        ca_class = 'lucky_guess' if correct else 'knowledge_gap'
    else:
        ca_class = 'true_mastery' if correct else 'knowledge_gap'
    
    # Assess explanation quality
    explanation = (student_explanation or "").strip()
    if len(explanation) < 3:
        exp_quality = "empty"
    elif len(explanation) < 20:
        exp_quality = "minimal"
    else:
        exp_quality = "rich"
    
    # If no explanation, we can't do mindset analysis
    if exp_quality == "empty":
        return {
            "gap_type": "insufficient_data",
            "confidence_answer_class": ca_class,
            "explanation_quality": exp_quality,
            "needs_socratic_probe": True,
            "insight": "لم يقدم الطالب تفسيراً — يحتاج سؤال سقراطي لفهم تفكيره"
        }
    
    # Heuristic mindset gap detection
    gap_type = "none"
    needs_probe = False
    insight = ""
    
    if correct and confidence >= 4 and exp_quality == "rich":
        # Best case: correct + confident + good explanation = true mastery
        gap_type = "none"
        insight = f"إتقان حقيقي: الطالب أجاب صح وواثق وشرح منطقه بوضوح"
    
    elif correct and confidence <= 2:
        # Lucky guess: correct but not confident
        gap_type = "procedural"
        needs_probe = True
        insight = f"تخمين محتمل: أجاب صح لكن ثقته منخفضة ({confidence}/5) — يحتاج تأكيد فهمه"
    
    elif not correct and confidence >= 4:
        # MOST DANGEROUS: confident but wrong = conceptual error ★
        gap_type = "conceptual"
        needs_probe = True
        insight = f"خطأ مفاهيمي خطير ★: واثق ({confidence}/5) لكن إجابته خاطئة — الطالب يحمل مفهوم خاطئ يجب تصحيحه"
    
    elif not correct and exp_quality == "rich":
        # Wrong but explained their thinking — procedural error
        gap_type = "procedural"
        needs_probe = True
        insight = f"خطأ إجرائي: الطالب يفهم المفهوم لكن أخطأ في التطبيق"
    
    elif not correct and confidence <= 2:
        # Wrong and knows they don't know — honest knowledge gap
        gap_type = "conceptual"
        needs_probe = False
        insight = f"فجوة معرفية واضحة: الطالب لا يعرف ويدرك ذلك — يحتاج شرح أساسي"
    
    else:
        gap_type = "none"
        insight = f"حالة عادية — متابعة التقييم"
    
    # Check for keywords in explanation that signal specific gaps
    if explanation:
        confusion_markers = ["مش فاهم", "ما اعرف", "حاولت", "مش متأكد", "بس حسيت", "ما بعرف", "صعب"]
        procedural_markers = ["طرحت", "جمعت", "ضربت", "قسمت", "حسبت", "عوضت", "حليت"]
        
        has_confusion = any(m in explanation for m in confusion_markers)
        has_procedure = any(m in explanation for m in procedural_markers)
        
        if correct and has_confusion:
            gap_type = "conceptual"
            needs_probe = True
            insight = "فجوة مخفية: أجاب صح لكن تفسيره يظهر عدم فهم — يحتاج تعمق"
        elif not correct and has_procedure:
            gap_type = "procedural"
            insight = "خطأ إجرائي: الطالب يعرف الخطوات لكن أخطأ في تنفيذها"
    
    return {
        "gap_type": gap_type,
        "confidence_answer_class": ca_class,
        "explanation_quality": exp_quality,
        "needs_socratic_probe": needs_probe,
        "insight": insight,
    }
