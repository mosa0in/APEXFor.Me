"""
APEX Curriculum Intelligence — Internal DevToolchain Setup
Integrates SocratiCode, Spec-Kit, and Understand-Anything as internal development tools.

These tools give APEX a competitive edge:
- SocratiCode: AI-powered code search + dependency analysis
- Spec-Kit: Specification-driven development workflow
- Understand-Anything: Visual code knowledge graph

For investors: "We don't just build software — we have our own intelligent dev infrastructure."
"""

import os
import json
import shutil
from rich.console import Console

console = Console(force_terminal=True)

# Paths to downloaded tool sources
TOOLS_DIR = r"C:\Users\MSI\Downloads\Compressed"
SOCRATICODE_SRC = os.path.join(TOOLS_DIR, "SocratiCode-main", "SocratiCode-main")
SPECKIT_SRC = os.path.join(TOOLS_DIR, "spec-kit-main", "spec-kit-main")
UNDERSTAND_SRC = os.path.join(TOOLS_DIR, "Understand-Anything-main", "Understand-Anything-main")


def setup_socraticode(project_root: str):
    """
    Integrate SocratiCode as an internal code intelligence engine.

    SocratiCode provides:
    - Semantic code search (hybrid BM25 + vector)
    - Dependency graph analysis
    - Impact analysis ("what breaks if I change X?")
    - MCP server for AI agent integration
    """
    console.print("\n[bold cyan]🔍 Setting up SocratiCode...[/]")

    # Create MCP config pointing to our project
    mcp_config = {
        "mcpServers": {
            "socraticode": {
                "command": "npx",
                "args": ["-y", "socraticode"],
                "env": {
                    "SOCRATICODE_PROJECT_ROOT": project_root
                }
            }
        }
    }

    mcp_path = os.path.join(project_root, ".mcp.json")
    with open(mcp_path, "w") as f:
        json.dump(mcp_config, f, indent=2)

    # Create socraticode ignore file
    ignore_content = """# SocratiCode Ignore
node_modules/
__pycache__/
*.pyc
.env
data/sinkt_data/
*.pkl
*.npz
neo4j-reference/
"""
    ignore_path = os.path.join(project_root, ".socraticodeignore")
    with open(ignore_path, "w") as f:
        f.write(ignore_content)

    console.print("[green]  ✅ .mcp.json created — SocratiCode ready via `npx socraticode`[/]")
    console.print("[dim]  Run: npx -y socraticode to start code intelligence[/]")


def setup_speckit(project_root: str):
    """
    Integrate Spec-Kit for specification-driven development.

    Creates:
    - AGENTS.md / CLAUDE.md — AI agent instructions
    - specs/ directory with project specifications
    """
    console.print("\n[bold cyan]📋 Setting up Spec-Kit...[/]")

    # Create AGENTS.md (used by Claude, Codex, etc.)
    agents_content = """# APEX Curriculum Intelligence — Agent Instructions

## Project Constitution
This is an educational AI platform that:
1. Parses curriculum PDFs into structured Knowledge Graphs
2. Uses SINKT (modified) for Knowledge Tracing
3. Provides RAG-based tutoring grounded in curriculum content
4. Integrates with APEX Diagnostic for student assessment

## Architecture
- `src/` — Core pipeline (PDF → Extract → Graph → Vectors → RAG)
- `sinkt/` — SINKT model (forked + modified for APEX)
- `toolchain/` — Internal development tools
- `scripts/` — CLI scripts for pipeline execution

## Key Principles
1. **Anti-Hallucination**: ALL LLM responses must be grounded in curriculum content
2. **Research-Grade**: Data structures must support academic paper requirements
3. **Bilingual**: Support both English and Arabic content
4. **Open Source**: SINKT modifications must be documented

## Technology Stack
- Python 3.14 + LangChain + Anthropic Claude
- Neo4j 5.26 (Knowledge Graph)
- Qdrant (Vector Database)
- PyTorch + PyG (SINKT model)
- SocratiCode (code intelligence)

## Coding Standards
- Type hints on all public functions
- Docstrings with Args/Returns
- Rich console output for user feedback
- Pydantic models for data validation
"""

    agents_path = os.path.join(project_root, "AGENTS.md")
    with open(agents_path, "w", encoding="utf-8") as f:
        f.write(agents_content)

    # Also create CLAUDE.md (same content, different filename for Claude Code)
    claude_path = os.path.join(project_root, "CLAUDE.md")
    shutil.copy2(agents_path, claude_path)

    # Create specs directory
    specs_dir = os.path.join(project_root, "toolchain", "speckit", "specs")
    os.makedirs(specs_dir, exist_ok=True)

    spec_content = """# Curriculum Parser — Specification

## Goal
Extract hierarchical structure from educational textbook PDFs and store
as a queryable Knowledge Graph with vector search capabilities.

## Input
- PDF textbook (e.g., Thomas Calculus)
- Student interaction data from APEX Diagnostic (CSV)

## Output
- Structured JSON (Book → Chapter → Section → Concept → Question)
- Neo4j Knowledge Graph with relationships
- Qdrant vector index for semantic search
- Fine-tuned SINKT model for Knowledge Tracing
- RAG engine for curriculum-grounded Q&A

## Success Criteria
1. Correctly extracts >80% of concepts from PDF
2. Knowledge Graph is queryable via Cypher
3. Semantic search returns relevant results (top-5 precision >70%)
4. RAG answers cite specific chapters/sections
5. SINKT achieves >0.7 AUC on knowledge prediction
"""

    spec_path = os.path.join(specs_dir, "curriculum_parser.md")
    with open(spec_path, "w", encoding="utf-8") as f:
        f.write(spec_content)

    console.print("[green]  ✅ AGENTS.md + CLAUDE.md + specs/ created[/]")


