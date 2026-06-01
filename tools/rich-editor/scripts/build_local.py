#!/usr/bin/env python3
"""Build the LOCAL (non-Codex) Ryu spritesheet — reads /tmp/ryu/local/picks.json
when present (the editor's output) and falls back to baked-in PICKS otherwise.

Per-frame fields supported:
  band, idx           — source frame (band number, local index within band)
  ymax (optional)     — crop sprite height to first ymax rows (drops bottom-row
                        bleed when alpha-segmentation merged two adjacent rows)
  offsetX, offsetY    — pixel-offset from default bottom-centered placement,
                        in atlas cell-pixel coordinates (208 = full cell height).
                        Negative Y = up, positive Y = down. Authored visually
                        in /tmp/ryu/local/editor.html.
"""
import json
import os
from PIL import Image

SRC = "/home/gibbon/projects/agent-pet/ryu.png"
SPRITES_JSON = "/tmp/ryu/sprites.json"
OUT_DIR = "/tmp/ryu/local"
PICKS_JSON = os.path.join(OUT_DIR, "picks.json")
os.makedirs(OUT_DIR, exist_ok=True)
OUT_WEBP = os.path.join(OUT_DIR, "spritesheet.webp")
OUT_PNG = os.path.join(OUT_DIR, "spritesheet.png")

CELL_W, CELL_H = 192, 208
DEFAULT_COLS, DEFAULT_ROWS = 8, 11
SCALE = 2.5

# Fallback picks — used only if picks.json is missing. Format mirrors the
# editor's JSON output for round-tripping.
FALLBACK_PICKS = [
    # row 0 — idle (6)
    {"rowIndex": 0, "rowId": "idle", "flipH": True, "fps": 6, "frames":
     [{"band": 0, "idx": i, "ymax": None, "offsetX": 0, "offsetY": 0}
      for i in [0,1,2,3,2,1]]},
    {"rowIndex": 1, "rowId": "walk-right", "flipH": False, "fps": 8, "frames":
     [{"band": 0, "idx": i, "ymax": None, "offsetX": 0, "offsetY": 0} for i in [4,5,6,7,8,9]]},
    {"rowIndex": 2, "rowId": "walk-left", "flipH": True, "fps": 8, "frames":
     [{"band": 0, "idx": i, "ymax": None, "offsetX": 0, "offsetY": 0} for i in [4,5,6,7,8,9]]},
    {"rowIndex": 3, "rowId": "taunt", "flipH": True, "fps": 6, "frames":
     [{"band": 1, "idx": i, "ymax": None, "offsetX": 0, "offsetY": 0} for i in [18,19,20,19]]},
    {"rowIndex": 4, "rowId": "shoryuken", "flipH": True, "fps": 9, "frames":
     [{"band": 4, "idx": i, "ymax": None, "offsetX": 0, "offsetY": 0} for i in [13,14,15,16,17,18,19]]
     + [{"band": 0, "idx": 0, "ymax": None, "offsetX": 0, "offsetY": 0}]},
    {"rowIndex": 5, "rowId": "knockdown", "flipH": True, "fps": 7, "frames":
     [{"band": 6, "idx": i, "ymax": None, "offsetX": 0, "offsetY": 0} for i in [8,9,10,11,12,13,14,15]]},
    {"rowIndex": 6, "rowId": "wait", "flipH": True, "fps": 6, "frames":
     [{"band": 1, "idx": i, "ymax": None, "offsetX": 0, "offsetY": 0} for i in [0,1,2,3,2,1]]},
    {"rowIndex": 7, "rowId": "kick", "flipH": True, "fps": 8, "frames":
     [{"band": 2, "idx": i, "ymax": None, "offsetX": 0, "offsetY": 0} for i in [0,3,4,5,6,7,8]]},
    {"rowIndex": 8, "rowId": "hadouken", "flipH": True, "fps": 7, "frames":
     [{"band": 5, "idx": i, "ymax": None, "offsetX": 0, "offsetY": 0} for i in [0,1,2,3]]},
    {"rowIndex": 9, "rowId": "spinkick", "flipH": True, "fps": 12, "frames":
     [{"band": 4, "idx": i, "ymax": None, "offsetX": 0, "offsetY": 0} for i in [20,21,22,23,24,25,26,27]]},
    {"rowIndex": 10, "rowId": "fireball", "flipH": True, "fps": 12, "frames":
     [{"band": 5, "idx": 7, "ymax": 38, "offsetX": 0, "offsetY": 0},
      {"band": 5, "idx": 9, "ymax": 38, "offsetX": 0, "offsetY": 0},
      {"band": 5, "idx": 7, "ymax": 38, "offsetX": 0, "offsetY": 0},
      {"band": 5, "idx": 9, "ymax": 38, "offsetX": 0, "offsetY": 0}]},
]

