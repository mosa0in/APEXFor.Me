# APEX Curriculum Intelligence

> **AI-Powered Adaptive Learning Infrastructure**
> Curriculum Parsing · Knowledge Tracing · Anti-Hallucination RAG

---

## What Is This?
## ما هو هذا المشروع؟

A complete AI pipeline that reads any textbook PDF, builds a Knowledge Graph of every concept and question, tracks what each student knows via Bayesian Knowledge Tracing, and provides tutoring answers grounded **only** in the curriculum — zero hallucination.

Built for the **APEX Diagnostic** platform — an Olympiad-level adaptive math assessment system.

> **بالعربي:** نظام ذكاء اصطناعي كامل يقرأ أي كتاب مدرسي PDF، يبني شبكة معرفية (Knowledge Graph) لكل مفهوم وسؤال، يتتبع ما يعرفه كل طالب عبر نموذج بايزي لتتبع المعرفة (BKT)، ويقدم إجابات مبنية **فقط** على المنهج — صفر هلوسة. مبني لمنصة **APEX التشخيصية** — نظام تقييم رياضيات تكيّفي على مستوى الأولمبياد.

```
📄 PDF Textbook
     ↓
🧩 Claude LLM extracts structure (BOOK → CH → SEC → CON → Q)
     ↓
🔵 Neo4j stores the Knowledge Graph
     ↓
🟣 Qdrant indexes vector embeddings
     ↓
🧠 SINKT (fine-tuned) tracks student mastery
     ↓
🎯 RAG Engine answers from curriculum only
     ↓
💻 APEX Diagnostic frontend
```

---

## Current State — الحالة الراهنة

> **بالعربي:** كل ملف مبني حالياً ووظيفته وحالته. الملفات بمجلد `src/` هي خط الأنابيب الأساسي، `sinkt/` فيها نموذج تتبع المعرفة، و `toolchain/` فيها أدوات التطوير الداخلية.

### Core Pipeline — خط الأنابيب الأساسي (`src/`)

| File | Purpose | Status |
|------|---------|--------|
| `pdf_reader.py` | Reads PDF via LangChain `PyPDFLoader`, splits into chunks | ✅ Tested — 58 pages / 108 chunks from Thomas Calculus |
| `structure_extractor.py` | Claude extracts BOOK/CH/SEC/CON/Q hierarchy → validated JSON | ✅ Built |
| `models.py` | Pydantic schemas: `Curriculum`, `Chapter`, `Section`, `Concept`, `Question`, `StudentState`, `MasterySnapshot`, `BKTParams`, `DiagnosticResponse` | ✅ Built |
| `graph_builder.py` | Builds Neo4j Knowledge Graph with CONTAINS, REQUIRES, TESTED_BY relationships | ✅ Built |
| `qdrant_store.py` | Indexes concepts in Qdrant with payload filtering (by chapter, difficulty) | ✅ Built |
| `rag_engine.py` | RAG chain: Qdrant retrieval → Claude answers from curriculum only | ✅ Built |
| `diagnostic_selector.py` | **Layer 01** — Graph-aware question selection + BKT initialization + StudentState creation | ✅ Built |
| `embeddings.py` | HuggingFace embeddings + Neo4j Vector Index (legacy, replaced by Qdrant) | ✅ Built |
| `config.py` | Centralized settings from `.env` (Claude, Neo4j, Qdrant, SINKT) | ✅ Built |

### SINKT Integration — نموذج تتبع المعرفة (`sinkt/`)

> **بالعربي:** SINKT هو نموذج ذكاء اصطناعي بحثي (ورقة ACM CIKM 2024) يتنبأ: "هل الطالب يفهم هذا المفهوم أو لا؟" — تم دمج كوده الكامل داخل المشروع مع محوّلات (adapters) تربطه ببيانات المنهج وجلسات APEX.

