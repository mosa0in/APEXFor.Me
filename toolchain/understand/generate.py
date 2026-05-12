#!/usr/bin/env python3
"""
Generate Code Knowledge Graph using Understand-Anything.
Produces an interactive visualization of the project's architecture.

Usage:
    python toolchain/understand/generate.py
"""

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
