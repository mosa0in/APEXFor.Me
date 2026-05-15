"""
APEX Coach Analyzer — Pipeline 4: Student behavior analysis for coach personalization
Analyzes interaction patterns to build personality_traits and coaching insights.
"""
import json
import sqlite3
from typing import Dict, List, Optional


def analyze_student_behavior(
    conn: sqlite3.Connection,
    student_id: str,
) -> dict:
    """
    Analyze all interactions for a student and build behavioral profile.
    
    Returns:
        {
            "personality_traits": {
                "needs_encouragement": "high" | "medium" | "low",
                "prefers_hints": bool,
                "attention_span": "short" | "medium" | "long",
                "learning_speed": "fast" | "medium" | "slow",
                "confidence_calibration": "overconfident" | "calibrated" | "underconfident",
            },
            "session_stats": {...},
            "recommendations": [str],
        }
    """
    conn.row_factory = sqlite3.Row
    
    interactions = conn.execute(
        "SELECT * FROM interactions WHERE student_id = ? ORDER BY timestamp",
        (student_id,)
    ).fetchall()
    
    if not interactions:
        return {
            "personality_traits": _default_traits(),
            "session_stats": {},
            "recommendations": ["لا توجد بيانات كافية — ابدأ الاختبار التشخيصي"],
        }
    
    total = len(interactions)
    correct_count = sum(1 for i in interactions if i["correct"])
    hint_count = sum(1 for i in interactions if i["hint_used"])
    coach_count = sum(1 for i in interactions if i["coach_called"])
    rest_count = sum(1 for i in interactions if i["rest_requested"])
    regen_count = sum(i["question_regenerated"] for i in interactions)
    
    # Confidence analysis
    confidences = [i["confidence_level"] for i in interactions if i["confidence_level"] > 0]
    avg_confidence = sum(confidences) / len(confidences) if confidences else 3
    
    # Confidence calibration: compare confidence with correctness
    overconfident_count = 0
    underconfident_count = 0
    for i in interactions:
        conf = i["confidence_level"]
        if conf >= 4 and not i["correct"]:
            overconfident_count += 1
        elif conf <= 2 and i["correct"]:
            underconfident_count += 1
    
    # Explanation analysis
    explanations = [i["student_explanation"] for i in interactions if i["student_explanation"]]
    avg_explanation_len = sum(len(e) for e in explanations) / len(explanations) if explanations else 0
    
    # Build traits
    accuracy = correct_count / total if total > 0 else 0
    
    # Needs encouragement: low accuracy + frequent rest/coach requests
    encouragement_score = (1 - accuracy) * 0.4 + (rest_count / max(total, 1)) * 0.3 + (coach_count / max(total, 1)) * 0.3
    needs_encouragement = "high" if encouragement_score > 0.5 else "medium" if encouragement_score > 0.2 else "low"
    
    # Attention span: based on rest requests and session patterns
    attention_span = "short" if rest_count > total * 0.3 else "long" if rest_count == 0 else "medium"
    
    # Learning speed: based on accuracy trend
    if total >= 4:
        first_half = interactions[:total // 2]
        second_half = interactions[total // 2:]
        first_acc = sum(1 for i in first_half if i["correct"]) / len(first_half)
        second_acc = sum(1 for i in second_half if i["correct"]) / len(second_half)
        if second_acc > first_acc + 0.15:
            learning_speed = "fast"
        elif second_acc < first_acc - 0.1:
            learning_speed = "slow"
        else:
            learning_speed = "medium"
    else:
        learning_speed = "medium"
    
    # Confidence calibration
    if overconfident_count > total * 0.3:
        confidence_calibration = "overconfident"
    elif underconfident_count > total * 0.3:
        confidence_calibration = "underconfident"
    else:
        confidence_calibration = "calibrated"
    
    traits = {
        "needs_encouragement": needs_encouragement,
        "prefers_hints": hint_count > total * 0.3,
        "attention_span": attention_span,
        "learning_speed": learning_speed,
        "confidence_calibration": confidence_calibration,
        "avg_explanation_length": round(avg_explanation_len),
    }
    
    stats = {
        "total_interactions": total,
        "accuracy": round(accuracy * 100, 1),
        "avg_confidence": round(avg_confidence, 2),
        "hint_usage_rate": round(hint_count / max(total, 1) * 100, 1),
        "coach_usage_rate": round(coach_count / max(total, 1) * 100, 1),
        "rest_requests": rest_count,
        "rephrase_total": regen_count,
        "explanations_given": len(explanations),
    }
    
    # Recommendations
    recs = []
    if confidence_calibration == "overconfident":
        recs.append("الطالب يميل للثقة المفرطة — استخدم أسئلة سقراطية لتحدي فهمه")
    if confidence_calibration == "underconfident":
        recs.append("الطالب يقلل من قدراته — شجعه وأبرز نجاحاته")
    if needs_encouragement == "high":
        recs.append("الطالب يحتاج تشجيع مستمر — استخدم نظام النجوم والـ badges")
    if attention_span == "short":
        recs.append("الطالب يتعب سريعاً — قصّر الجلسات وأضف فترات راحة")
    if learning_speed == "fast":
        recs.append("الطالب يتعلم بسرعة — زد صعوبة الأسئلة تدريجياً")
    if not explanations:
        recs.append("الطالب لا يكتب تفسيرات — شجعه على الشرح لتفعيل Mindset Detection")
    
    return {
        "personality_traits": traits,
        "session_stats": stats,
        "recommendations": recs,
    }


def _default_traits():
    return {
        "needs_encouragement": "medium",
        "prefers_hints": False,
        "attention_span": "medium",
        "learning_speed": "medium",
        "confidence_calibration": "calibrated",
        "avg_explanation_length": 0,
    }
