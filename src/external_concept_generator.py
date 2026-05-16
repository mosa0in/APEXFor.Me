"""
APEX — External Concept Generator
Runs once at curriculum upload time.

Produces:
  - 15 AI-generated diagnostic questions for the top internal concepts
  - 15 external prerequisite/related concepts (with 1 question each)

Total diagnostic pool: 30 questions with 40/30/30 MCQ/T-F/essay distribution.
"""

import json
import re
from typing import Any

import anthropic

from src.config import settings


# ── Distribution targets ──────────────────────────────────────────────────
_INTERNAL_Q = 15   # from curriculum concepts
_EXTERNAL_Q  = 15  # from outside the curriculum
_TYPE_DIST   = {   # target share per type (applied independently to each half)
    "mcq":        0.40,
    "true_false": 0.30,
    "text_input": 0.30,
}


def _type_sequence(n: int) -> list[str]:
    """Return a list of n question types matching target distribution."""
    mcq_n = round(n * _TYPE_DIST["mcq"])
    tf_n  = round(n * _TYPE_DIST["true_false"])
    ti_n  = n - mcq_n - tf_n
    return ["mcq"] * mcq_n + ["true_false"] * tf_n + ["text_input"] * ti_n


def _call_claude(prompt: str, max_tokens: int = 4096, timeout: int = 240) -> str:
    # Set timeout directly on the SDK client (httpx-level — truly kills the request)
    client = anthropic.Anthropic(api_key=settings.ANTHROPIC_API_KEY, timeout=timeout)
    msg = client.messages.create(
        model=settings.LLM_MODEL,
        max_tokens=max_tokens,
        messages=[{"role": "user", "content": prompt}],
    )
    return msg.content[0].text.strip()


def _extract_json(raw: str) -> Any:
    """Extract the first JSON object/array from a string."""
    match = re.search(r'(\{[\s\S]*\}|\[[\s\S]*\])', raw)
    if not match:
        raise ValueError("No JSON found in response")
    return json.loads(match.group(1))


# ─────────────────────────────────────────────────────────────────────────
# STEP A — Generate AI diagnostic questions for internal concepts
# ─────────────────────────────────────────────────────────────────────────

_INTERNAL_PROMPT = """\
You are an expert curriculum designer creating diagnostic questions.

Curriculum: {book_title}
Internal concepts (JSON list):
{concepts_json}

Task: Generate exactly {n} diagnostic questions for the MOST IMPORTANT concepts above.
- Choose concepts by priority: core first, then higher difficulty.
- Do NOT copy questions from the book; write fresh questions that test understanding.
- Follow this exact type distribution: {type_dist}
  (types must be exactly as listed, in any order)

Return a JSON array only, no commentary:
[
  {{
    "concept_id": "<id from above>",
    "concept_name": "<name>",
    "question_text": "<question in the same language as the book>",
    "question_type": "mcq" | "true_false" | "text_input",
    "options": ["A", "B", "C", "D"],   // required for mcq; ["True","False"] for true_false; [] for text_input
    "correct_answer": "<answer>",
    "answer_hint": "<one-sentence hint — do NOT reveal the answer>",
    "difficulty": "easy" | "medium" | "hard"
  }},
  ...
]
"""


def generate_internal_questions(
    book_title: str,
    concepts: list[dict],
) -> list[dict]:
    """Generate AI diagnostic questions for internal curriculum concepts."""
    # Select top concepts: core first, then by difficulty desc, cap at 2× target
    ranked = sorted(
        concepts,
        key=lambda c: (0 if c.get("is_core") else 1, -c.get("difficulty_level", 0.5)),
    )[:_INTERNAL_Q * 2]

    type_seq = _type_sequence(_INTERNAL_Q)
    type_dist_str = ", ".join(
        f"{t}: {type_seq.count(t)}" for t in ["mcq", "true_false", "text_input"]
    )

    slim = [
        {"id": c["concept_id"], "name": c["name"],
         "description": c.get("description", "")[:120],
         "is_core": c.get("is_core", True),
         "difficulty_level": c.get("difficulty_level", 0.5)}
        for c in ranked
    ]

    prompt = _INTERNAL_PROMPT.format(
        book_title=book_title,
        concepts_json=json.dumps(slim, ensure_ascii=False, indent=2),
        n=_INTERNAL_Q,
        type_dist=type_dist_str,
    )

    raw = _call_claude(prompt)
    questions = _extract_json(raw)

    # Normalise fields
    result = []
    for q in questions[:_INTERNAL_Q]:
        q.setdefault("options", [])
        q.setdefault("correct_answer", "")
        q.setdefault("answer_hint", "")
        q.setdefault("difficulty", "medium")
        result.append(q)
    return result


