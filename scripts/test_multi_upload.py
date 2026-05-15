"""
APEX Multi-Upload Tester — Upload N PDFs and watch the pipeline in real-time.

Usage:
    python scripts/test_multi_upload.py
    python scripts/test_multi_upload.py --dir data/uploads --url http://localhost:8000
    python scripts/test_multi_upload.py --dir /path/to/pdfs --url http://localhost:8000
"""
import sys
import argparse
import time
import json
from pathlib import Path
from datetime import datetime

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
import src.encoding_fix  # noqa: F401

import requests
from rich.console import Console
from rich.live import Live
from rich.table import Table
from rich.panel import Panel
from rich.text import Text

console = Console()

PROJECT_ROOT = Path(__file__).resolve().parent.parent
DEFAULT_DIR = PROJECT_ROOT / "data" / "uploads"
DEFAULT_URL = "http://localhost:8000"

STATUS_COLORS = {
    "processing":     "yellow",
    "extracting_pdf": "cyan",
    "enriching":      "blue",
    "storing":        "magenta",
    "ready":          "green",
    "error":          "red",
    "pending":        "dim",
}

TERMINAL_STATES = {"ready", "error"}


def color_status(status: str) -> str:
    color = STATUS_COLORS.get(status, "white")
    return f"[{color}]{status}[/{color}]"


def upload_pdf(base_url: str, pdf_path: Path) -> dict:
    """Upload a single PDF. Returns {slug, curriculum_id, status} or {error}."""
    with open(pdf_path, "rb") as f:
        resp = requests.post(
            f"{base_url}/api/curricula/upload",
            files={"file": (pdf_path.name, f, "application/pdf")},
            data={"name": pdf_path.stem},
            timeout=30,
        )
    if resp.status_code == 200:
        return resp.json()
    return {"error": f"HTTP {resp.status_code}: {resp.text[:200]}"}


def poll_status(base_url: str, slug: str) -> dict:
    """Poll a single curriculum's status. Returns the row dict."""
    try:
        resp = requests.get(f"{base_url}/api/curricula/{slug}", timeout=10)
        if resp.status_code == 200:
            return resp.json()
        return {"status": "error", "error_message": f"HTTP {resp.status_code}"}
    except requests.RequestException as e:
        return {"status": "error", "error_message": str(e)[:100]}


def build_live_table(jobs: list[dict]) -> Table:
    t = Table(
        title="[bold cyan]APEX Pipeline Monitor[/bold cyan]",
        show_lines=True,
        expand=True,
    )
    t.add_column("#",           width=3,  justify="right")
    t.add_column("File",        min_width=20, overflow="fold")
    t.add_column("Slug",        min_width=20, overflow="fold")
    t.add_column("Status",      width=18)
    t.add_column("Concepts",    width=9,  justify="right")
    t.add_column("Sections",    width=9,  justify="right")
    t.add_column("Chapters",    width=9,  justify="right")
    t.add_column("Elapsed",     width=9,  justify="right")

    for i, job in enumerate(jobs, 1):
        status   = job.get("status", "pending")
        elapsed  = time.time() - job["started_at"]
        concepts = str(job.get("total_concepts", "—"))
        sections = str(job.get("total_sections", "—"))
        chapters = str(job.get("total_chapters", "—"))
        slug     = job.get("slug", "—")
        err      = job.get("error_message", "")

        if status == "error" and err:
            status_cell = f"[red]error[/red]\n[dim]{err[:40]}[/dim]"
        else:
            status_cell = color_status(status)

        t.add_row(
            str(i),
            job["filename"],
            slug,
            status_cell,
            concepts,
            sections,
            chapters,
            f"{elapsed:.0f}s",
        )

    return t


