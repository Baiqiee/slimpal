# -*- coding: utf-8 -*-
"""把安卓工程的图标与启动图换成减肥姬自己的（覆盖 Capacitor 默认素材）。"""
import os
import re
from PIL import Image, ImageDraw, ImageFilter

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
RES = os.path.join(ROOT, "android", "android", "app", "src", "main", "res")
CHIBI = os.path.join(ROOT, "app", "assets", "chloe", "chibi.png")
PORTRAIT = os.path.join(ROOT, "app", "assets", "chloe", "portrait.png")

PINK_TOP = (255, 186, 205)
PINK_BOTTOM = (222, 100, 134)
SPLASH_TOP = (255, 246, 248)
SPLASH_BOTTOM = (250, 214, 224)

chibi = Image.open(CHIBI).convert("RGBA")
portrait = Image.open(PORTRAIT).convert("RGBA")


def vgrad(size, top, bottom):
    img = Image.new("RGB", size, top)
    d = ImageDraw.Draw(img)
    w, h = size
    for y in range(h):
        t = (y / max(1, h - 1)) ** 0.9
        d.line([(0, y), (w, y)], fill=tuple(int(top[i] + (bottom[i] - top[i]) * t) for i in range(3)))
    return img


def person_layer(size, person, height_ratio, bottom_ratio, shadow=True):
    w, h = size
    layer = Image.new("RGBA", size, (0, 0, 0, 0))
    target_h = max(1, int(h * height_ratio))
    scale = target_h / person.height
    p = person.resize((max(1, int(person.width * scale)), target_h), Image.LANCZOS)
    x = (w - p.width) // 2
    y = h - target_h - int(h * bottom_ratio)
    if shadow:
        sh = Image.new("RGBA", size, (0, 0, 0, 0))
        ImageDraw.Draw(sh).ellipse(
            [x + p.width * 0.22, y + target_h - h * 0.04,
             x + p.width * 0.78, y + target_h + h * 0.03],
            fill=(140, 55, 85, 90))
        layer = Image.alpha_composite(layer, sh.filter(ImageFilter.GaussianBlur(max(1.5, h * 0.018))))
    layer.alpha_composite(p, (x, y))
    return layer


def square_icon(size, circular=False):
    base = vgrad((size, size), PINK_TOP, PINK_BOTTOM).convert("RGBA")
    if circular:
        mask = Image.new("L", (size, size), 0)
        ImageDraw.Draw(mask).ellipse([0, 0, size - 1, size - 1], fill=255)
        out = Image.new("RGBA", (size, size), (0, 0, 0, 0))
        out.paste(base, (0, 0), mask)
        base = out
    else:
        mask = Image.new("L", (size, size), 0)
        r = int(size * 0.22)
        ImageDraw.Draw(mask).rounded_rectangle([0, 0, size - 1, size - 1], radius=r, fill=255)
        out = Image.new("RGBA", (size, size), (0, 0, 0, 0))
        out.paste(base, (0, 0), mask)
        base = out
    return Image.alpha_composite(base, person_layer((size, size), chibi, 0.74, 0.09))


def foreground(size):
    # 自适应图标：内容要落在中间约 66% 的安全区里
    return person_layer((size, size), chibi, 0.52, 0.24, shadow=False)


DENSITIES = {
    "mdpi": 1, "hdpi": 1.5, "xhdpi": 2, "xxhdpi": 3, "xxxhdpi": 4
}

print("=== 图标 ===")
for d, s in DENSITIES.items():
    folder = os.path.join(RES, "mipmap-" + d)
    os.makedirs(folder, exist_ok=True)
    n = int(48 * s)
    square_icon(n).save(os.path.join(folder, "ic_launcher.png"))
    square_icon(n, circular=True).save(os.path.join(folder, "ic_launcher_round.png"))
    foreground(int(108 * s)).save(os.path.join(folder, "ic_launcher_foreground.png"))
    print(f"  mipmap-{d}: ic_launcher {n}px, foreground {int(108*s)}px")

print("=== 启动图 ===")
for root, dirs, files in os.walk(RES):
    for f in files:
        if f != "splash.png":
            continue
        p = os.path.join(root, f)
        im = Image.open(p)
        w, h = im.size
        canvas = vgrad((w, h), SPLASH_TOP, SPLASH_BOTTOM).convert("RGBA")
        # 竖屏放立绘，横屏和默认放 Q 版
        if h > w:
            person, ratio = portrait, 0.42
            canvas = Image.alpha_composite(canvas, person_layer((w, h), person, ratio, 0.30))
        else:
            person, ratio = chibi, 0.58
            canvas = Image.alpha_composite(canvas, person_layer((w, h), person, ratio, 0.20))
        canvas.convert("RGB").save(p)
        print(f"  {p[len(RES)+1:]:44s} {w}x{h}")

print("=== 自适应图标底色 ===")
colors = os.path.join(RES, "values", "colors.xml")
if os.path.exists(colors):
    txt = open(colors, encoding="utf-8").read()
else:
    txt = '<?xml version="1.0" encoding="utf-8"?>\n<resources>\n</resources>\n'
if "ic_launcher_background" in txt:
    txt = re.sub(r'<color name="ic_launcher_background">.*?</color>',
                 '<color name="ic_launcher_background">#FFB6C9</color>', txt)
else:
    txt = txt.replace("</resources>", '    <color name="ic_launcher_background">#FFB6C9</color>\n</resources>')
open(colors, "w", encoding="utf-8").write(txt)
print(open(colors, encoding="utf-8").read())