| File | Purpose | Status |
|------|---------|--------|
| `models/SINKT.py` | Original SINKT model — GATConv + GRU + HeteroData Knowledge Graph | ✅ Integrated (from source) |
| `train.py` | Training loop with BCE loss, AUC/accuracy metrics | ✅ Integrated |
| `dataset_doubletext.py` | Data loader supporting BERT/LLaMA/ChatGLM embeddings | ✅ Integrated |
| `main.py` | Entry point for SINKT training | ✅ Integrated |
| `adapters/curriculum_adapter.py` | Converts extracted curriculum JSON → SINKT training format (pkl, npz, json) | ✅ Built |
| `adapters/apex_adapter.py` | Converts APEX Diagnostic session CSV → SINKT training histories | ✅ Built |

### Internal DevToolchain — أدوات التطوير الداخلية (`toolchain/`)

> **بالعربي:** ثلاث أدوات مدمجة تسرّع التطوير وتُبهر المستثمرين: SocratiCode (بحث ذكي في الكود)، Spec-Kit (تطوير بالمواصفات)، Understand-Anything (تحويل الكود لرسم بياني بصري).

| Tool | Purpose | Status |
|------|---------|--------|
| **SocratiCode** | AI code search, dependency graphs, impact analysis via MCP | ✅ Configured (`.mcp.json`) |
| **Spec-Kit** | Specification-driven development workflow | ✅ Configured (`AGENTS.md`, `specs/`) |
| **Understand-Anything** | Visual code Knowledge Graph generation | ✅ Configured (`generate.py`) |

### Scripts (`scripts/`)

| Script | Purpose |
|--------|---------|
| `ingest.py` | Full 6-step pipeline: PDF → Extract → JSON → Neo4j → Qdrant → SINKT data |
| `fine_tune.py` | SINKT fine-tuning on curriculum or APEX session data |
| `test_query.py` | Interactive RAG testing |
| `setup_toolchain.py` | One-command setup for all three dev tools |

---

## Project Structure — هيكل المشروع

```
apex-curriculum-intelligence/
│
├── AGENTS.md                         # AI agent instructions (Spec-Kit)
├── CLAUDE.md                         # Claude Code instructions
├── .mcp.json                         # SocratiCode MCP config
├── .socraticodeignore                # Code indexing exclusions
├── docker-compose.yml                # Neo4j 5.26 + Qdrant
├── .env.example                      # API keys template
├── requirements.txt                  # Python dependencies
├── README.md                         # ← You are here
│
├── src/                              # ── Core Pipeline ──
│   ├── config.py                     # Settings (Claude, Neo4j, Qdrant, SINKT)
│   ├── models.py                     # All data models + BKT + mastery tracking
│   ├── pdf_reader.py                 # PDF → chunks
│   ├── structure_extractor.py        # Chunks → structured JSON (Claude)
│   ├── graph_builder.py              # JSON → Neo4j Knowledge Graph
│   ├── qdrant_store.py               # Concepts → Qdrant vectors
│   ├── rag_engine.py                 # RAG: Qdrant + Claude (anti-hallucination)
│   ├── diagnostic_selector.py        # Layer 01: diagnostic test engine
│   └── embeddings.py                 # Legacy embedding module
│
├── sinkt/                            # ── SINKT (Forked + Modified) ──
│   ├── models/
│   │   └── SINKT.py                  # GATConv + GRU Knowledge Tracing
│   ├── adapters/
│   │   ├── curriculum_adapter.py     # Curriculum JSON → SINKT format
│   │   └── apex_adapter.py           # APEX sessions → SINKT format
│   ├── train.py                      # Training loop
│   ├── dataset_doubletext.py         # Data processing
│   └── main.py                       # SINKT entry point
│
├── toolchain/                        # ── Internal DevTools ──
│   ├── speckit/specs/                # Project specifications
│   └── understand/generate.py        # Code KG generator
│
├── neo4j-reference/                  # ── Research Reference ──
│   └── README.md                     # Neo4j 5.26 source analysis + citation
│
├── scripts/                          # ── CLI Scripts ──
│   ├── ingest.py                     # Full pipeline
│   ├── fine_tune.py                  # SINKT training
│   ├── test_query.py                 # RAG testing
│   └── setup_toolchain.py           # DevTool setup
│
├── data/                             # ── Generated Data (auto) ──
│   ├── curriculum.json               # Extracted curriculum structure
│   ├── sinkt_data/                   # SINKT training files
│   └── student_*.json                # Student mastery states
│
└── docs/
    └── code_graph/                   # Understand-Anything output
```

