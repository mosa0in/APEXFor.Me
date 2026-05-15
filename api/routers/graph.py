"""
APEX — Knowledge Graph Router
Endpoints: concept context, prereq-chain, summary, interpolate
"""

from fastapi import APIRouter, HTTPException
from api.utils import get_db
from src.graph_engine import SQLiteGraphEngine

router = APIRouter(prefix="/api/graph", tags=["Knowledge Graph"])


@router.get("/concept/{concept_id}")
def api_graph_concept(concept_id: str):
    with get_db() as conn:
        graph = SQLiteGraphEngine(conn)
        ctx = graph.get_concept_with_context(concept_id)
        if not ctx:
            raise HTTPException(404, f"Concept {concept_id} not found")
        ctx["related_concepts"] = graph.find_related_concepts(concept_id)
        ctx["prerequisite_chain"] = graph.get_prerequisite_chain(concept_id)
    return ctx


@router.get("/prereq-chain/{concept_id}")
def api_prereq_chain(concept_id: str):
    with get_db() as conn:
        graph = SQLiteGraphEngine(conn)
        chain = graph.get_prerequisite_chain(concept_id)
    return {"concept_id": concept_id, "chain": chain, "depth": len(chain)}


@router.get("/summary/{curriculum_slug}")
def api_graph_summary(curriculum_slug: str):
    with get_db() as conn:
        cur = conn.execute("SELECT id FROM curricula WHERE slug = ?", (curriculum_slug,)).fetchone()
        if not cur:
            raise HTTPException(404, "Curriculum not found")
        graph = SQLiteGraphEngine(conn)
        return graph.get_graph_summary(cur["id"])


@router.get("/interpolate/{student_id}/{concept_id}")
def api_interpolate_mastery(student_id: str, concept_id: str):
    with get_db() as conn:
        mastery_rows = conn.execute(
            "SELECT concept_id, mastery_estimate FROM mastery_snapshots WHERE student_id = ?",
            (student_id,)).fetchall()
        mastery_map = {r["concept_id"]: r["mastery_estimate"] for r in mastery_rows}
        graph = SQLiteGraphEngine(conn)
        estimated = graph.interpolate_mastery(mastery_map, concept_id)
    return {"concept_id": concept_id, "interpolated_mastery": estimated,
            "method": "prerequisite_average × 0.7", "directly_tested": concept_id in mastery_map}
