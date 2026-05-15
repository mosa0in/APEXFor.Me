# APEX Curriculum Intelligence — Agent Instructions
# Auto-synced: 2026-05-14

## Read SPEC.md for full project specification.

## Source Modules
  - src/ai_enricher.py (533 lines)
  - src/chapter_transition.py (132 lines)
  - src/coach_analyzer.py (152 lines)
  - src/config.py (53 lines)
  - src/content_renderer.py (271 lines)
  - src/denoising_engine.py (94 lines)
  - src/diagnostic_selector.py (505 lines)
  - src/docling_extractor.py (161 lines)
  - src/embeddings.py (196 lines)
  - src/encoding_fix.py (40 lines)
  - src/graph_adapter.py (232 lines)
  - src/graph_builder.py (299 lines)
  - src/graph_engine.py (226 lines)
  - src/mastery_tracker.py (124 lines)
  - src/mcp_agent.py (241 lines)
  - src/mindset_analyzer.py (124 lines)
  - src/models.py (259 lines)
  - src/pdf_analyzer.py (504 lines)
  - src/pdf_reader.py (232 lines)
  - src/qdrant_store.py (356 lines)
  - src/question_generator.py (242 lines)
  - src/question_selector.py (179 lines)
  - src/rag_engine.py (192 lines)
  - src/sinkt_embeddings.py (338 lines)
  - src/structure_extractor.py (559 lines)

## Key Principles
1. Docling-First Extraction: IBM Docling (PDF→Markdown), Claude only for semantics
2. Anti-Hallucination: RAG responses MUST cite curriculum sources
3. Bilingual: English + Arabic content via Docling
4. Clean Pipeline: PDF → Markdown → Curriculum JSON → SQLite

## Coding Standards
- Type hints on all public functions
- Rich console output for user feedback
- Pydantic models for data validation
