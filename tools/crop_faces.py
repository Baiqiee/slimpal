# -*- coding: utf-8 -*-
"""Trial-crop the six expression cells from image 1 and build a contact sheet."""
import os
from PIL import Image, ImageDraw

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, "source")
OUT = os.path.join(ROOT, "tools", "preview")
os.makedirs(OUT, exist_ok=True)

files = sorted(f for f in os.listdir(SRC) if f.lower().endswith(".png"))
img1 = Image.open(os.path.join(SRC, files[0])).convert("RGB")

# estimated inner boxes (left, top, right, bottom) in image-1 coordinates
CELLS = [
    ("happy",   (744, 525, 862, 644)),   # 开心
    ("shy",     (882, 525, 996, 644)),   # 害羞
    ("serious", (744, 689, 862, 808)),   # 认真
    ("tired",   (882, 689, 996, 808)),   # 疲惫
    ("angry",   (744, 853, 862, 972)),   # 生气
    ("bashful", (882, 853, 996, 972)),   # 腼腆
]

Z = 3
tiles = []
for name, box in CELLS:
    c = img1.crop(box).resize(((box[2] - box[0]) * Z, (box[3] - box[1]) * Z), Image.LANCZOS)
    tiles.append((name, c))
    print(f"{name:8s} box={box} size={box[2]-box[0]}x{box[3]-box[1]}")

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
sheet.save(os.path.join(OUT, "sheet_expr.png"))
print("contact sheet ->", os.path.join(OUT, "sheet_expr.png"), sheet.size)

# debug overlay of the chosen boxes on the source region
dbg = img1.crop((700, 450, 1024, 1010)).copy()
dbg = dbg.resize((dbg.width * 3, dbg.height * 3), Image.LANCZOS)
dd = ImageDraw.Draw(dbg)
for name, (x0, y0, x1, y1) in CELLS:
    bx = ((x0 - 700) * 3, (y0 - 450) * 3, (x1 - 700) * 3, (y1 - 450) * 3)
    dd.rectangle(bx, outline=(0, 255, 120), width=3)
dbg.save(os.path.join(OUT, "sheet_expr_debug.png"))
print("debug ->", os.path.join(OUT, "sheet_expr_debug.png"), dbg.size)
