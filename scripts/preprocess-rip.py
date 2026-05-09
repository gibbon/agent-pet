#!/usr/bin/env python3
"""Preprocess a sprite-rip image into an alpha-cleaned PNG + sprites.json
suitable for the rich-editor's source-frame mode.

Pipeline:
  1. Load input image (PNG / WebP / JPG / GIF).
  2. If a chroma-key color is given (--bg / --auto-bg), convert pixels
     within `--tolerance` of that color to alpha 0. Skip if input already
     has a transparent background.
  3. Segment the alpha channel into individual sprites:
       - "bands" — horizontal strips separated by fully-transparent rows
       - within each band, split horizontally at fully-transparent columns
       - tight-bbox each resulting region
  4. Write:
       - <output>.png   (cleaned source image, RGBA)
       - <output>.json  (sprites array: [{band, idx, bbox: [x0,y0,x1,y1]}, ...])

Usage:
  python preprocess-rip.py <input> [--out <stem>] [--bg <color>]
                           [--auto-bg] [--tolerance N]
                           [--min-gap-h N] [--min-gap-v N]
                           [--min-sprite N] [--preview]

  Color formats: '#ff00ff', 'ff00ff', 'magenta', 'cyan', 'black', 'white'.
  --auto-bg samples the four corner pixels and picks the most common.

Examples:
  # Magenta-keyed Capcom-style rip
  python preprocess-rip.py ken.png --bg magenta

  # Auto-detect background from corners (works for solid bg rips)
  python preprocess-rip.py homelander.png --auto-bg

  # Already-transparent input — skip chroma keying, just segment
  python preprocess-rip.py ryu.png --out ryu

After running: drop the cleaned PNG and JSON next to the rich editor's
manifest, and reference them via manifest.sourceImage + manifest.sprites
(or load sprites.json from disk).
"""

import argparse
import json
import os
import sys
from collections import Counter

try:
    from PIL import Image
except ImportError:
    print("error: requires Pillow. install with: pip install Pillow", file=sys.stderr)
    sys.exit(1)


NAMED_COLORS = {
    "black":   (0, 0, 0),
    "white":   (255, 255, 255),
    "magenta": (255, 0, 255),
    "cyan":    (0, 255, 255),
    "green":   (0, 255, 0),
    "red":     (255, 0, 0),
    "blue":    (0, 0, 255),
    "yellow":  (255, 255, 0),
}


def parse_color(s: str) -> tuple[int, int, int]:
    s = s.strip().lower().lstrip("#")
    if s in NAMED_COLORS:
        return NAMED_COLORS[s]
    if len(s) == 6:
        return (int(s[0:2], 16), int(s[2:4], 16), int(s[4:6], 16))
    if len(s) == 3:
        return (int(s[0] * 2, 16), int(s[1] * 2, 16), int(s[2] * 2, 16))
    raise ValueError(f"unrecognised color: {s!r}")


