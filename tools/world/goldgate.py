# goldgate.py : the Sun Gate — a golden gate across the terrace right of Ivy Heights, closed until the sun is crossed
# (Sunfall Pass), then open. GPT painted it (closed / open, same pillars) in a steeper 3/4 view than the game's; a vertical
# shear (posts stay upright) lays its foot line across the terrace's whole depth, from its back to its front edge.
#   in : tools/world/goldgate/{closed,open}.png (magenta background)
#   out: public/assets/world/goldgate/{closed,open}.png, src/data/world-goldgate.json
#   python3 tools/world/goldgate.py
import json, os
import numpy as np
from PIL import Image
G = os.path.dirname(os.path.abspath(__file__)) + '/'
R = G + '../../'
OUT = R + 'public/assets/world/goldgate/'; os.makedirs(OUT, exist_ok=True)
S = 0.42                      # world px per picture px (the pillars about three figures tall)
BACK, FRONT = 336, 664        # the terrace's back and front at its feet (world y): the gate seals the whole depth
X0 = 5020                     # world x of its back pillar's foot


def key(path):
  im = np.asarray(Image.open(path).convert('RGB')).astype(np.float32)
  r, g, b = im[..., 0], im[..., 1], im[..., 2]
  a = 1 - np.clip((np.minimum(r, b) - g - 60) / 90, 0, 1)
  k = np.where(np.minimum(r, b) > g, (np.minimum(r, b) - g) * (1 - a), 0)
  rgb = im.copy(); rgb[..., 0] -= k; rgb[..., 2] -= k
  # the glow and motes GPT painted over the magenta come out pink (even opaque): warm gold instead, the pinker the fainter
  pinkness = np.clip((np.minimum(rgb[..., 0], rgb[..., 2]) - rgb[..., 1]) / 90, 0, 1) * (rgb[..., 0] > 150)
  lum = rgb.max(-1, keepdims=True)
  rgb = np.where((pinkness > 0)[..., None], lum * np.array([1.0, 0.84, 0.5]), rgb)
  a = a * (1 - 0.7 * pinkness)
  return np.dstack([np.clip(rgb, 0, 255), a * 255]).astype(np.uint8)


closed, opened = key(G + 'goldgate/closed.png'), key(G + 'goldgate/open.png')
A = closed[..., 3] > 128
H, W = A.shape


def foot(x0, x1):   # a pillar's foot: the middle of its lowest rows
  ys, xs = np.nonzero(A[:, x0:x1]); y = ys.max(); sel = ys > y - 40
  return float(xs[sel].mean() + x0), float(y - 20)


bx, by = foot(0, W // 3); fx, fy = foot(2 * W // 3, W)
span = (FRONT - BACK) / S
k = (span - (fy - by)) / (fx - bx)    # the shear: y' = y + k (x - bx)
print('feet', (bx, by), (fx, fy), 'shear', round(k, 3))
oy = int(k * bx) + 10
OH = H + int(k * W) + 20


# output pixel (u, v) shows source (u, v - oy - k (u - bx)) — the PIL map: x = u, y = -k u + v + (k bx - oy)
def shear(a):
  return Image.fromarray(a, 'RGBA').transform((W, OH), Image.AFFINE, (1, 0, 0, -k, 1, k * bx - oy), Image.BICUBIC)


outs = {n: shear(a) for n, a in (('closed', closed), ('open', opened))}
# crop both to their union, then scale
bb = None
for im in outs.values():
  b = im.getbbox(); bb = b if bb is None else (min(bb[0], b[0]), min(bb[1], b[1]), max(bb[2], b[2]), max(bb[3], b[3]))
bb = (max(0, bb[0] - 4), max(0, bb[1] - 4), bb[2] + 4, bb[3] + 4)
sz = (round((bb[2] - bb[0]) * S), round((bb[3] - bb[1]) * S))
for n, im in outs.items():
  im.crop(bb).resize(sz, Image.LANCZOS).save(OUT + f'{n}.png', optimize=True)
# the feet in the output picture (world px from its top-left)
fb = ((bx - bb[0]) * S, (by + oy - bb[1]) * S)
ff = ((fx - bb[0]) * S, (fy + oy + k * (fx - bx) - bb[1]) * S)
x = X0 - fb[0]; y = BACK - fb[1]
data = {'img': {'closed': 'assets/world/goldgate/closed.png', 'open': 'assets/world/goldgate/open.png'}, 'x': round(x, 1), 'y': round(y, 1),
        'w': sz[0], 'h': sz[1], 'back': [X0, BACK], 'front': [round(x + ff[0], 1), round(y + ff[1], 1)]}
json.dump(data, open(R + 'src/data/world-goldgate.json', 'w'), indent=1)
print(data)
