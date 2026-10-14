# -*- coding: utf-8 -*-
"""给 calm.png 画网格，方便定"脸部特写"的裁切框。"""
import os
from PIL import Image, ImageDraw

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, "app", "assets", "chloe", "calm.png")
OUT = os.path.join(ROOT, "tools", "preview", "calm_grid.png")

im = Image.open(SRC).convert("RGBA")
bg = Image.new("RGBA", im.size, (255, 240, 245, 255))
im = Image.alpha_composite(bg, im).convert("RGB")
print("calm.png 尺寸:", im.size)

g = im.copy()
d = ImageDraw.Draw(g)
step = 50
for x in range(0, g.width, step):
    major = (x % 100 == 0)
    d.line([(x, 0), (x, g.height)], fill=(255, 0, 0) if major else (120, 190, 255), width=2 if major else 1)
    if major:
        d.text((x + 3, 3), str(x), fill=(255, 0, 0))
for y in range(0, g.height, step):
    major = (y % 100 == 0)
    d.line([(0, y), (g.width, y)], fill=(255, 0, 0) if major else (120, 190, 255), width=2 if major else 1)
    if major:
        d.text((3, y + 3), str(y), fill=(255, 0, 0))
g = g.resize((g.width * 2, g.height * 2), Image.LANCZOS)
g.save(OUT)
print("网格图 ->", OUT, g.size)
