"""
APEX — Docling PDF Extractor
==============================
Replaces the broken PDFAnalyzer + structure_extractor pipeline with
Docling's proven PDF → Markdown converter.

Docling (IBM) is free, local, and produces clean Markdown with:
  - Proper headings hierarchy
  - Table preservation (no OCR needed)
  - Bilingual support (Arabic + English)
  - Optional GPU acceleration
"""

import logging
import os
import warnings
from typing import Any

from rich.console import Console

console = Console(force_terminal=True)
logger = logging.getLogger(__name__)


def extract_markdown(pdf_path: str) -> str:
    """
    Extract clean Markdown from a PDF file using Docling.

    This is the core extraction function that replaces:
      - pdf_reader.py (PyMuPDF raw text)
      - pdf_analyzer.py (500+ lines of fragile parsing)
      - structure_extractor.py (559 lines of regex)

    Args:
        pdf_path: Absolute path to the PDF file.

    Returns:
        Clean Markdown string with headings, paragraphs, and tables.

    Raises:
        FileNotFoundError: If PDF doesn't exist.
        RuntimeError: If Docling fails to process.
    """
    if not os.path.exists(pdf_path):
        raise FileNotFoundError(f"PDF not found: {pdf_path}")

    console.print(f"[bold cyan]📄 Docling: Extracting from[/] {os.path.basename(pdf_path)}")

    try:
        from docling.backend.pypdfium2_backend import PyPdfiumDocumentBackend
        from docling.datamodel.base_models import InputFormat
        from docling.datamodel.pipeline_options import PdfPipelineOptions
        from docling.document_converter import DocumentConverter, PdfFormatOption
    except ImportError as e:
        raise RuntimeError(
            "Docling not installed. Run: pip install docling>=2.0.0"
        ) from e

    # ── Configure pipeline ────────────────────────────────────────
    pipeline_options = PdfPipelineOptions()

    # Disable OCR (not needed for digital textbooks)
    if hasattr(pipeline_options, "do_ocr"):
        pipeline_options.do_ocr = False

    # Enable table structure detection
    if hasattr(pipeline_options, "do_table_structure"):
        pipeline_options.do_table_structure = True

    # GPU acceleration (auto-detect)
    use_gpu = _check_gpu()
    if hasattr(pipeline_options, "accelerator_device"):
        pipeline_options.accelerator_device = "cuda" if use_gpu else "cpu"

    # ── Create converter ──────────────────────────────────────────
    pdf_format_option = PdfFormatOption(
        pipeline_options=pipeline_options,
        backend=PyPdfiumDocumentBackend,
    )

    converter = DocumentConverter(
        format_options={InputFormat.PDF: pdf_format_option},
    )

    accel = "GPU" if use_gpu else "CPU"
    console.print(f"[dim]   Acceleration: {accel}[/]")

    # ── Convert PDF → Markdown ────────────────────────────────────
    with warnings.catch_warnings():
        warnings.filterwarnings("ignore", category=UserWarning, module="pdfminer")
        warnings.filterwarnings("ignore", message=".*Cannot set gray.*")
        warnings.filterwarnings("ignore", message=".*invalid float.*")

        try:
            result = converter.convert(pdf_path)
        except Exception as e:
            raise RuntimeError(f"Docling conversion failed: {e}") from e

    # ── Extract Markdown content ──────────────────────────────────
    content = _extract_content(result)

    if not content or len(content.strip()) < 100:
        raise RuntimeError(
            f"Docling extracted too little content ({len(content or '')} chars). "
            "PDF may be scanned/image-only."
        )

    console.print(f"[green]✅ Extracted {len(content):,} characters of Markdown[/]")
    return content


def _extract_content(result: Any) -> str:
    """Extract Markdown from Docling result (version-safe)."""
    if not hasattr(result, "document") or not result.document:
        raise RuntimeError("Docling returned no document object")

    doc = result.document

    # Try export methods in order of preference
    for method_name in ("export_to_markdown", "to_markdown"):
        method = getattr(doc, method_name, None)
        if method and callable(method):
            content = method()
            if content:
                logger.info("Used %s() — %d chars", method_name, len(content))
                return content

    # Fallback: text property or string conversion
    if hasattr(doc, "text") and doc.text:
        return doc.text

    return str(doc)


def _check_gpu() -> bool:
    """Check if CUDA GPU is available."""
    try:
        import torch
        if torch.cuda.is_available():
            gpu_name = torch.cuda.get_device_name(0)
            console.print(f"[dim]   GPU detected: {gpu_name}[/]")
            return True
    except ImportError:
        pass
    except Exception:
        pass
    return False


if __name__ == "__main__":
    import sys
    if len(sys.argv) < 2:
        print("Usage: python -m src.docling_extractor <pdf_path>")
        sys.exit(1)

    md = extract_markdown(sys.argv[1])
    print(f"\n{'='*60}")
    print(f"Extracted {len(md):,} characters")
    print(f"{'='*60}")
    print(md[:2000])
    print("...")
