"""
APEX — AI Enricher (Layer 2)
=============================
Takes structured_raw.json (522 questions, 100% accurate from Python)
and enriches it with AI-generated:
  - Concept descriptions
  - Prerequisites
  - Difficulty classification
  - Bloom's taxonomy levels
  - Diagnostic question selection

Uses ~90% fewer tokens than full extraction because AI only DESCRIBES,
it doesn't search or count.
"""

import json
import time
from langchain_anthropic import ChatAnthropic
from langchain_core.prompts import ChatPromptTemplate
from rich.console import Console
from rich.progress import track

from src.config import settings
from src.models import Curriculum, Chapter, Section, Concept, Question

console = Console(force_terminal=True)

# ─── AI Prompt: Enrich concepts for ONE section ─────────────────────────
ENRICH_PROMPT = ChatPromptTemplate.from_messages([
    ("system", """You are a mathematics curriculum expert. You receive PRE-EXTRACTED data from a textbook section and your job is to ENRICH it with pedagogical metadata.

You do NOT need to find or count anything — that's already done. You ONLY need to:
1. Write a clear 1-2 sentence description for each concept
2. Set prerequisites (which concepts must be learned first)
3. Classify difficulty (0.0-1.0)
4. Select 2-3 diagnostic questions per concept from the exercise range

IMPORTANT: Use ONLY the information provided. Do not invent concepts or questions that aren't in the data."""),
    ("human", """Section: {section_title}
Section ID: {section_id}

DEFINITIONS found in this section:
{definitions}

BOLD TERMS found:
{bold_terms}

EXERCISE INFO:
- Total exercises: {exercise_count}
- Topic groups in exercises: {exercise_groups}

TASK: Create a concept list for this section. Group related bold terms into concepts.
For example, "domain" and "range" belong to ONE concept "Domain and Range".

Return ONLY valid JSON:
{{
  "concepts": [
    {{
      "id": "{section_id}_con1",
      "name": "Concept Name",
      "description": "1-2 sentence description",
      "prerequisites": ["id of prerequisite concept"],
      "key_formulas": ["formula if any"],
      "is_core": true,
      "difficulty_level": 0.5,
      "bold_terms_included": ["domain", "range"],
      "exercise_range": "1-12",
      "exercise_count": 12,
      "diagnostic_questions": [1, 5, 10]
    }}
  ]
}}

Rules:
- Group related bold terms into ONE concept (don't make 50 concepts for 50 terms)
- Aim for 5-10 concepts per section (not too granular, not too broad)
- Prerequisites reference concept IDs from earlier sections (e.g., sec1_1_con1)
- exercise_range should match topic groups from the exercises
- diagnostic_questions: pick 2-3 question NUMBERS that best test this concept"""),
])


def _get_llm(max_tokens: int = 4096):
    return ChatAnthropic(
        model=settings.LLM_MODEL,
        anthropic_api_key=settings.ANTHROPIC_API_KEY,
        max_tokens=max_tokens,
        temperature=0,
        timeout=120,  # 2 min max per call — avoids silent hangs
    )


def _clean_json(text: str) -> str:
    text = text.strip()
    if text.startswith("```json"):
        text = text[7:]
    if text.startswith("```"):
        text = text[3:]
    if text.endswith("```"):
        text = text[:-3]
    return text.strip()


def _repair_json(text: str) -> str:
    """Attempt to repair truncated JSON from Claude.
    
    When max_tokens cuts off a response, the JSON will be incomplete.
    This tries to close open brackets/braces to make it parseable.
    """
    text = text.rstrip()
    
    # Track open brackets
    open_braces = 0
    open_brackets = 0
    in_string = False
    escape_next = False
    
    for ch in text:
        if escape_next:
            escape_next = False
            continue
        if ch == '\\':
            escape_next = True
            continue
        if ch == '"':
            in_string = not in_string
            continue
        if in_string:
            continue
        if ch == '{':
            open_braces += 1
        elif ch == '}':
            open_braces -= 1
        elif ch == '[':
            open_brackets += 1
        elif ch == ']':
            open_brackets -= 1
    
    # If we're in a string, close it
    if in_string:
        text += '"'
    
    # Remove trailing comma or incomplete key-value
    text = text.rstrip()
    if text.endswith(','):
        text = text[:-1]
    # Remove incomplete key (e.g., '"key":' with no value)
    import re
    text = re.sub(r',?\s*"[^"]*":\s*$', '', text)
    
    # Close open brackets and braces
    text += ']' * max(0, open_brackets)
    text += '}' * max(0, open_braces)
    
    return text


