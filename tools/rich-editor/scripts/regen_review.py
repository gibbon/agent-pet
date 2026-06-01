#!/usr/bin/env python3
"""Regenerate the per-band review images with WidgetState labels matching test page buttons."""
import json
from PIL import Image, ImageDraw, ImageFont

SRC = "/home/gibbon/projects/agent-pet/ryu.png"
SPRITES_JSON = "/tmp/ryu/sprites.json"
OUT_DIR = "/tmp/ryu/review"

# Atlas row id → WidgetState name (what the test page buttons use)
ROW_TO_STATE = {
    "idle":          "idle",
    "running-right": "delegating",
    "running-left":  "leaving",
    "waving":        "greeting",
    "jumping":       "success",
    "failed":        "error",
    "waiting":       "waiting",
    "running":       "building",
    "review":        "thinking",
}

# Picks: (row_id, flip_h, [(band, idx), ...])
PICKS = [
    ("idle",          True,  [(0,0),(0,1),(0,2),(0,3),(0,2),(0,1)]),
    ("running-right", False, [(0,10),(0,11),(0,12),(0,13),(0,10),(0,11),(0,12),(0,13)]),
    ("running-left",  True,  [(0,10),(0,11),(0,12),(0,13),(0,10),(0,11),(0,12),(0,13)]),
    ("waving",        True,  [(1,18),(1,19),(1,20),(1,19)]),
    ("jumping",       True,  [(3,8),(3,9),(3,10),(3,9),(3,8)]),
    ("failed",        True,  [(6,8),(6,9),(6,10),(6,11),(6,12),(6,13),(6,14),(6,15)]),
    ("waiting",       True,  [(1,0),(1,1),(1,2),(1,3),(1,2),(1,1)]),
    ("running",       True,  [(2,0),(2,3),(2,4),(2,5),(2,6),(2,7)]),
    ("review",        True,  [(3,0),(3,1),(3,2),(3,3),(3,2),(3,1)]),
]

# Color per row (used for highlight + label colour)
ROW_COLORS = {
    "idle":          (255, 215,   0),  # gold
    "running-right": ( 64, 224, 208),  # turquoise
    "running-left":  ( 30, 144, 255),  # dodger blue
    "waving":        (255, 105, 180),  # hot pink
    "jumping":       (255, 165,   0),  # orange
    "failed":        (255,  69,   0),  # red-orange
    "waiting":       ( 50, 205,  50),  # lime
    "running":       (180, 100, 255),  # purple
    "review":        (218, 165,  32),  # goldenrod
}

SCALE = 3
PAD = 12
LABEL_H = 90  # extra room under each frame for two label lines

def load_sprites():
    with open(SPRITES_JSON) as f:
        sprites = json.load(f)
    by_idx = {(s["band"], s["idx"]): s for s in sprites}
    by_band = {}
    for s in sprites:
        by_band.setdefault(s["band"], []).append(s)
    for b in by_band:
        by_band[b].sort(key=lambda s: s["idx"])
    return by_idx, by_band

def build_pick_index():
    """Map (band, idx) → list of (row_id, cycle_pos)."""
    idx = {}
    for row_id, _flip, frames in PICKS:
        for pos, key in enumerate(frames):
            idx.setdefault(key, []).append((row_id, pos))
    return idx

def render_band(band, frames, pick_idx, src_img, out_path):
    font = ImageFont.load_default()
    try:
        big_font = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSansMono-Bold.ttf", 16)
        small_font = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSansMono.ttf", 12)
    except Exception:
        big_font = font
        small_font = font

    # Compute layout: each frame is its bbox, scaled by SCALE
    cells = []
    max_h = 0
    for s in frames:
        x0, y0, x1, y1 = s["bbox"]
        w = (x1 - x0) * SCALE
        h = (y1 - y0) * SCALE
        cells.append((s, w, h))
        max_h = max(max_h, h)

    total_w = PAD + sum(w + PAD for _, w, _ in cells)
    total_h = 30 + max_h + LABEL_H + PAD  # 30px header
    img = Image.new("RGBA", (total_w, total_h), (12, 12, 16, 255))
    draw = ImageDraw.Draw(img)
    draw.text((PAD, 6), f"BAND {band}  ({len(frames)} frames)", fill=(230,230,230), font=big_font)

    x = PAD
    for s, w, h in cells:
        x0, y0, x1, y1 = s["bbox"]
        crop = src_img.crop((x0, y0, x1, y1))
        crop = crop.resize((w, h), Image.NEAREST)
        y = 30 + (max_h - h)  # bottom-align frames
        img.paste(crop, (x, y), crop if crop.mode == "RGBA" else None)

        key = (s["band"], s["idx"])
        picks_for = pick_idx.get(key, [])

        # Highlight border if part of any pick
        if picks_for:
            row_id = picks_for[0][0]
            color = ROW_COLORS[row_id]
            # 2px border
            draw.rectangle([x-2, y-2, x+w+1, y+h+1], outline=color, width=2)

        # Frame number under
        label_y = 30 + max_h + 4
        draw.text((x, label_y), f"{s['band']}.{s['idx']}", fill=(200,200,200), font=small_font)

        # Pick labels: row_id and state name and cycle position
        for i, (row_id, pos) in enumerate(picks_for):
            color = ROW_COLORS[row_id]
            state = ROW_TO_STATE[row_id]
            line1 = f"{state}#{pos}"          # what the button is called
            line2 = f"({row_id})"              # what the row is called
            ly = label_y + 16 + i * 26
            draw.text((x, ly), line1, fill=color, font=small_font)
            draw.text((x, ly + 12), line2, fill=tuple(int(c*0.7) for c in color), font=small_font)

        x += w + PAD

    img.save(out_path)
    print(f"wrote {out_path}  ({total_w}x{total_h})")

def render_legend(out_path):
    try:
        big_font = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSansMono-Bold.ttf", 18)
        small_font = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSansMono.ttf", 14)
    except Exception:
        big_font = small_font = ImageFont.load_default()

    rows = list(ROW_TO_STATE.items())
    line_h = 28
    w = 700
    h = 50 + line_h * len(rows) + 20
    img = Image.new("RGBA", (w, h), (12, 12, 16, 255))
    draw = ImageDraw.Draw(img)
    draw.text((16, 12), "LEGEND  (test-page button → atlas row)", fill=(230,230,230), font=big_font)
    for i, (row_id, state) in enumerate(rows):
        y = 50 + i * line_h
        color = ROW_COLORS[row_id]
        draw.rectangle([16, y+4, 36, y+22], fill=color)
        draw.text((48, y+4), f"{state:<12} → {row_id}", fill=(230,230,230), font=small_font)
    img.save(out_path)
    print(f"wrote {out_path}  ({w}x{h})")

def main():
    src = Image.open(SRC).convert("RGBA")
    by_idx, by_band = load_sprites()
    pick_idx = build_pick_index()

    for band in sorted(by_band.keys()):
        out = f"{OUT_DIR}/band{band}.png"
        render_band(band, by_band[band], pick_idx, src, out)

    render_legend(f"{OUT_DIR}/legend.png")

if __name__ == "__main__":
    main()
