# lights.py : the Hanging Roots' four root lanterns as overlays — what the lit picture (den_2_lit.png, GPT's first
# version) shows over the unlit one (den_2_unlit.png, its variant with the roots dark and the bowls empty): the glowing
# tip, its light on the bark and the bowl's rim. The game draws them while a lantern is lit (Den.ts, room 2).
#   out: public/assets/world/den/light_<i>.png (i = 0..3), each BOX wide/high, its top-left at (x - BOX[0] // 2, TOP)
import os
import numpy as np
from PIL import Image, ImageFilter
G = os.path.dirname(os.path.abspath(__file__)) + '/'
R = G + '../../../'
XS = (480, 740, 1010, 1270)
BOX = (240, 360)
TOP = 50
lit = np.asarray(Image.open(G + 'den_2_lit.png').convert('RGB')).astype(np.float32)
dark = np.asarray(Image.open(G + 'den_2_unlit.png').convert('RGB')).astype(np.float32)
lum = lambda a: a[..., 0] * 0.4 + a[..., 1] * 0.45 + a[..., 2] * 0.15
dl = lum(lit) - lum(dark)
# the glow: where the lit picture is clearly brighter (the two paintings differ a little everywhere: a soft threshold)
a = np.clip((dl - 14) / 60, 0, 1)
a = np.asarray(Image.fromarray((a * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(2))).astype(np.float32) / 255
a = np.clip((a - 0.08) / 0.8, 0, 1) ** 0.9
# specks (the two paintings' bark differs a little everywhere): keep only the big patches — the tip, its light, the rim
import cv2
n, lab, st, _ = cv2.connectedComponentsWithStats((a > 0.25).astype(np.uint8), 8)
keep = np.isin(lab, [i for i in range(1, n) if st[i, cv2.CC_STAT_AREA] >= 220])
keep = np.asarray(Image.fromarray((keep * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(5))).astype(np.float32) / 255
a *= np.clip(keep * 1.6, 0, 1)
out = R + 'public/assets/world/den/'; os.makedirs(out, exist_ok=True)
yy, xx = np.mgrid[0:BOX[1], 0:BOX[0]]
feather = np.clip(np.minimum.reduce([xx, BOX[0] - 1 - xx, yy, BOX[1] - 1 - yy]) / 28, 0, 1)
for i, x in enumerate(XS):
  x0, y0 = x - BOX[0] // 2, TOP
  rgb = lit[y0:y0 + BOX[1], x0:x0 + BOX[0]]
  al = a[y0:y0 + BOX[1], x0:x0 + BOX[0]] * feather
  png = np.dstack([rgb, al * 255]).astype(np.uint8)
  Image.fromarray(png, 'RGBA').save(out + f'light_{i}.png', optimize=True)
  print(i, x0, y0, 'alpha mean %.3f' % al.mean(), 'rows with light:', int((al.max(axis=1) > 0.3).sum()))
