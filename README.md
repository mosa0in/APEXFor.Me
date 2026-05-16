# APEX — منصة التعلم التكيّفي

> **نظام ذكاء اصطناعي كامل للتعلم التكيّفي — مبني للإنتاج**
> Adaptive Learning · Bayesian Knowledge Tracing · AI Coach · Space UI

**Live:** [https://apexfor.me](https://apexfor.me)

---

## ما هو APEX؟

منصة تعليمية ذكية تقرأ أي كتاب مدرسي PDF، تبني خريطة طريق معرفية لكل مفهوم، تتتبع ما يعرفه الطالب عبر نموذج BKT البايزي، وتقدم جلسات تعلم + اختبارات تشخيصية تكيّفية — كل ذلك بواجهة Space Theme باللغة العربية.

An intelligent learning platform that parses any PDF textbook, builds a concept roadmap, tracks per-student mastery via Bayesian Knowledge Tracing, and delivers adaptive diagnostic tests + learn sessions — fully bilingual (Arabic/English) with a space-themed UI.

```
📄 PDF Textbook
     ↓  IBM Docling (PDF → Markdown)
🧩 Claude — Structure Extraction (BOOK → CH → SEC → CON → Q)
     ↓
🗄️  SQLite — Curriculum + Interactions + Mastery Snapshots
     ↓
🧠 5-Layer Intelligence Pipeline
     ↓
🎯 Adaptive Diagnostic Test + Learn Session
     ↓
🗺️  Knowledge Roadmap + AI Coach
```

---

## الحالة الراهنة — APEX v4.1 (مكتمل وفي الإنتاج)

### طبقات الذكاء الخمس — كلها مطبّقة

```
┌─────────────────────────────────────────────────────────────┐
│                    APEX INTELLIGENCE STACK                   │
├─────────────────────────────────────────────────────────────┤
│  Layer 01  DIAGNOSTIC SELECTOR                     ✅ LIVE  │
│  diagnostic_selector.py                                      │
│  → اختيار أسئلة تشخيصية بناءً على صعوبة المنهج            │
│  → بدء P(L₀) = 0.1 لكل مفهوم                              │
├─────────────────────────────────────────────────────────────┤
│  Layer 02  DENOISING ENGINE                        ✅ LIVE  │
│  denoising_engine.py                                         │
│  → compute_weighted_correct: تنقية الإجابات                │
│  → يحسب: ثقة الطالب، التلميح، الحل المعروض، إعادة الصياغة │
│  → 3 مستويات إعادة صياغة: 1.0× / 0.8× / 0.6×             │
│  → عرض الحل → weighted = 0.0 (استبعاد كامل من BKT)         │
├─────────────────────────────────────────────────────────────┤
│  Layer 03  MINDSET ANALYZER                        ✅ LIVE  │
│  mindset_analyzer.py                                         │
│  → يقارن الإجابة بتفسير الطالب                             │
│  → يكتشف: conceptual / procedural / false_confidence gap    │
├─────────────────────────────────────────────────────────────┤
│  Layer 04  BKT MASTERY TRACKING                    ✅ LIVE  │
│  mastery_tracker.py                                          │
│  → bkt_update بعد كل إجابة منقّاة                         │
│  → check_mastery_gate: threshold 0.8                        │
│  → mastery_snapshots محفوظة في SQLite                       │
├─────────────────────────────────────────────────────────────┤
│  Layer 05  MCP AGENT + AI COACH                    ✅ LIVE  │
│  mcp_agent.py · CoachPanel                                  │
│  → كوتش ذكي بشخصيات متعددة (محفّز / سقراطي / صديق / صارم)│
│  → استراتيجيات تعلم تفاعلية داخل الاختبار                 │
│  → استدعاء MCP tools: get_student_state, get_next_question  │
└─────────────────────────────────────────────────────────────┘
```

---

## المميزات الكاملة

### الاختبار التشخيصي
- أسئلة MCQ + صح/خطأ + إدخال نصي (تقييم ذاتي)
- **تايمر مرئي** مع إمكانية وقف أثناء الاستراحة
- **عرض الحل** → ينتقل تلقائياً للسؤال التالي، يُسجّل في BKT كـ `isCorrect: false`
- **إعادة صياغة مدرّجة** (3 مستويات: أكاديمي → شبابي علمي → مبسّط جداً) — كل مستوى يولّد سؤاله وتلميحه
- **نقطة تفتيش** كل 5 أسئلة — حفظ مؤقت للجلسة
- Break timer منفصل محفوظ في قاعدة البيانات

### جلسة التعلم
- شرائح تعليمية (تعريف + أمثلة + صيغة + إضاءة ذكية) مُولَّدة بالذكاء الاصطناعي
- **Prefetch في الخلفية**: يجهّز الاختبار أثناء الدراسة — الزر يتحول أخضر عند الجاهزية
- دعم مفاهيم المنهج الخارجية (External Concepts) من خريطة الطريق

### خريطة الطريق
- خريطة بصرية لكل مفاهيم المنهج مع مستوى الإتقان
- عقد جانبية: prerequisite / related / extension
- مؤشر تقدم لكل قسم

### الكوتش الذكي
- 4 شخصيات: المحفّز 🔥 / السقراطي 🧠 / الصديق 🤝 / الصارم ⚡
- استراتيجيات تفاعلية: خطوة بخطوة، تدفق بصري، مقارنة، بازل ترتيب، إيجاد الخطأ
- دعم الصوت (Speech-to-Text) عبر Whisper

---

## التقنيات

| الطبقة | التقنية | الدور |
|--------|---------|-------|
| Backend | FastAPI + Python 3.12 | API Server |
| Database | SQLite (WAL mode) | Curriculum + Interactions + Mastery |
| PDF Extraction | IBM Docling | PDF → Markdown (bilingual) |
| LLM | Anthropic Claude (claude-sonnet-4-5) | Structure + Coach + Questions |
| Frontend | React 18 + Vite + TypeScript | SPA |
| Styling | Tailwind CSS v4 + IBM Plex Sans Arabic | Space Theme |
| Speech | OpenAI Whisper API | Voice input |
| Auth | Token-based (SQLite auth_tokens) | Session management |
| Deploy | nginx + systemd (VPS) | Production |

---

## هيكل المشروع

```
apex/
├── api/
│   ├── server.py                # FastAPI app + DB init + migrations
│   ├── pipeline.py              # PDF → Curriculum pipeline
│   ├── utils.py                 # DB connection + auth helpers
│   └── routers/
│       ├── auth.py              # Login / logout / token
│       ├── students.py          # Student profile + onboarding
│       ├── sessions.py          # Diagnostic session submission (5-layer pipeline)
│       ├── learn.py             # Learn session slides + questions
│       ├── diagnostic.py        # Diagnostic question generation
│       ├── curricula.py         # Curriculum CRUD + upload
│       ├── intelligence.py      # AI Coach + RAG
│       ├── mastery.py           # Mastery snapshots
│       ├── graph.py             # Knowledge graph API
│       ├── sinkt.py             # SINKT embeddings
│       ├── mcp.py               # MCP agent tools
│       └── whisper.py           # Speech-to-text
│
├── src/
│   ├── config.py                # Settings (.env)
│   ├── models.py                # Pydantic models
│   ├── ai_enricher.py           # AI enrichment pipeline
│   ├── diagnostic_selector.py   # Layer 01: question selection
│   ├── denoising_engine.py      # Layer 02: weighted_correct
│   ├── mindset_analyzer.py      # Layer 03: gap detection
│   ├── mastery_tracker.py       # Layer 04: BKT update
│   ├── mcp_agent.py             # Layer 05: MCP tools
│   ├── docling_extractor.py     # PDF → Markdown (Docling)
│   ├── question_generator.py    # AI question generation
│   └── external_concept_generator.py  # Side-node concept generation
│
├── frontend/
│   ├── src/
│   │   ├── index.css            # Space theme (purple palette + star field)
│   │   ├── App.tsx              # Main app + modals + session management
│   │   ├── pages/
│   │   │   ├── RoadmapPage.tsx      # Knowledge roadmap
│   │   │   ├── LearnSessionPage.tsx # Learn slides + prefetch
│   │   │   ├── ResultsPage.tsx      # Session results
│   │   │   ├── CurriculumPage.tsx   # Curriculum overview
│   │   │   ├── UploadPage.tsx       # PDF upload + pipeline status
│   │   │   ├── LoginPage.tsx        # Auth
│   │   │   └── SignupPage.tsx       # Registration
│   │   ├── components/
│   │   │   ├── MainQuestion.tsx     # Question display + timer + break
│   │   │   ├── CoachPanel.tsx       # AI coach side panel
│   │   │   ├── QuestionRenderer.tsx # MCQ / True-False / Text input
│   │   │   ├── Strategies.tsx       # Interactive coach strategies
│   │   │   └── AppShell.tsx         # Navigation shell
│   │   ├── context/
│   │   │   ├── SessionContext.tsx   # Test state + BKT events
│   │   │   └── CurriculumContext.tsx
│   │   └── services/
│   │       ├── ai.ts            # Rephrase + coach AI calls
│   │       └── backend.ts       # API client
│   └── package.json
│
├── deploy_dist.py               # Deploy built frontend + backend to VPS
├── requirements.txt
├── SPEC.md                      # Full system specification
├── CLAUDE.md                    # Agent instructions
└── .env                         # API keys (never commit)
```

---

## BKT — المعادلات

```
بعد كل إجابة منقّاة (weighted_correct):

إجابة صحيحة:
  P(L|correct) = P(L)·(1-P(S)) / [P(L)·(1-P(S)) + (1-P(L))·P(G)]

إجابة خاطئة:
  P(L|wrong) = P(L)·P(S) / [P(L)·P(S) + (1-P(L))·(1-P(G))]

انتقال التعلم:
  P(L_new) = P(L|obs) + (1 - P(L|obs)) · P(T)

المعاملات:
  P(L₀) = 0.10   احتمال المعرفة المبدئي
  P(T)  = 0.10   احتمال التعلم من الفرصة
  P(S)  = 0.10   احتمال الزلة (يعرف لكن أخطأ)
  P(G)  = 0.25   احتمال التخمين

بوابات الإتقان:
  P(L) < 0.3  → NOT_MASTERED
  P(L) < 0.6  → LEARNING
  P(L) < 0.8  → NEARLY_MASTERED
  P(L) ≥ 0.8  → MASTERED ✓
```

---

## التشغيل المحلي

### Backend
```bash
pip install -r requirements.txt
cp .env.example .env        # أضف ANTHROPIC_API_KEY
uvicorn api.server:app --reload --port 8000
```

### Frontend
```bash
cd frontend
npm install
npm run dev                  # http://localhost:3000
```

### Deploy to VPS
```bash
cd frontend && npm run build && cd ..
python deploy_dist.py
```

---

## الهوية البصرية

Space Theme بألوان Material Design 3 للفضاء:

| اللون | Hex | الدور |
|-------|-----|-------|
| Deep Navy | `#15121b` | الخلفية |
| Electric Purple | `#d0bcff` | Primary |
| Electric Blue | `#adc6ff` | Secondary |
| Amber | `#ffb869` | Tertiary / Correct |
| Error Red | `#ffb4ab` | خطأ |

خلفية الـ body: حقل نجوم CSS (3 طبقات radial-gradient) + سدم نيبولا بنفسجية وزرقاء.

---

## متغيرات البيئة

```env
ANTHROPIC_API_KEY=sk-ant-...
LLM_MODEL=claude-sonnet-4-5
SECRET_KEY=your-secret-key
DB_PATH=api/apex_data.db
UPLOAD_DIR=api/uploads
```

---

## الترخيص

Private — جميع الحقوق محفوظة لـ Mosa Al-Wahidi.