def setup_understand_anything(project_root: str):
    """
    Integrate Understand-Anything for visual code knowledge graph.

    Creates setup script and docs directory for generated visualizations.
    """
    console.print("\n[bold cyan]🗺️ Setting up Understand-Anything...[/]")

    docs_dir = os.path.join(project_root, "docs", "code_graph")
    os.makedirs(docs_dir, exist_ok=True)

    setup_script = """#!/usr/bin/env python3
\"\"\"
Generate Code Knowledge Graph using Understand-Anything.
Produces an interactive visualization of the project's architecture.

Usage:
    python toolchain/understand/generate.py
\"\"\"

import subprocess
import os

PROJECT_ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
OUTPUT_DIR = os.path.join(PROJECT_ROOT, "docs", "code_graph")

def generate():
    print("🗺️ Generating Code Knowledge Graph...")
    print(f"   Project: {PROJECT_ROOT}")
    print(f"   Output: {OUTPUT_DIR}")
    
    # Run Understand-Anything on the project
    # npx -y understand-anything --input <project> --output <dir>
    try:
        subprocess.run([
            "npx", "-y", "understand-anything",
            "--input", PROJECT_ROOT,
            "--output", OUTPUT_DIR,
        ], check=True)
        print("✅ Code Knowledge Graph generated!")
        print(f"   Open: {os.path.join(OUTPUT_DIR, 'index.html')}")
    except FileNotFoundError:
        print("⚠️ npx not found. Install Node.js first.")
    except subprocess.CalledProcessError as e:
        print(f"⚠️ Generation failed: {e}")
        print("   You can run manually: npx understand-anything")

if __name__ == "__main__":
    generate()
"""

    gen_dir = os.path.join(project_root, "toolchain", "understand")
    os.makedirs(gen_dir, exist_ok=True)

    gen_path = os.path.join(gen_dir, "generate.py")
    with open(gen_path, "w") as f:
        f.write(setup_script)

    console.print("[green]  ✅ Understand-Anything setup ready[/]")
    console.print("[dim]  Run: python toolchain/understand/generate.py[/]")


def setup_all(project_root: str | None = None):
    """Setup all three dev tools."""
    root = project_root or os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

    console.print("[bold magenta]═══════════════════════════════════════[/]")
    console.print("[bold magenta]  🔧 APEX Internal DevToolchain Setup[/]")
    console.print("[bold magenta]═══════════════════════════════════════[/]")

    setup_socraticode(root)
    setup_speckit(root)
    setup_understand_anything(root)

    console.print("\n[bold green]✅ All dev tools configured![/]")
    console.print("[dim]  SocratiCode: npx socraticode[/]")
    console.print("[dim]  Spec-Kit: see AGENTS.md + toolchain/speckit/specs/[/]")
    console.print("[dim]  Understand: python toolchain/understand/generate.py[/]")


if __name__ == "__main__":
    setup_all()
