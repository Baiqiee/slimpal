# -*- coding: utf-8 -*-
"""Sample the actual label-chip colour and the skin colour so the detector can separate them."""
import os
from collections import Counter
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, "source")
files = sorted(f for f in os.listdir(SRC) if f.lower().endswith(".png"))
img1 = Image.open(os.path.join(SRC, files[0])).convert("RGB")


def top_colors(box, label, n=8):
    c = img1.crop(box)
    cnt = Counter(c.getdata())
    print(f"--- {label} {box} ---")
    for col, k in cnt.most_common(n):
        print(f"    {col}  x{k}")


# the 开心 chip (bottom-left of card 1) and its white glyph
top_colors((748, 648, 780, 666), "chip 开心")
# cheek / blush of the happy face
top_colors((795, 560, 825, 590), "cheek")
# plain page background
top_colors((700, 500, 730, 520), "page bg")
# card inner background (right edge of card 1)
top_colors((852, 560, 862, 600), "card bg")
