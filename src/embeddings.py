"""
Curriculum Parser — Embedding Engine (Component 4)
Converts curriculum content into vector embeddings and stores them in Neo4j Vector Index.
Enables semantic search — "find concepts similar to X" even if exact words differ.
"""

from langchain_anthropic import ChatAnthropic
from langchain_neo4j import Neo4jVector
from langchain.schema import Document
from rich.console import Console

from src.config import settings
from src.models import Curriculum

console = Console()


class VoyageEmbeddings:
    """
    Simple embedding wrapper using Anthropic's recommended Voyage AI,
    or falls back to a basic approach using Claude for embeddings.
    
    For production, you can swap this with OpenAI, Voyage, or local embeddings.
    """

    def __init__(self):
        # We use LangChain's built-in embedding abstraction
        # For now, we'll use a simple approach that works with Claude
        pass


def curriculum_to_documents(curriculum: Curriculum) -> list[Document]:
    """
    Convert a Curriculum model into a list of LangChain Documents
    suitable for embedding and vector storage.

    Each concept becomes a document with rich metadata for filtering.

    Args:
        curriculum: Validated Curriculum model.

    Returns:
        List of Document objects with content and metadata.
    """
    documents: list[Document] = []

    for chapter in curriculum.chapters:
        for section in chapter.sections:
            for concept in section.concepts:
                # Build rich text content for the concept
                content_parts = [
                    f"Chapter: {chapter.title}",
                    f"Section: {section.title}",
                    f"Concept: {concept.name}",
                    f"Description: {concept.description}",
                ]

                if concept.key_formulas:
                    content_parts.append(f"Key Formulas: {', '.join(concept.key_formulas)}")

                if concept.questions:
                    q_texts = [f"  - {q.text}" for q in concept.questions[:5]]
                    content_parts.append("Sample Questions:\n" + "\n".join(q_texts))

                doc = Document(
                    page_content="\n".join(content_parts),
                    metadata={
                        "concept_id": concept.id,
                        "concept_name": concept.name,
                        "section_id": section.id,
                        "section_title": section.title,
                        "chapter_id": chapter.id,
                        "chapter_title": chapter.title,
                        "chapter_number": chapter.number,
                        "has_prerequisites": len(concept.prerequisites) > 0,
                        "num_questions": len(concept.questions),
                        "source": "curriculum",
                    },
                )
                documents.append(doc)

    console.print(f"[green]✅ Created {len(documents)} concept documents for embedding[/]")
    return documents


def create_vector_store(
    documents: list[Document],
    embedding_model=None,
) -> Neo4jVector:
    """
    Create a Neo4j Vector Store from curriculum documents.

    This stores embeddings directly in Neo4j alongside the Knowledge Graph,
    enabling both graph traversal AND semantic search in one database.

    Args:
        documents: List of Document objects from curriculum_to_documents().
        embedding_model: LangChain embedding model instance.

    Returns:
        Neo4jVector store ready for similarity search.
    """
    console.print("[bold cyan]🧠 Creating vector embeddings...[/]")

    if embedding_model is None:
        # Default: use a simple embedding approach
        # In production, use OpenAI, Voyage, or local model
        try:
            from langchain_community.embeddings import HuggingFaceEmbeddings
            embedding_model = HuggingFaceEmbeddings(
                model_name="sentence-transformers/all-MiniLM-L6-v2"
            )
            console.print("[dim]  Using local HuggingFace embeddings (all-MiniLM-L6-v2)[/]")
        except ImportError:
            console.print("[red]⚠️ No embedding model available. Install sentence-transformers.[/]")
            raise

    vectorstore = Neo4jVector.from_documents(
        documents=documents,
        embedding=embedding_model,
        url=settings.NEO4J_URI,
        username=settings.NEO4J_USERNAME,
        password=settings.NEO4J_PASSWORD,
        index_name="curriculum_concepts",
        node_label="ConceptEmbedding",
        text_node_property="content",
        embedding_node_property="embedding",
    )

    console.print(f"[bold green]✅ Vector store created with {len(documents)} embeddings[/]")
    return vectorstore


def load_existing_vector_store(embedding_model=None) -> Neo4jVector:
    """
    Load an existing vector store from Neo4j (after initial creation).

    Args:
        embedding_model: Same embedding model used during creation.

    Returns:
        Neo4jVector store connected to existing index.
    """
    if embedding_model is None:
        from langchain_community.embeddings import HuggingFaceEmbeddings
        embedding_model = HuggingFaceEmbeddings(
            model_name="sentence-transformers/all-MiniLM-L6-v2"
        )

    return Neo4jVector.from_existing_index(
        embedding=embedding_model,
        url=settings.NEO4J_URI,
        username=settings.NEO4J_USERNAME,
        password=settings.NEO4J_PASSWORD,
        index_name="curriculum_concepts",
    )


def search_similar_concepts(vectorstore: Neo4jVector, query: str, k: int = 5) -> list[Document]:
    """
    Search for concepts similar to a query using vector similarity.

    Args:
        vectorstore: Neo4jVector store.
        query: Search query (e.g., "derivatives of trigonometric functions").
        k: Number of results to return.

    Returns:
        List of matching Document objects ranked by similarity.
    """
    results = vectorstore.similarity_search(query, k=k)

    console.print(f"\n[bold cyan]🔍 Search: '{query}' — {len(results)} results[/]")
    for i, doc in enumerate(results, 1):
        meta = doc.metadata
        console.print(f"  {i}. [bold]{meta.get('concept_name', 'N/A')}[/]")
        console.print(f"     Chapter: {meta.get('chapter_title', 'N/A')}")
        console.print(f"     Section: {meta.get('section_title', 'N/A')}")

    return results


if __name__ == "__main__":
    import json
    from src.models import Curriculum

    # Load curriculum from saved JSON
    with open("data/curriculum.json", "r", encoding="utf-8") as f:
        curriculum = Curriculum(**json.load(f))

    docs = curriculum_to_documents(curriculum)
    vectorstore = create_vector_store(docs)

    # Test search
    search_similar_concepts(vectorstore, "derivative of polynomial functions")
    search_similar_concepts(vectorstore, "integration by parts")
