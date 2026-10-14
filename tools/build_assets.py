# -*- coding: utf-8 -*-
"""Build every Chloe asset the app needs from the three source sheets.

Outputs (app/assets/chloe):
    portrait.png      standing front figure   (image 3, view 1)
    portrait-back.png standing turn-back pose (image 3, view 4)
    portrait-alt.png  dynamic walking pose    (image 2)
    chibi.png         chibi mascot            (image 2)
    calm/laugh/cheer  large bust expressions  (image 1 / image 2)
    happy/shy/serious/tired/angry/bashful     expression cards (image 1)
"""
import os
import time
import numpy as np
from scipy import ndimage
from PIL import Image, ImageDraw, ImageFilter

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, "source")                    # 角色原始设定图
OUT = os.path.join(ROOT, "app", "assets", "chloe")    # 生成的角色素材
PREVIEW = os.path.join(ROOT, "tools", "preview")      # 中间预览图
os.makedirs(OUT, exist_ok=True)
os.makedirs(PREVIEW, exist_ok=True)

files = sorted(f for f in os.listdir(SRC) if f.lower().endswith(".png"))
SRC1 = Image.open(os.path.join(SRC, files[0])).convert("RGB")   # profile sheet
SRC2 = Image.open(os.path.join(SRC, files[1])).convert("RGB")   # expression collage, white bg
SRC3 = Image.open(os.path.join(SRC, files[2])).convert("RGB")   # turnaround, dark bg

# ---- crops that stay rectangular (they keep their painted card background) ----
CARD_FACES = [
    ("happy",   SRC1, (743, 524, 865, 642)),
    ("shy",     SRC1, (881, 524, 997, 642)),
    ("serious", SRC1, (743, 688, 865, 799)),
    ("tired",   SRC1, (881, 688, 997, 799)),
    ("angry",   SRC1, (743, 852, 865, 953)),
    ("bashful", SRC1, (881, 852, 997, 953)),
]

# ---- crops that get cut out (background removed) ----
# 注意：laugh / cheer / chibi 这三个的框是「收紧过的」。
# 原图里它们周围有装饰文字、爱心、以及相邻卡片的灰边，框大了就会一起抠进来；
# 收紧到人物本体、再配合 keep_largest_component 才算干净。改动这三个框之前先看
# tools/preview/sheet_assets.png 的对照图。
CUTOUTS = [
    ("portrait",      SRC3, (40, 0, 430, 1024),    1400),
    ("portrait-back", SRC3, (1120, 0, 1500, 1024), 1400),
    ("portrait-alt",  SRC2, (95, 5, 585, 1536),    1400),
    ("chibi",         SRC2, (15, 805, 230, 1225),   400),
    ("calm",          SRC1, (540, 40, 1010, 500),   512),
    ("laugh",         SRC2, (575, 62, 885, 490),    512),
    ("cheer",         SRC2, (612, 622, 898, 882),   512),
]


def unsharp(img, radius=2.0, percent=65, threshold=3):
    return img.filter(ImageFilter.UnsharpMask(radius=radius, percent=percent, threshold=threshold))


def square_cover(img, side):
    """Centre-crop to a square, then resize to `side`."""
    w, h = img.size
    s = min(w, h)
    left = (w - s) // 2
    top = (h - s) // 2
    img = img.crop((left, top, left + s, top + s))
    return img.resize((side, side), Image.LANCZOS)


def trim_alpha(img, margin=6):
    bbox = img.getchannel("A").getbbox()
    if not bbox:
        return img
    x0, y0, x1, y1 = bbox
    x0 = max(0, x0 - margin); y0 = max(0, y0 - margin)
    x1 = min(img.width, x1 + margin); y1 = min(img.height, y1 + margin)
    return img.crop((x0, y0, x1, y1))


def fit_height(img, target_h):
    """Resize to an exact height, up or down, preserving aspect ratio."""
    if img.height == target_h:
        return img
    scale = target_h / img.height
    return img.resize((max(1, round(img.width * scale)), target_h), Image.LANCZOS)


