# Curriculum Parser — Specification

## Goal
Extract hierarchical structure from educational textbook PDFs and store
as a queryable Knowledge Graph with vector search capabilities.

## Input
- PDF textbook (e.g., Thomas Calculus)
- Student interaction data from APEX Diagnostic (CSV)

## Output
- Structured JSON (Book → Chapter → Section → Concept → Question)
- Neo4j Knowledge Graph with relationships
- Qdrant vector index for semantic search
- Fine-tuned SINKT model for Knowledge Tracing
- RAG engine for curriculum-grounded Q&A

## Success Criteria
1. Correctly extracts >80% of concepts from PDF
2. Knowledge Graph is queryable via Cypher
3. Semantic search returns relevant results (top-5 precision >70%)
4. RAG answers cite specific chapters/sections
5. SINKT achieves >0.7 AUC on knowledge prediction
