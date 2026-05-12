# APEX Curriculum Intelligence — Agent Instructions

## Project Constitution
This is an educational AI platform that:
1. Parses curriculum PDFs into structured Knowledge Graphs
2. Uses SINKT (modified) for Knowledge Tracing
3. Provides RAG-based tutoring grounded in curriculum content
4. Integrates with APEX Diagnostic for student assessment

## Architecture
- `src/` — Core pipeline (PDF → Extract → Graph → Vectors → RAG)
- `sinkt/` — SINKT model (forked + modified for APEX)
- `toolchain/` — Internal development tools
- `scripts/` — CLI scripts for pipeline execution

## Key Principles
1. **Anti-Hallucination**: ALL LLM responses must be grounded in curriculum content
2. **Research-Grade**: Data structures must support academic paper requirements
3. **Bilingual**: Support both English and Arabic content
4. **Open Source**: SINKT modifications must be documented

## Technology Stack
- Python 3.14 + LangChain + Anthropic Claude
- Neo4j 5.26 (Knowledge Graph)
- Qdrant (Vector Database)
- PyTorch + PyG (SINKT model)
- SocratiCode (code intelligence)

## Coding Standards
- Type hints on all public functions
- Docstrings with Args/Returns
- Rich console output for user feedback
- Pydantic models for data validation
