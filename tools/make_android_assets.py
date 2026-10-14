# -*- coding: utf-8 -*-
"""生成 Capacitor 需要的图标与启动图。"""
import os
from PIL import Image, ImageDraw, ImageFilter

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CHIBI = os.path.join(ROOT, "app", "assets", "chloe", "chibi.png")
PORTRAIT = os.path.join(ROOT, "app", "assets", "chloe", "portrait.png")
OUT = os.path.join(ROOT, "android", "assets")
os.makedirs(OUT, exist_ok=True)

PINK_TOP = (255, 186, 205)
PINK_BOTTOM = (222, 100, 134)


def gradient(size, top=PINK_TOP, bottom=PINK_BOTTOM, vertical=True):
    img = Image.new("RGB", size, top)
    d = ImageDraw.Draw(img)
    w, h = size
    for y in range(h):
        t = (y / max(1, h - 1)) ** 0.9
        c = tuple(int(top[i] + (bottom[i] - top[i]) * t) for i in range(3))
        d.line([(0, y), (w, y)], fill=c)
    return img


def place_person(canvas, person, height_ratio, bottom_margin_ratio=0.06):
    w, h = canvas.size
    target_h = int(h * height_ratio)
    scale = target_h / person.height
    p = person.resize((max(1, int(person.width * scale)), target_h), Image.LANCZOS)
    x = (w - p.width) // 2
    y = h - target_h - int(h * bottom_margin_ratio)
    # 柔和落地阴影
    shadow = Image.new("RGBA", canvas.size, (0, 0, 0, 0))
    ImageDraw.Draw(shadow).ellipse(
        [x + p.width * 0.20, y + target_h - h * 0.05,
         x + p.width * 0.80, y + target_h + h * 0.035],
        fill=(140, 55, 85, 95))
    shadow = shadow.filter(ImageFilter.GaussianBlur(max(2, h * 0.02)))
    canvas = Image.alpha_composite(canvas.convert("RGBA"), shadow)
    canvas.alpha_composite(p, (x, y))
    return canvas


chibi = Image.open(CHIBI).convert("RGBA")
portrait = Image.open(PORTRAIT).convert("RGBA")

# 图标：1024x1024，粉底 + Q 版
icon = place_person(gradient((1024, 1024)), chibi, 0.78, 0.07)
icon.convert("RGB").save(os.path.join(OUT, "icon.png"))

# 自适应图标的前景/背景（安卓会自己做圆形/方形裁切）
fg = Image.new("RGBA", (1024, 1024), (0, 0, 0, 0))
fg = place_person(fg, chibi, 0.52, 0.24)          # 安全区留大一点
fg.save(os.path.join(OUT, "icon-foreground.png"))
gradient((1024, 1024)).convert("RGB").save(os.path.join(OUT, "icon-background.png"))

# 启动图：2732x2732（安卓会按比例裁），中间放立绘
splash = gradient((2732, 2732), (255, 244, 247), PINK_TOP)
splash = place_person(splash, portrait, 0.46, 0.27)
splash = place_person(splash, chibi, 0.0, 0.0) if False else splash
splash.convert("RGB").save(os.path.join(OUT, "splash.png"))
splash.convert("RGB").save(os.path.join(OUT, "splash-dark.png"))

for f in sorted(os.listdir(OUT)):
    p = os.path.join(OUT, f)
    im = Image.open(p)
    print(f"{f:28s} {im.size}  {os.path.getsize(p)//1024} KB")
