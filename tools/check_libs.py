# -*- coding: utf-8 -*-
import importlib

for m in ("scipy", "cv2", "numpy", "PIL", "onnxruntime", "pymatting"):
    try:
        mod = importlib.import_module(m)
        print(f"{m:12s} OK      {getattr(mod, '__version__', '?')}")
    except Exception as e:
        print(f"{m:12s} MISSING {type(e).__name__}")
