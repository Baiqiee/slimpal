# -*- coding: utf-8 -*-
"""生成 App 图标与托盘图标（从 Q 版小克来）。"""
import os
from PIL import Image, ImageDraw, ImageFilter

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, "app", "assets", "chloe", "chibi.png")
APP_ASSETS = os.path.join(ROOT, "app", "assets")
BUILD = os.path.join(ROOT, "build")

chibi = Image.open(SRC).convert("RGBA")


def rounded_bg(size, radius_ratio=0.22):
    """粉色渐变圆角方块底。"""
    bg = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    grad = Image.new("RGBA", (size, size))
    d = ImageDraw.Draw(grad)
    top = (255, 186, 205)
    bottom = (222, 100, 134)
    for y in range(size):
        t = y / max(1, size - 1)
        # 斜向渐变，读起来更活一点
        c = tuple(int(top[i] + (bottom[i] - top[i]) * (t ** 0.85)) for i in range(3))
        d.line([(0, y), (size, y)], fill=c + (255,))
    mask = Image.new("L", (size, size), 0)
    ImageDraw.Draw(mask).rounded_rectangle([0, 0, size - 1, size - 1],
                                           radius=int(size * radius_ratio), fill=255)
    bg.paste(grad, (0, 0), mask)
    return bg


def make_icon(size):
    canvas = rounded_bg(size)
    # 人物占高度的 82%，底部留一点空间，看起来是「站」在图标里
    target_h = int(size * 0.82)
    scale = target_h / chibi.height
    person = chibi.resize((max(1, int(chibi.width * scale)), target_h), Image.LANCZOS)
    x = (size - person.width) // 2
    y = size - target_h - int(size * 0.06)
    # 脚下加一点柔和阴影
    shadow = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    ImageDraw.Draw(shadow).ellipse(
        [x + person.width * 0.18, y + target_h - size * 0.05,
         x + person.width * 0.82, y + target_h + size * 0.035],
        fill=(150, 60, 90, 90))
    shadow = shadow.filter(ImageFilter.GaussianBlur(size * 0.02))
    canvas = Image.alpha_composite(canvas, shadow)
    canvas.alpha_composite(person, (x, y))
    return canvas


def make_tray(size):
    """托盘图标要小、要能看清轮廓，所以不用背景，直接放人。"""
    scale = size / chibi.height
    person = chibi.resize((max(1, int(chibi.width * scale)), size), Image.LANCZOS)
    canvas = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    canvas.alpha_composite(person, ((size - person.width) // 2, 0))
    return canvas


os.makedirs(BUILD, exist_ok=True)
jobs = [
    (make_icon(512), os.path.join(BUILD, "icon.png")),
    (make_icon(256), os.path.join(APP_ASSETS, "icon.png")),
    (make_tray(32), os.path.join(APP_ASSETS, "tray.png")),
]
for img, path in jobs:
    img.save(path)
    print(f"{path}  {img.size}  {os.path.getsize(path)//1024} KB")
