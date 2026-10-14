# -*- coding: utf-8 -*-
"""Report source image sizes and emit grid-overlaid previews for coordinate picking."""
import os
from PIL import Image, ImageDraw

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, "source")
OUT = os.path.join(ROOT, "tools", "preview")
os.makedirs(OUT, exist_ok=True)

files = sorted(f for f in os.listdir(SRC) if f.lower().endswith(".png"))

for i, name in enumerate(files, 1):
    path = os.path.join(SRC, name)
    im = Image.open(path).convert("RGB")
    print(f"[{i}] {name}  ->  {im.width} x {im.height}")

    # grid overlay every 100 px on the original resolution
    g = im.copy()
    d = ImageDraw.Draw(g)
    step = 100
    for x in range(0, g.width, step):
        major = (x % 500 == 0)
        d.line([(x, 0), (x, g.height)], fill=(255, 0, 0) if major else (0, 160, 255), width=3 if major else 1)
        if major:
            d.text((x + 6, 6), str(x), fill=(255, 0, 0))
    for y in range(0, g.height, step):
        major = (y % 500 == 0)
        d.line([(0, y), (g.width, y)], fill=(255, 0, 0) if major else (0, 160, 255), width=3 if major else 1)
        if major:
            d.text((6, y + 6), str(y), fill=(255, 0, 0))

    # keep previews small enough to eyeball
    scale = min(1.0, 1400 / max(g.width, g.height))
    if scale < 1.0:
        g = g.resize((int(g.width * scale), int(g.height * scale)), Image.LANCZOS)
    out = os.path.join(OUT, f"grid_{i}.png")
    g.save(out)
    print(f"     grid preview -> {out}  ({g.width}x{g.height})")
