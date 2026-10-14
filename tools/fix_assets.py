# -*- coding: utf-8 -*-
"""【历史脚本，已不需要再跑】

当初 laughing / cheer / chibi 三个素材的裁切框太大，把原图里的装饰文字和相邻卡片
灰边一起抠了进来。这个脚本用收紧过的框重切了那三张。

这些修正过的框**已经合并进 build_assets.py**，所以现在只要跑
`python tools/build_assets.py` 就能一次得到全部正确素材。

保留此文件只是为了留下当时的排查过程：它记录了"哪三个素材出过问题、错在哪、
收紧到哪个框才对"。
"""
import os
import numpy as np
from scipy import ndimage
from PIL import Image, ImageDraw, ImageFilter

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, "source")
OUT = os.path.join(ROOT, "app", "assets", "chloe")
PREVIEW = os.path.join(ROOT, "tools", "preview")

files = sorted(f for f in os.listdir(SRC) if f.lower().endswith(".png"))
SRC1 = Image.open(os.path.join(SRC, files[0])).convert("RGB")
SRC2 = Image.open(os.path.join(SRC, files[1])).convert("RGB")
SRC3 = Image.open(os.path.join(SRC, files[2])).convert("RGB")

from rembg import remove, new_session
session = new_session("isnet-anime")


def keep_largest(rgba, threshold=24, dilate=6):
    arr = np.array(rgba)
    mask = arr[..., 3] > threshold
    grown = ndimage.binary_dilation(mask, iterations=dilate, structure=np.ones((3, 3), bool))
    labels, n = ndimage.label(grown, structure=np.ones((3, 3), int))
    if n <= 1:
        return rgba
    sizes = ndimage.sum(grown, labels, range(1, n + 1))
    keep = labels == (1 + int(np.argmax(sizes)))
    arr[..., 3] = np.where(mask & keep, arr[..., 3], 0)
    return Image.fromarray(arr)


def trim(img, m=6):
    b = img.getchannel("A").getbbox()
    if not b:
        return img
    return img.crop((max(0, b[0] - m), max(0, b[1] - m), min(img.width, b[2] + m), min(img.height, b[3] + m)))


def unsharp(img, r=1.6, p=55):
    return img.filter(ImageFilter.UnsharpMask(radius=r, percent=p, threshold=3))


JOBS = [
    ("laugh", SRC2, (575, 62, 885, 490), 512),
    ("cheer", SRC2, (612, 622, 898, 882), 512),
    ("chibi", SRC2, (15, 805, 230, 1225), 400),
]

results = []
for name, src, box, target_h in JOBS:
    rgba = remove(src.crop(box), session=session, alpha_matting=False)
    rgba = keep_largest(rgba)
    rgba = trim(rgba)
    scale = target_h / rgba.height
    rgba = rgba.resize((max(1, round(rgba.width * scale)), target_h), Image.LANCZOS)
    rgba = unsharp(rgba)
    p = os.path.join(OUT, f"{name}.png")
    rgba.save(p, optimize=True)
    results.append((name, rgba))
    print(f"{name:7s} box={box} -> {rgba.size}  {os.path.getsize(p)//1024} KB")

# --- big review sheet on a light background (real app background is light) ---
TILE, pad, lab = 380, 12, 24
sheet = Image.new("RGB", (pad + len(results) * (TILE + pad), pad + TILE + lab), (245, 240, 242))
d = ImageDraw.Draw(sheet)
for i, (name, im) in enumerate(results):
    tile = Image.new("RGBA", (TILE, TILE), (245, 240, 242, 255))
    s = min(TILE / im.width, TILE / im.height)
    t = im.resize((max(1, round(im.width * s)), max(1, round(im.height * s))), Image.LANCZOS)
    tile.alpha_composite(t, ((TILE - t.width) // 2, (TILE - t.height) // 2))
    cx = pad + i * (TILE + pad)
    sheet.paste(tile.convert("RGB"), (cx, pad))
    d.text((cx + 4, pad + TILE + 4), name, fill=(60, 40, 50))
p = os.path.join(PREVIEW, "sheet_fix.png")
sheet.save(p)
print("sheet ->", p, sheet.size)
