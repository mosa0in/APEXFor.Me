import os
import sys

PROJECT_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if PROJECT_ROOT not in sys.path:
    sys.path.insert(0, PROJECT_ROOT)

"""
APEX Backend API — v4.1 (Router Architecture)
FastAPI server with modular routers. All business logic lives in api/routers/*.
"""
import src.encoding_fix  # noqa: F401 — Fix Windows charmap for emoji/Arabic

from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from api.utils import get_db, DB_PATH, UPLOAD_DIR

# Import all routers
from api.routers import auth, students, interactions, mastery
from api.routers import curriculum_content, curricula, section_questions
from api.routers import sessions, intelligence, graph, sinkt, mcp


# ═══════════════════════════════════════════════════════════════════════════
# Database Init — 4 Tables + Legacy
# ═══════════════════════════════════════════════════════════════════════════

def init_db():
    with get_db() as conn:
        conn.executescript("""
        -- ═══ 1. Students ═══
        CREATE TABLE IF NOT EXISTS students (
            student_id    TEXT PRIMARY KEY,
            password_hash TEXT NOT NULL,
            email         TEXT DEFAULT '',
            full_name     TEXT DEFAULT '',
            coach_id      TEXT DEFAULT 'coach_default',
            coach_name    TEXT DEFAULT 'المدرب',
            coach_personality_json TEXT DEFAULT '{}',
            reward_style  TEXT DEFAULT '{}',
            mastery_gates_passed TEXT DEFAULT '{}',
            stars_total   INTEGER DEFAULT 0,
            badges        TEXT DEFAULT '[]',
            diagnostic_done INTEGER DEFAULT 0,
            created_at    TEXT NOT NULL DEFAULT (datetime('now')),
            updated_at    TEXT NOT NULL DEFAULT (datetime('now'))
        );

        -- ═══ 2. Curriculum ═══
        CREATE TABLE IF NOT EXISTS curriculum (
            id              INTEGER PRIMARY KEY AUTOINCREMENT,
            concept_id      TEXT NOT NULL,
            question_id     TEXT NOT NULL,
            book_id         TEXT DEFAULT '',
            chapter_id      TEXT DEFAULT '',
            section_id      TEXT DEFAULT '',
            concept_name    TEXT DEFAULT '',
            subject         TEXT DEFAULT '',
            prerequisites   TEXT DEFAULT '[]',
            question_text   TEXT DEFAULT '',
            question_type   TEXT DEFAULT 'MCQ',
            difficulty_level INTEGER DEFAULT 1,
            correct_answer  TEXT DEFAULT '',
            UNIQUE(concept_id, question_id)
        );

        -- ═══ 3. Interactions ★ ═══
        CREATE TABLE IF NOT EXISTS interactions (
            interaction_id        INTEGER PRIMARY KEY AUTOINCREMENT,
            student_id            TEXT NOT NULL REFERENCES students(student_id),
            question_id           TEXT NOT NULL,
            concept_id            TEXT NOT NULL,
            session_id            TEXT NOT NULL,
            timestamp             TEXT NOT NULL DEFAULT (datetime('now')),
            session_type          TEXT DEFAULT 'diagnostic',
            correct               INTEGER DEFAULT 0,
            attempt_number        INTEGER DEFAULT 1,
            prior_attempts        INTEGER DEFAULT 0,
            confidence_level      INTEGER DEFAULT 0,
            hint_used             INTEGER DEFAULT 0,
            explanation_viewed    INTEGER DEFAULT 0,
            student_explanation   TEXT DEFAULT '',
            input_modality        TEXT DEFAULT 'text',
            question_pattern      TEXT DEFAULT 'MCQ',
            question_regenerated  INTEGER DEFAULT 0,
            regeneration_reason   TEXT DEFAULT '',
            rest_requested        INTEGER DEFAULT 0,
            coach_called          INTEGER DEFAULT 0,
            coach_interaction_type TEXT DEFAULT '',
            session_end_type      TEXT DEFAULT '',
            mastery_gate_passed   INTEGER DEFAULT 0
        );

        -- ═══ 4. Mastery Snapshots ═══
        CREATE TABLE IF NOT EXISTS mastery_snapshots (
            student_id       TEXT NOT NULL REFERENCES students(student_id),
            concept_id       TEXT NOT NULL,
            mastery_estimate REAL DEFAULT 0.0,
            pattern_accuracy TEXT DEFAULT '{}',
            accuracy_rate    REAL DEFAULT 0.0,
            sessions_count   INTEGER DEFAULT 0,
            last_updated     TEXT NOT NULL DEFAULT (datetime('now')),
            PRIMARY KEY (student_id, concept_id)
        );

        -- ═══ Legacy: Curricula (keep for PDF upload pipeline) ═══
        CREATE TABLE IF NOT EXISTS curricula (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            slug TEXT UNIQUE NOT NULL,
            student_id TEXT DEFAULT '',
            name TEXT NOT NULL,
            book_title TEXT DEFAULT '',
            authors TEXT DEFAULT '[]',
            language TEXT DEFAULT 'en',
            pdf_filename TEXT DEFAULT '',
            total_chapters INTEGER DEFAULT 0,
            total_sections INTEGER DEFAULT 0,
            total_concepts INTEGER DEFAULT 0,
            total_exercises INTEGER DEFAULT 0,
            status TEXT DEFAULT 'processing',
            error_message TEXT DEFAULT '',
            curriculum_json TEXT DEFAULT '{}',
            created_at TEXT NOT NULL DEFAULT (datetime('now')),
            updated_at TEXT NOT NULL DEFAULT (datetime('now'))
        );

        CREATE TABLE IF NOT EXISTS concepts (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            curriculum_id INTEGER NOT NULL,
            concept_id TEXT NOT NULL,
            name TEXT NOT NULL,
            description TEXT DEFAULT '',
            section_title TEXT DEFAULT '',
            difficulty_level REAL DEFAULT 0.5,
            is_core INTEGER DEFAULT 1,
            exercise_count INTEGER DEFAULT 0,
            prerequisites TEXT DEFAULT '[]',
            FOREIGN KEY (curriculum_id) REFERENCES curricula(id) ON DELETE CASCADE
        );

        -- ═══ Indexes ═══
        CREATE INDEX IF NOT EXISTS idx_interactions_student ON interactions(student_id);
        CREATE INDEX IF NOT EXISTS idx_interactions_session ON interactions(session_id);
        CREATE INDEX IF NOT EXISTS idx_interactions_concept ON interactions(concept_id);
        CREATE INDEX IF NOT EXISTS idx_mastery_student ON mastery_snapshots(student_id);
        CREATE INDEX IF NOT EXISTS idx_curriculum_concept ON curriculum(concept_id);
        CREATE INDEX IF NOT EXISTS idx_concepts_curriculum ON concepts(curriculum_id);
        CREATE INDEX IF NOT EXISTS idx_curricula_slug ON curricula(slug);
        """)
        conn.commit()