# ─────────────────────────────────────────────────────────────────────────
# STEP B — Identify external concepts + generate their questions
# ─────────────────────────────────────────────────────────────────────────

_EXTERNAL_PROMPT = """\
You are an expert curriculum designer analyzing prerequisite knowledge.

Curriculum: {book_title}
Internal concepts:
{concepts_json}

Task A — Identify exactly {n_ext} external concepts that are:
  - Prerequisites, co-requisites, or strongly related topics NOT listed above.
  - From general academic knowledge (math, CS, science, etc.).
  - Ordered by importance: most critical prerequisites first.
  - Include an "insert_after" field: the concept_id of the internal concept after which
    this external concept should appear in the learning roadmap. Use "" if it belongs before all.

Task B — For each external concept generate exactly 1 diagnostic question.
Type distribution across all {n_ext} questions: {type_dist}

Return a JSON array only:
[
  {{
    "concept_id": "ext_{{}}_001",  // use ext_<index>
    "name": "<concept name>",
    "description": "<2-3 sentence description>",
    "relation_type": "prerequisite" | "related" | "extension",
    "priority": 1 | 2 | 3,          // 1=must know, 2=helpful, 3=enrichment
    "insert_after": "<internal concept_id or ''>",
    "question": {{
      "question_text": "<question>",
      "question_type": "mcq" | "true_false" | "text_input",
      "options": [],
      "correct_answer": "<answer>",
      "answer_hint": "<hint>",
      "difficulty": "easy" | "medium" | "hard"
    }}
  }},
  ...
]
"""


def generate_external_concepts(
    book_title: str,
    concepts: list[dict],
) -> list[dict]:
    """Ask AI to identify 15 external concepts and generate one question each."""
    type_seq = _type_sequence(_EXTERNAL_Q)
    type_dist_str = ", ".join(
        f"{t}: {type_seq.count(t)}" for t in ["mcq", "true_false", "text_input"]
    )

    slim = [
        {"concept_id": c["concept_id"], "name": c["name"],
         "section_title": c.get("section_title", "")}
        for c in concepts
    ]

    prompt = _EXTERNAL_PROMPT.format(
        book_title=book_title,
        concepts_json=json.dumps(slim, ensure_ascii=False, indent=2),
        n_ext=_EXTERNAL_Q,
        type_dist=type_dist_str,
    )

    raw = _call_claude(prompt, max_tokens=6000)
    ext_concepts = _extract_json(raw)

    result = []
    for i, ec in enumerate(ext_concepts[:_EXTERNAL_Q]):
        ec.setdefault("concept_id", f"ext_{i+1:03d}")
        ec.setdefault("description", "")
        ec.setdefault("relation_type", "prerequisite")
        ec.setdefault("priority", 2)
        ec.setdefault("insert_after", "")
        q = ec.get("question", {})
        q.setdefault("options", [])
        q.setdefault("correct_answer", "")
        q.setdefault("answer_hint", "")
        q.setdefault("difficulty", "medium")
        ec["question"] = q
        result.append(ec)
    return result


# ─────────────────────────────────────────────────────────────────────────
# Public entry point
# ─────────────────────────────────────────────────────────────────────────