---

## Technology Stack — التقنيات المستخدمة

> **بالعربي:** كل تقنية ولماذا اخترناها. Claude للاستخلاص والإجابة، Neo4j للعلاقات بين المفاهيم، Qdrant للبحث الدلالي، SINKT لتتبع فهم الطالب، BKT للنمذجة الإحصائية.

| Layer | Technology | Role |
|-------|-----------|------|
| LLM | Anthropic Claude | Structure extraction + RAG answers |
| Framework | LangChain | PDF loading, text splitting, chain orchestration |
| Knowledge Graph | Neo4j 5.26 | Stores curriculum hierarchy + relationships |
| Vector Database | Qdrant | Semantic search for RAG retrieval |
| Knowledge Tracing | SINKT (PyTorch + PyG) | Predicts student mastery per concept |
| Mastery Model | BKT (Bayesian Knowledge Tracing) | Updates P(know) after each response |
| Data Validation | Pydantic v2 | Enforces schemas at every boundary |
| Code Intelligence | SocratiCode | Internal code search + dependency analysis |
| Dev Workflow | Spec-Kit | Specification-driven task management |
| Code Visualization | Understand-Anything | Interactive code Knowledge Graph |

---

## System Design — التصميم الهندسي الكامل
## المعمارية الخماسية — 5 طبقات ذكاء متراكمة

The system operates as a **5-layer intelligence stack**. Each layer feeds the next:

> **بالعربي:** النظام يعمل كـ 5 طبقات ذكاء، كل طبقة تُغذّي التالية. الطبقة الأولى (الاختبار التشخيصي) تحدد مستوى الطالب المبدئي. الثانية (تنقية البيانات) تكشف التخمين والغش. الثالثة (تحليل المايندسيت — **مساهمتنا الأصلية**) تقارن الإجابة بتفسير الطالب. الرابعة (تتبع الإتقان) تحدّث مستوى المعرفة. الخامسة (طبقة الأفعال) تقرر الخطوة التالية للطالب عبر MCP.

