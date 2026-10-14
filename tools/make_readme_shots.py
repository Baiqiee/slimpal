# -*- coding: utf-8 -*-
"""把开发用的截图（tools/shots/，已被忽略）缩小后放进 docs/screenshots/，
供 README 展示。tools/shots/ 里的原图是 shot.js 生成的 624px 宽，
README 不需要那么大，缩到 420px 能把仓库体积压下来一半以上。

用法：
    cd build && npx electron shot.js     # 先出图
    python tools/make_readme_shots.py    # 再归档
"""
import os
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, "tools", "shots")
OUT = os.path.join(ROOT, "docs", "screenshots")

WIDTH = 420

# (源文件名, README 里用的名字, 说明)
PICKS = [
    ("00-onboarding.png", "onboarding.png", "开场：小克居中淡入、逐句介绍自己"),
    ("01-home.png",       "home.png",       "首页：她本人 + 今天的状态摘要"),
    ("02-checkin.png",    "checkin.png",    "打卡：今天吃了什么"),
    ("03-food.png",       "food.png",       "吃：常吃列表"),
    ("03b-food-library.png", "food-library.png", "吃：食物库"),
    ("04-diary.png",      "diary.png",      "日记"),
    ("05-stats.png",      "stats.png",      "数据：体重与热量曲线"),
    ("06-settings.png",   "settings.png",   "设置"),
    ("07-celebrate.png",  "celebrate.png",  "达成里程碑：整屏庆祝"),
]


def main():
    if not os.path.isdir(SRC):
        raise SystemExit("找不到 %s，先跑 `cd build && npx electron shot.js`" % SRC)
    os.makedirs(OUT, exist_ok=True)

    made = 0
    for src_name, out_name, _ in PICKS:
        src = os.path.join(SRC, src_name)
        if not os.path.exists(src):
            print("  跳过（没有这张）：%s" % src_name)
            continue
        im = Image.open(src).convert("RGB")
        h = int(im.height * WIDTH / im.width)
        im = im.resize((WIDTH, h), Image.LANCZOS)
        dst = os.path.join(OUT, out_name)
        im.save(dst, optimize=True)
        print("  %-22s %dx%d  %d KB" % (out_name, WIDTH, h, os.path.getsize(dst) // 1024))
        made += 1

    total = sum(os.path.getsize(os.path.join(OUT, f)) for f in os.listdir(OUT))
    print("\n共 %d 张，合计 %.2f MB -> %s" % (made, total / 1024 / 1024, OUT))


if __name__ == "__main__":
    main()
