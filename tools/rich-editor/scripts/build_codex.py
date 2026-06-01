#!/usr/bin/env python3
"""Build a Codex-default-compliant 8x9 atlas for upload to codex-pets.net.

Same picks as build_atlas.py where possible, trimmed/padded to match the
canonical Codex frame counts so consumers using `data-codex-pet="ryu"` get
correct loops without overriding the atlas layout.
"""
import json
import os
from PIL import Image

SRC = "/home/gibbon/projects/agent-pet/ryu.png"
SPRITES_JSON = "/tmp/ryu/sprites.json"
OUT_DIR = "/tmp/ryu/dist-codex"
os.makedirs(OUT_DIR, exist_ok=True)
OUT_WEBP = os.path.join(OUT_DIR, "spritesheet.webp")
OUT_PNG = os.path.join(OUT_DIR, "spritesheet.png")
OUT_THUMB = os.path.join(OUT_DIR, "thumbnail.webp")

CELL_W, CELL_H = 192, 208
COLS, ROWS = 8, 9
SCALE = 2.5

# Codex defaults: idle=6, running-right=8, running-left=8, waving=4, jumping=5,
# failed=8, waiting=6, running=6, review=6.
PICKS = [
    # row 0 — idle (6)
    (0, True,  [(0,0),(0,1),(0,2),(0,3),(0,2),(0,1)]),
    # row 1 — running-right (8) — spinning kick
    (1, False, [(4,20),(4,21),(4,22),(4,23),(4,24),(4,25),(4,26),(4,27)]),
    # row 2 — running-left (8) — spinning kick mirrored
    (2, True,  [(4,20),(4,21),(4,22),(4,23),(4,24),(4,25),(4,26),(4,27)]),
    # row 3 — waving (4) — taunt
    (3, True,  [(1,18),(1,19),(1,20),(1,19)]),
    # row 4 — jumping (5) — SHORYUKEN: charge, windup, peak, descend, stance
    (4, True,  [(4,13),(4,15),(4,17),(4,18),(0,0)]),
    # row 5 — failed (8) — knockdown
    (5, True,  [(6,8),(6,9),(6,10),(6,11),(6,12),(6,13),(6,14),(6,15)]),
    # row 6 — waiting (6)
    (6, True,  [(1,0),(1,1),(1,2),(1,3),(1,2),(1,1)]),
    # row 7 — running (6) — high kick (drop 2.0 stance)
    (7, True,  [(2,3),(2,4),(2,5),(2,6),(2,7),(2,8)]),
    # row 8 — review (6) — hadouken: drop empty-hands 5.4, ping-pong back to stance
    (8, True,  [(5,0),(5,1),(5,2),(5,3),(5,2),(5,1)]),
]

def load_sprites_by_band():
    with open(SPRITES_JSON) as f:
        sprites = json.load(f)
    by_band = {}
    for s in sprites:
        by_band.setdefault(s["band"], []).append(s)
    for b in by_band:
        by_band[b].sort(key=lambda s: s["idx"])
    return by_band

def crop_sprite(src, sprite, flip_h):
    x0, y0, x1, y1 = sprite["bbox"]
    crop = src.crop((x0, y0, x1, y1))
    if flip_h:
        crop = crop.transpose(Image.FLIP_LEFT_RIGHT)
    return crop

def place_in_cell(atlas, sprite_img, col, row):
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
    px = cx0 + (CELL_W - new_w) // 2
    py = cy0 + CELL_H - new_h - 4
    atlas.paste(scaled, (px, py), scaled if scaled.mode == "RGBA" else None)

def main():
    src = Image.open(SRC).convert("RGBA")
    by_band = load_sprites_by_band()
    atlas = Image.new("RGBA", (COLS * CELL_W, ROWS * CELL_H), (0, 0, 0, 0))

    for row_idx, flip_h, frames in PICKS:
        for col, (band, local_idx) in enumerate(frames):
            if col >= COLS:
                print(f"WARN row {row_idx} > {COLS} frames")
                break
            band_sprites = by_band.get(band, [])
            if local_idx >= len(band_sprites):
                print(f"WARN missing band={band} local={local_idx}")
                continue
            sprite = band_sprites[local_idx]
            cropped = crop_sprite(src, sprite, flip_h)
            place_in_cell(atlas, cropped, col, row_idx)

    atlas.save(OUT_PNG, "PNG")
    atlas.save(OUT_WEBP, "WebP", lossless=False, quality=92, method=6)
    sz = os.path.getsize(OUT_WEBP)
    print(f"wrote {OUT_WEBP}  ({atlas.size[0]}x{atlas.size[1]}, {sz/1024:.1f} KB)")

    # Thumbnail: first idle cell, 256x256, fits codex-pets.net listing.
    thumb_cell = atlas.crop((0, 0, CELL_W, CELL_H))
    thumb = Image.new("RGBA", (256, 256), (0, 0, 0, 0))
    sw, sh = thumb_cell.size
    s = min(248 / sw, 248 / sh)
    new_w, new_h = max(1, int(sw * s)), max(1, int(sh * s))
    thumb_cell = thumb_cell.resize((new_w, new_h), Image.NEAREST)
    thumb.paste(thumb_cell, ((256 - new_w) // 2, (256 - new_h) // 2), thumb_cell)
    thumb.save(OUT_THUMB, "WebP", lossless=False, quality=90, method=6)
    print(f"wrote {OUT_THUMB}  ({os.path.getsize(OUT_THUMB)/1024:.1f} KB)")

if __name__ == "__main__":
    main()
