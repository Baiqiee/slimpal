# -*- coding: utf-8 -*-
"""Locate the pink label chips at each card's bottom-left corner, then crop above them.

Chip colour sampled from the sheet is about (214, 161, 170): a cool pink where blue
slightly exceeds green. Skin and blush are warm (green above blue), so that difference
separates them. Chips only ever sit in the lower-left corner, so the scan is limited
to that strip.
"""
import json
import os
from PIL import Image, ImageDraw

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, "source")
OUT = os.path.join(ROOT, "tools", "preview")
os.makedirs(OUT, exist_ok=True)

files = sorted(f for f in os.listdir(SRC) if f.lower().endswith(".png"))
img1 = Image.open(os.path.join(SRC, files[0])).convert("RGB")
px = img1.load()

REGIONS = [
    ("happy",   738, 518, 870, 672),
    ("shy",     876, 518, 1002, 672),
    ("serious", 738, 682, 870, 836),
    ("tired",   876, 682, 1002, 836),
    ("angry",   738, 846, 870, 1000),
    ("bashful", 876, 846, 1002, 1000),
]


def is_chip(r, g, b):
    return r > 190 and (r - g) > 35 and (b - g) > -6 and b < 215


print("chip scan (bottom-left strip, top-down):")
chip_top = {}
for name, x0, y0, x1, y1 in REGIONS:
    strip_x1 = min(x0 + 46, img1.width)
    top = None
    for y in range(y0, min(y1, img1.height)):
        hits = sum(1 for x in range(x0 + 4, strip_x1) if is_chip(*px[x, y]))
        if hits >= 20:
            top = y
            break
    chip_top[name] = top
    print(f"  {name:8s} chip_top={top}")

print("\nfinal crop boxes:")
CELLS = []
for name, x0, y0, x1, y1 in REGIONS:
    top = chip_top[name]
    bottom = (top - 4) if top is not None else (y0 + 126)
    bottom = min(bottom, y0 + 132)
    box = (x0 + 5, y0 + 6, x1 - 5, bottom)
    CELLS.append((name, box))
    print(f"  {name:8s} box={box}  size={box[2]-box[0]}x{box[3]-box[1]}")

Z = 3
tiles = []
for name, box in CELLS:
    c = img1.crop(box).resize(((box[2] - box[0]) * Z, (box[3] - box[1]) * Z), Image.LANCZOS)
    tiles.append((name, c))

pad, label_h = 12, 28
tw = max(t.width for _, t in tiles)
th = max(t.height for _, t in tiles)
sheet = Image.new("RGB", (pad + (tw + pad) * 3, pad + (th + pad + label_h) * 2), (32, 32, 36))
d = ImageDraw.Draw(sheet)
for i, (name, t) in enumerate(tiles):
    cx = pad + (i % 3) * (tw + pad)
    cy = pad + (i // 3) * (th + pad + label_h)
    sheet.paste(t, (cx, cy))
    d.text((cx + 4, cy + th + 6), name, fill=(255, 220, 160))
p = os.path.join(OUT, "sheet_expr3.png")
sheet.save(p)
print("\ncontact sheet ->", p, sheet.size)

with open(os.path.join(OUT, "expr_boxes.json"), "w", encoding="utf-8") as f:
    json.dump({n: list(b) for n, b in CELLS}, f, indent=2)
print("boxes ->", os.path.join(OUT, "expr_boxes.json"))
