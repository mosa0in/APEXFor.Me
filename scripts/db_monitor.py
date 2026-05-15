"""
APEX DB Monitor — Schema verification, ERD, FK integrity, row counts, data samples.
Usage:
    python scripts/db_monitor.py
    python scripts/db_monitor.py --db path/to/apex_data.db
"""
import sys
import sqlite3
import json
import argparse
from pathlib import Path

# Fix Windows charmap before any Rich output
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
import src.encoding_fix  # noqa: F401

from rich.console import Console
from rich.table import Table
from rich.panel import Panel
from rich.text import Text

console = Console()

# ── DB location ──────────────────────────────────────────────────────────────
PROJECT_ROOT = Path(__file__).resolve().parent.parent
DEFAULT_DB = PROJECT_ROOT / "api" / "apex_data.db"

# ── Expected schema (source of truth = api/server.py init_db) ────────────────
EXPECTED_SCHEMA: dict[str, list[tuple[str, str]]] = {
    "students": [
        ("student_id",             "TEXT"),
        ("password_hash",          "TEXT"),
        ("email",                  "TEXT"),
        ("full_name",              "TEXT"),
        ("coach_id",               "TEXT"),
        ("coach_name",             "TEXT"),
        ("coach_personality_json", "TEXT"),
        ("reward_style",           "TEXT"),
        ("mastery_gates_passed",   "TEXT"),
        ("stars_total",            "INTEGER"),
        ("badges",                 "TEXT"),
        ("diagnostic_done",        "INTEGER"),
        ("created_at",             "TEXT"),
        ("updated_at",             "TEXT"),
    ],
    "curriculum": [
        ("id",               "INTEGER"),
        ("concept_id",       "TEXT"),
        ("question_id",      "TEXT"),
        ("book_id",          "TEXT"),
        ("chapter_id",       "TEXT"),
        ("section_id",       "TEXT"),
        ("concept_name",     "TEXT"),
        ("subject",          "TEXT"),
        ("prerequisites",    "TEXT"),
        ("question_text",    "TEXT"),
        ("question_type",    "TEXT"),
        ("difficulty_level", "INTEGER"),
        ("correct_answer",   "TEXT"),
    ],
    "interactions": [
        ("interaction_id",         "INTEGER"),
        ("student_id",             "TEXT"),
        ("question_id",            "TEXT"),
        ("concept_id",             "TEXT"),
        ("session_id",             "TEXT"),
        ("timestamp",              "TEXT"),
        ("session_type",           "TEXT"),
        ("correct",                "INTEGER"),
        ("attempt_number",         "INTEGER"),
        ("prior_attempts",         "INTEGER"),
        ("confidence_level",       "INTEGER"),
        ("hint_used",              "INTEGER"),
        ("explanation_viewed",     "INTEGER"),
        ("student_explanation",    "TEXT"),
        ("input_modality",         "TEXT"),
        ("question_pattern",       "TEXT"),
        ("question_regenerated",   "INTEGER"),
        ("regeneration_reason",    "TEXT"),
        ("rest_requested",         "INTEGER"),
        ("coach_called",           "INTEGER"),
        ("coach_interaction_type", "TEXT"),
        ("session_end_type",       "TEXT"),
        ("mastery_gate_passed",    "INTEGER"),
    ],
    "mastery_snapshots": [
        ("student_id",       "TEXT"),
        ("concept_id",       "TEXT"),
        ("mastery_estimate", "REAL"),
        ("pattern_accuracy", "TEXT"),
        ("accuracy_rate",    "REAL"),
        ("sessions_count",   "INTEGER"),
        ("last_updated",     "TEXT"),
    ],
    "curricula": [
        ("id",              "INTEGER"),
        ("slug",            "TEXT"),
        ("student_id",      "TEXT"),
        ("name",            "TEXT"),
        ("book_title",      "TEXT"),
        ("authors",         "TEXT"),
        ("language",        "TEXT"),
        ("pdf_filename",    "TEXT"),
        ("total_chapters",  "INTEGER"),
        ("total_sections",  "INTEGER"),
        ("total_concepts",  "INTEGER"),
        ("total_exercises", "INTEGER"),
        ("status",          "TEXT"),
        ("error_message",   "TEXT"),
        ("curriculum_json", "TEXT"),
        ("created_at",      "TEXT"),
        ("updated_at",      "TEXT"),
    ],
    "concepts": [
        ("id",               "INTEGER"),
        ("curriculum_id",    "INTEGER"),
        ("concept_id",       "TEXT"),
        ("name",             "TEXT"),
        ("description",      "TEXT"),
        ("section_title",    "TEXT"),
        ("difficulty_level", "REAL"),
        ("is_core",          "INTEGER"),
        ("exercise_count",   "INTEGER"),
        ("prerequisites",    "TEXT"),
    ],
    "concept_embeddings": [
        ("concept_id",       "TEXT"),
        ("embedding_text",   "TEXT"),
        ("embedding_vector", "TEXT"),
        ("concept_name",     "TEXT"),
        ("section_title",    "TEXT"),
        ("keywords",         "TEXT"),
        ("updated_at",       "TIMESTAMP"),
    ],
}

