"""
APEX Knowledge Graph — SQLite-native graph layer
Provides graph traversal queries (prerequisites, related concepts, paths)
using the existing SQLite schema instead of requiring a Neo4j server.

This is the production-ready alternative that mirrors the Neo4j graph_builder
interface but works with the 4-table SQLite schema.
"""
import json
import sqlite3
from typing import List, Dict, Optional, Tuple


class SQLiteGraphEngine:
    """Graph query engine using SQLite — no external dependencies."""

    def __init__(self, conn: sqlite3.Connection):
        self.conn = conn
        self.conn.row_factory = sqlite3.Row

    def get_concept_with_context(self, concept_id: str) -> Optional[dict]:
        """Get a concept with its full graph context (section, chapter, prerequisites, questions)."""
        concept = self.conn.execute(
            "SELECT * FROM concepts WHERE concept_id = ?", (concept_id,)
        ).fetchone()
        if not concept:
            return None

        # Get section and chapter info from curriculum
        curriculum = self.conn.execute(
            "SELECT * FROM curricula WHERE id = ?", (concept["curriculum_id"],)
        ).fetchone()

        # Parse prerequisites
        prereqs = []
        try:
            prereq_ids = json.loads(concept["prerequisites"] or "[]")
            for pid in prereq_ids:
                p = self.conn.execute(
                    "SELECT concept_id, name, difficulty_level FROM concepts WHERE concept_id = ?", (pid,)
                ).fetchone()
                if p:
                    prereqs.append(dict(p))
        except:
            pass

        # Get questions from the curriculum_json (stored in curricula table)
        questions = self.conn.execute(
            "SELECT * FROM curriculum WHERE concept_id = ?", (concept_id,)
        ).fetchall()

        return {
            "concept": dict(concept),
            "section_title": concept["section_title"],
            "curriculum": dict(curriculum) if curriculum else {},
            "prerequisites": prereqs,
            "questions": [dict(q) for q in questions],
            "dependents": self._get_dependents(concept_id),
        }

    def _get_dependents(self, concept_id: str) -> List[dict]:
        """Find concepts that depend on (require) this concept."""
        all_concepts = self.conn.execute(
            "SELECT concept_id, name, prerequisites FROM concepts"
        ).fetchall()

        dependents = []
        for c in all_concepts:
            try:
                prereqs = json.loads(c["prerequisites"] or "[]")
                if concept_id in prereqs:
                    dependents.append({"concept_id": c["concept_id"], "name": c["name"]})
            except:
                pass
        return dependents

    def get_prerequisite_chain(self, concept_id: str, max_depth: int = 10) -> List[dict]:
        """
        Walk the prerequisite graph backwards from a concept.
        Returns ordered list from foundational → target concept.
        """
        chain = []
        visited = set()

        def _walk(cid: str, depth: int):
            if depth > max_depth or cid in visited:
                return
            visited.add(cid)

            concept = self.conn.execute(
                "SELECT concept_id, name, prerequisites, difficulty_level FROM concepts WHERE concept_id = ?",
                (cid,)
            ).fetchone()
            if not concept:
                return

            prereqs = []
            try:
                prereqs = json.loads(concept["prerequisites"] or "[]")
            except:
                pass

            for pid in prereqs:
                _walk(pid, depth + 1)

            chain.append({
                "concept_id": concept["concept_id"],
                "name": concept["name"],
                "difficulty": concept["difficulty_level"],
                "depth": depth,
            })

        _walk(concept_id, 0)
        return chain

    def find_related_concepts(self, concept_id: str) -> List[dict]:
        """
        Find concepts related to a given concept by:
        1. Sharing the same section
        2. Having overlapping prerequisites
        3. Being prerequisite of the same concept
        """
        concept = self.conn.execute(
            "SELECT * FROM concepts WHERE concept_id = ?", (concept_id,)
        ).fetchone()
        if not concept:
            return []

        related = {}

        # Same section
        same_section = self.conn.execute(
            "SELECT concept_id, name FROM concepts WHERE section_title = ? AND concept_id != ?",
            (concept["section_title"], concept_id)
        ).fetchall()
        for c in same_section:
            related[c["concept_id"]] = {
                "concept_id": c["concept_id"],
                "name": c["name"],
                "relation": "same_section",
            }

        # Prerequisites of this concept
        try:
            prereqs = json.loads(concept["prerequisites"] or "[]")
            for pid in prereqs:
                p = self.conn.execute(
                    "SELECT concept_id, name FROM concepts WHERE concept_id = ?", (pid,)
                ).fetchone()
                if p and p["concept_id"] not in related:
                    related[p["concept_id"]] = {
                        "concept_id": p["concept_id"],
                        "name": p["name"],
                        "relation": "prerequisite",
                    }
        except:
            pass

        # Concepts that depend on this
        dependents = self._get_dependents(concept_id)
        for d in dependents:
            if d["concept_id"] not in related:
                related[d["concept_id"]] = {**d, "relation": "dependent"}

        return list(related.values())

    def get_graph_summary(self, curriculum_id: int) -> dict:
        """Get Knowledge Graph stats for a curriculum."""
        concepts = self.conn.execute(
            "SELECT COUNT(*) as count FROM concepts WHERE curriculum_id = ?", (curriculum_id,)
        ).fetchone()

        exercises = self.conn.execute(
            "SELECT SUM(exercise_count) as count FROM concepts WHERE curriculum_id = ?", (curriculum_id,)
        ).fetchone()

        # Count prerequisite edges
        all_concepts = self.conn.execute(
            "SELECT prerequisites FROM concepts WHERE curriculum_id = ?", (curriculum_id,)
        ).fetchall()

        edge_count = 0
        for c in all_concepts:
            try:
                prereqs = json.loads(c["prerequisites"] or "[]")
                edge_count += len(prereqs)
            except:
                pass

        return {
            "total_concepts": concepts["count"],
            "total_exercises": exercises["count"],
            "total_prerequisite_edges": edge_count,
            "graph_type": "SQLite-native (no Neo4j required)",
        }

    def interpolate_mastery(
        self,
        student_mastery: Dict[str, float],
        concept_id: str,
    ) -> float:
        """
        Estimate mastery for a concept that hasn't been directly tested,
        based on prerequisite mastery (graph interpolation).

        Formula: avg(prereq_masteries) × 0.7
        """
        concept = self.conn.execute(
            "SELECT prerequisites FROM concepts WHERE concept_id = ?", (concept_id,)
        ).fetchone()
        if not concept:
            return 0.3  # Default L0

        try:
            prereqs = json.loads(concept["prerequisites"] or "[]")
        except:
            return 0.3

        if not prereqs:
            return 0.3

        prereq_masteries = [student_mastery.get(pid, 0.3) for pid in prereqs]
        avg_prereq = sum(prereq_masteries) / len(prereq_masteries)

        # Interpolated mastery is lower than prereqs (you haven't studied this yet)
        return round(avg_prereq * 0.7, 3)
