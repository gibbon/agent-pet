#!/usr/bin/env python3
"""Batch-preprocess every sprite-rip in `sprites/` into cleaned PNG +
sprites.json under `sprites/processed/<slug>/`.

For each input:
  • Auto-detect background color from the four corner pixels.
  • Run the preprocessing pipeline (chroma-key + alpha segmentation).
  • Write to sprites/processed/<slug>/<slug>.png + .json + -preview.png.
  • Print a one-line summary.

Run from the repo root:
    python scripts/batch-preprocess.py
"""
import os
import re
import subprocess
import sys
from pathlib import Path

REPO = Path(__file__).resolve().parent.parent
SPRITES_DIR = REPO / "sprites"
OUT_DIR = SPRITES_DIR / "processed"
PREPROCESS = REPO / "scripts" / "preprocess-rip.py"


def slugify(name: str) -> str:
    """Filename → short kebab-case slug.

    The rips follow a "Platform - Game - Category - Character" pattern.
    Take the LAST component (character name), lowercase, replace non-word
    chars with hyphens, and strip leading/trailing hyphens. If the name
    looks generic (e.g. just "Sub-Zero") we prefix the game name to
    disambiguate."""
    stem = Path(name).stem
    # Detect duplicate character names by extracting platform + character.
    # Pattern: "Platform - Game - Category - Character"
    parts = [p.strip() for p in stem.split(" - ")]
    if len(parts) >= 4:
        char = parts[-1]
        platform = parts[0]
        # Disambiguate Sub-Zero variants by platform.
        if char.lower() in ("sub-zero", "guile", "raphael"):
            slug_src = f"{char}-{platform}"
        else:
            slug_src = char
    else:
        slug_src = stem
    s = re.sub(r"[^a-zA-Z0-9]+", "-", slug_src).strip("-").lower()
    return s


def auto_corner_bg(path: Path) -> str | None:
    """Sample the corners and return a hex color string. None if input
    already has alpha (no chroma key needed)."""
    try:
        from PIL import Image
    except ImportError:
        return None
    img = Image.open(path).convert("RGBA")
    a = img.split()[-1]
    opaque = sum(1 for v in a.tobytes() if v > 0)
    total = img.size[0] * img.size[1]
    # If under 90% of pixels are opaque, assume alpha is already correct.
    if opaque / total < 0.92:
        return None
    w, h = img.size
    from collections import Counter
    corners = [
        img.getpixel((0, 0))[:3],
        img.getpixel((w - 1, 0))[:3],
        img.getpixel((0, h - 1))[:3],
        img.getpixel((w - 1, h - 1))[:3],
    ]
    rgb = Counter(corners).most_common(1)[0][0]
    return "#{:02x}{:02x}{:02x}".format(*rgb)


def main() -> int:
    if not PREPROCESS.exists():
        print(f"missing {PREPROCESS}", file=sys.stderr)
        return 1
    OUT_DIR.mkdir(parents=True, exist_ok=True)

    inputs = sorted([p for p in SPRITES_DIR.iterdir()
                     if p.is_file() and p.suffix.lower() in (".png", ".gif", ".webp", ".jpg")])
    if not inputs:
        print("no sprite files found in sprites/")
        return 1

    rows = []
    for src in inputs:
        slug = slugify(src.name)
        out_dir = OUT_DIR / slug
        out_dir.mkdir(parents=True, exist_ok=True)
        out_stem = out_dir / slug
        bg_hex = auto_corner_bg(src)

        cmd = [sys.executable, str(PREPROCESS), str(src),
               "--out", str(out_stem),
               "--preview"]
        if bg_hex:
            cmd += ["--bg", bg_hex, "--tolerance", "10"]

        print(f"\n=== {src.name}")
        print(f"    slug={slug}  bg={bg_hex or 'none (alpha already)'}")
        try:
            r = subprocess.run(cmd, capture_output=True, text=True, timeout=120)
            if r.returncode != 0:
                print(r.stdout)
                print(r.stderr, file=sys.stderr)
                rows.append((slug, "FAILED", r.stderr.strip().split("\n")[-1][:60]))
                continue
            # Pull the sprite-count line out of stdout.
            n = "?"
            for line in r.stdout.splitlines():
                if line.startswith("segmented"):
                    n = line.split()[1]
            rows.append((slug, n, bg_hex or "(alpha)"))
            print(f"    → {out_dir} ({n} sprites)")
        except subprocess.TimeoutExpired:
            rows.append((slug, "TIMEOUT", ""))

    print("\n┌" + "─" * 60 + "┐")
    print(f"│ {'slug':<28}  {'sprites':>8}  {'bg':<18} │")
    print("├" + "─" * 60 + "┤")
    for slug, n, bg in rows:
        print(f"│ {slug:<28}  {n:>8}  {bg:<18} │")
    print("└" + "─" * 60 + "┘")
    return 0


if __name__ == "__main__":
    sys.exit(main())