def _invoke_with_retry(chain, params, retries=3):
    for attempt in range(retries):
        try:
            response = chain.invoke(params)
            content = response.content if hasattr(response, 'content') else str(response)
            cleaned = _clean_json(content)
            # Try parsing as-is first
            try:
                json.loads(cleaned)
                return cleaned
            except json.JSONDecodeError:
                # Try repairing truncated JSON
                repaired = _repair_json(cleaned)
                try:
                    json.loads(repaired)
                    console.print("[yellow]   ⚠️ JSON was truncated — auto-repaired[/]")
                    return repaired
                except json.JSONDecodeError:
                    if attempt < retries - 1:
                        console.print(f"[yellow]   ⚠️ JSON repair failed, retrying...")
                        time.sleep(2 ** attempt * 3)
                        continue
                    # Last resort: return repaired anyway, let caller handle
                    return repaired
        except Exception as e:
            if attempt < retries - 1:
                wait = 2 ** attempt * 5
                console.print(f"[yellow]⚠️ Retry {attempt+1}: {str(e)[:60]}[/]")
                time.sleep(wait)
            else:
                raise


def enrich(raw_path: str = "data/structured_raw.json",
           output_path: str = "data/curriculum.json") -> Curriculum:
    """
    Enrich structured_raw.json with AI-generated pedagogical metadata.
    """
    console.print(f"\n[bold yellow]{'='*60}[/]")
    console.print(f"[bold yellow]  APEX AI Enricher — Layer 2[/]")
    console.print(f"[bold yellow]{'='*60}[/]")

    # Load raw data
    with open(raw_path, "r", encoding="utf-8") as f:
        raw = json.load(f)

    console.print(f"[dim]Loaded: {raw['total_questions']} questions, {len(raw['sections'])} sections[/]")

    llm = _get_llm()
    chain = ENRICH_PROMPT | llm

    all_sections: list[Section] = []

    # Process each section
    for i, sec_raw in enumerate(track(raw["sections"], description="Enriching sections")):
        sec_id = sec_raw["id"]
        sec_title = sec_raw["full_title"]

        # Get concept data for this section
        concept_data = None
        for c in raw.get("concepts_by_section", []):
            if c["section_id"] == sec_id:
                concept_data = c
                break

        if not concept_data:
            console.print(f"[yellow]⚠️ No concept data for {sec_id}[/]")
            continue

        # Get exercise data
        exercises = sec_raw.get("exercises", [])
        ex_count = sum(e.get("highest_number", 0) for e in exercises)
        ex_groups = []
        for e in exercises:
            for g in e.get("groups", []):
                ex_groups.append(f"{g['topic']}: Q{g['range']}")

        # Format definitions
        defs_text = "\n".join(
            f"- {d['name']}: {d.get('raw_text', '')[:150]}"
            for d in concept_data.get("definitions", [])
        ) or "None found"

        # Format bold terms
        bold_text = ", ".join(concept_data.get("bold_terms", [])[:30]) or "None"

        # Call AI — ONLY for descriptions + prerequisites
        try:
            raw_response = _invoke_with_retry(chain, {
                "section_title": sec_title,
                "section_id": sec_id,
                "definitions": defs_text,
                "bold_terms": bold_text,
                "exercise_count": ex_count,
                "exercise_groups": "\n".join(ex_groups[:10]) or "No groups detected",
            })

            enriched = json.loads(raw_response)
        except Exception as e:
            console.print(f"[red]⚠️ {sec_title}: AI failed ({str(e)[:50]})[/]")
            # Fallback: create basic concepts from definitions + bold terms
            enriched = {"concepts": _fallback_concepts(sec_id, concept_data)}

        # Build Section model
        concepts = []
        for con in enriched.get("concepts", []):
            # Create diagnostic questions from the numbers
            diag_nums = con.get("diagnostic_questions", [])
            questions = [
                Question(
                    id=f"{con['id']}_q{n}",
                    text=f"Exercise {n}",  # Placeholder — real text in structured_raw
                    difficulty="medium",
                    is_diagnostic=True,
                    bloom_level=con.get("bloom_level", 3),
                )
                for n in diag_nums[:3]
            ]

            concepts.append(Concept(
                id=con.get("id", ""),
                name=con.get("name", ""),
                description=con.get("description", ""),
                prerequisites=con.get("prerequisites", []),
                key_formulas=con.get("key_formulas", []),
                is_core=con.get("is_core", True),
                difficulty_level=con.get("difficulty_level", 0.5),
                questions=questions,
                exercise_count=con.get("exercise_count", 0),
                exercise_range=con.get("exercise_range", ""),
            ))

        section = Section(
            id=sec_id,
            title=sec_title,
            page_start=sec_raw.get("start_page", 0),
            concepts=concepts,
            total_exercises=ex_count,
        )
        all_sections.append(section)
        console.print(f"   ✅ {sec_title}: {len(concepts)} concepts")

    # ─── Add review/practice blocks ──────────────────────────────────
    for eb in raw.get("exercise_blocks", []):
        if eb["block_type"] != "section":
            review_sec = Section(
                id=f"sec_{eb['block_type']}",
                title=eb["label"],
                total_exercises=eb.get("highest_number", 0),
                concepts=[],
            )
            all_sections.append(review_sec)
            console.print(f"   📝 {eb['label']}: {eb.get('highest_number', 0)} questions")

    # ─── Build curriculum ────────────────────────────────────────────
    curriculum = Curriculum(
        book_title=raw.get("book_title", "Thomas' Calculus"),
        authors=["George B. Thomas Jr."],
        language="en",
        chapters=[Chapter(
            id="ch1",
            number=1,
            title="Functions",
            summary="Chapter 1 covers functions, their graphs, transformations, trigonometric functions, exponential functions, and inverse functions with logarithms.",
            sections=all_sections,
        )],
    )

    # Save
    import os
    os.makedirs(os.path.dirname(output_path), exist_ok=True)
    with open(output_path, "w", encoding="utf-8") as f:
        f.write(curriculum.model_dump_json(indent=2))

    console.print(f"\n[green]💾 Saved enriched curriculum to {output_path}[/]")
    console.print(f"   📕 {curriculum.book_title}")
    console.print(f"   💡 Concepts: {curriculum.total_concepts}")
    console.print(f"   ❓ Questions (total): {curriculum.total_questions}")

    return curriculum