def generate_all(
    curriculum_id: int,
    book_title: str,
    concepts: list[dict],
    db_path: str,
) -> None:
    """
    Generate internal AI questions + external concepts, store in SQLite.
    Called from pipeline after main curriculum is stored.
    """
    import sqlite3
    conn = sqlite3.connect(db_path)

    # Ensure tables exist
    conn.executescript("""
        CREATE TABLE IF NOT EXISTS external_concepts (
            id              INTEGER PRIMARY KEY AUTOINCREMENT,
            curriculum_id   INTEGER NOT NULL,
            concept_id      TEXT    NOT NULL,
            name            TEXT    NOT NULL,
            description     TEXT    DEFAULT '',
            relation_type   TEXT    DEFAULT 'prerequisite',
            priority        INTEGER DEFAULT 2,
            insert_after    TEXT    DEFAULT '',
            question_json   TEXT    DEFAULT '{}',
            FOREIGN KEY (curriculum_id) REFERENCES curricula(id) ON DELETE CASCADE
        );

        CREATE TABLE IF NOT EXISTS diagnostic_questions_ai (
            id              INTEGER PRIMARY KEY AUTOINCREMENT,
            curriculum_id   INTEGER NOT NULL,
            concept_id      TEXT    NOT NULL,
            concept_name    TEXT    NOT NULL,
            source          TEXT    NOT NULL DEFAULT 'internal',
            question_text   TEXT    NOT NULL,
            question_type   TEXT    NOT NULL DEFAULT 'mcq',
            options_json    TEXT    DEFAULT '[]',
            correct_answer  TEXT    DEFAULT '',
            answer_hint     TEXT    DEFAULT '',
            difficulty      TEXT    DEFAULT 'medium',
            FOREIGN KEY (curriculum_id) REFERENCES curricula(id) ON DELETE CASCADE
        );
    """)

    # Clear any prior data for this curriculum
    conn.execute("DELETE FROM external_concepts WHERE curriculum_id = ?", (curriculum_id,))
    conn.execute("DELETE FROM diagnostic_questions_ai WHERE curriculum_id = ?", (curriculum_id,))

    print(f"[ExtGen] Generating {_INTERNAL_Q} internal AI questions ...")
    internal_qs = generate_internal_questions(book_title, concepts)
    for q in internal_qs:
        conn.execute("""
            INSERT INTO diagnostic_questions_ai
            (curriculum_id, concept_id, concept_name, source,
             question_text, question_type, options_json, correct_answer, answer_hint, difficulty)
            VALUES (?, ?, ?, 'internal', ?, ?, ?, ?, ?, ?)
        """, (
            curriculum_id, q["concept_id"], q["concept_name"],
            q["question_text"], q["question_type"],
            json.dumps(q.get("options", []), ensure_ascii=False),
            q["correct_answer"], q["answer_hint"], q["difficulty"],
        ))
    print(f"[ExtGen] ✓ {len(internal_qs)} internal questions stored")

    print(f"[ExtGen] Identifying {_EXTERNAL_Q} external concepts + questions ...")
    ext_concepts = generate_external_concepts(book_title, concepts)
    for ec in ext_concepts:
        q = ec["question"]
        conn.execute("""
            INSERT INTO external_concepts
            (curriculum_id, concept_id, name, description, relation_type, priority, insert_after, question_json)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        """, (
            curriculum_id, ec["concept_id"], ec["name"], ec["description"],
            ec["relation_type"], ec["priority"], ec["insert_after"],
            json.dumps(q, ensure_ascii=False),
        ))
        conn.execute("""
            INSERT INTO diagnostic_questions_ai
            (curriculum_id, concept_id, concept_name, source,
             question_text, question_type, options_json, correct_answer, answer_hint, difficulty)
            VALUES (?, ?, ?, 'external', ?, ?, ?, ?, ?, ?)
        """, (
            curriculum_id, ec["concept_id"], ec["name"],
            q["question_text"], q["question_type"],
            json.dumps(q.get("options", []), ensure_ascii=False),
            q["correct_answer"], q["answer_hint"], q["difficulty"],
        ))
    print(f"[ExtGen] ✓ {len(ext_concepts)} external concepts stored")

    conn.commit()
    conn.close()
    print(f"[ExtGen] DONE All diagnostic AI data stored for curriculum #{curriculum_id}")
