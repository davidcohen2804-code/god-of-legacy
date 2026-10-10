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
# set this far right of where it was painted: its back wall right against Ivy Heights' end tower (nobody drops down past it
# from up there), the terrace's depth the same all along
SHIFT = 362


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
W = lambda px, py: [round(VIEW['x'] + SHIFT + px * SX, 1), round(VIEW['y'] + py * SY, 1)]
data = {'img': {'closed': 'assets/world/goldgate/closed.png', 'open': 'assets/world/goldgate/open.png'},
        'x': W(bb[0], bb[1])[0], 'y': W(bb[0], bb[1])[1], 'w': bb[2] - bb[0], 'h': bb[3] - bb[1], 'sx': round(SX, 5), 'sy': round(SY, 5),
        'back': W(*FOOT[0]), 'front': W(*FOOT[1]), 'doors': [W(DOORS[0], 0)[0], W(DOORS[1], 0)[0]]}
# its real foot, column by column (the base of its walls, pillars and doors as painted — the loose leaves on the floor in
# front of it left out: a column's base is where a solid run of it at least 30 px tall ends)
A = pics['closed'][..., 3] > 200
foot = []
for px in range(bb[0], bb[2], 6):
  col = A[:, px]; ys = np.nonzero(col)[0]
  if len(ys) < 30: continue
  run, best = 0, None
  for y in range(ys.min(), ys.max() + 1):
    run = run + 1 if col[y] else 0
    if run >= 30: best = y
  if best is not None:
    # the run's end: follow it down while solid
    y = best
    while y + 1 < PH and col[y + 1]: y += 1
    foot.append(W(px, y))
# kept near the straight foot line (a heap of leaves at a pillar's base is no wall), then smoothed
(bx0, by0), (fx0, fy0) = data['back'], data['front']
line = lambda x: by0 + (fy0 - by0) * (x - bx0) / (fx0 - bx0)
ys = np.array([min(max(y, line(x) - 30), line(x) + 30) for x, y in foot])
ys = np.array([np.median(ys[max(0, i - 3):i + 4]) for i in range(len(ys))])
data['foot'] = [[x, round(float(y), 1)] for (x, _), y in zip(foot, ys)]
json.dump(data, open(R + 'src/data/world-goldgate.json', 'w'), indent=1)
print(data)
