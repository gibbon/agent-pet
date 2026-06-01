#!/usr/bin/env python3
"""Stage every processed rip into a deploy directory + generate an
`index.json` so the rich editor can discover them at runtime.

Usage:
    python scripts/build-rips-deploy.py <deploy-dir>

For each subfolder in `sprites/processed/<slug>/`, copies <slug>.png and
<slug>.json into <deploy-dir>/rips/<slug>/. Also includes the original
Ryu rip at /ryu.png + /sprites.json under slug "ryu" so the picker has
a default entry. Writes <deploy-dir>/rips/index.json:

    [
      { "slug": "ryu", "name": "Ryu (SF2)", "image": "/rips/ryu/ryu.png",
        "sprites": "/rips/ryu/ryu.json", "count": 197 },
      { "slug": "wolverine", "name": "Wolverine (MvC)", ... },
      ...
    ]
"""
import json
import os
import shutil
import sys
from pathlib import Path

REPO = Path(__file__).resolve().parent.parent
PROCESSED = REPO / "sprites" / "processed"
RYU_PNG = REPO / "ryu.png"

# Hand-curated display names (so the picker reads naturally rather than
# `sub-zero-arcade`). Anything not listed falls back to title-cased slug.
DISPLAY_NAMES = {
    "ryu":               "Ryu (SF2)",
    "wolverine":         "Wolverine (MvC)",
    "sub-zero-arcade":   "Sub-Zero (MK Arcade)",
    "sub-zero-snes":     "Sub-Zero (MK SNES)",
    "guile-arcade":      "Guile (SF2 Arcade)",
    "guile-snes":        "Guile (SF2 SNES)",
    "raphael-arcade":    "Raphael (TMNT Arcade)",
    "raphael-snes":      "Raphael (TMNT SNES)",
    "cyclops":           "Cyclops (X-Men Arcade)",
    "sonic-the-hedgehog": "Sonic (Sonic Advance 3)",
    "donkey-kong":       "Donkey Kong (DKC)",
    "xxxg-01w-wing-gundam": "Wing Gundam (Gundam Wing SNES)",
    "fulgore":           "Fulgore (KI SNES)",
    "orchid":            "Orchid (KI SNES)",
    "mario":             "Mario (SMW)",
    "chun-li-snes":      "Chun-Li (SF2 SNES)",
    "ken":               "Ken (SF2 SNES)",
    "foot-soldier-orange": "Foot Soldier (TMNT SNES)",
}


def humanise(slug: str) -> str:
    return DISPLAY_NAMES.get(slug, slug.replace("-", " ").title())


def main() -> int:
    if len(sys.argv) != 2:
        print(__doc__.strip())
        return 1
    deploy_dir = Path(sys.argv[1])
    rips_dir = deploy_dir / "rips"
    rips_dir.mkdir(parents=True, exist_ok=True)

    entries = []

    # Ryu (the original) — copy from repo root if available; otherwise fall
    # back to the deploy's existing /ryu.png + /sprites.json.
    ryu_dir = rips_dir / "ryu"
    ryu_dir.mkdir(parents=True, exist_ok=True)
    ryu_dst_png = ryu_dir / "ryu.png"
    ryu_dst_json = ryu_dir / "ryu.json"
    if RYU_PNG.exists():
        shutil.copy2(RYU_PNG, ryu_dst_png)
    elif (deploy_dir / "ryu.png").exists():
        shutil.copy2(deploy_dir / "ryu.png", ryu_dst_png)
    src_json = REPO.parent / "tmp" / "ryu" / "sprites.json"
    if (deploy_dir / "sprites.json").exists():
        shutil.copy2(deploy_dir / "sprites.json", ryu_dst_json)
    elif src_json.exists():
        shutil.copy2(src_json, ryu_dst_json)
    if ryu_dst_png.exists() and ryu_dst_json.exists():
        with open(ryu_dst_json) as f:
            count = len(json.load(f))
        entries.append({
            "slug": "ryu",
            "name": humanise("ryu"),
            "image": "/rips/ryu/ryu.png",
            "sprites": "/rips/ryu/ryu.json",
            "count": count,
        })

    # Every processed rip.
    for src_dir in sorted(PROCESSED.iterdir()) if PROCESSED.exists() else []:
        if not src_dir.is_dir():
            continue
        slug = src_dir.name
        png = src_dir / f"{slug}.png"
        sprites_json = src_dir / f"{slug}.json"
        if not (png.exists() and sprites_json.exists()):
            continue
        out_dir = rips_dir / slug
        out_dir.mkdir(parents=True, exist_ok=True)
        shutil.copy2(png, out_dir / png.name)
        shutil.copy2(sprites_json, out_dir / sprites_json.name)
        with open(sprites_json) as f:
            count = len(json.load(f))
        entries.append({
            "slug": slug,
            "name": humanise(slug),
            "image": f"/rips/{slug}/{slug}.png",
            "sprites": f"/rips/{slug}/{slug}.json",
            "count": count,
        })

    # Sort by count descending — most-segmented rips first (proxy for
    # "most useful for animation").
    entries.sort(key=lambda e: -e["count"])

    index_path = rips_dir / "index.json"
    with open(index_path, "w") as f:
        json.dump(entries, f, indent=2)
    print(f"wrote {index_path}  ({len(entries)} rips)")
    for e in entries:
        print(f"  {e['slug']:<28}  {e['count']:>5}  {e['name']}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