FOREIGN_KEYS = [
    ("interactions",     "student_id",    "students",  "student_id"),
    ("mastery_snapshots","student_id",    "students",  "student_id"),
    ("concepts",         "curriculum_id", "curricula", "id"),
]


def connect(db_path: Path) -> sqlite3.Connection:
    conn = sqlite3.connect(str(db_path))
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    conn.execute("PRAGMA journal_mode = WAL")
    return conn


# ── Section A: ERD ────────────────────────────────────────────────────────────
def print_erd():
    erd = """
  ┌─────────────────────────────────────────────────────────────────────┐
  │                       APEX  SQLite  ERD                             │
  └─────────────────────────────────────────────────────────────────────┘

   students ─────────────────────────────────────────────────┐
   PK: student_id (TEXT)                                     │
   ├── interactions.student_id  ──── FK (ON DELETE RESTRICT) │
   └── mastery_snapshots.student_id ─ FK (ON DELETE RESTRICT)│
                                                             │
   curricula ───────────────────────────────────────┐        │
   PK: id (INTEGER)                                 │        │
   UK: slug (TEXT)                                  │        │
   └── concepts.curriculum_id ─ FK (CASCADE DELETE) │        │
                                                    │        │
   ┌──────────────────────────┐  ┌──────────────────┴─┐  ┌──┴──────────────────────┐
   │      concepts            │  │     interactions    │  │    mastery_snapshots    │
   │  PK: id                  │  │  PK: interaction_id │  │  PK: (student_id,      │
   │  FK: curriculum_id       │  │  FK: student_id     │  │       concept_id)      │
   │  concept_id (TEXT)       │  │  concept_id (TEXT)  │  │  FK: student_id        │
   │  difficulty_level (REAL) │  │  correct (INTEGER)  │  │  mastery_estimate(REAL)│
   └──────────────────────────┘  └─────────────────────┘  └────────────────────────┘

   ┌──────────────────────────┐  ┌─────────────────────────────────────────────────┐
   │      curriculum          │  │       concept_embeddings + concept_fts           │
   │  (flat Q+A store)        │  │  (semantic search layer — no FK to other tables) │
   │  PK: id                  │  │  PK: concept_id (TEXT)                           │
   │  UK: (concept_id,        │  │  FTS5 virtual table: concept_fts                 │
   │       question_id)       │  └─────────────────────────────────────────────────┘
   └──────────────────────────┘
"""
    console.print(Panel(erd, title="[bold cyan]ERD[/bold cyan]", border_style="cyan"))