def _fix_empty_ready_curricula():
    """Fix corrupted state: mark empty curricula as 'error' instead of 'ready'."""
    with get_db() as conn:
        fixed = conn.execute("""
            UPDATE curricula SET status='error',
                error_message='Empty curriculum (0 concepts/sections) — auto-corrected',
                updated_at=datetime('now')
            WHERE status='ready' AND (total_concepts=0 OR total_sections=0)
        """).rowcount
        conn.commit()
    if fixed > 0:
        print(f"[Startup] Fixed {fixed} empty curricula marked as 'ready' → 'error'")


def _backfill_curriculum_qa():
    """One-time migration: populate curriculum Q+A flat table from stored curriculum_json."""
    with get_db() as conn:
        already = conn.execute("SELECT COUNT(*) FROM curriculum").fetchone()[0]
        if already > 0:
            return  # Already populated

        curricula = conn.execute(
            "SELECT id, book_title, curriculum_json FROM curricula WHERE status='ready' AND curriculum_json IS NOT NULL AND curriculum_json != '{}'"
        ).fetchall()

        inserted = 0
        diff_map = {"easy": 1, "medium": 2, "hard": 3}
        for cur in curricula:
            try:
                data = json.loads(cur["curriculum_json"] or "{}")
            except Exception:
                continue
            book_code = (cur["book_title"] or "BOOK")[:20].upper().replace(" ", "_")
            for ch in data.get("chapters", []):
                ch_id = ch.get("id", "")
                for sec in ch.get("sections", []):
                    sec_id = sec.get("id", "")
                    for con in sec.get("concepts", []):
                        con_id = con.get("id", "")
                        prereqs = json.dumps(con.get("prerequisites", []), ensure_ascii=False)
                        for q in con.get("questions", []):
                            opts = q.get("options", [])
                            conn.execute("""
                                INSERT OR IGNORE INTO curriculum
                                (concept_id, question_id, book_id, chapter_id, section_id,
                                 concept_name, subject, prerequisites, question_text,
                                 question_type, difficulty_level, correct_answer)
                                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                            """, (
                                con_id, q.get("id", f"{con_id}_q{inserted}"),
                                book_code, ch_id, sec_id,
                                con.get("name", ""), cur["book_title"],
                                prereqs, q.get("text", ""),
                                q.get("question_type", "text_input"),
                                diff_map.get(q.get("difficulty", "medium"), 2),
                                q.get("correct_answer", ""),
                            ))
                            inserted += 1
        conn.commit()
    if inserted > 0:
        print(f"[Startup] Backfilled {inserted} Q+A rows into curriculum table")


# ═══════════════════════════════════════════════════════════════════════════
# Lifespan (replaces deprecated @app.on_event)
# ═══════════════════════════════════════════════════════════════════════════

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    init_db()
    os.makedirs(UPLOAD_DIR, exist_ok=True)
    print(f"[OK] APEX DB initialized at {DB_PATH}")
    from api.pipeline import seed_existing_curriculum
    seed_existing_curriculum(DB_PATH)
    _fix_empty_ready_curricula()
    _backfill_curriculum_qa()
    yield
    # Shutdown (if needed)


# ═══════════════════════════════════════════════════════════════════════════
# App Creation
# ═══════════════════════════════════════════════════════════════════════════

app = FastAPI(title="APEX Diagnostic API", version="4.1.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ═══════════════════════════════════════════════════════════════════════════
# Register All Routers
# ═══════════════════════════════════════════════════════════════════════════

app.include_router(auth.router)
app.include_router(students.router)
app.include_router(interactions.router)
app.include_router(mastery.router)
app.include_router(curriculum_content.router)
app.include_router(curricula.router)
app.include_router(section_questions.router)
app.include_router(sessions.router)
app.include_router(intelligence.router)
app.include_router(graph.router)
app.include_router(sinkt.router)
app.include_router(mcp.router)
