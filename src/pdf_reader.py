"""
Curriculum Parser — PDF Reader (Component 1)
Reads a PDF file and splits it into manageable chunks for LLM processing.
"""

from langchain_community.document_loaders import PyPDFLoader
from langchain_text_splitters import RecursiveCharacterTextSplitter
from langchain_core.documents import Document
import os
os.environ["PYTHONIOENCODING"] = "utf-8"
from rich.console import Console
from src.config import settings

console = Console(force_terminal=True)


def read_pdf(pdf_path: str | None = None) -> list[Document]:
    """
    Read a PDF file and return a list of Document objects (one per page).

    Args:
        pdf_path: Path to the PDF file. Falls back to settings.PDF_PATH.

    Returns:
        List of Document objects with page content and metadata.
    """
    path = pdf_path or settings.PDF_PATH
    if not path:
        raise ValueError("No PDF path provided. Set PDF_PATH in .env or pass it directly.")

    console.print(f"[bold cyan]📖 Reading PDF:[/] {path}")
    loader = PyPDFLoader(path)
    pages = loader.load()
    console.print(f"[green]✅ Loaded {len(pages)} pages[/]")
    return pages


def split_into_chunks(
    pages: list[Document],
    chunk_size: int | None = None,
    chunk_overlap: int | None = None,
) -> list[Document]:
    """
    Split pages into smaller chunks suitable for LLM context windows.

    Uses recursive splitting that respects paragraph and sentence boundaries.

    Args:
        pages: List of Document objects from read_pdf().
        chunk_size: Max characters per chunk (default from settings).
        chunk_overlap: Overlap between chunks (default from settings).

    Returns:
        List of smaller Document chunks.
    """
    size = chunk_size or settings.CHUNK_SIZE
    overlap = chunk_overlap or settings.CHUNK_OVERLAP

    splitter = RecursiveCharacterTextSplitter(
        chunk_size=size,
        chunk_overlap=overlap,
        separators=["\n\n", "\n", ". ", " ", ""],
        length_function=len,
    )

    chunks = splitter.split_documents(pages)
    console.print(f"[green]✅ Split into {len(chunks)} chunks[/] (size={size}, overlap={overlap})")
    return chunks


def read_and_split(pdf_path: str | None = None) -> list[Document]:
    """Convenience function: read PDF → split into chunks."""
    pages = read_pdf(pdf_path)
    chunks = split_into_chunks(pages)
    return chunks


if __name__ == "__main__":
    # Quick test
    chunks = read_and_split()
    for i, chunk in enumerate(chunks[:3]):
        console.print(f"\n[bold yellow]--- Chunk {i+1} ---[/]")
        console.print(chunk.page_content[:300] + "...")
        console.print(f"[dim]Metadata: {chunk.metadata}[/]")