```
┌─────────────────────────────────────────────────────────────┐
│                    APEX INTELLIGENCE STACK                   │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  Layer 01  DIAGNOSTIC TEST                         ✅ BUILT │
│  ─────────────────────────────────────────────────────────  │
│  diagnostic_selector.py · BKT init · Graph traversal       │
│  → Selects 1-2 questions per core concept                  │
│  → Creates initial mastery_snapshots                       │
│  → Determines starting point in Knowledge Graph            │
│  → Without this, the system is BLIND                       │
│                                                             │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  Layer 02  GNN DENOISING                        🔲 PLANNED │
│  ─────────────────────────────────────────────────────────  │
│  denoising_engine.py · DGKT · LPKT · Graph-aware           │
│  → Compares response to position in Graph                  │
│  → Correct on "Calculus" but failed "Addition" = GUESS     │
│  → Outputs weighted_correct for each response              │
│  → Handles: Guess, Slip, Cheating, Bad Day                 │
│                                                             │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  Layer 03  MINDSET ANALYSIS ★ ORIGINAL         🔲 PLANNED │
│  ─────────────────────────────────────────────────────────  │
│  mindset_analyzer.py · Bloom's · Vygotsky ZPD              │
│  → Compares answer vs student's explanation                │
│  → "Correct + can't explain why" ≠ "Correct + explains"   │
│  → Gap reveals root cause of failure                       │
│  → Classifies: conceptual / procedural / none              │
│  → NO ONE HAS DONE THIS BEFORE — our winning paper         │
│                                                             │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  Layer 04  MASTERY TRACKING                     🔲 PLANNED │
│  ─────────────────────────────────────────────────────────  │
│  mastery_tracker.py · pyKT · DKT · AKT                     │
│  → Fed DENOISED data (not raw responses)                   │
│  → Guided by SINKT's Knowledge Graph                       │
│  → Updates mastery_estimate after every answer             │
│  → Not blind — sees prerequisite context                   │
│                                                             │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  Layer 05  ACTION LAYER (MCP Agent)             🔲 PLANNED │
│  ─────────────────────────────────────────────────────────  │
│  mcp_agent.py · RLM · Guardrails                           │
│  → LLM thinks first (RLM), then calls tools via MCP       │
│  → Tools: get_student_state, fetch_concept,                │
│           get_next_question, update_mastery,               │
│           run_socratic_probe                               │
│  → NEVER gives the answer — guides student to it           │
│  → Pedagogical guardrails enforced                         │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### Data Flow Between Layers — تدفق البيانات بين الطبقات

> **بالعربي:** البيانات تنتقل تسلسلياً: الطالب يجيب ← الإجابة تُنقّى ← تُحلّل الفجوة ← يُحدّث مستوى الإتقان ← يُقرّر الإجراء التعليمي المناسب.

```
Student → [Layer 01: Diagnostic] → mastery_snapshots (initial)
                                         ↓
       → [Layer 02: Denoising]  → weighted_correct (clean signal)
                                         ↓
       → [Layer 03: Mindset]    → gap_classification (conceptual/procedural)
                                         ↓
       → [Layer 04: Mastery]    → mastery_estimate (updated P(know))
                                         ↓
       → [Layer 05: MCP Agent]  → pedagogical_action (next step for student)
```

### Knowledge Graph Schema — مخطط شبكة المعرفة (Neo4j)

> **بالعربي:** العُقد (Nodes) تمثل: الكتاب، الفصل، الدرس، المفهوم، السؤال، الطالب، والإجابة. العلاقات (Relationships) تربط بينها: يحتوي، يتطلب (متطلبات سابقة)، يُختبر بـ، أتقن، يعاني من.

```
Nodes:
  (:Book)     — Textbook metadata
  (:Chapter)  — Chapter with number + summary
  (:Section)  — Section with page reference
  (:Concept)  — Core unit: name, description, difficulty, formulas
  (:Question) — Test item: text, type, difficulty, Bloom's level
  (:Student)  — Linked to mastery states
  (:Response) — Individual answer with confidence + time

Relationships:
  (Book)-[:CONTAINS]->(Chapter)
  (Chapter)-[:CONTAINS]->(Section)
  (Section)-[:CONTAINS]->(Concept)
  (Concept)-[:TESTED_BY]->(Question)
  (Concept)-[:REQUIRES]->(Concept)          # prerequisite chain
  (Concept)-[:RELATED_TO]->(Concept)        # semantic similarity
  (Student)-[:ATTEMPTED]->(Question)
  (Student)-[:MASTERED]->(Concept)           # from Layer 04
  (Student)-[:STRUGGLING_WITH]->(Concept)    # from Layer 01
```

### BKT — تتبع المعرفة البايزي (المعادلات الرياضية)

> **بالعربي:** بعد كل إجابة، نحدّث احتمال P(L) أن الطالب يعرف المفهوم. لو أجاب صح → الاحتمال يرتفع. لو أجاب غلط → ينخفض. لكن نأخذ بالحسبان التخمين P(G)=0.25 والزلة P(S)=0.10. لما P(L) يوصل 0.8+ نعتبره "أتقن المفهوم".

```
After each response, update P(L) for the concept:

