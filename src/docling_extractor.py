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

    Strategy (two-pass):
      Pass 1 — no OCR (fast, for digital PDFs)
      Pass 2 — OCR enabled (for scanned/image-only PDFs)
      Fallback — PyMuPDF direct text extraction

    Args:
        pdf_path: Absolute path to the PDF file.

    Returns:
        Clean Markdown string with headings, paragraphs, and tables.

    Raises:
        FileNotFoundError: If PDF doesn't exist.
        RuntimeError: If all extraction passes fail.
    """
    if not os.path.exists(pdf_path):
        raise FileNotFoundError(f"PDF not found: {pdf_path}")

    console.print(f"[bold cyan]Docling: Extracting from[/] {os.path.basename(pdf_path)}")

    try:
        from docling.backend.pypdfium2_backend import PyPdfiumDocumentBackend
        from docling.datamodel.base_models import InputFormat
        from docling.datamodel.pipeline_options import PdfPipelineOptions
        from docling.document_converter import DocumentConverter, PdfFormatOption
    except ImportError as e:
        raise RuntimeError(
            "Docling not installed. Run: pip install docling>=2.0.0"
        ) from e

    use_gpu = _check_gpu()
    accel = "GPU" if use_gpu else "CPU"

    def _run_docling(enable_ocr: bool) -> str:
        pipeline_options = PdfPipelineOptions()
        if hasattr(pipeline_options, "do_ocr"):
            pipeline_options.do_ocr = enable_ocr
        if hasattr(pipeline_options, "do_table_structure"):
            pipeline_options.do_table_structure = True
        if hasattr(pipeline_options, "accelerator_device"):
            pipeline_options.accelerator_device = "cuda" if use_gpu else "cpu"

        pdf_format_option = PdfFormatOption(
            pipeline_options=pipeline_options,
            backend=PyPdfiumDocumentBackend,
        )
        converter = DocumentConverter(
            format_options={InputFormat.PDF: pdf_format_option},
        )
        with warnings.catch_warnings():
            warnings.filterwarnings("ignore", category=UserWarning, module="pdfminer")
            warnings.filterwarnings("ignore", message=".*Cannot set gray.*")
            warnings.filterwarnings("ignore", message=".*invalid float.*")
            result = converter.convert(pdf_path)
        return _extract_content(result)

    # ── Pass 1: no OCR (fast path for digital PDFs) ───────────────
    console.print(f"[dim]   Pass 1: digital extraction ({accel}, no OCR)...[/]")
    try:
        content = _run_docling(enable_ocr=False)
    except Exception as e:
        console.print(f"[yellow]   Pass 1 failed: {str(e)[:80]}[/]")
        content = ""

    if content and len(content.strip()) >= 200:
        console.print(f"[green]Extracted {len(content):,} chars (digital)[/]")
        return content

    # ── Pass 2: OCR enabled (scanned/image PDFs) ─────────────────
    console.print(f"[yellow]   Pass 1 got {len(content.strip())} chars — retrying with OCR...[/]")
    try:
        content_ocr = _run_docling(enable_ocr=True)
        if content_ocr and len(content_ocr.strip()) >= 200:
            console.print(f"[green]Extracted {len(content_ocr):,} chars (OCR)[/]")
            return content_ocr
        # OCR got something but short — prefer it over nothing
        if content_ocr and len(content_ocr.strip()) > len(content.strip()):
            content = content_ocr
    except Exception as e:
        console.print(f"[yellow]   OCR pass failed: {str(e)[:80]}[/]")

    # ── Pass 3: PyMuPDF fallback (no Docling dependency) ─────────
    console.print("[yellow]   Trying PyMuPDF fallback...[/]")
    pymupdf_content = _extract_with_pymupdf(pdf_path)
    if pymupdf_content and len(pymupdf_content.strip()) >= 200:
        console.print(f"[green]Extracted {len(pymupdf_content):,} chars (PyMuPDF)[/]")
        return pymupdf_content

    # ── Give up — but return whatever we have rather than crashing ─
    best = max([content, pymupdf_content or ""], key=lambda s: len(s.strip()))
    if best and len(best.strip()) >= 50:
        console.print(f"[yellow]WARNING: Low-quality extraction ({len(best.strip())} chars) — proceeding[/]")
        return best

    raise RuntimeError(
        f"All extraction methods failed for '{os.path.basename(pdf_path)}'. "
        f"Best result: {len(best.strip())} chars. "
        "PDF may be heavily protected or corrupted."
    )


def _extract_with_pymupdf(pdf_path: str) -> str:
    """PyMuPDF (fitz) text extraction — last-resort fallback for scanned PDFs."""
    try:
        import fitz  # PyMuPDF
    except ImportError:
        console.print("[dim]   PyMuPDF (fitz) not installed — skipping fallback[/]")
        return ""

    try:
        doc = fitz.open(pdf_path)
        pages_text: list[str] = []
        for i, page in enumerate(doc):
            text = page.get_text("text")
            if text and text.strip():
                pages_text.append(f"## Page {i + 1}\n\n{text.strip()}")
        doc.close()
        return "\n\n".join(pages_text)
    except Exception as e:
        console.print(f"[dim]   PyMuPDF failed: {str(e)[:60]}[/]")
        return ""


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