def _fallback_concepts(sec_id: str, concept_data: dict) -> list[dict]:
    """Create basic concepts when AI fails (from definitions + bold terms)."""
    # Parse sec_id to regenerate in CON_ch_sec_nn format if possible
    # sec_id may be old-format (sec1_1) or new-format (SEC_01_01)
    concepts = []
    for i, d in enumerate(concept_data.get("definitions", [])):
        concepts.append({
            "id": f"{sec_id}_CON_{i+1:02d}",
            "name": d["name"][:60],
            "description": d.get("raw_text", "")[:200],
            "prerequisites": [],
            "key_formulas": [],
            "is_core": True,
            "difficulty_level": 0.5,
            "exercise_range": "",
            "exercise_count": 0,
            "diagnostic_questions": [],
        })
    return concepts


# ═══════════════════════════════════════════════════════════════════════════
# NEW: Markdown-based enrichment (Docling pipeline)
# ═══════════════════════════════════════════════════════════════════════════

MARKDOWN_ENRICH_PROMPT = ChatPromptTemplate.from_messages([
    ("system", """You are a curriculum analysis expert. You receive Markdown content extracted from an academic textbook PDF.

Your job is to analyze the content and extract the FULL curriculum structure.

RULES:
1. Detect the book language (en/ar/mixed) from the content
2. Extract ALL chapters, sections, concepts, and exercises you find
3. Group related terms into meaningful concepts (5-10 per section)
4. Set difficulty_level based on concept complexity (0.0-1.0)
5. Identify prerequisites between concepts (earlier concepts first)
6. Pick 2-3 diagnostic questions per concept from exercises
7. If content is NOT a valid textbook/curriculum, return empty chapters
8. For each question, set question_type: "mcq" (with options), "true_false" (yes/no), "text_input" (open-ended/calculation). Only provide "options" array for mcq type.

Return ONLY valid JSON — no explanation, no markdown fences."""),
    ("human", """Analyze this textbook content and extract the curriculum structure.

<MARKDOWN_CONTENT>
{markdown_chunk}
</MARKDOWN_CONTENT>

ID FORMAT RULES (critical — follow exactly):
- Chapter   : CH_{nn}              e.g. CH_01, CH_02
- Section   : SEC_{ch}_{nn}        e.g. SEC_01_01, SEC_01_02
- Concept   : CON_{ch}_{sec}_{nn}  e.g. CON_01_01_01, CON_01_01_02
- Question  : Q_{ch}_{sec}_{con}_{nnn}  e.g. Q_01_01_01_001
Each ID encodes its full path — no JOIN needed.
Prerequisites must reference existing CON_... IDs from the same curriculum.

Return this exact JSON structure:
{{
  "book_title": "Title of the textbook",
  "authors": ["Author Name"],
  "language": "en",
  "chapters": [
    {{
      "id": "CH_01",
      "number": 1,
      "title": "Chapter Title",
      "summary": "Brief chapter summary",
      "sections": [
        {{
          "id": "SEC_01_01",
          "title": "Section 1.1 Title",
          "page_start": 0,
          "total_exercises": 20,
          "concepts": [
            {{
              "id": "CON_01_01_01",
              "name": "Concept Name",
              "description": "Clear 1-2 sentence description",
              "prerequisites": [],
              "key_formulas": ["formula if any"],
              "is_core": true,
              "difficulty_level": 0.4,
              "exercise_count": 10,
              "exercise_range": "1-10",
              "diagnostic_questions": [
                {{
                  "id": "Q_01_01_01_001",
                  "text": "Question text from exercises",
                  "question_type": "mcq",
                  "difficulty": "medium",
                  "correct_answer": "answer if visible",
                  "options": ["A) ...", "B) ...", "C) ...", "D) ..."]
                }}
              ]
            }},
            {{
              "id": "CON_01_01_02",
              "name": "Second Concept",
              "description": "Description",
              "prerequisites": ["CON_01_01_01"],
              "key_formulas": [],
              "is_core": true,
              "difficulty_level": 0.6,
              "exercise_count": 8,
              "exercise_range": "11-18",
              "diagnostic_questions": []
            }}
          ]
        }}
      ]
    }}
  ]
}}"""),
])