# ── Section B: Schema Verification ───────────────────────────────────────────
def verify_schema(conn: sqlite3.Connection):
    console.print(Panel("[bold]Schema Verification[/bold]", border_style="green"))

    all_pass = True
    for table, expected_cols in EXPECTED_SCHEMA.items():
        rows = conn.execute(f"PRAGMA table_info({table})").fetchall()
        if not rows:
            console.print(f"  [bold red]MISSING TABLE:[/bold red] {table}")
            all_pass = False
            continue

        actual = {r["name"]: r["type"].upper() for r in rows}
        expected_map = {name: typ.upper() for name, typ in expected_cols}

        t = Table(title=f"[bold]{table}[/bold]", show_lines=False, expand=False)
        t.add_column("Column", style="cyan")
        t.add_column("Expected", style="white")
        t.add_column("Actual", style="white")
        t.add_column("Status", style="bold")

        table_ok = True
        for col_name, exp_type in expected_cols:
            if col_name not in actual:
                t.add_row(col_name, exp_type, "—", "[red]MISSING[/red]")
                table_ok = False
            elif actual[col_name] != exp_type:
                t.add_row(col_name, exp_type, actual[col_name], "[yellow]WARN type mismatch[/yellow]")
            else:
                t.add_row(col_name, exp_type, actual[col_name], "[green]PASS[/green]")

        for col_name, act_type in actual.items():
            if col_name not in expected_map:
                t.add_row(col_name, "—", act_type, "[blue]EXTRA (ok)[/blue]")

        if not table_ok:
            all_pass = False

        console.print(t)

    # concept_fts is a virtual table — just check it exists
    tables_in_db = {r[0] for r in conn.execute("SELECT name FROM sqlite_master WHERE type IN ('table','shadow')").fetchall()}
    if "concept_fts" in tables_in_db:
        console.print("  [green]PASS[/green] concept_fts (FTS5 virtual table exists)")
    else:
        console.print("  [yellow]INFO[/yellow] concept_fts not yet created (created on first SINKT index run)")

    console.print()
    if all_pass:
        console.print("[bold green]Schema: ALL PASS[/bold green]")
    else:
        console.print("[bold red]Schema: issues found (see above)[/bold red]")


# ── Section C: Row Counts ─────────────────────────────────────────────────────
def print_row_counts(conn: sqlite3.Connection):
    console.print(Panel("[bold]Row Counts[/bold]", border_style="yellow"))

    tables = [r[0] for r in conn.execute(
        "SELECT name FROM sqlite_master WHERE type='table' ORDER BY name"
    ).fetchall()]

    t = Table(show_lines=True)
    t.add_column("Table", style="cyan")
    t.add_column("Rows", justify="right", style="bold white")

    for tbl in tables:
        try:
            count = conn.execute(f"SELECT COUNT(*) FROM [{tbl}]").fetchone()[0]
            color = "green" if count > 0 else "dim"
            t.add_row(tbl, f"[{color}]{count:,}[/{color}]")
        except Exception:
            t.add_row(tbl, "[red]error[/red]")

    console.print(t)


# ── Section D: FK Integrity ───────────────────────────────────────────────────
def check_fk_integrity(conn: sqlite3.Connection):
    console.print(Panel("[bold]Foreign Key Integrity[/bold]", border_style="magenta"))

    violations = conn.execute("PRAGMA foreign_key_check").fetchall()
    if not violations:
        console.print("  [bold green]PASS — No FK violations found.[/bold green]")
    else:
        t = Table(title="FK Violations", show_lines=True)
        t.add_column("Table", style="red")
        t.add_column("Row ID", style="white")
        t.add_column("Parent Table", style="yellow")
        t.add_column("FK Index", style="white")
        for v in violations:
            t.add_row(str(v[0]), str(v[1]), str(v[2]), str(v[3]))
        console.print(t)

    # Also check orphans manually for each FK
    orphan_found = False
    for child_table, child_col, parent_table, parent_col in FOREIGN_KEYS:
        tables_in_db = {r[0] for r in conn.execute("SELECT name FROM sqlite_master WHERE type='table'").fetchall()}
        if child_table not in tables_in_db or parent_table not in tables_in_db:
            continue
        orphans = conn.execute(f"""
            SELECT COUNT(*) FROM {child_table} c
            WHERE NOT EXISTS (
                SELECT 1 FROM {parent_table} p WHERE p.{parent_col} = c.{child_col}
            )
        """).fetchone()[0]
        if orphans > 0:
            console.print(f"  [red]ORPHANS:[/red] {child_table}.{child_col} → {orphans} rows with no matching {parent_table}.{parent_col}")
            orphan_found = True

    if not orphan_found and not violations:
        console.print("  [green]Manual orphan check: PASS[/green]")


