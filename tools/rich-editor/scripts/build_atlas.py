#!/usr/bin/env python3
"""Build the Codex 8x9 atlas spritesheet for Ryu from sprites.json + ryu.png.

Picks use (band, local_idx_within_band). Sprites.json uses global idx,
so we convert local → global by indexing into the band's sprite list.
"""
import json
from PIL import Image

SRC = "/home/gibbon/projects/agent-pet/ryu.png"
SPRITES_JSON = "/tmp/ryu/sprites.json"
OUT_WEBP = "/tmp/ryu/spritesheet.webp"
OUT_PNG = "/tmp/ryu/spritesheet.png"

CELL_W, CELL_H = 192, 208
COLS, ROWS = 8, 9
SCALE = 2.5

# Each row: (atlas_row_index, flip_h, [(band, local_idx), ...])
PICKS = [
    # row 0 — idle
    (0, True,  [(0,0),(0,1),(0,2),(0,3),(0,2),(0,1)]),
    # row 1 — running-right ("walk →") — spinning kick 4.20..4.27 (8 frames)
    (1, False, [(4,20),(4,21),(4,22),(4,23),(4,24),(4,25),(4,26),(4,27)]),
    # row 2 — running-left ("walk ←") — spinning kick, mirrored
    (2, True,  [(4,20),(4,21),(4,22),(4,23),(4,24),(4,25),(4,26),(4,27)]),
    # row 3 — waving ("greeting → taunt")
    (3, True,  [(1,18),(1,19),(1,20),(1,19)]),
    # row 4 — jumping ("success → SHORYUKEN") — 4.13..4.19, then back to idle.0
    (4, True,  [(4,13),(4,14),(4,15),(4,16),(4,17),(4,18),(4,19),(0,0)]),
    # row 5 — failed ("error → knockdown")
    (5, True,  [(6,8),(6,9),(6,10),(6,11),(6,12),(6,13),(6,14),(6,15)]),
    # row 6 — waiting
    (6, True,  [(1,0),(1,1),(1,2),(1,3),(1,2),(1,1)]),
    # row 7 — running ("building → kick") — high kick 2.0, 2.3..2.8
    (7, True,  [(2,0),(2,3),(2,4),(2,5),(2,6),(2,7),(2,8)]),
    # row 8 — review ("thinking → hadouken") — drop empty-hands frame 5.4
    (8, True,  [(5,0),(5,1),(5,2),(5,3)]),
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
                print(f"WARN row {row_idx} has {len(frames)} frames, truncating to {COLS}")
                break
            band_sprites = by_band.get(band, [])
            if local_idx < 0 or local_idx >= len(band_sprites):
                print(f"WARN missing band={band} local={local_idx} (band has {len(band_sprites)} sprites)")
                continue
            sprite = band_sprites[local_idx]
            cropped = crop_sprite(src, sprite, flip_h)
            place_in_cell(atlas, cropped, col, row_idx)

    atlas.save(OUT_PNG, "PNG")
    atlas.save(OUT_WEBP, "WebP", lossless=False, quality=92, method=6)
    import os
    sz = os.path.getsize(OUT_WEBP)
    print(f"wrote {OUT_WEBP}  ({atlas.size[0]}x{atlas.size[1]}, {sz/1024:.1f} KB)")

if __name__ == "__main__":
    main()
