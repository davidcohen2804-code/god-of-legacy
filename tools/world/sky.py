# sky.py : the life of the far landscape, from GPT's sheets in tools/world/layers/sky/ →
#   public/assets/world/sky/clouds.png (+ each cloud's rect), birds.png (wing-beat strip), falls.png (falling-water strip,
#   glow on black, drawn additive) and src/data/world-sky.json, including where the backdrop's waterfalls are ("spots",
#   found in tools/world/layers/bg.png: tall streaks of white water; world-areas.json backdrop.falls overrides them).
#   clouds.png : separate clouds on flat magenta       birds.png : bird frames (one wing-beat, left to right) on magenta
#   falls.png  : 8 frames of falling water, 4 x 2 grid, on black
#   python3 tools/world/sky.py   (then tools/world/strip.py is not needed: the game reads world-sky.json directly)
import json, os
import numpy as np, cv2
from PIL import Image

G = os.path.dirname(os.path.abspath(__file__)) + '/'
R = G + '../../'
SRC = G + 'layers/sky/'
OUT = R + 'public/assets/world/sky/'
D = json.load(open(R + 'src/data/world-areas.json'))
os.makedirs(OUT, exist_ok=True)
sky = {'clouds': [], 'birds': None, 'falls': None, 'spots': []}


def unmagenta(path):
  """RGBA from a picture on flat magenta: alpha from the distance to magenta, the magenta taken out of the edge colours."""
  im = cv2.imread(path).astype(np.float32)
  M = np.array([255, 0, 255], np.float32)
  d = np.sqrt(((im - M) ** 2).sum(2))
  a = np.clip((d - 40) / 120, 0, 1)
  aa = np.maximum(a, 0.15)[..., None]
  rgb = np.clip((im - (1 - aa) * M) / aa, 0, 255)
  return np.dstack([rgb, a * 255])


def pieces(rgba, min_area):
  m = (rgba[..., 3] > 25).astype(np.uint8)
  m = cv2.morphologyEx(m, cv2.MORPH_CLOSE, np.ones((9, 9), np.uint8))
  n, lab, st, _ = cv2.connectedComponentsWithStats(m, 8)
  return [tuple(int(v) for v in st[i][:4]) for i in range(1, n) if st[i][4] >= min_area]


# ---- clouds: each one cut out, packed side by side in one picture
if os.path.exists(SRC + 'clouds.png'):
  rgba = unmagenta(SRC + 'clouds.png')
  boxes = sorted(pieces(rgba, 2500), key=lambda b: (b[1] // 200, b[0]))
  pad = 4; W = sum(b[2] + pad * 2 for b in boxes); H = max(b[3] for b in boxes) + pad * 2
  atlas = np.zeros((H, W, 4), np.float32); x = 0
  for (bx, by, bw, bh) in boxes:
    atlas[pad:pad + bh, x + pad:x + pad + bw] = rgba[by:by + bh, bx:bx + bw]
    sky['clouds'].append({'x': x + pad, 'y': pad, 'w': bw, 'h': bh}); x += bw + pad * 2
  Image.fromarray(cv2.cvtColor(atlas.astype(np.uint8), cv2.COLOR_BGRA2RGBA), 'RGBA').save(OUT + 'clouds.png', optimize=True)
  print('clouds', len(boxes), [b[2:] for b in boxes])

# ---- birds: the frames in order (left to right), each centred in one equal cell
if os.path.exists(SRC + 'birds.png'):
  rgba = unmagenta(SRC + 'birds.png')
  boxes = sorted(pieces(rgba, 60), key=lambda b: (b[1] // 120, b[0]))
  cw = max(b[2] for b in boxes) + 8; ch = max(b[3] for b in boxes) + 8
  strip = np.zeros((ch, cw * len(boxes), 4), np.float32)
  for i, (bx, by, bw, bh) in enumerate(boxes):
    ox, oy = i * cw + (cw - bw) // 2, (ch - bh) // 2
    strip[oy:oy + bh, ox:ox + bw] = rgba[by:by + bh, bx:bx + bw]
  Image.fromarray(cv2.cvtColor(strip.astype(np.uint8), cv2.COLOR_BGRA2RGBA), 'RGBA').save(OUT + 'birds.png', optimize=True)
  sky['birds'] = {'w': cw, 'h': ch, 'n': len(boxes)}
  print('birds', len(boxes), 'frames', cw, 'x', ch)

# ---- falling water: 4 x 2 cells on black → one strip (the same crop for every frame, black crushed for additive drawing)
if os.path.exists(SRC + 'falls.png'):
  im = cv2.imread(SRC + 'falls.png').astype(np.float32)
  floor = np.percentile(im.max(2), 35) + 6
  im = np.clip((im - floor) * (255 / (255 - floor)), 0, 255)
  H, W = im.shape[:2]; cw, ch = W // 4, H // 2; m = max(2, int(min(cw, ch) * 0.015))
  cells = [im[r * ch + m:(r + 1) * ch - m, c * cw + m:(c + 1) * cw - m] for r in range(2) for c in range(4)]
  lit = np.zeros(cells[0].shape[:2], bool)
  for c in cells: lit |= c.max(2) > 12
  ys, xs = np.nonzero(lit); y0, y1, x0, x1 = ys.min(), ys.max() + 1, xs.min(), xs.max() + 1
  frames = [c[y0:y1, x0:x1] for c in cells]
  scale = min(1, 360 / (y1 - y0))   # tall enough to stretch over any fall in the landscape
  frames = [cv2.resize(f, (max(8, round(f.shape[1] * scale)), round(f.shape[0] * scale)), interpolation=cv2.INTER_AREA) for f in frames]
  strip = np.hstack(frames)
  cv2.imwrite(OUT + 'falls.png', strip.astype(np.uint8))
  sky['falls'] = {'w': frames[0].shape[1], 'h': frames[0].shape[0], 'n': len(frames)}
  print('falls', len(frames), 'frames', frames[0].shape[1], 'x', frames[0].shape[0])

# ---- where the backdrop's waterfalls are
bd = D.get('backdrop', {})
if bd.get('falls'):
  sky['spots'] = [{'x': f[0], 'y': f[1], 'w': f[2], 'h': f[3]} for f in bd['falls']]
elif os.path.exists(G + 'layers/bg.png'):
  bg = cv2.imread(G + 'layers/bg.png')
  hsv = cv2.cvtColor(bg, cv2.COLOR_BGR2HSV).astype(np.int32)
  white = ((hsv[..., 2] > 200) & (hsv[..., 1] < 70)).astype(np.uint8)
  white[: int(bg.shape[0] * 0.08)] = 0                                  # not the sky's glow
  white = cv2.morphologyEx(white, cv2.MORPH_OPEN, np.ones((5, 2), np.uint8))
  white = cv2.morphologyEx(white, cv2.MORPH_CLOSE, np.ones((15, 3), np.uint8))
  n, lab, st, _ = cv2.connectedComponentsWithStats(white, 8)
  for i in range(1, n):
    x, y, w, h, a = st[i]
    if h >= 40 and h >= 2.2 * w and w >= 5 and a >= 0.35 * w * h:
      sky['spots'].append({'x': int(x), 'y': int(y), 'w': int(w), 'h': int(h)})
  print('waterfalls found in the backdrop:', [(s['x'], s['y'], s['w'], s['h']) for s in sky['spots']])

json.dump(sky, open(R + 'src/data/world-sky.json', 'w'), separators=(',', ':'))
print('→ src/data/world-sky.json')