# ── Section E: Pipeline Status Distribution ───────────────────────────────────
def print_pipeline_status(conn: sqlite3.Connection):
    console.print(Panel("[bold]Curricula Pipeline Status[/bold]", border_style="blue"))

    tables_in_db = {r[0] for r in conn.execute("SELECT name FROM sqlite_master WHERE type='table'").fetchall()}
    if "curricula" not in tables_in_db:
        console.print("  [dim]curricula table not yet created[/dim]")
        return

    rows = conn.execute(
        "SELECT status, COUNT(*) as cnt FROM curricula GROUP BY status ORDER BY cnt DESC"
    ).fetchall()

    if not rows:
        console.print("  [dim]No curricula in database yet.[/dim]")
        return

    STATUS_COLORS = {
        "ready":          "green",
        "error":          "red",
        "processing":     "yellow",
        "extracting_pdf": "cyan",
        "enriching":      "blue",
        "storing":        "magenta",
    }

    t = Table(show_lines=True)
    t.add_column("Status", style="bold")
    t.add_column("Count", justify="right")

    for row in rows:
        status, cnt = row["status"], row["cnt"]
        color = STATUS_COLORS.get(status, "white")
        t.add_row(f"[{color}]{status}[/{color}]", str(cnt))

    console.print(t)

    # List curricula with error messages
    errors = conn.execute(
        "SELECT slug, error_message FROM curricula WHERE status='error'"
    ).fetchall()
    if errors:
        console.print("\n  [bold red]Curricula with errors:[/bold red]")
        for e in errors:
            console.print(f"    • [red]{e['slug']}[/red]: {e['error_message'][:120]}")


# ── Section F: Data Samples ───────────────────────────────────────────────────
def print_samples(conn: sqlite3.Connection):
    console.print(Panel("[bold]Data Samples (latest 3 rows per table)[/bold]", border_style="white"))

    SAMPLE_TABLES = {
        "students":          ("student_id, full_name, stars_total, diagnostic_done, created_at", "rowid DESC"),
        "curriculum":        ("id, concept_id, question_id, concept_name, difficulty_level", "id DESC"),
        "interactions":      ("interaction_id, student_id, concept_id, correct, confidence_level, timestamp", "interaction_id DESC"),
        "mastery_snapshots": ("student_id, concept_id, mastery_estimate, accuracy_rate, last_updated", "last_updated DESC"),
        "curricula":         ("id, slug, name, status, total_concepts, total_sections, updated_at", "id DESC"),
        "concepts":          ("id, curriculum_id, concept_id, name, difficulty_level, is_core", "id DESC"),
    }

    tables_in_db = {r[0] for r in conn.execute("SELECT name FROM sqlite_master WHERE type='table'").fetchall()}

    for table, (cols, order) in SAMPLE_TABLES.items():
        if table not in tables_in_db:
            continue

        count = conn.execute(f"SELECT COUNT(*) FROM {table}").fetchone()[0]
        if count == 0:
            console.print(f"  [dim]{table}: empty[/dim]")
            continue

        rows = conn.execute(f"SELECT {cols} FROM {table} ORDER BY {order} LIMIT 3").fetchall()
        col_names = [c.strip() for c in cols.split(",")]

        t = Table(title=f"[bold]{table}[/bold] ({count:,} total rows — latest 3)", show_lines=True, expand=True)
        for c in col_names:
            t.add_column(c, overflow="fold", max_width=40)

        for row in rows:
            t.add_row(*[str(row[c]) if row[c] is not None else "NULL" for c in col_names])

        console.print(t)


# ── Main ──────────────────────────────────────────────────────────────────────
def main():
    parser = argparse.ArgumentParser(description="APEX DB Monitor")
    parser.add_argument("--db", type=Path, default=DEFAULT_DB, help="Path to apex_data.db")
    args = parser.parse_args()

    if not args.db.exists():
        console.print(f"[bold red]DB not found:[/bold red] {args.db}")
        console.print("Start the server first: [cyan]python -m uvicorn api.server:app --reload[/cyan]")
        return

    console.print(f"\n[bold]APEX DB Monitor[/bold] — [cyan]{args.db}[/cyan]")
    console.print(f"Size: [yellow]{args.db.stat().st_size / 1024:.1f} KB[/yellow]\n")

    conn = connect(args.db)

    print_erd()
    verify_schema(conn)
    print_row_counts(conn)
    check_fk_integrity(conn)
    print_pipeline_status(conn)
    print_samples(conn)

    conn.close()
    console.print("\n[bold green]Monitor complete.[/bold green]")


if __name__ == "__main__":
    main()
