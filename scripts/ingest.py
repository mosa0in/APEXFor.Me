"""
APEX Curriculum Intelligence — Full Ingestion Pipeline
Runs the complete pipeline: PDF → Extract → Neo4j Graph → Qdrant Vectors → SINKT Data → Ready

Usage:
    python -m scripts.ingest --pdf "path/to/book.pdf"
    python -m scripts.ingest --pdf "path/to/book.pdf" --skip-graph
    python -m scripts.ingest --json data/curriculum.json
"""

import argparse
import json
import os
import sys
import time

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from rich.console import Console
from rich.panel import Panel

from src.pdf_reader import read_and_split
from src.structure_extractor import extract_structure_from_chunks, save_curriculum_json
from src.models import Curriculum

console = Console(force_terminal=True)


def run_pipeline(
    pdf_path: str | None = None,
    skip_graph: bool = False,
    skip_vectors: bool = False,
    skip_sinkt: bool = False,
    output_dir: str = "data",
):
    """
    Execute the full APEX curriculum intelligence pipeline.

    Steps:
    1. Read PDF and split into chunks
    2. Extract curriculum structure with Claude
    3. Save structure as JSON
    4. Build Knowledge Graph in Neo4j
    5. Index vectors in Qdrant
    6. Generate SINKT training data
    """
    start_time = time.time()

    console.print(Panel(
        "[bold white]APEX Curriculum Intelligence — Full Pipeline[/]\n"
        "[dim]PDF -> Extract -> Neo4j -> Qdrant -> SINKT -> Ready![/]",
        border_style="cyan",
    ))

    # ── Step 1: Read PDF ──────────────────────────────────────────────────
    console.print("\n[bold]=== Step 1/6: Reading PDF ===[/]")
    chunks = read_and_split(pdf_path)

    # ── Step 2: Extract Structure ─────────────────────────────────────────
    console.print("\n[bold]=== Step 2/6: Extracting Structure (Claude) ===[/]")
    curriculum = extract_structure_from_chunks(chunks)

    # ── Step 3: Save JSON ─────────────────────────────────────────────────
    console.print("\n[bold]=== Step 3/6: Saving JSON ===[/]")
    json_path = os.path.join(output_dir, "curriculum.json")
    save_curriculum_json(curriculum, json_path)

    # ── Step 4: Neo4j Knowledge Graph ─────────────────────────────────────
    if not skip_graph:
        console.print("\n[bold]=== Step 4/6: Building Knowledge Graph (Neo4j) ===[/]")
        try:
            from src.graph_builder import KnowledgeGraphBuilder
            builder = KnowledgeGraphBuilder()
            builder.build_full_graph(curriculum)
            builder.close()
        except Exception as e:
            console.print(f"[red]Neo4j error: {e}[/]")
            console.print("[yellow]  Is Neo4j running? docker-compose up -d[/]")
    else:
        console.print("\n[bold]=== Step 4/6: Skipping Neo4j ===[/]")

    # ── Step 5: Qdrant Vector Index ───────────────────────────────────────
    if not skip_vectors:
        console.print("\n[bold]=== Step 5/6: Indexing Vectors (Qdrant) ===[/]")
        try:
            from src.qdrant_store import CurriculumVectorStore
            store = CurriculumVectorStore()
            store.index_curriculum(curriculum)
            stats = store.get_stats()
            console.print(f"[green]  Vectors: {stats['total_vectors']} | Dims: {stats['vector_size']}[/]")
        except Exception as e:
            console.print(f"[red]Qdrant error: {e}[/]")
            console.print("[yellow]  Is Qdrant running? docker-compose up -d[/]")
    else:
        console.print("\n[bold]=== Step 5/6: Skipping Qdrant ===[/]")

    # ── Step 6: SINKT Training Data ───────────────────────────────────────
    if not skip_sinkt:
        console.print("\n[bold]=== Step 6/6: Generating SINKT Data ===[/]")
        try:
            from sinkt.adapters.curriculum_adapter import CurriculumToSINKT
            adapter = CurriculumToSINKT(json_path, os.path.join(output_dir, "sinkt_data"))
            adapter.generate_all(n_students=500)
        except Exception as e:
            console.print(f"[red]SINKT data error: {e}[/]")
    else:
        console.print("\n[bold]=== Step 6/6: Skipping SINKT ===[/]")

    # ── Summary ───────────────────────────────────────────────────────────
    elapsed = time.time() - start_time
    console.print(Panel(
        f"[bold green]Pipeline Complete![/]\n\n"
        f"Book: {curriculum.book_title}\n"
        f"Chapters: {len(curriculum.chapters)}\n"
        f"Concepts: {curriculum.total_concepts}\n"
        f"Questions: {curriculum.total_questions}\n"
        f"Time: {elapsed:.1f}s\n\n"
        f"JSON: {json_path}\n"
        f"{'Neo4j: OK' if not skip_graph else 'Neo4j: Skipped'}\n"
        f"{'Qdrant: OK' if not skip_vectors else 'Qdrant: Skipped'}\n"
        f"{'SINKT: OK' if not skip_sinkt else 'SINKT: Skipped'}",
        title="Summary",
        border_style="green",
    ))


def run_from_json(json_path: str, **kwargs):
    """Build graph + vectors from existing JSON."""
    console.print(f"[cyan]Loading from {json_path}...[/]")
    with open(json_path, "r", encoding="utf-8") as f:
        curriculum = Curriculum(**json.load(f))

    console.print(f"[green]Loaded: {curriculum.book_title} ({curriculum.total_concepts} concepts)[/]")

    if not kwargs.get("skip_graph"):
        from src.graph_builder import KnowledgeGraphBuilder
        builder = KnowledgeGraphBuilder()
        builder.build_full_graph(curriculum)
        builder.close()

    if not kwargs.get("skip_vectors"):
        from src.qdrant_store import CurriculumVectorStore
        store = CurriculumVectorStore()
        store.index_curriculum(curriculum)

    if not kwargs.get("skip_sinkt"):
        from sinkt.adapters.curriculum_adapter import CurriculumToSINKT
        adapter = CurriculumToSINKT(json_path)
        adapter.generate_all()


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="APEX Curriculum Intelligence — Ingestion")
    parser.add_argument("--pdf", type=str, help="Path to PDF file")
    parser.add_argument("--json", type=str, help="Load from existing JSON")
    parser.add_argument("--skip-graph", action="store_true", help="Skip Neo4j")
    parser.add_argument("--skip-vectors", action="store_true", help="Skip Qdrant")
    parser.add_argument("--skip-sinkt", action="store_true", help="Skip SINKT data")
    parser.add_argument("--output", type=str, default="data", help="Output directory")

    args = parser.parse_args()

    if args.json:
        run_from_json(args.json, skip_graph=args.skip_graph,
                      skip_vectors=args.skip_vectors, skip_sinkt=args.skip_sinkt)
    else:
        run_pipeline(
            pdf_path=args.pdf,
            skip_graph=args.skip_graph,
            skip_vectors=args.skip_vectors,
            skip_sinkt=args.skip_sinkt,
            output_dir=args.output,
        )
