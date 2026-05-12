"""
Curriculum Parser — Test Query Script
Quick way to test the RAG system after ingestion.

Usage:
    python -m scripts.test_query "What is a derivative?"
    python -m scripts.test_query --interactive
"""

import argparse
import os
import sys

from rich.console import Console

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from src.embeddings import load_existing_vector_store
from src.rag_engine import create_rag_chain, ask, interactive_mode

console = Console()


def main():
    parser = argparse.ArgumentParser(description="Test the Curriculum RAG System")
    parser.add_argument("question", nargs="?", help="Question to ask")
    parser.add_argument("--interactive", "-i", action="store_true", help="Start interactive mode")
    parser.add_argument("--top-k", type=int, default=5, help="Number of retrieved chunks")

    args = parser.parse_args()

    # Load vector store and create RAG chain
    console.print("[cyan]Loading vector store...[/]")
    vectorstore = load_existing_vector_store()
    chain = create_rag_chain(vectorstore, top_k=args.top_k)

    if args.interactive:
        interactive_mode(chain)
    elif args.question:
        result = ask(chain, args.question)
    else:
        # Default test questions
        test_questions = [
            "What is a limit in calculus?",
            "Explain the chain rule for derivatives.",
            "How do you calculate the area under a curve?",
        ]
        console.print("[bold]Running default test questions...\n[/]")
        for q in test_questions:
            ask(chain, q)
            print("\n" + "─" * 60 + "\n")


if __name__ == "__main__":
    main()
