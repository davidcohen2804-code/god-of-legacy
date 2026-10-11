"""stillpose.py <cls> <act> <target_head_w> img1 img2 ... : key GPT stills, scale by head width, place on the 768 canvas.
Airborne frames: feet at y=700 as well (the game lifts the body by the jump height); hips at x=384."""
import sys, os, glob, numpy as np
from PIL import Image
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from gkey import key
from integrate import largest, place, hip_x
from headw import head_w
cls, act, target = sys.argv[1], sys.argv[2], float(sys.argv[3]); imgs = sys.argv[4:]
out = f'/home/claude/god-of-legacy/tools/heroes/motion/{cls}'
for f in glob.glob(f'{out}/{act}_[0-9]*.png'): os.remove(f)
for n, p in enumerate(imgs, 1):
    a = largest(key(p)); m = a[..., 3] > 128
    hw, top = head_w(m); S = target if target < 3 else target / hw  # a value < 3 is a fixed scale (GPT canvas → motion canvas)
    ys, xs = np.where(m)
    place(a, S, hip_x(m), ys.max(), f'{out}/{act}_{n:02d}.png')
    print(p, 'head', hw, 'scale', round(S, 3), 'height', round((ys.max() - ys.min()) * S))