def _chunk_markdown(markdown: str, max_chars: int = 40000) -> list[str]:
    """Split large Markdown into chunks that fit in LLM context window.

    Splits on chapter/section boundaries when possible.
    """
    if len(markdown) <= max_chars:
        return [markdown]

    chunks = []
    lines = markdown.split("\n")
    current_chunk: list[str] = []
    current_size = 0

    for line in lines:
        line_len = len(line) + 1
        # Split at chapter/section headers if chunk is getting large
        is_header = line.startswith("# ") or line.startswith("## ")
        if is_header and current_size > max_chars * 0.5:
            chunks.append("\n".join(current_chunk))
            current_chunk = []
            current_size = 0

        current_chunk.append(line)
        current_size += line_len

        if current_size >= max_chars:
            chunks.append("\n".join(current_chunk))
            current_chunk = []
            current_size = 0

    if current_chunk:
        chunks.append("\n".join(current_chunk))

    return chunks


def enrich_from_markdown(
    markdown: str,
    output_path: str = "data/curriculum.json",
    status_callback=None,
) -> Curriculum:
    """
    Enrich curriculum directly from Markdown content (Docling output).

    This replaces the old enrich() flow that needed structured_raw.json.
    Now Claude analyzes clean Markdown and extracts everything in one pass.

    Args:
        markdown: Clean Markdown string from Docling.
        output_path: Where to save the resulting curriculum JSON.

    Returns:
        Curriculum model with all chapters, sections, concepts, and questions.
    """
    console.print(f"\n[bold yellow]{'='*60}[/]")
    console.print(f"[bold yellow]  APEX AI Enricher — Markdown Mode (Docling)[/]")
    console.print(f"[bold yellow]{'='*60}[/]")
    console.print(f"[dim]Markdown size: {len(markdown):,} characters[/]")

    llm = _get_llm(max_tokens=16384)
    chain = MARKDOWN_ENRICH_PROMPT | llm

    # Split into chunks if too large for context window
    chunks = _chunk_markdown(markdown)
    console.print(f"[dim]Processing {len(chunks)} chunk(s)...[/]")

    all_chapters: list[Chapter] = []
    book_title = ""
    authors: list[str] = []
    language = "en"

    for i, chunk in enumerate(chunks):
        console.print(f"[cyan]🔄 Processing chunk {i+1}/{len(chunks)} ({len(chunk):,} chars)...[/]")
        if status_callback:
            status_callback(f"enriching ({i+1}/{len(chunks)} chunks)")

        try:
            raw_response = _invoke_with_retry(chain, {"markdown_chunk": chunk})
            parsed = json.loads(raw_response)
        except Exception as e:
            console.print(f"[red]❌ Chunk {i+1} failed: {str(e)[:80]}[/]")
            continue

        # Extract metadata from first successful chunk
        if not book_title:
            book_title = parsed.get("book_title", "Unknown Textbook")
            authors = parsed.get("authors", [])
            language = parsed.get("language", "en")

        # Build Chapter/Section/Concept models from parsed JSON
        for ch_data in parsed.get("chapters", []):
            sections = []
            for sec_data in ch_data.get("sections", []):
                concepts = []
                for con_data in sec_data.get("concepts", []):
                    # Build questions from diagnostic_questions
                    questions = []
                    for q_data in con_data.get("diagnostic_questions", []):
                        if isinstance(q_data, dict):
                            con_id = con_data.get("id", "")
                            questions.append(Question(
                                id=q_data.get("id", f"{con_id}_Q_{len(questions)+1:03d}"),
                                text=q_data.get("text", ""),
                                difficulty=q_data.get("difficulty", "medium"),
                                correct_answer=q_data.get("correct_answer", ""),
                                options=q_data.get("options") or [],
                                concept_id=con_data.get("id", ""),
                                is_diagnostic=True,
                                bloom_level=q_data.get("bloom_level", 3),
                            ))
                        elif isinstance(q_data, (int, str)):
                            questions.append(Question(
                                id=f"{con_data.get('id', '')}_q{q_data}",
                                text=f"Exercise {q_data}",
                                difficulty="medium",
                                is_diagnostic=True,
                            ))

                    concepts.append(Concept(
                        id=con_data.get("id", ""),
                        name=con_data.get("name", ""),
                        description=con_data.get("description", ""),
                        prerequisites=con_data.get("prerequisites", []),
                        key_formulas=con_data.get("key_formulas", []),
                        is_core=con_data.get("is_core", True),
                        difficulty_level=con_data.get("difficulty_level", 0.5),
                        questions=questions,
                        exercise_count=con_data.get("exercise_count", 0),
                        exercise_range=con_data.get("exercise_range", ""),
                    ))

                sections.append(Section(
                    id=sec_data.get("id", ""),
                    title=sec_data.get("title", ""),
                    page_start=sec_data.get("page_start", 0),
                    concepts=concepts,
                    total_exercises=sec_data.get("total_exercises", 0),
                ))

            # Merge or add chapter
            ch_id = ch_data.get("id", f"CH_{len(all_chapters)+1:02d}")
            existing = next((c for c in all_chapters if c.id == ch_id), None)
            if existing:
                existing.sections.extend(sections)
            else:
                all_chapters.append(Chapter(
                    id=ch_id,
                    number=ch_data.get("number", len(all_chapters) + 1),
                    title=ch_data.get("title", ""),
                    summary=ch_data.get("summary", ""),
                    sections=sections,
                ))

        console.print(f"   ✅ Chunk {i+1}: {sum(len(s.get('concepts', [])) for ch in parsed.get('chapters', []) for s in ch.get('sections', []))} concepts")

    # ── Build final curriculum ────────────────────────────────────
    curriculum = Curriculum(
        book_title=book_title,
        authors=authors,
        language=language,
        chapters=all_chapters,
    )

    # Save
    import os
    os.makedirs(os.path.dirname(output_path) if os.path.dirname(output_path) else "data", exist_ok=True)
    with open(output_path, "w", encoding="utf-8") as f:
        f.write(curriculum.model_dump_json(indent=2))

    console.print(f"\n[green]💾 Saved enriched curriculum to {output_path}[/]")
    console.print(f"   📕 {curriculum.book_title}")
    console.print(f"   📚 Chapters: {len(curriculum.chapters)}")
    console.print(f"   💡 Concepts: {curriculum.total_concepts}")
    console.print(f"   ❓ Questions: {curriculum.total_questions}")

    return curriculum


if __name__ == "__main__":
    enrich()
