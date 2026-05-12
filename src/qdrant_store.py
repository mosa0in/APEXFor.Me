"""
APEX Curriculum Intelligence — Qdrant Vector Store (Component 4)
Enterprise-grade vector database for semantic search and RAG retrieval.

Why Qdrant over alternatives:
- Written in Rust → fast and memory-efficient
- Production-ready with REST + gRPC APIs
- Advanced payload filtering (filter by chapter, difficulty, etc.)
- Self-hosted via Docker — full data ownership
"""

from qdrant_client import QdrantClient
from qdrant_client.models import (
    Distance,
    VectorParams,
    PointStruct,
    Filter,
    FieldCondition,
    MatchValue,
)
from sentence_transformers import SentenceTransformer
from rich.console import Console

from src.config import settings
from src.models import Curriculum

console = Console(force_terminal=True)


class CurriculumVectorStore:
    """
    Manages vector embeddings for curriculum concepts in Qdrant.

    Each concept is stored as a vector with rich metadata (payload)
    enabling both semantic search AND filtered queries.
    """

    def __init__(
        self,
        host: str | None = None,
        port: int | None = None,
        collection: str | None = None,
    ):
        self.host = host or settings.QDRANT_HOST
        self.port = port or settings.QDRANT_PORT
        self.collection = collection or settings.QDRANT_COLLECTION

        self.client = QdrantClient(host=self.host, port=self.port)
        self.encoder = SentenceTransformer(settings.EMBEDDING_MODEL)
        self.vector_size = self.encoder.get_sentence_embedding_dimension()

        console.print(f"[cyan]🟣 Connected to Qdrant at {self.host}:{self.port}[/]")
        console.print(f"[dim]  Embedding model: {settings.EMBEDDING_MODEL} ({self.vector_size}D)[/]")

    def create_collection(self, recreate: bool = False):
        """Create or recreate the curriculum concepts collection."""
        collections = [c.name for c in self.client.get_collections().collections]

        if self.collection in collections:
            if recreate:
                self.client.delete_collection(self.collection)
                console.print(f"[yellow]🗑️  Deleted existing collection: {self.collection}[/]")
            else:
                console.print(f"[dim]Collection '{self.collection}' already exists[/]")
                return

        self.client.create_collection(
            collection_name=self.collection,
            vectors_config=VectorParams(
                size=self.vector_size,
                distance=Distance.COSINE,
            ),
        )
        console.print(f"[green]✅ Created collection: {self.collection} ({self.vector_size}D cosine)[/]")

    def index_curriculum(self, curriculum: Curriculum):
        """
        Index all curriculum concepts into Qdrant with rich payloads.

        Each concept gets:
        - Vector: embedding of its full text representation
        - Payload: chapter, section, difficulty, prerequisites, language, etc.
        """
        self.create_collection(recreate=True)

        points = []
        point_id = 0

        for chapter in curriculum.chapters:
            for section in chapter.sections:
                for concept in section.concepts:
                    # Build rich text for embedding
                    text = (
                        f"Chapter: {chapter.title}. "
                        f"Section: {section.title}. "
                        f"Concept: {concept.name}. "
                        f"{concept.description}"
                    )
                    if concept.key_formulas:
                        text += f" Formulas: {', '.join(concept.key_formulas)}"

                    # Generate embedding
                    vector = self.encoder.encode(text).tolist()

                    # Build rich payload for filtering
                    payload = {
                        "concept_id": concept.id,
                        "concept_name": concept.name,
                        "description": concept.description,
                        "chapter_id": chapter.id,
                        "chapter_number": chapter.number,
                        "chapter_title": chapter.title,
                        "section_id": section.id,
                        "section_title": section.title,
                        "prerequisites": concept.prerequisites,
                        "key_formulas": concept.key_formulas,
                        "num_questions": len(concept.questions),
                        "question_texts": [q.text for q in concept.questions[:5]],
                        "full_text": text,
                        "language": curriculum.language,
                        "source": "curriculum_parser",
                    }

                    points.append(PointStruct(
                        id=point_id,
                        vector=vector,
                        payload=payload,
                    ))
                    point_id += 1

        # Batch upsert
        batch_size = 100
        for i in range(0, len(points), batch_size):
            batch = points[i:i + batch_size]
            self.client.upsert(
                collection_name=self.collection,
                points=batch,
            )

        console.print(f"[bold green]✅ Indexed {len(points)} concepts into Qdrant[/]")

    def search(
        self,
        query: str,
        top_k: int = 5,
        chapter_filter: int | None = None,
    ) -> list[dict]:
        """
        Semantic search for concepts matching a query.

        Args:
            query: Natural language query (English or Arabic).
            top_k: Number of results.
            chapter_filter: Optional — only search within this chapter number.

        Returns:
            List of matching concepts with scores and metadata.
        """
        query_vector = self.encoder.encode(query).tolist()

        # Build filter if specified
        search_filter = None
        if chapter_filter is not None:
            search_filter = Filter(
                must=[FieldCondition(
                    key="chapter_number",
                    match=MatchValue(value=chapter_filter),
                )]
            )

        results = self.client.query_points(
            collection_name=self.collection,
            query=query_vector,
            limit=top_k,
            query_filter=search_filter,
        )

        formatted = []
        for hit in results.points:
            formatted.append({
                "score": hit.score,
                "concept_id": hit.payload.get("concept_id", ""),
                "concept_name": hit.payload.get("concept_name", ""),
                "chapter_title": hit.payload.get("chapter_title", ""),
                "section_title": hit.payload.get("section_title", ""),
                "description": hit.payload.get("description", ""),
                "full_text": hit.payload.get("full_text", ""),
            })

        return formatted

    def search_with_display(self, query: str, top_k: int = 5, chapter_filter: int | None = None):
        """Search and display results in terminal."""
        results = self.search(query, top_k, chapter_filter)

        console.print(f"\n[bold cyan]🔍 Search: '{query}'[/]")
        for i, r in enumerate(results, 1):
            console.print(f"  {i}. [bold]{r['concept_name']}[/] (score: {r['score']:.3f})")
            console.print(f"     {r['chapter_title']} > {r['section_title']}")
            if r['description']:
                console.print(f"     [dim]{r['description'][:100]}...[/]")

        return results

    def get_context_for_rag(self, query: str, top_k: int = 5) -> str:
        """
        Get formatted context string for RAG engine consumption.

        Returns a single string with all relevant concept information
        ready to be injected into the RAG prompt.
        """
        results = self.search(query, top_k)

        context_parts = []
        for r in results:
            context_parts.append(
                f"--- Concept: {r['concept_name']} ---\n"
                f"Chapter: {r['chapter_title']}\n"
                f"Section: {r['section_title']}\n"
                f"Description: {r['description']}\n"
            )

        return "\n".join(context_parts)

    def get_stats(self) -> dict:
        """Get collection statistics."""
        info = self.client.get_collection(self.collection)
        return {
            "total_vectors": info.points_count,
            "vector_size": info.config.params.vectors.size,
            "distance": str(info.config.params.vectors.distance),
            "status": str(info.status),
        }


if __name__ == "__main__":
    import json
    from src.models import Curriculum

    # Load and index
    with open("data/curriculum.json", "r", encoding="utf-8") as f:
        curriculum = Curriculum(**json.load(f))

    store = CurriculumVectorStore()
    store.index_curriculum(curriculum)

    # Test search
    store.search_with_display("What is a derivative?")
    store.search_with_display("integration by substitution")
