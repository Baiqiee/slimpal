# -*- coding: utf-8 -*-
"""从 calm.png 裁一张"脸部特写"，给底部导航正中间那个圆钮用。

导航钮只有 50px，所以这里要的是"脸占满整个圆"，不是半身像。
框是照着 tools/preview/calm_grid.png 定的：把眼睛、鼻、嘴、下巴都框进去，
上缘留一点额头，下缘到脖子。
"""
import os
from PIL import Image, ImageDraw, ImageFilter

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, "app", "assets", "chloe", "calm.png")
OUT = os.path.join(ROOT, "app", "assets", "chloe", "nav-face.png")
PREVIEW = os.path.join(ROOT, "tools", "preview")

BOX = (50, 22, 380, 352)     # 330x330，正对脸部（比 300 略松，留住头顶轮廓）
SIDE = 256                   # 输出尺寸（导航钮 50px，3 倍屏 150px，留足余量）

im = Image.open(SRC).convert("RGBA")
face = im.crop(BOX)
face = face.resize((SIDE, SIDE), Image.LANCZOS)
face = face.filter(ImageFilter.UnsharpMask(radius=1.4, percent=50, threshold=3))
face.save(OUT)
print(f"{OUT}  {face.size}  {os.path.getsize(OUT)//1024} KB")

# 预览：分别放在"粉底圆钮"和"灰底圆钮"里，看 50px 时能不能认出来
sizes = [128, 64, 50]
tiles = []
for s in sizes:
    t = face.resize((s, s), Image.LANCZOS)
    circ = Image.new("RGBA", (s, s), (0, 0, 0, 0))
    mask = Image.new("L", (s, s), 0)
    ImageDraw.Draw(mask).ellipse([0, 0, s - 1, s - 1], fill=255)
    circ.paste(t, (0, 0), mask)
    tiles.append((s, circ))

pad = 16
W = pad + sum(t.width + pad for _, t in tiles)
H = max(t.height for _, t in tiles) + pad * 2 + 20
sheet = Image.new("RGB", (W, H), (250, 235, 240))
d = ImageDraw.Draw(sheet)
x = pad
for s, t in tiles:
    # 先画一个粉底圆，模拟真实导航钮；再把人像叠上去
    bg = Image.new("RGBA", (s, s), (0, 0, 0, 0))
    mask = Image.new("L", (s, s), 0)
    ImageDraw.Draw(mask).ellipse([0, 0, s - 1, s - 1], fill=255)
    grad = Image.new("RGB", (s, s), (255, 182, 201))
    bg.paste(grad, (0, 0), mask)
    bg.alpha_composite(t)
    # 不能在透明底上直接转 RGB（四角会变黑），要贴到不透明背景上
    onsheet = Image.new("RGB", (s, s), (250, 235, 240))
    onsheet.paste(bg, (0, 0), bg.split()[3])
    sheet.paste(onsheet, (x, pad))
    d.text((x, pad + s + 4), f"{s}px", fill=(80, 60, 70))
    x += s + pad
p = os.path.join(PREVIEW, "nav_face_preview.png")
sheet.save(p)
print("预览 ->", p, sheet.size)
