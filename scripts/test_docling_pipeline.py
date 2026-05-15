"""
APEX — Full Docling Pipeline Test
===================================
Tests the complete flow: PDF → Docling → AI Enricher → Curriculum JSON

Usage: python scripts/test_docling_pipeline.py [pdf_path]
"""

import os
import sys
import glob
import time

# Setup path
PROJECT_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if PROJECT_ROOT not in sys.path:
    sys.path.insert(0, PROJECT_ROOT)

# Fix Windows encoding
os.environ["PYTHONIOENCODING"] = "utf-8"
try:
    import src.encoding_fix  # noqa: F401
except ImportError:
    pass

from rich.console import Console
from rich.panel import Panel

console = Console(force_terminal=True)


def run_pipeline(pdf_path: str):
    """Run the full Docling pipeline on a single PDF."""

    console.print(Panel(
        "[bold cyan]APEX Docling Pipeline — Full Test[/]\n"
        f"[dim]PDF: {os.path.basename(pdf_path)}[/]",
        title="Pipeline Test",
        border_style="cyan",
    ))

    # ── Step 1: Docling → Markdown ────────────────────────────────
    console.print("\n[bold yellow]STEP 1/3: Docling PDF → Markdown[/]")
    t0 = time.time()

    from src.docling_extractor import extract_markdown
    markdown = extract_markdown(pdf_path)

    t1 = time.time()
    console.print(f"[green]   Done in {t1-t0:.1f}s — {len(markdown):,} chars[/]")

    # Save markdown for inspection
    os.makedirs("data", exist_ok=True)
    md_path = "data/test_markdown.md"
    with open(md_path, "w", encoding="utf-8") as f:
        f.write(markdown)
    console.print(f"[dim]   Saved to {md_path}[/]")

    # ── Step 2: AI Enricher → Curriculum JSON ─────────────────────
    console.print("\n[bold yellow]STEP 2/3: Claude AI → Curriculum JSON[/]")
    t2 = time.time()

    from src.ai_enricher import enrich_from_markdown
    curriculum = enrich_from_markdown(markdown, "data/test_curriculum.json")

    t3 = time.time()
    console.print(f"[green]   Done in {t3-t2:.1f}s[/]")

    # ── Step 3: Results ───────────────────────────────────────────
    console.print(f"\n[bold yellow]STEP 3/3: Results[/]")

    console.print(Panel(
        f"[bold]{curriculum.book_title}[/]\n"
        f"Authors: {', '.join(curriculum.authors) or 'N/A'}\n"
        f"Language: {curriculum.language}\n"
        f"Chapters: {len(curriculum.chapters)}\n"
        f"Sections: {sum(len(ch.sections) for ch in curriculum.chapters)}\n"
        f"Concepts: {curriculum.total_concepts}\n"
        f"Questions: {curriculum.total_questions}\n"
        f"\n[dim]Total time: {t3-t0:.1f}s[/]",
        title="Curriculum Extracted",
        border_style="green",
    ))

    # Show first few concepts
    if curriculum.chapters:
        console.print("\n[bold cyan]Sample Concepts:[/]")
        for ch in curriculum.chapters[:2]:
            for sec in ch.sections[:3]:
                for con in sec.concepts[:3]:
                    prereqs = ", ".join(con.prerequisites) if con.prerequisites else "none"
                    console.print(
                        f"   [cyan]{con.id}[/] {con.name} "
                        f"[dim](diff={con.difficulty_level}, prereqs={prereqs})[/]"
                    )
                    if con.questions:
                        for q in con.questions[:2]:
                            console.print(f"      [dim]Q: {q.text[:80]}[/]")

    return curriculum


if __name__ == "__main__":
    if len(sys.argv) > 1:
        pdf = sys.argv[1]
    else:
        # Auto-find a PDF
        pdfs = glob.glob("data/uploads/*.pdf")
        if not pdfs:
            console.print("[red]No PDFs found in data/uploads/[/]")
            sys.exit(1)
        # Pick the syllabus (English, smaller)
        pdf = next((p for p in pdfs if "syllabus" in p.lower()), pdfs[0])

    if not os.path.exists(pdf):
        console.print(f"[red]PDF not found: {pdf}[/]")
        sys.exit(1)

    run_pipeline(pdf)