def keep_largest_component(rgba, threshold=24, dilate=6):
    """Drop everything not connected to the main subject.

    Decorative text, hearts and sparkles in the source sheets are detached from the
    figure, so they survive a plain background removal. Dilating before labelling
    bridges thin gaps in hair, so the subject stays one component.
    """
    arr = np.array(rgba)
    mask = arr[..., 3] > threshold
    grown = ndimage.binary_dilation(mask, iterations=dilate, structure=np.ones((3, 3), bool))
    labels, n = ndimage.label(grown, structure=np.ones((3, 3), int))
    if n <= 1:
        return rgba
    sizes = ndimage.sum(grown, labels, range(1, n + 1))
    biggest = 1 + int(np.argmax(sizes))
    keep = labels == biggest
    arr[..., 3] = np.where(mask & keep, arr[..., 3], 0)
    return Image.fromarray(arr)


# ============ 1. expression cards (no cutout needed) ============
print("=== expression cards ===", flush=True)
card_results = []
for name, src, box in CARD_FACES:
    c = src.crop(box)
    c = square_cover(c, 384)
    c = unsharp(c)
    p = os.path.join(OUT, f"face-{name}.png")
    c.save(p, optimize=True)
    card_results.append((name, c))
    print(f"  face-{name}.png  from {box} {box[2]-box[0]}x{box[3]-box[1]} -> 384x384  {os.path.getsize(p)//1024} KB", flush=True)

# ============ 2. cutouts ============
print("\n=== cutouts (rembg isnet-anime) ===", flush=True)
from rembg import remove, new_session
session = new_session("isnet-anime")

cut_results = []
for name, src, box, target_h in CUTOUTS:
    t0 = time.time()
    crop = src.crop(box)
    rgba = remove(crop, session=session, alpha_matting=False)
    rgba = keep_largest_component(rgba)
    rgba = trim_alpha(rgba)
    rgba = fit_height(rgba, target_h)
    rgba = unsharp(rgba, radius=1.6, percent=55)
    p = os.path.join(OUT, f"{name}.png")
    rgba.save(p, optimize=True)
    cut_results.append((name, rgba))
    print(f"  {name}.png  {crop.size} -> {rgba.size}  {os.path.getsize(p)//1024} KB  ({time.time()-t0:.1f}s)", flush=True)

# ============ 3. review contact sheet ============
print("\n=== contact sheet ===", flush=True)
TILE = 260
items = [(n, im.convert("RGBA")) for n, im in card_results] + \
        [(n, im) for n, im in cut_results]

cols = 4
rows = (len(items) + cols - 1) // cols
pad, lab = 10, 22
sheet = Image.new("RGB", (pad + cols * (TILE + pad), pad + rows * (TILE + pad + lab)), (26, 26, 30))
d = ImageDraw.Draw(sheet)
for i, (name, im) in enumerate(items):
    tile = Image.new("RGBA", (TILE, TILE), (60, 60, 68, 255))
    scale = min(TILE / im.width, TILE / im.height)
    t = im.resize((max(1, round(im.width * scale)), max(1, round(im.height * scale))), Image.LANCZOS)
    tile.alpha_composite(t, ((TILE - t.width) // 2, (TILE - t.height) // 2))
    cx = pad + (i % cols) * (TILE + pad)
    cy = pad + (i // cols) * (TILE + pad + lab)
    sheet.paste(tile.convert("RGB"), (cx, cy))
    d.text((cx + 4, cy + TILE + 4), name, fill=(255, 220, 160))
p = os.path.join(PREVIEW, "sheet_assets.png")
sheet.save(p)
print("sheet ->", p, sheet.size, flush=True)

total = sum(os.path.getsize(os.path.join(OUT, f)) for f in os.listdir(OUT))
print(f"\nassets dir: {OUT}\nfiles: {len(os.listdir(OUT))}  total {total/1024/1024:.2f} MB", flush=True)
