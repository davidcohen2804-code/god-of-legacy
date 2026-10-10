# goldgate.py : the Sun Gate — a golden gate with short stone walls closing the terrace walkway right of Ivy Heights,
# closed until the sun over Sunfall Pass is crossed, then open. GPT painted it straight into a screenshot of the spot
# (tools/world/goldgate/ref_spot.png, so it has the map's own angle, light and scale), then alone on magenta in the same
# place; the screenshot's camera turns its pixels into world px.
#   in : tools/world/goldgate/iso_closed.png, iso_open.png (1672x941, the screenshot's frame; magenta background)
#   out: public/assets/world/goldgate/{closed,open}.png, src/data/world-goldgate.json
#   python3 tools/world/goldgate.py
import json, os
import numpy as np
from PIL import Image
G = os.path.dirname(os.path.abspath(__file__)) + '/'
R = G + '../../'
OUT = R + 'public/assets/world/goldgate/'; os.makedirs(OUT, exist_ok=True)
# the screenshot's camera (OpenWorld at the spot: its world view): a picture px is this many world px from its corner
VIEW = {'x': 3928, 'y': -108, 'w': 1884, 'h': 1060}
PW, PH = 1672, 941
SX, SY = VIEW['w'] / PW, VIEW['h'] / PH
# its foot line on the picture (the walls' and pillars' base, back end by the arcade to the front urn) and the doors' span
FOOT = [(540, 402), (1060, 698)]
DOORS = (700, 878)


def key(path):
  im = np.asarray(Image.open(path).convert('RGB')).astype(np.float32)
  r, g, b = im[..., 0], im[..., 1], im[..., 2]
  a = 1 - np.clip((np.minimum(r, b) - g - 60) / 90, 0, 1)
  k = np.where(np.minimum(r, b) > g, (np.minimum(r, b) - g) * (1 - a), 0)
  rgb = im.copy(); rgb[..., 0] -= k; rgb[..., 2] -= k
  pinkness = np.clip((np.minimum(rgb[..., 0], rgb[..., 2]) - rgb[..., 1]) / 90, 0, 1) * (rgb[..., 0] > 150)
  lum = rgb.max(-1, keepdims=True)
  rgb = np.where((pinkness > 0)[..., None], lum * np.array([1.0, 0.84, 0.5]), rgb)
  a = a * (1 - 0.7 * pinkness)
  return np.dstack([np.clip(rgb, 0, 255), a * 255]).astype(np.uint8)


pics = {n: key(G + f'goldgate/iso_{n}.png') for n in ('closed', 'open') if os.path.exists(G + f'goldgate/iso_{n}.png')}
if 'open' not in pics: pics['open'] = pics['closed']   # (until its open picture is in)
bb = None
for a in pics.values():
  ys, xs = np.nonzero(a[..., 3] > 8); b = (xs.min(), ys.min(), xs.max() + 1, ys.max() + 1)
  bb = b if bb is None else (min(bb[0], b[0]), min(bb[1], b[1]), max(bb[2], b[2]), max(bb[3], b[3]))
bb = tuple(int(v) for v in (max(0, bb[0] - 4), max(0, bb[1] - 4), min(PW, bb[2] + 4), min(PH, bb[3] + 4)))
for n, a in pics.items(): Image.fromarray(a[bb[1]:bb[3], bb[0]:bb[2]], 'RGBA').save(OUT + f'{n}.png', optimize=True)
W = lambda px, py: [round(VIEW['x'] + px * SX, 1), round(VIEW['y'] + py * SY, 1)]
data = {'img': {'closed': 'assets/world/goldgate/closed.png', 'open': 'assets/world/goldgate/open.png'},
        'x': W(bb[0], bb[1])[0], 'y': W(bb[0], bb[1])[1], 'w': bb[2] - bb[0], 'h': bb[3] - bb[1], 'sx': round(SX, 5), 'sy': round(SY, 5),
        'back': W(*FOOT[0]), 'front': W(*FOOT[1]), 'doors': [W(DOORS[0], 0)[0], W(DOORS[1], 0)[0]]}
json.dump(data, open(R + 'src/data/world-goldgate.json', 'w'), indent=1)
print(data)
