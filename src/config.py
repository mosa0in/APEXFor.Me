"""
APEX Curriculum Intelligence — Configuration
Centralized settings for all components: LLM, Neo4j, Qdrant, SINKT.
"""

import os
from dotenv import load_dotenv

# Use absolute path so .env is found regardless of working directory
_ENV_PATH = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), ".env")
load_dotenv(_ENV_PATH)


class Settings:
    """Centralized configuration for the full intelligence stack."""

    # --- LLM (Claude) ---
    ANTHROPIC_API_KEY: str = os.getenv("ANTHROPIC_API_KEY", "")
    LLM_MODEL: str = os.getenv("LLM_MODEL", "claude-sonnet-4-6")

    # --- LLM (Gemini) ---
    GEMINI_API_KEY: str = os.getenv("GEMINI_API_KEY", "")

    # --- Neo4j Knowledge Graph ---
    NEO4J_URI: str = os.getenv("NEO4J_URI", "bolt://localhost:7687")
    NEO4J_USERNAME: str = os.getenv("NEO4J_USERNAME", "neo4j")
    NEO4J_PASSWORD: str = os.getenv("NEO4J_PASSWORD", "apex_intelligence_2026")

    # --- Qdrant Vector Database ---
    QDRANT_HOST: str = os.getenv("QDRANT_HOST", "localhost")
    QDRANT_PORT: int = int(os.getenv("QDRANT_PORT", "6333"))
    QDRANT_COLLECTION: str = os.getenv("QDRANT_COLLECTION", "curriculum_concepts")

    # --- Embedding ---
    EMBEDDING_MODEL: str = os.getenv("EMBEDDING_MODEL", "all-MiniLM-L6-v2")

    # --- PDF ---
    PDF_PATH: str = os.getenv("PDF_PATH", "")

    # --- Chunking ---
    CHUNK_SIZE: int = int(os.getenv("CHUNK_SIZE", "2000"))
    CHUNK_OVERLAP: int = int(os.getenv("CHUNK_OVERLAP", "300"))

    # --- RAG ---
    RAG_TOP_K: int = int(os.getenv("RAG_TOP_K", "5"))

    # --- SINKT ---
    SINKT_DEVICE: str = os.getenv("SINKT_DEVICE", "cpu")
    SINKT_DIM: int = int(os.getenv("SINKT_DIM", "256"))
    SINKT_EPOCHS: int = int(os.getenv("SINKT_EPOCHS", "30"))
    SINKT_BATCH_SIZE: int = int(os.getenv("SINKT_BATCH_SIZE", "64"))
    SINKT_LR: float = float(os.getenv("SINKT_LR", "0.0005"))


settings = Settings()