If CORRECT:
  P(L|correct) = P(L)·(1-P(S)) / [P(L)·(1-P(S)) + (1-P(L))·P(G)]

If WRONG:
  P(L|wrong) = P(L)·P(S) / [P(L)·P(S) + (1-P(L))·(1-P(G))]

Learning transition:
  P(L_new) = P(L|obs) + (1 - P(L|obs)) · P(T)

Where:
  P(L₀) = 0.10  prior probability of knowing
  P(T)  = 0.10  probability of learning per opportunity
  P(S)  = 0.10  probability of slip (knows but answers wrong)
  P(G)  = 0.25  probability of guess (doesn't know but answers right)

Mastery classification:
  P(L) < 0.3  → NOT_MASTERED
  P(L) < 0.6  → LEARNING
  P(L) < 0.8  → NEARLY_MASTERED
  P(L) ≥ 0.8  → MASTERED
```

---

## Quick Start — التشغيل السريع

> **بالعربي:** 7 خطوات لتشغيل النظام بالكامل: تثبيت المكتبات، إعداد مفاتيح API، تشغيل قواعد البيانات، تشغيل الاستخلاص، إعداد أدوات التطوير، اختبار RAG، وتدريب SINKT.

### 1. Install dependencies
```bash
pip install -r requirements.txt
```

### 2. Configure environment
```bash
cp .env.example .env
# Add your ANTHROPIC_API_KEY
```

### 3. Start databases
```bash
docker-compose up -d
# Neo4j Browser: http://localhost:7474
# Qdrant Dashboard: http://localhost:6333/dashboard
```

### 4. Run the full pipeline
```bash
python -m scripts.ingest --pdf "C:\Users\MSI\Downloads\Thomas_Calculus.pdf"
```

### 5. Setup dev toolchain
```bash
python -m scripts.setup_toolchain
```

### 6. Test RAG
```bash
python -m scripts.test_query --interactive
```

### 7. Fine-tune SINKT
```bash
python -m scripts.fine_tune --data-only           # Prepare data
python -m scripts.fine_tune                        # Full training
python -m scripts.fine_tune --apex-csv data.csv    # Train on real APEX data
```

---

## Research Citations — الاستشهادات البحثية

> **بالعربي:** مراجع BibTeX جاهزة للورقة البحثية.

```bibtex
@inproceedings{sinkt2024,
  title={SINKT: A Structure-Aware Inductive Knowledge Tracing Model
         with Large Language Model},
  author={...},
  booktitle={ACM CIKM},
  year={2024}
}

@misc{neo4j2024,
  title={Neo4j Graph Database},
  note={Version 5.26, Community Edition},
  url={https://neo4j.com}
}

@misc{langchain2024,
  title={LangChain: Building Applications with LLMs},
  url={https://github.com/langchain-ai/langchain}
}
```

---

## Connection to APEX Diagnostic — الربط بمنصة APEX

This project is the **backend intelligence layer** for [APEX Diagnostic](https://dist-pi-sandy-98.vercel.app):

> **بالعربي:** هذا المشروع هو "العقل الخلفي" لمنصة APEX التشخيصية. كل ميزة في الواجهة الأمامية تُغذّى من إحدى الطبقات الخمس.

| APEX Feature | Powered By |
|-------------|-----------|
| Adaptive question selection | Layer 01 (diagnostic_selector) + Neo4j Graph traversal |
| AI Coach responses | RAG Engine (Qdrant + Claude) — curriculum-grounded |
| Student mastery tracking | BKT + SINKT Knowledge Tracing |
| Concept gap analysis | Layer 03 (mindset_analyzer) — planned |
| Data denoising | Layer 02 (denoising_engine) — planned |
| Pedagogical agent | Layer 05 (mcp_agent) — planned |
