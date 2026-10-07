# recolor.py : the samurai's first effect sheets were violet / blue; the class is crimson, gold and sakura now. Each sheet
#   (kept as drawn in tools/skills/orig/samurai/) has its colours turned so its main hue becomes crimson — the spread of
#   hues inside it kept (halved), white light stays white, a touch more saturation →
#   public/assets/final/skills/samurai/<id>/vfx.png
# python3 tools/skills/recolor.py
import os
import numpy as np, cv2
from PIL import Image

G = os.path.dirname(os.path.abspath(__file__)) + '/../../'
SRC = G + 'tools/skills/orig/samurai/'
# sheet: target hue (deg) — Blossom Storm keeps its cherry-blossom pink, Dragon Eclipse is crimson already
TARGET = {'quick_slash': 352, 'shadow_step': 350, 'spin_cut': 356, 'iai_strike': 352, 'sword_wave': 350, 'mirage': 354}


def dominant(h, w):
    ang = np.radians(h); x, y = (np.cos(ang) * w).sum(), (np.sin(ang) * w).sum()
    return float(np.degrees(np.arctan2(y, x)) % 360)


for sid, target in TARGET.items():
    a = np.array(Image.open(SRC + f'{sid}_vfx.png').convert('RGBA'))
    hsv = cv2.cvtColor(np.ascontiguousarray(a[..., :3]), cv2.COLOR_RGB2HSV_FULL).astype(np.float32)
    h, s, v = hsv[..., 0] * 360 / 256, hsv[..., 1] / 255, hsv[..., 2] / 255
    w = (a[..., 3] / 255) * s * v
    dom = dominant(h[w > 0.05], w[w > 0.05])
    d = ((h - dom + 180) % 360) - 180                                   # each pixel's hue around the sheet's main hue
    nh = (target + d * 0.5) % 360
    ns = np.clip(s * 1.12, 0, 1)
    out = np.dstack([nh * 256 / 360, ns * 255, v * 255]).round().clip(0, 255).astype(np.uint8)
    rgb = cv2.cvtColor(out, cv2.COLOR_HSV2RGB_FULL)
    # nearly grey (white light): unchanged
    keep = (s < 0.08)[..., None]
    rgb = np.where(keep, a[..., :3], rgb)
    res = np.dstack([rgb, a[..., 3]])
    res[res[..., 3] == 0] = 0
    Image.fromarray(res, 'RGBA').save(G + f'public/assets/final/skills/samurai/{sid}/vfx.png', optimize=True)
    print(sid, f'hue {dom:.0f} -> {target}')
