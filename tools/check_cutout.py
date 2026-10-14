# -*- coding: utf-8 -*-
"""Render a cutout over magenta so leftover background pixels are obvious."""
import sys
import os
from PIL import Image

src = sys.argv[1]
out = sys.argv[2] if len(sys.argv) > 2 else src.replace(".png", "_check.png")

im = Image.open(src).convert("RGBA")
bg = Image.new("RGBA", im.size, (255, 0, 255, 255))
comp = Image.alpha_composite(bg, im).convert("RGB")

scale = min(1.0, 700 / max(comp.width, comp.height))
if scale < 1.0:
    comp = comp.resize((int(comp.width * scale), int(comp.height * scale)), Image.LANCZOS)
comp.save(out)
print("check ->", out, comp.size)
