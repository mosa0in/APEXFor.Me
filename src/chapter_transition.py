"""
APEX Chapter Transition — Mastery gate detection and chapter progression
Detects when a student has mastered all concepts in a section/chapter
and triggers the transition to the next one.
"""
import json
import sqlite3
from typing import Optional, List, Dict


def check_section_completion(
    conn: sqlite3.Connection,
    student_id: str,
    curriculum_slug: str,
    gate_threshold: float = 0.75,
) -> dict:
    """
    Check all sections for completion status.
    A section is complete when ALL its core concepts have mastery >= gate_threshold.
    
    Returns:
        {
            "completed_sections": [...],
            "active_section": {...} or None,
            "next_section": {...} or None,
            "overall_progress": float (0-100),
        }
    """
    conn.row_factory = sqlite3.Row
    
    # Load curriculum
    curriculum = conn.execute(
        "SELECT id, curriculum_json FROM curricula WHERE slug = ?", (curriculum_slug,)
    ).fetchone()
    if not curriculum:
        return {"completed_sections": [], "active_section": None, "next_section": None, "overall_progress": 0}
    
    # Load mastery
    mastery_rows = conn.execute(
        "SELECT concept_id, mastery_estimate FROM mastery_snapshots WHERE student_id = ?",
        (student_id,)
    ).fetchall()
    mastery_map = {r["concept_id"]: r["mastery_estimate"] for r in mastery_rows}

    # Build title→id map from curriculum JSON so we can return section IDs
    title_to_id: Dict[str, str] = {}
    try:
        cur_data = json.loads(curriculum["curriculum_json"])
        for ch in cur_data.get("chapters", []):
            for sec in ch.get("sections", []):
                if sec.get("title") and sec.get("id"):
                    title_to_id[sec["title"]] = sec["id"]
    except Exception:
        pass

    # Load concepts grouped by section
    concepts = conn.execute(
        "SELECT concept_id, name, section_title, is_core FROM concepts WHERE curriculum_id = ? ORDER BY id",
        (curriculum["id"],)
    ).fetchall()

    # Group by section
    sections: Dict[str, dict] = {}
    for c in concepts:
        sec = c["section_title"] or "Unknown"
        if sec not in sections:
            sections[sec] = {"title": sec, "concepts": [], "core_concepts": []}
        sections[sec]["concepts"].append(c["concept_id"])
        if c["is_core"]:
            sections[sec]["core_concepts"].append(c["concept_id"])

    completed = []
    active_section = None
    next_section = None

    for sec_title, sec_data in sections.items():
        core = sec_data["core_concepts"] or sec_data["concepts"]
        if not core:
            continue

        # Check mastery of core concepts
        masteries = [mastery_map.get(cid, 0.0) for cid in core]
        avg_mastery = sum(masteries) / len(masteries)
        all_passed = all(m >= gate_threshold for m in masteries)

        sec_info = {
            "id": title_to_id.get(sec_title, ""),
            "title": sec_title,
            "total_concepts": len(sec_data["concepts"]),
            "core_concepts": len(core),
            "avg_mastery": round(avg_mastery, 3),
            "all_gates_passed": all_passed,
        }
        
        if all_passed:
            completed.append(sec_info)
        elif active_section is None:
            active_section = sec_info
        elif next_section is None:
            next_section = sec_info
    
    total = len(sections)
    progress = round((len(completed) / total * 100) if total > 0 else 0, 1)
    
    return {
        "completed_sections": completed,
        "active_section": active_section,
        "next_section": next_section,
        "overall_progress": progress,
        "total_sections": total,
    }


def detect_gate_passage(
    conn: sqlite3.Connection,
    student_id: str,
    concept_id: str,
    new_mastery: float,
    gate_threshold: float = 0.75,
) -> Optional[dict]:
    """
    Called after each mastery update. Detects if this update caused a gate passage.
    
    Returns transition info if gate was just passed, None otherwise.
    """
    if new_mastery < gate_threshold:
        return None
    
    # Check if this was already passed before
    conn.row_factory = sqlite3.Row
    prev = conn.execute(
        "SELECT mastery_estimate FROM mastery_snapshots WHERE student_id = ? AND concept_id = ?",
        (student_id, concept_id)
    ).fetchone()
    
    if prev and prev["mastery_estimate"] >= gate_threshold:
        return None  # Already passed before
    
    return {
        "type": "gate_passed",
        "concept_id": concept_id,
        "new_mastery": round(new_mastery, 3),
        "message": f"تهانينا! تجاوزت بوابة الإتقان للمفهوم ({round(new_mastery * 100)}%)",
    }