def load_picks():
    if os.path.exists(PICKS_JSON):
        with open(PICKS_JSON) as f:
            print(f"reading {PICKS_JSON}")
            data = json.load(f)
        # Editor v2: top-level object with mode/cols/rows. Older format
        # was a flat array of row records — handle both.
        if isinstance(data, list):
            return {"mode": "codex", "cols": DEFAULT_COLS, "rows": data}
        return data
    print(f"no {PICKS_JSON} — using built-in fallback picks")
    return {"mode": "codex", "cols": DEFAULT_COLS, "rows": FALLBACK_PICKS}

def load_sprites_by_band():
    with open(SPRITES_JSON) as f:
        sprites = json.load(f)
    by_band = {}
    for s in sprites:
        by_band.setdefault(s["band"], []).append(s)
    for b in by_band:
        by_band[b].sort(key=lambda s: s["idx"])
    return by_band

def crop_sprite(src, sprite, flip_h, ymax=None):
    x0, y0, x1, y1 = sprite["bbox"]
    if ymax:
        y1 = min(y1, y0 + ymax)
    crop = src.crop((x0, y0, x1, y1))
    if flip_h:
        crop = crop.transpose(Image.FLIP_LEFT_RIGHT)
    return crop

def place_in_cell(atlas, sprite_img, col, row, offsetX=0, offsetY=0):
    cx0 = col * CELL_W
    cy0 = row * CELL_H
    sw, sh = sprite_img.size
    new_w = int(sw * SCALE)
    new_h = int(sh * SCALE)
    max_w = CELL_W - 8
    max_h = CELL_H - 8
    if new_w > max_w or new_h > max_h:
        s = min(max_w / sw, max_h / sh)
        new_w = max(1, int(sw * s))
        new_h = max(1, int(sh * s))
    scaled = sprite_img.resize((new_w, new_h), Image.NEAREST)
    px = cx0 + (CELL_W - new_w) // 2 + offsetX
    py = cy0 + CELL_H - new_h - 4 + offsetY
    atlas.paste(scaled, (px, py), scaled if scaled.mode == "RGBA" else None)

def main():
    src = Image.open(SRC).convert("RGBA")
    by_band = load_sprites_by_band()
    picks = load_picks()
    cols = int(picks.get("cols") or DEFAULT_COLS)
    row_records = picks["rows"]
    rows = max(DEFAULT_ROWS, max((r["rowIndex"] for r in row_records), default=0) + 1)
    print(f"mode={picks.get('mode', 'codex')} cols={cols} rows={rows}")
    atlas = Image.new("RGBA", (cols * CELL_W, rows * CELL_H), (0, 0, 0, 0))

    for row in row_records:
        row_idx = row["rowIndex"]
        row_flip_h = row.get("flipH", False)
        for col, frame in enumerate(row.get("frames", [])):
            if col >= cols:
                print(f"WARN row {row_idx} > {cols} frames")
                break
            # Multi-layer frames: composite each layer in order. Older
            # single-layer frames (no `layers` key) are wrapped inline.
            if "layers" in frame:
                layers = frame["layers"]
            else:
                layers = [{
                    "band": frame["band"], "idx": frame["idx"],
                    "ymax": frame.get("ymax"),
                    "offsetX": frame.get("offsetX") or 0,
                    "offsetY": frame.get("offsetY") or 0,
                    "flipH": None,
                }]
            for layer in layers:
                band = layer["band"]
                local_idx = layer["idx"]
                ymax = layer.get("ymax")
                ox = int(layer.get("offsetX") or 0)
                oy = int(layer.get("offsetY") or 0)
                # Per-layer flip wins; fall back to row default. None/missing
                # means "inherit" so explicit False is respected.
                lf = layer.get("flipH")
                flip_h = lf if lf is not None else row_flip_h
                band_sprites = by_band.get(band, [])
                if local_idx >= len(band_sprites):
                    print(f"WARN missing band={band} local={local_idx}")
                    continue
                sprite = band_sprites[local_idx]
                cropped = crop_sprite(src, sprite, flip_h, ymax=ymax)
                place_in_cell(atlas, cropped, col, row_idx, offsetX=ox, offsetY=oy)

    atlas.save(OUT_PNG, "PNG")
    atlas.save(OUT_WEBP, "WebP", lossless=False, quality=92, method=6)
    sz = os.path.getsize(OUT_WEBP)
    print(f"wrote {OUT_WEBP}  ({atlas.size[0]}x{atlas.size[1]}, {sz/1024:.1f} KB)")

if __name__ == "__main__":
    main()