def auto_detect_bg(img: Image.Image) -> tuple[int, int, int]:
    """Most common RGB color across the whole image — far more reliable
    than corner-sampling for rips with multi-tile backgrounds (two-tone
    panels, gradients, or character pixels at the corners). Sub-samples
    to keep runtime reasonable on big images."""
    w, h = img.size
    step = max(1, min(w, h) // 200)  # at most ~40k samples
    counts: Counter[tuple[int, int, int]] = Counter()
    for y in range(0, h, step):
        for x in range(0, w, step):
            p = img.getpixel((x, y))
            if isinstance(p, tuple):
                # Skip already-transparent pixels — they're not the bg we want to key.
                if len(p) >= 4 and p[3] == 0:
                    continue
                counts[p[:3]] += 1
            else:
                counts[(p, p, p)] += 1
    if not counts:
        return (0, 0, 0)
    return counts.most_common(1)[0][0]


def chroma_key(img: Image.Image, bgs: list[tuple[int, int, int]], tolerance: int) -> Image.Image:
    """Replace pixels within `tolerance` of any color in `bgs` with alpha=0.
    Multi-bg support handles rips with two-color tiled or gradient panels
    where a single chroma-key would only catch one of them."""
    img = img.convert("RGBA")
    px = img.load()
    w, h = img.size
    cleared = 0
    for y in range(h):
        for x in range(w):
            r, g, b, a = px[x, y]
            for br, bgg, bb in bgs:
                if (abs(r - br) <= tolerance and
                    abs(g - bgg) <= tolerance and
                    abs(b - bb) <= tolerance):
                    px[x, y] = (0, 0, 0, 0)
                    cleared += 1
                    break
    print(f"chroma-keyed {cleared:,} / {w*h:,} pixels ({100*cleared/(w*h):.1f}%) "
          f"using {len(bgs)} bg color{'s' if len(bgs) > 1 else ''}")
    return img


def alpha_mask(img: Image.Image) -> list[list[bool]]:
    """Return a 2D bool array where True = visible (alpha > 0)."""
    a = img.split()[-1]
    w, h = a.size
    data = a.tobytes()
    return [
        [data[y * w + x] > 0 for x in range(w)]
        for y in range(h)
    ]


def segment(img: Image.Image, min_gap_h: int, min_gap_v: int, min_sprite: int,
            noise_thresh: int = 0) -> list[dict]:
    """Find sprite bboxes via alpha-channel segmentation.

    Step 1: split into horizontal "bands" — runs of rows with more than
    `noise_thresh` visible pixels, separated by gaps of `min_gap_h`
    near-empty rows. (`noise_thresh > 0` lets us ignore stray pixels from
    grid lines, JPEG edge artifacts, or watermarks that would otherwise
    prevent any row from being fully empty.)

    Step 2: within each band, split into individual sprites — runs of
    columns with more than `noise_thresh` visible pixels, separated by
    `min_gap_v` near-empty columns.

    Step 3: tight-bbox each sprite (trim transparent rows/cols on its
    edges) and emit if it's bigger than `min_sprite` on either axis.
    """
    mask = alpha_mask(img)
    h = len(mask)
    w = len(mask[0]) if h else 0
    row_has = [sum(row) > noise_thresh for row in mask]

    # Step 1: bands (runs of non-empty rows)
    bands: list[tuple[int, int]] = []
    in_band = False
    band_start = 0
    empty_run = 0
    for y in range(h):
        if row_has[y]:
            if not in_band:
                in_band = True
                band_start = y
            empty_run = 0
        else:
            if in_band:
                empty_run += 1
                if empty_run >= min_gap_h:
                    bands.append((band_start, y - empty_run + 1))
                    in_band = False
                    empty_run = 0
    if in_band:
        bands.append((band_start, h))

    # Step 2 + 3: split each band into sprites by column gaps, then bbox
    sprites: list[dict] = []
    global_idx = 0
    for band_no, (y0_band, y1_band) in enumerate(bands):
        col_has = [
            sum(mask[y][x] for y in range(y0_band, y1_band)) > noise_thresh
            for x in range(w)
        ]
        col_runs: list[tuple[int, int]] = []
        in_run = False
        run_start = 0
        empty_run = 0
        for x in range(w):
            if col_has[x]:
                if not in_run:
                    in_run = True
                    run_start = x
                empty_run = 0
            else:
                if in_run:
                    empty_run += 1
                    if empty_run >= min_gap_v:
                        col_runs.append((run_start, x - empty_run + 1))
                        in_run = False
                        empty_run = 0
        if in_run:
            col_runs.append((run_start, w))

        for (x0_run, x1_run) in col_runs:
            # Tight-bbox: trim outer transparent rows/cols.
            x0, y0, x1, y1 = x0_run, y0_band, x1_run, y1_band
            while y0 < y1 and not any(mask[y0][x] for x in range(x0, x1)):
                y0 += 1
            while y1 > y0 and not any(mask[y1 - 1][x] for x in range(x0, x1)):
                y1 -= 1
            while x0 < x1 and not any(mask[y][x0] for y in range(y0, y1)):
                x0 += 1
            while x1 > x0 and not any(mask[y][x1 - 1] for y in range(y0, y1)):
                x1 -= 1
            if (x1 - x0) < min_sprite or (y1 - y0) < min_sprite:
                continue
            sprites.append({
                "band": band_no,
                "idx": global_idx,
                "bbox": [x0, y0, x1, y1],
            })
            global_idx += 1
    print(f"segmented {len(sprites)} sprites across {len(bands)} bands")
    return sprites


def write_preview(img: Image.Image, sprites: list[dict], path: str):
    """Annotated image: each sprite outlined in red with its index."""
    from PIL import ImageDraw
    preview = img.copy().convert("RGBA")
    overlay = Image.new("RGBA", preview.size, (0, 0, 0, 0))
    d = ImageDraw.Draw(overlay)
    for s in sprites:
        x0, y0, x1, y1 = s["bbox"]
        d.rectangle([x0, y0, x1 - 1, y1 - 1], outline=(231, 76, 60, 255), width=1)
        d.text((x0 + 1, y0 + 1), f"{s['band']}.{s['idx']}", fill=(255, 255, 0, 255))
    preview = Image.alpha_composite(preview, overlay)
    preview.save(path)
    print(f"wrote preview {path}")


def main():
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    p.add_argument("input", help="path to source image")
    p.add_argument("--out", help="output stem (default: <input> without extension)")
    p.add_argument("--bg", action="append", default=[],
                   help="background color to convert to alpha. Pass multiple times for multi-color bg "
                        "(e.g. --bg magenta --bg '#000070'). Each color uses --tolerance.")
    p.add_argument("--auto-bg", action="store_true",
                   help="auto-detect background color: most common color across the whole image")
    p.add_argument("--tolerance", type=int, default=8, help="chroma-key tolerance per channel (default 8)")
    p.add_argument("--min-gap-h", type=int, default=4, help="min empty rows between bands (default 4)")
    p.add_argument("--min-gap-v", type=int, default=3, help="min empty cols between sprites (default 3)")
    p.add_argument("--min-sprite", type=int, default=6, help="discard sprites smaller than NxN (default 6)")
    p.add_argument("--noise", type=int, default=0,
                   help="rows/cols with at most this many visible pixels count as empty for "
                        "gap detection. Tune up (4–20) for rips with grid lines or edge noise. (default 0)")
    p.add_argument("--preview", action="store_true", help="also write an annotated preview image")
    args = p.parse_args()

    if not os.path.exists(args.input):
        print(f"error: {args.input} not found", file=sys.stderr)
        sys.exit(1)

    img = Image.open(args.input).convert("RGBA")
    print(f"loaded {args.input}: {img.size[0]}x{img.size[1]} px")

    # Determine if we need chroma keying.
    bgs: list[tuple[int, int, int]] = []
    if args.bg:
        bgs = [parse_color(s) for s in args.bg]
    elif args.auto_bg:
        bgs = [auto_detect_bg(img)]
        print(f"auto-detected bg color: rgb{bgs[0]}")
    if bgs:
        img = chroma_key(img, bgs, args.tolerance)
    else:
        # No chroma key — assume input already has alpha. Sanity check.
        a = img.split()[-1]
        opaque = sum(1 for v in a.tobytes() if v > 0)
        total = img.size[0] * img.size[1]
        if opaque / total > 0.9:
            print("warning: input has no transparency and no --bg given. "
                  "Sprites will not segment cleanly — pass --bg or --auto-bg.")

    sprites = segment(img, args.min_gap_h, args.min_gap_v, args.min_sprite, args.noise)
    if not sprites:
        print("error: no sprites detected. Try lowering --min-sprite, "
              "adjusting --min-gap-*, or check the chroma-key color.", file=sys.stderr)
        sys.exit(2)

    stem = args.out or os.path.splitext(args.input)[0]
    png_path = f"{stem}.png"
    json_path = f"{stem}.json"
    img.save(png_path, "PNG")
    print(f"wrote cleaned image {png_path}  ({os.path.getsize(png_path)/1024:.1f} KB)")
    with open(json_path, "w") as f:
        json.dump(sprites, f, separators=(",", ":"))
    print(f"wrote sprites metadata {json_path}  ({os.path.getsize(json_path)/1024:.1f} KB)")

    if args.preview:
        write_preview(img, sprites, f"{stem}-preview.png")


if __name__ == "__main__":
    main()
