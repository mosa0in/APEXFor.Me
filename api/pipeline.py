"""
APEX — Background Pipeline Runner
Runs PDF analysis pipeline in a background thread and stores results in SQLite.
"""

import threading
import json
import sqlite3
import os
import sys
import traceback
from datetime import datetime

PROJECT_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if PROJECT_ROOT not in sys.path:
    sys.path.insert(0, PROJECT_ROOT)

import src.encoding_fix  # noqa: F401 — Fix Windows charmap for emoji/Arabic

DB_PATH = os.path.join(os.path.dirname(__file__), "apex_data.db")


def _slugify(text: str) -> str:
    """Convert text to URL-safe slug."""
    import re
    text = text.lower().strip()
    text = re.sub(r'[^\w\s-]', '', text)
    text = re.sub(r'[\s_]+', '-', text)
    text = re.sub(r'-+', '-', text)
    return text[:60] or "unnamed"


def _update_status(curriculum_id: int, status: str, db_path: str = DB_PATH, **kwargs):
    """Update curriculum status in DB."""
    conn = sqlite3.connect(db_path)
    sets = ["status = ?", "updated_at = ?"]
    vals = [status, datetime.now().isoformat()]
    for k, v in kwargs.items():
        sets.append(f"{k} = ?")
        vals.append(v)
    vals.append(curriculum_id)
    conn.execute(f"UPDATE curricula SET {', '.join(sets)} WHERE id = ?", vals)
    conn.commit()
    conn.close()


def _pipeline_worker(pdf_path: str, curriculum_id: int, name: str, db_path: str = DB_PATH):
    """
    Run the full extraction pipeline and store results in SQLite.
    This runs in a background thread.

    NEW FLOW (Docling):
      1. Docling → Clean Markdown
      2. AI Enricher → Curriculum JSON (from Markdown)
      3. Store in SQLite
    """
    try:
        print(f"[Pipeline] Starting analysis for curriculum #{curriculum_id}: {name}")
        _update_status(curriculum_id, "extracting_pdf", db_path)

        # ── Step 1: Docling → Markdown ────────────────────────────────
        from src.docling_extractor import extract_markdown
        markdown = extract_markdown(pdf_path)

        # Save raw markdown for debugging
        md_path = os.path.join("data", f"markdown_raw_{curriculum_id}.md")
        os.makedirs("data", exist_ok=True)
        with open(md_path, "w", encoding="utf-8") as f:
            f.write(markdown)
        print(f"[Pipeline] Docling extracted {len(markdown):,} chars of Markdown")

        _update_status(curriculum_id, "enriching", db_path)

        # ── Step 2: AI Enrichment (from Markdown) ─────────────────────
        from src.config import settings as _cfg
        _key_ok = bool(_cfg.ANTHROPIC_API_KEY)
        print(f"[Pipeline] AI config: key={'SET' if _key_ok else 'MISSING'}  model={_cfg.LLM_MODEL}")
        if not _key_ok:
            raise RuntimeError("ANTHROPIC_API_KEY is not set — check .env file")

        from src.ai_enricher import enrich_from_markdown
        enriched_path = os.path.join("data", f"curriculum_{curriculum_id}.json")

        curriculum = enrich_from_markdown(
            markdown, enriched_path,
            status_callback=lambda msg: _update_status(curriculum_id, msg, db_path),
        )

        _update_status(curriculum_id, "storing", db_path)

        # ── Step 3: Store in SQLite ──────────────────────────────────
        with open(enriched_path, "r", encoding="utf-8") as f:
            curriculum_json = f.read()

        conn = sqlite3.connect(db_path)

        # Validate curriculum has actual content
        total_secs = sum(len(ch.sections) for ch in curriculum.chapters)
        total_cons = curriculum.total_concepts

        if total_cons == 0 or total_secs == 0:
            print(f"[Pipeline] WARNING: Curriculum #{curriculum_id} is empty "
                  f"({total_cons} concepts, {total_secs} sections) — marking as error")
            _update_status(curriculum_id, "error", db_path,
                           error_message=f"Empty curriculum: {total_cons} concepts, {total_secs} sections. "
                                         "PDF may not be a valid textbook.")
            return

        # Update curricula row — status will move to 'ready' after step 4
        conn.execute("""
            UPDATE curricula SET
                book_title = ?,
                language = ?,
                total_chapters = ?,
                total_sections = ?,
                total_concepts = ?,
                total_exercises = ?,
                curriculum_json = ?,
                status = 'stored',
                updated_at = ?
            WHERE id = ?
        """, (
            curriculum.book_title,
            curriculum.language,
            len(curriculum.chapters),
            total_secs,
            total_cons,
            curriculum.total_questions,
            curriculum_json,
            datetime.now().isoformat(),
            curriculum_id,
        ))

        # Store concepts + flat Q+A table
        book_code = curriculum.book_title[:20].upper().replace(" ", "_")
        for ch in curriculum.chapters:
            for sec in ch.sections:
                for con in sec.concepts:
                    ext_prereqs_json = json.dumps(
                        [ep.model_dump() for ep in con.external_prerequisites],
                        ensure_ascii=False,
                    )
                    conn.execute("""
                        INSERT INTO concepts
                        (curriculum_id, concept_id, name, description, section_title,
                         difficulty_level, is_core, exercise_count, prerequisites,
                         external_prerequisites)
                        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                    """, (
                        curriculum_id, con.id, con.name, con.description,
                        sec.title, con.difficulty_level, int(con.is_core),
                        con.exercise_count, json.dumps(con.prerequisites),
                        ext_prereqs_json,
                    ))

                    # Populate flat curriculum Q+A table for fast question lookup
                    for q in con.questions:
                        conn.execute("""
                            INSERT OR IGNORE INTO curriculum
                            (concept_id, question_id, book_id, chapter_id, section_id,
                             concept_name, subject, prerequisites, question_text,
                             question_type, difficulty_level, correct_answer)
                            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                        """, (
                            con.id, q.id,
                            book_code, ch.id, sec.id,
                            con.name, curriculum.book_title,
                            json.dumps(con.prerequisites),
                            q.text, q.question_type,
                            {"easy": 1, "medium": 2, "hard": 3}.get(q.difficulty, 2),
                            q.correct_answer,
                        ))

        conn.commit()
        conn.close()

        # ── Mark READY immediately — user can access curriculum now ─────
        _update_status(curriculum_id, "ready", db_path)
        print(f"[Pipeline] DONE Curriculum #{curriculum_id} ready "
              f"({curriculum.total_concepts} concepts, {curriculum.total_questions} exercises)")

        # ── Step 4: AI Diagnostic Questions — runs in background ────────
        flat_concepts = [
            {
                "concept_id": con.id,
                "name": con.name,
                "description": con.description,
                "section_title": sec.title,
                "difficulty_level": con.difficulty_level,
                "is_core": con.is_core,
            }
            for ch in curriculum.chapters
            for sec in ch.sections
            for con in sec.concepts
        ]

        def _gen_diagnostic_bg(cid: int, title: str, concepts: list, db: str) -> None:
            try:
                from src.external_concept_generator import generate_all as _gen_all
                _gen_all(curriculum_id=cid, book_title=title, concepts=concepts, db_path=db)
                print(f"[Pipeline] DONE AI diagnostic questions ready for #{cid}")
            except Exception as ext_err:
                print(f"[Pipeline] WARNING: External concept generation failed: {ext_err}")

        threading.Thread(
            target=_gen_diagnostic_bg,
            args=(curriculum_id, curriculum.book_title, flat_concepts, db_path),
            daemon=True,
        ).start()

    except Exception as e:
        print(f"[Pipeline] ERROR for curriculum #{curriculum_id}: {e}")
        traceback.print_exc()
        _update_status(curriculum_id, "error", db_path, error_message=str(e)[:500])


