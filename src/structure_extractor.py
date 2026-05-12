"""
Curriculum Parser — Structure Extractor (Component 2)
Uses Claude LLM to extract hierarchical curriculum structure from text chunks.
Outputs validated Pydantic models: Book → Chapter → Section → Concept → Question.
"""

import json
from langchain_anthropic import ChatAnthropic
from langchain_core.prompts import ChatPromptTemplate
from langchain_core.documents import Document
from rich.console import Console
from rich.progress import track

from src.config import settings
from src.models import Curriculum, Chapter, Section, Concept, Question

console = Console(force_terminal=True)

# ─── Extraction Prompt ───────────────────────────────────────────────────────

EXTRACTION_PROMPT = ChatPromptTemplate.from_messages([
    ("system", """You are an expert curriculum analyzer for educational textbooks.
Your job is to extract the hierarchical structure from textbook content.

RULES:
1. Extract ALL chapters, sections, concepts, and questions you can find.
2. For each concept, identify prerequisites (other concepts it depends on).
3. For questions, classify difficulty (easy/medium/hard) and type (mcq/calculation/proof/conceptual).
4. Keep descriptions concise but informative.
5. Use consistent ID formats: ch1, sec1_1, con1_1_1, q1_1_1_1.
6. Support both English and Arabic content — preserve original language.

OUTPUT FORMAT: Return ONLY valid JSON matching this schema:
{{
  "book_title": "...",
  "authors": ["..."],
  "edition": "...",
  "language": "en",
  "chapters": [
    {{
      "id": "ch1",
      "number": 1,
      "title": "...",
      "summary": "...",
      "sections": [
        {{
          "id": "sec1_1",
          "title": "...",
          "page_start": 0,
          "concepts": [
            {{
              "id": "con1_1_1",
              "name": "...",
              "description": "...",
              "prerequisites": [],
              "key_formulas": ["..."],
              "questions": [
                {{
                  "id": "q1_1_1_1",
                  "text": "...",
                  "difficulty": "medium",
                  "question_type": "calculation",
                  "answer_hint": "..."
                }}
              ]
            }}
          ]
        }}
      ]
    }}
  ]
}}"""),
    ("human", """Analyze the following textbook content and extract the curriculum structure.
If this is a continuation of a previous extraction, merge with existing data.

TEXTBOOK CONTENT:
{content}

Return ONLY the JSON — no markdown, no explanation."""),
])

# ─── Chapter-Level Prompt (for processing chunks per chapter) ────────────────

CHAPTER_PROMPT = ChatPromptTemplate.from_messages([
    ("system", """You are an expert curriculum analyzer. Extract the structure of ONE chapter from the given text.

RULES:
1. Extract all sections, concepts, and questions within this chapter.
2. Identify prerequisite relationships between concepts.
3. Classify question difficulty and type.
4. Use IDs relative to chapter number: sec{ch_num}_X, con{ch_num}_X_Y, q{ch_num}_X_Y_Z.

Return ONLY valid JSON for a single chapter object."""),
    ("human", """Chapter number: {chapter_num}

CONTENT:
{content}

Return JSON for this chapter only — no markdown wrapping."""),
])


def _get_llm() -> ChatAnthropic:
    """Initialize the Claude LLM."""
    return ChatAnthropic(
        model=settings.LLM_MODEL,
        anthropic_api_key=settings.ANTHROPIC_API_KEY,
        max_tokens=16384,
        temperature=0,
    )


def _clean_json_response(text: str) -> str:
    """Strip markdown code fences and whitespace from LLM JSON output."""
    text = text.strip()
    if text.startswith("```json"):
        text = text[7:]
    if text.startswith("```"):
        text = text[3:]
    if text.endswith("```"):
        text = text[:-3]
    return text.strip()


def extract_structure_from_chunks(chunks: list[Document]) -> Curriculum:
    """
    Send all chunks to Claude and extract the full curriculum structure.

    For large books, processes in batches and merges results.

    Args:
        chunks: List of Document chunks from pdf_reader.

    Returns:
        A validated Curriculum Pydantic model.
    """
    llm = _get_llm()
    console.print("[bold cyan]🧩 Extracting curriculum structure with Claude...[/]")

    # Combine chunks into manageable batches (respect context window)
    MAX_CHARS = 30_000  # Smaller batches = JSON fits within output token limit
    batches: list[str] = []
    current_batch = ""

    for chunk in chunks:
        if len(current_batch) + len(chunk.page_content) > MAX_CHARS:
            batches.append(current_batch)
            current_batch = chunk.page_content
        else:
            current_batch += "\n\n" + chunk.page_content

    if current_batch:
        batches.append(current_batch)

    console.print(f"[dim]Processing {len(batches)} batch(es)...[/]")

    all_chapters: list[Chapter] = []
    book_title = ""
    authors: list[str] = []

    for i, batch in enumerate(track(batches, description="Extracting...")):
        chain = EXTRACTION_PROMPT | llm
        response = chain.invoke({"content": batch})
        raw = _clean_json_response(response.content)

        try:
            data = json.loads(raw)
            curriculum = Curriculum(**data)

            if not book_title and curriculum.book_title:
                book_title = curriculum.book_title
                authors = curriculum.authors

            all_chapters.extend(curriculum.chapters)

        except (json.JSONDecodeError, Exception) as e:
            console.print(f"[red]⚠️ Batch {i+1} parse error: {e}[/]")
            console.print(f"[dim]Raw response (first 500 chars): {raw[:500]}[/]")
            continue

    # Merge into final curriculum
    result = Curriculum(
        book_title=book_title or "Unknown Textbook",
        authors=authors,
        language="mixed",
        chapters=_deduplicate_chapters(all_chapters),
    )

    console.print(f"\n[bold green]✅ Extraction complete![/]")
    console.print(f"   📕 Book: {result.book_title}")
    console.print(f"   📖 Chapters: {len(result.chapters)}")
    console.print(f"   💡 Concepts: {result.total_concepts}")
    console.print(f"   ❓ Questions: {result.total_questions}")

    return result


def _deduplicate_chapters(chapters: list[Chapter]) -> list[Chapter]:
    """Remove duplicate chapters (by number) keeping the most complete version."""
    seen: dict[int, Chapter] = {}
    for ch in chapters:
        if ch.number not in seen:
            seen[ch.number] = ch
        else:
            existing = seen[ch.number]
            # Keep the one with more content
            if len(ch.sections) > len(existing.sections):
                seen[ch.number] = ch
            else:
                # Merge sections
                existing_ids = {s.id for s in existing.sections}
                for sec in ch.sections:
                    if sec.id not in existing_ids:
                        existing.sections.append(sec)

    return sorted(seen.values(), key=lambda c: c.number)


def save_curriculum_json(curriculum: Curriculum, output_path: str = "data/curriculum.json"):
    """Save extracted curriculum to a JSON file."""
    import os
    os.makedirs(os.path.dirname(output_path), exist_ok=True)

    with open(output_path, "w", encoding="utf-8") as f:
        f.write(curriculum.model_dump_json(indent=2))

    console.print(f"[green]💾 Saved to {output_path}[/]")


if __name__ == "__main__":
    from src.pdf_reader import read_and_split

    chunks = read_and_split()
    curriculum = extract_structure_from_chunks(chunks)
    save_curriculum_json(curriculum)
