"""
APEX — Sessions Router
The core intelligence pipeline: Denoising → BKT → Mindset → Store
"""

import json
from fastapi import APIRouter, HTTPException, Depends

from api.utils import get_db, get_current_student
from src.denoising_engine import compute_weighted_correct, classify_confidence_answer
from src.mastery_tracker import bkt_update, check_mastery_gate, get_mastery_level, L0
from src.mindset_analyzer import analyze_mindset_gap

router = APIRouter(prefix="/api/sessions", tags=["Sessions"])


@router.post("")
def submit_session(data: dict, current_student: str = Depends(get_current_student)):
    """
    Receive a complete diagnostic session from the frontend.
    Pipeline: Insert interactions → Denoising → BKT Update → Mindset Analysis → Store mastery.
    """
    student_id = current_student  # Always use token identity — never trust request body
    session_id = data.get("sessionId", "")
    responses = data.get("responses", [])

    if not student_id or not responses:
        raise HTTPException(400, "Missing studentId or responses")

    with get_db() as conn:
        # Load existing mastery snapshots
        existing_mastery = {}
        rows = conn.execute(
            "SELECT concept_id, mastery_estimate FROM mastery_snapshots WHERE student_id = ?",
            (student_id,)).fetchall()
        for row in rows:
            existing_mastery[row["concept_id"]] = row["mastery_estimate"]

        inserted = 0
        mindset_insights = []
        mastery_updates = {}

        for r in responses:
            concept_id = r.get("conceptId", "")
            correct = bool(r.get("isCorrect", False))
            confidence = r.get("confidenceBefore", 0)
            reflection = r.get("reflection", "")
            hint_used = bool(r.get("usedHint", False))
            explanation_viewed = bool(r.get("usedSolution", False))
            rephrase_count = r.get("rephraseCount", 0)
            coach_used = bool(r.get("coachUsed", False))
            rest_requested = bool(r.get("restRequested", False))
            response_time_ms = int(r.get("timeSpentMs", r.get("responseTimeMs", r.get("response_time_ms", 0))))
            break_duration_ms = int(r.get("breakDurationMs", 0))

            # Step 1: Denoising
            prereq_mastery = existing_mastery.get(concept_id)
            weighted = compute_weighted_correct(
                correct=correct, confidence_level=confidence, hint_used=hint_used,
                explanation_viewed=explanation_viewed, question_regenerated=rephrase_count,
                prereq_mastery=prereq_mastery)
            ca_class = classify_confidence_answer(correct, confidence)

            # Step 2: BKT Mastery Update
            current_mastery = mastery_updates.get(concept_id, existing_mastery.get(concept_id, L0))
            new_mastery = bkt_update(current_mastery, weighted)
            gate_passed = check_mastery_gate(new_mastery)
            mastery_updates[concept_id] = new_mastery

            # Step 3: Mindset Gap Detection
            mindset = analyze_mindset_gap(
                correct=correct, confidence=confidence,
                student_explanation=reflection, concept_name=r.get("conceptName", ""))
            if mindset["gap_type"] not in ("none", "insufficient_data"):
                mindset_insights.append({
                    "concept": r.get("conceptName", concept_id),
                    "gap_type": mindset["gap_type"], "insight": mindset["insight"]})

            # Step 4: Store interaction
            try:
                conn.execute("""
                    INSERT INTO interactions
                    (student_id, question_id, concept_id, session_id, session_type,
                     correct, attempt_number, prior_attempts, confidence_level,
                     hint_used, explanation_viewed, student_explanation,
                     input_modality, question_pattern, question_regenerated,
                     regeneration_reason, rest_requested, coach_called,
                     coach_interaction_type, session_end_type, mastery_gate_passed,
                     response_time_ms, break_duration_ms)
                    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
                """, (student_id, str(r.get("questionId", "")), concept_id, session_id,
                      "diagnostic", int(correct), 1, 0, confidence,
                      int(hint_used), int(explanation_viewed), reflection,
                      r.get("inputModality", "keyboard"), "MCQ", rephrase_count,
                      "", int(rest_requested), int(coach_used), ca_class, mindset.get("gap_type", ""),
                      int(gate_passed), response_time_ms, break_duration_ms))
                inserted += 1
            except Exception as e:
                print(f"[Sessions] Error inserting interaction: {e}")

        # Store BKT mastery snapshots
        for concept_id, mastery in mastery_updates.items():
            try:
                conn.execute("""
                    INSERT INTO mastery_snapshots
                        (student_id, concept_id, mastery_estimate, accuracy_rate, sessions_count, last_updated)
                    VALUES (?, ?, ?, ?, 1, datetime('now'))
                    ON CONFLICT(student_id, concept_id) DO UPDATE SET
                        mastery_estimate = ?, accuracy_rate = ?,
                        sessions_count = sessions_count + 1, last_updated = datetime('now')
                """, (student_id, concept_id, mastery, mastery, mastery, mastery))
            except Exception as e:
                print(f"[Sessions] Error updating mastery: {e}")

        # Mark diagnostic_done + update stars
        correct_count = sum(1 for r in responses if r.get("isCorrect", False))
        gates_passed = sum(1 for m in mastery_updates.values() if check_mastery_gate(m))
        stars_earned = correct_count * 10 + gates_passed * 50

        try:
            conn.execute("UPDATE students SET diagnostic_done = 1, stars_total = stars_total + ?, updated_at = datetime('now') WHERE student_id = ?",
                         (stars_earned, student_id))
        except Exception as e:
            print(f"[Sessions] Error updating student: {e}")

        conn.commit()

    overall_mastery = sum(mastery_updates.values()) / len(mastery_updates) if mastery_updates else 0
    print(f"[Sessions] Pipeline complete: {inserted} interactions | mastery: {overall_mastery:.2f} | gates: {gates_passed}/{len(mastery_updates)} | mindset gaps: {len(mindset_insights)} | stars: +{stars_earned}")

    return {
        "status": "ok", "interactions_saved": inserted, "session_id": session_id,
        "stars_earned": stars_earned,
        "pipeline": {
            "overall_mastery": round(overall_mastery, 3), "concepts_tracked": len(mastery_updates),
            "gates_passed": gates_passed, "mindset_gaps": mindset_insights,
        }
    }
