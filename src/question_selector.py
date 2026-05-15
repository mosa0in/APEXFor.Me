"""
APEX Question Selector — Adaptive question selection
Selects the optimal next question based on:
- Student mastery level (BKT)
- Pattern accuracy gaps
- Prerequisite coverage
- Difficulty fit

Formula (Spec §4.3):
  score(q) = difficulty_fit × 0.4 + pattern_gap × 0.3 + prereq_coverage × 0.3
"""
import json
import sqlite3
from typing import List, Dict, Optional, Tuple


def select_next_questions(
    conn: sqlite3.Connection,
    student_id: str,
    curriculum_slug: str,
    count: int = 1,
) -> List[dict]:
    """
    Select the best next question(s) for a student from the curriculum.
    
    Strategy:
    1. Load student mastery snapshots
    2. Find concepts with mastery < 0.75 (not yet mastered)
    3. Score available questions by difficulty_fit + pattern_gap + prereq_coverage
    4. Return top N questions
    """
    conn.row_factory = sqlite3.Row
    
    # 1. Load student mastery
    mastery_rows = conn.execute(
        "SELECT concept_id, mastery_estimate, pattern_accuracy FROM mastery_snapshots WHERE student_id = ?",
        (student_id,)
    ).fetchall()
    
    mastery_map = {}
    pattern_map = {}
    for r in mastery_rows:
        mastery_map[r["concept_id"]] = r["mastery_estimate"]
        try:
            pattern_map[r["concept_id"]] = json.loads(r["pattern_accuracy"] or "{}")
        except:
            pattern_map[r["concept_id"]] = {}
    
    # 2. Load curriculum concepts for this slug
    curriculum = conn.execute(
        "SELECT id FROM curricula WHERE slug = ?", (curriculum_slug,)
    ).fetchone()
    if not curriculum:
        return []
    
    concepts = conn.execute(
        "SELECT concept_id, name, prerequisites, difficulty_level FROM concepts WHERE curriculum_id = ?",
        (curriculum["id"],)
    ).fetchall()
    
    # 3. Find unmastered concepts (mastery < 0.75), ordered by prerequisite chain
    candidates = []
    for c in concepts:
        cid = c["concept_id"]
        mastery = mastery_map.get(cid, 0.3)  # Default L0
        
        if mastery >= 0.75:
            continue  # Already mastered
        
        # Check prerequisite coverage
        prereqs = []
        try:
            prereqs = json.loads(c["prerequisites"] or "[]")
        except:
            pass
        
        prereq_mastery_sum = 0
        prereq_count = 0
        for prereq_id in prereqs:
            prereq_count += 1
            prereq_mastery_sum += mastery_map.get(prereq_id, 0.3)
        
        prereq_coverage = (prereq_mastery_sum / prereq_count) if prereq_count > 0 else 1.0
        
        # Skip if prerequisites not met (< 0.5 average)
        if prereq_coverage < 0.4 and prereq_count > 0:
            continue
        
        # Difficulty fit: 1 - |q.diff - mastery×5| / 5
        diff = c["difficulty_level"] or 0.5
        difficulty_fit = 1.0 - abs(diff - mastery)
        
        # Pattern gap: prioritize question types the student is weakest at
        patterns = pattern_map.get(cid, {})
        mcq_acc = patterns.get("MCQ", 0.5)
        pattern_gap = 1.0 - mcq_acc
        
        # Score
        score = (difficulty_fit * 0.4) + (pattern_gap * 0.3) + (prereq_coverage * 0.3)
        
        candidates.append({
            "concept_id": cid,
            "concept_name": c["name"],
            "mastery": round(mastery, 3),
            "score": round(score, 3),
            "difficulty": diff,
            "prereq_coverage": round(prereq_coverage, 3),
        })
    
    # 4. Sort by score (highest first) and return top N
    candidates.sort(key=lambda x: x["score"], reverse=True)
    return candidates[:count]


def get_learning_path(
    conn: sqlite3.Connection,
    student_id: str,
    curriculum_slug: str,
) -> dict:
    """
    Generate a complete learning path for a student.
    Returns ordered list of concepts with status (mastered/active/locked).
    """
    conn.row_factory = sqlite3.Row
    
    # Load mastery
    mastery_rows = conn.execute(
        "SELECT concept_id, mastery_estimate FROM mastery_snapshots WHERE student_id = ?",
        (student_id,)
    ).fetchall()
    mastery_map = {r["concept_id"]: r["mastery_estimate"] for r in mastery_rows}
    
    # Load curriculum
    curriculum = conn.execute(
        "SELECT id FROM curricula WHERE slug = ?", (curriculum_slug,)
    ).fetchone()
    if not curriculum:
        return {"path": [], "progress": 0}
    
    concepts = conn.execute(
        "SELECT concept_id, name, section_title, difficulty_level, is_core, prerequisites "
        "FROM concepts WHERE curriculum_id = ? ORDER BY id",
        (curriculum["id"],)
    ).fetchall()
    
    path = []
    mastered = 0
    total = len(concepts)
    
    for c in concepts:
        cid = c["concept_id"]
        mastery = mastery_map.get(cid, 0.0)
        
        if mastery >= 0.75:
            status = "mastered"
            mastered += 1
        elif mastery > 0:
            status = "active"
        else:
            status = "locked"
        
        path.append({
            "concept_id": cid,
            "name": c["name"],
            "section": c["section_title"],
            "mastery": round(mastery, 3),
            "status": status,
            "is_core": bool(c["is_core"]),
        })
    
    progress = round((mastered / total * 100) if total > 0 else 0, 1)
    
    return {
        "path": path,
        "progress": progress,
        "mastered": mastered,
        "total": total,
        "next_concepts": select_next_questions(conn, student_id, curriculum_slug, count=3),
    }
