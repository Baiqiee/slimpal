# -*- coding: utf-8 -*-
"""Smoke-test rembg on the standing figure so the model download happens once, up front."""
import os
import time
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, "source")
OUT = os.path.join(ROOT, "tools", "preview")
os.makedirs(OUT, exist_ok=True)

files = sorted(f for f in os.listdir(SRC) if f.lower().endswith(".png"))
img3 = Image.open(os.path.join(SRC, files[2])).convert("RGB")

from rembg import remove, new_session

crop = img3.crop((40, 0, 430, 1024))
print("crop size:", crop.size, flush=True)

for model in ("isnet-anime", "u2net"):
    t0 = time.time()
    try:
        session = new_session(model)
        out = remove(crop, session=session, alpha_matting=False)
        path = os.path.join(OUT, f"test_cutout_{model}.png")
        out.save(path)
        bbox = out.getchannel("A").getbbox()
        print(f"[OK] {model}: {time.time()-t0:.1f}s -> {path}  alpha_bbox={bbox}", flush=True)
        break
    except Exception as e:
        print(f"[FAIL] {model}: {type(e).__name__}: {e}", flush=True)
