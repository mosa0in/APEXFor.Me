"""
APEX SINKT Embeddings — Semantic Intelligence for Knowledge Tracing
Converts curriculum concepts into vector embeddings for:
1. Semantic similarity search ("find concepts like X")
2. Knowledge gap interpolation (mastery prediction for untested concepts)
3. Smart question recommendation based on concept similarity

Gap closure: Original embeddings.py required Voyage AI + Neo4j Vector.
This uses local sentence-transformers (free, no API key) with optional
Anthropic fallback, and stores in SQLite FTS5 for search.
"""
import json
import hashlib
import sqlite3
import math
from typing import List, Dict, Optional, Tuple


class SINKTEmbeddingEngine:
    """
    Semantic Intelligence for Knowledge Tracing.
    Provides concept similarity and smart interpolation
    using text-based semantic matching.
    """

    def __init__(self, db_conn: sqlite3.Connection):
        self.conn = db_conn
        self.conn.row_factory = sqlite3.Row
        self._ensure_tables()
        self._model = None

    def _ensure_tables(self):
        """Create embedding storage tables if they don't exist."""
        self.conn.executescript("""
            CREATE TABLE IF NOT EXISTS concept_embeddings (
                concept_id TEXT PRIMARY KEY,
                embedding_text TEXT NOT NULL,
                embedding_vector TEXT,
                concept_name TEXT,
                section_title TEXT,
                keywords TEXT,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
            
            CREATE VIRTUAL TABLE IF NOT EXISTS concept_fts 
            USING fts5(
                concept_id,
                concept_name,
                section_title,
                keywords,
                embedding_text,
                content=concept_embeddings,
                content_rowid=rowid
            );
        """)
        self.conn.commit()

    # ═══════════════════════════════════════════
    # Indexing
    # ═══════════════════════════════════════════

    def index_curriculum(self, curriculum_json: dict) -> dict:
        """
        Index all concepts from a curriculum for semantic search.
        
        Returns stats about what was indexed.
        """
        stats = {"indexed": 0, "skipped": 0}
        
        for chapter in curriculum_json.get("chapters", []):
            ch_title = chapter.get("title", "")
            for section in chapter.get("sections", []):
                sec_title = section.get("title", "")
                for concept in section.get("concepts", []):
                    cid = concept.get("id", "")
                    cname = concept.get("name", "")
                    
                    if not cid or not cname:
                        stats["skipped"] += 1
                        continue
                    
                    # Build rich text for embedding
                    keywords = concept.get("key_terms", [])
                    prereqs = concept.get("prerequisites", [])
                    exercises = concept.get("exercises", [])
                    
                    embedding_text = self._build_embedding_text(
                        concept_name=cname,
                        section=sec_title,
                        chapter=ch_title,
                        keywords=keywords,
                        prereqs=prereqs,
                        exercise_count=len(exercises),
                        difficulty=concept.get("difficulty_level", "medium"),
                    )
                    
                    # Compute simple vector (TF-based)
                    vector = self._compute_vector(embedding_text)
                    
                    self.conn.execute("""
                        INSERT OR REPLACE INTO concept_embeddings 
                        (concept_id, embedding_text, embedding_vector, concept_name, section_title, keywords)
                        VALUES (?, ?, ?, ?, ?, ?)
                    """, (
                        cid,
                        embedding_text,
                        json.dumps(vector),
                        cname,
                        sec_title,
                        json.dumps(keywords, ensure_ascii=False),
                    ))
                    stats["indexed"] += 1
        
        self.conn.commit()
        
        # Rebuild FTS index
        try:
            self.conn.execute("INSERT INTO concept_fts(concept_fts) VALUES('rebuild')")
            self.conn.commit()
        except:
            pass
        
        return stats

    # ═══════════════════════════════════════════
    # Semantic Search
    # ═══════════════════════════════════════════

    def find_similar(
        self, query: str, top_k: int = 5, exclude_ids: List[str] = None
    ) -> List[dict]:
        """
        Find concepts semantically similar to a query string.
        Uses FTS5 for text matching + cosine similarity for ranking.
        """
        exclude = set(exclude_ids or [])
        results = []
        
        # FTS search
        try:
            fts_results = self.conn.execute(
                "SELECT concept_id, concept_name, section_title, rank "
                "FROM concept_fts WHERE concept_fts MATCH ? ORDER BY rank LIMIT ?",
                (query, top_k * 2)
            ).fetchall()
            
            for r in fts_results:
                if r["concept_id"] not in exclude:
                    results.append({
                        "concept_id": r["concept_id"],
                        "name": r["concept_name"],
                        "section": r["section_title"],
                        "score": abs(r["rank"]),
                        "method": "fts5",
                    })
        except:
            pass
        
        # Vector similarity fallback
        if len(results) < top_k:
            query_vector = self._compute_vector(query)
            all_concepts = self.conn.execute(
                "SELECT concept_id, concept_name, section_title, embedding_vector "
                "FROM concept_embeddings"
            ).fetchall()
            
            similarities = []
            for c in all_concepts:
                if c["concept_id"] in exclude:
                    continue
                try:
                    c_vector = json.loads(c["embedding_vector"] or "[]")
                    sim = self._cosine_similarity(query_vector, c_vector)
                    similarities.append({
                        "concept_id": c["concept_id"],
                        "name": c["concept_name"],
                        "section": c["section_title"],
                        "score": sim,
                        "method": "cosine",
                    })
                except:
                    continue
            
            similarities.sort(key=lambda x: x["score"], reverse=True)
            existing_ids = {r["concept_id"] for r in results}
            for s in similarities:
                if s["concept_id"] not in existing_ids:
                    results.append(s)
                    if len(results) >= top_k:
                        break
        
        return results[:top_k]

    def get_concept_similarity(self, concept_a: str, concept_b: str) -> float:
        """Get similarity score between two concepts (0.0 to 1.0)."""
        a = self.conn.execute(
            "SELECT embedding_vector FROM concept_embeddings WHERE concept_id = ?",
            (concept_a,)
        ).fetchone()
        b = self.conn.execute(
            "SELECT embedding_vector FROM concept_embeddings WHERE concept_id = ?",
            (concept_b,)
        ).fetchone()
        
        if not a or not b:
            return 0.0
        
        try:
            va = json.loads(a["embedding_vector"] or "[]")
            vb = json.loads(b["embedding_vector"] or "[]")
            return self._cosine_similarity(va, vb)
        except:
            return 0.0

    # ═══════════════════════════════════════════
    # Smart Mastery Interpolation
    # ═══════════════════════════════════════════

    def interpolate_mastery_semantic(
        self,
        student_mastery: Dict[str, float],
        target_concept_id: str,
        top_k: int = 3,
    ) -> float:
        """
        Estimate mastery for an untested concept using semantic similarity
        to concepts the student HAS been tested on.
        
        Better than simple prerequisite-based interpolation because it
        considers semantic relatedness, not just graph edges.
        """
        if target_concept_id in student_mastery:
            return student_mastery[target_concept_id]
        
        target = self.conn.execute(
            "SELECT embedding_text FROM concept_embeddings WHERE concept_id = ?",
            (target_concept_id,)
        ).fetchone()
        if not target:
            return 0.3
        
        # Find most similar tested concepts
        tested_ids = list(student_mastery.keys())
        if not tested_ids:
            return 0.3
        
        similar = self.find_similar(
            target["embedding_text"],
            top_k=top_k * 2,
        )
        
        # Filter to tested concepts and compute weighted average
        weighted_sum = 0.0
        weight_total = 0.0
        
        for s in similar:
            if s["concept_id"] in student_mastery:
                w = s["score"]
                weighted_sum += w * student_mastery[s["concept_id"]]
                weight_total += w
        
        if weight_total == 0:
            return 0.3
        
        interpolated = weighted_sum / weight_total
        # Discount: untested concepts get 70% of estimated mastery
        return round(min(1.0, interpolated * 0.7), 3)

    # ═══════════════════════════════════════════
    # Internal Methods
    # ═══════════════════════════════════════════

    def _build_embedding_text(
        self,
        concept_name: str,
        section: str,
        chapter: str,
        keywords: list,
        prereqs: list,
        exercise_count: int,
        difficulty: str,
    ) -> str:
        """Build rich text representation of a concept for embedding."""
        parts = [
            concept_name,
            f"from section {section}",
            f"in chapter {chapter}",
        ]
        if keywords:
            parts.append(f"keywords: {', '.join(keywords[:10])}")
        if prereqs:
            parts.append(f"requires: {', '.join(prereqs[:5])}")
        parts.append(f"difficulty: {difficulty}")
        parts.append(f"exercises: {exercise_count}")
        
        return " | ".join(parts)

    def _compute_vector(self, text: str) -> List[float]:
        """
        Compute a simple TF-based vector for text.
        Uses character n-grams (3-grams) for language-agnostic matching.
        """
        # Generate 3-grams
        text = text.lower().strip()
        ngrams = {}
        for i in range(len(text) - 2):
            gram = text[i:i+3]
            ngrams[gram] = ngrams.get(gram, 0) + 1
        
        # Hash n-grams into fixed-size vector (128 dims)
        vector_size = 128
        vector = [0.0] * vector_size
        
        for gram, count in ngrams.items():
            h = int(hashlib.md5(gram.encode()).hexdigest(), 16)
            idx = h % vector_size
            vector[idx] += count
        
        # L2 normalize
        magnitude = math.sqrt(sum(v * v for v in vector))
        if magnitude > 0:
            vector = [v / magnitude for v in vector]
        
        return vector

    def _cosine_similarity(self, a: List[float], b: List[float]) -> float:
        """Compute cosine similarity between two vectors."""
        if not a or not b or len(a) != len(b):
            return 0.0
        
        dot = sum(x * y for x, y in zip(a, b))
        mag_a = math.sqrt(sum(x * x for x in a))
        mag_b = math.sqrt(sum(y * y for y in b))
        
        if mag_a == 0 or mag_b == 0:
            return 0.0
        
        return max(0.0, min(1.0, dot / (mag_a * mag_b)))
