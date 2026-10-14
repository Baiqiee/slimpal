# -*- coding: utf-8 -*-
"""Sample backgrounds and emit zoomed crops of candidate regions."""
import os
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, "source")
OUT = os.path.join(ROOT, "tools", "preview")
os.makedirs(OUT, exist_ok=True)

files = sorted(f for f in os.listdir(SRC) if f.lower().endswith(".png"))
ims = [Image.open(os.path.join(SRC, f)).convert("RGB") for f in files]

print("=== background samples ===")
for i, im in enumerate(ims, 1):
    w, h = im.size
    pts = {
        "TL": (2, 2), "TR": (w - 3, 2), "BL": (2, h - 3), "BR": (w - 3, h - 3),
        "top-mid": (w // 2, 2), "bottom-mid": (w // 2, h - 3),
        "left-mid": (2, h // 2), "right-mid": (w - 3, h // 2),
    }
    print(f"--- image {i} ({w}x{h}) ---")
    for k, (x, y) in pts.items():
        print(f"   {k:10s} {im.getpixel((x, y))}")

# ---- zoomed crops for coordinate picking ----
jobs = [
    # (image index, name, box, zoom)
    (1, "img1_expr_grid", (700, 450, 1024, 1000), 3),
    (1, "img1_chibi",     (10, 850, 200, 1200), 4),
    (3, "img3_fig1",      (40, 0, 430, 1024), 2),
    (3, "img3_fig4",      (1100, 0, 1500, 1024), 2),
]
for idx, name, box, zoom in jobs:
    src = ims[idx - 1]
    box = (max(0, box[0]), max(0, box[1]), min(src.width, box[2]), min(src.height, box[3]))
    c = src.crop(box)
    c = c.resize((c.width * zoom, c.height * zoom), Image.LANCZOS)
    p = os.path.join(OUT, f"{name}.png")
    c.save(p)
    print(f"crop {name}: box={box} zoom={zoom} -> {p} ({c.width}x{c.height})")