def run_pipeline_async(pdf_path: str, curriculum_id: int, name: str, db_path: str = DB_PATH):
    """Start the pipeline in a background thread."""
    thread = threading.Thread(
        target=_pipeline_worker,
        args=(pdf_path, curriculum_id, name, db_path),
        daemon=True,
    )
    thread.start()
    return thread


def seed_existing_curriculum(db_path: str = DB_PATH):
    """
    Seed the database with the existing curriculum.json if no curricula exist.
    Called on server startup.
    """
    conn = sqlite3.connect(db_path)
    conn.row_factory = sqlite3.Row
    count = conn.execute("SELECT COUNT(*) as c FROM curricula").fetchone()["c"]

    if count > 0:
        conn.close()
        return

    # Check if curriculum.json exists
    cur_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), "data", "curriculum.json")
    if not os.path.exists(cur_path):
        conn.close()
        return

    print("[Seed] Seeding existing curriculum.json into SQLite...")

    with open(cur_path, "r", encoding="utf-8") as f:
        data = json.load(f)
        curriculum_json = f.read()

    # Re-read for the raw string
    with open(cur_path, "r", encoding="utf-8") as f:
        curriculum_json = f.read()

    book_title = data.get("book_title", "Thomas' Calculus")
    chapters = data.get("chapters", [])
    total_sections = sum(len(ch.get("sections", [])) for ch in chapters)
    total_concepts = sum(
        len(sec.get("concepts", []))
        for ch in chapters for sec in ch.get("sections", [])
    )
    total_exercises = sum(
        sec.get("total_exercises", 0)
        for ch in chapters for sec in ch.get("sections", [])
    )

    slug = _slugify(book_title)

    conn.execute("""
        INSERT INTO curricula
        (slug, name, book_title, authors, language, total_chapters,
         total_sections, total_concepts, total_exercises, status, curriculum_json)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'ready', ?)
    """, (
        slug, book_title, book_title,
        json.dumps(data.get("authors", [])),
        data.get("language", "en"),
        len(chapters), total_sections, total_concepts, total_exercises,
        curriculum_json,
    ))

    curriculum_id = conn.execute("SELECT last_insert_rowid()").fetchone()[0]

    # Store concepts
    for ch in chapters:
        for sec in ch.get("sections", []):
            for con in sec.get("concepts", []):
                conn.execute("""
                    INSERT INTO concepts
                    (curriculum_id, concept_id, name, description, section_title,
                     difficulty_level, is_core, exercise_count, prerequisites)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                """, (
                    curriculum_id,
                    con.get("id", ""),
                    con.get("name", ""),
                    con.get("description", ""),
                    sec.get("title", ""),
                    con.get("difficulty_level", 0.5),
                    int(con.get("is_core", True)),
                    con.get("exercise_count", 0),
                    json.dumps(con.get("prerequisites", [])),
                ))

    conn.commit()
    conn.close()
    print(f"[Seed] OK Seeded: {book_title} ({total_concepts} concepts)")