def main():
    parser = argparse.ArgumentParser(description="APEX Multi-Upload Tester")
    parser.add_argument("--dir", type=Path, default=DEFAULT_DIR, help="Directory containing PDFs")
    parser.add_argument("--url", type=str, default=DEFAULT_URL, help="API base URL")
    parser.add_argument("--poll", type=float, default=3.0, help="Poll interval in seconds")
    args = parser.parse_args()

    # ── Find PDFs ────────────────────────────────────────────────────────────
    pdf_files = sorted(args.dir.glob("*.pdf"))
    if not pdf_files:
        console.print(f"[yellow]No PDFs found in {args.dir}[/yellow]")
        console.print("Put PDF files there and retry.")
        return

    console.print(f"\n[bold]APEX Multi-Upload Tester[/bold]")
    console.print(f"  API:  [cyan]{args.url}[/cyan]")
    console.print(f"  Dir:  [cyan]{args.dir}[/cyan]")
    console.print(f"  PDFs: [yellow]{len(pdf_files)} file(s)[/yellow]\n")

    # ── Health check ─────────────────────────────────────────────────────────
    try:
        r = requests.get(f"{args.url}/api/health", timeout=5)
        r.raise_for_status()
    except Exception as e:
        console.print(f"[bold red]Cannot reach API at {args.url}[/bold red]: {e}")
        console.print("Start the server: [cyan]python -m uvicorn api.server:app --reload[/cyan]")
        return

    # ── Upload all PDFs ───────────────────────────────────────────────────────
    jobs: list[dict] = []

    console.print("[bold]Uploading files...[/bold]")
    for pdf in pdf_files:
        console.print(f"  ^ {pdf.name}", end=" ")
        result = upload_pdf(args.url, pdf)

        if "error" in result:
            console.print(f"[red]FAILED[/red] — {result['error']}")
            jobs.append({
                "filename":  pdf.name,
                "slug":      "—",
                "status":    "error",
                "error_message": result["error"],
                "started_at": time.time(),
                "total_concepts": 0,
                "total_sections": 0,
                "total_chapters": 0,
            })
        else:
            console.print(f"[green]OK[/green] slug=[cyan]{result['slug']}[/cyan]")
            jobs.append({
                "filename":      pdf.name,
                "slug":          result["slug"],
                "curriculum_id": result.get("curriculum_id"),
                "status":        "processing",
                "started_at":    time.time(),
                "total_concepts": 0,
                "total_sections": 0,
                "total_chapters": 0,
            })

    console.print()

    # Filter jobs that actually started
    active_jobs = [j for j in jobs if j["slug"] != "—"]
    if not active_jobs:
        console.print("[red]All uploads failed. Nothing to monitor.[/red]")
        return

    # ── Live monitoring ───────────────────────────────────────────────────────
    console.print("[bold]Monitoring pipeline... (Ctrl+C to stop)[/bold]\n")

    try:
        with Live(build_live_table(jobs), refresh_per_second=2, console=console) as live:
            while True:
                still_running = False

                for job in jobs:
                    if job["slug"] == "—":
                        continue
                    if job["status"] in TERMINAL_STATES:
                        continue

                    data = poll_status(args.url, job["slug"])
                    job["status"]         = data.get("status", job["status"])
                    job["total_concepts"] = data.get("total_concepts", 0) or 0
                    job["total_sections"] = data.get("total_sections", 0) or 0
                    job["total_chapters"] = data.get("total_chapters", 0) or 0
                    job["error_message"]  = data.get("error_message", "")

                    if job["status"] not in TERMINAL_STATES:
                        still_running = True

                live.update(build_live_table(jobs))

                if not still_running:
                    break

                time.sleep(args.poll)

    except KeyboardInterrupt:
        console.print("\n[yellow]Stopped by user.[/yellow]")

    # ── Final Summary ─────────────────────────────────────────────────────────
    ready  = [j for j in jobs if j["status"] == "ready"]
    errors = [j for j in jobs if j["status"] == "error"]
    total_concepts = sum(j.get("total_concepts", 0) for j in ready)

    console.print()
    console.print(Panel(
        f"[bold]Upload Complete[/bold]\n\n"
        f"  Total uploaded : [white]{len(pdf_files)}[/white]\n"
        f"  Ready          : [green]{len(ready)}[/green]\n"
        f"  Errors         : [red]{len(errors)}[/red]\n"
        f"  Total concepts : [cyan]{total_concepts:,}[/cyan]",
        title="Summary",
        border_style="green" if not errors else "yellow",
    ))

    if errors:
        console.print("\n[bold red]Failed uploads:[/bold red]")
        for j in errors:
            console.print(f"  • [red]{j['filename']}[/red]: {j.get('error_message', '')[:120]}")

    if ready:
        console.print("\n[bold green]Successful uploads:[/bold green]")
        for j in ready:
            elapsed = time.time() - j["started_at"]
            console.print(
                f"  • [green]{j['filename']}[/green] → "
                f"slug=[cyan]{j['slug']}[/cyan] "
                f"{j['total_concepts']} concepts, "
                f"{j['total_sections']} sections "
                f"({elapsed:.0f}s)"
            )

    console.print(f"\n[dim]Run [cyan]python scripts/db_monitor.py[/cyan] to inspect the database.[/dim]")


if __name__ == "__main__":
    main()
