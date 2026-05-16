"""
APEX — SINKT Semantic Search Router
Endpoints: index, search, similarity, interpolate
"""

import json
import sqlite3
from fastapi import APIRouter, HTTPException, Depends
from api.utils import DB_PATH, get_current_student
from src.sinkt_embeddings import SINKTEmbeddingEngine

router = APIRouter(prefix="/api/sinkt", tags=["SINKT Semantic"])


@router.post("/index/{slug}")
def api_sinkt_index(slug: str):
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    row = conn.execute("SELECT curriculum_json FROM curricula WHERE slug = ?", (slug,)).fetchone()
    if not row:
        conn.close()
        raise HTTPException(404, "Curriculum not found")
    curriculum = json.loads(row["curriculum_json"])
    engine = SINKTEmbeddingEngine(conn)
    stats = engine.index_curriculum(curriculum)
    conn.close()
    return {"slug": slug, **stats}


@router.get("/search")
def api_sinkt_search(q: str, top_k: int = 5):
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    engine = SINKTEmbeddingEngine(conn)
    results = engine.find_similar(q, top_k=top_k)
    conn.close()
    return {"query": q, "results": results}


@router.get("/similarity/{concept_a}/{concept_b}")
def api_sinkt_similarity(concept_a: str, concept_b: str):
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    engine = SINKTEmbeddingEngine(conn)
    score = engine.get_concept_similarity(concept_a, concept_b)
    conn.close()
    return {"concept_a": concept_a, "concept_b": concept_b, "similarity": score}


@router.get("/interpolate/{student_id}/{concept_id}")
def api_sinkt_interpolate(student_id: str, concept_id: str, current_student: str = Depends(get_current_student)):
    if current_student != student_id:
        raise HTTPException(403, "Access denied")
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    snaps = conn.execute(
        "SELECT concept_id, mastery_estimate FROM mastery_snapshots WHERE student_id = ?",
        (student_id,)).fetchall()
    mastery = {s["concept_id"]: s["mastery_estimate"] for s in snaps}
    engine = SINKTEmbeddingEngine(conn)
    estimated = engine.interpolate_mastery_semantic(mastery, concept_id)
    conn.close()
    return {"concept_id": concept_id, "estimated_mastery": estimated, "method": "sinkt_semantic"}
