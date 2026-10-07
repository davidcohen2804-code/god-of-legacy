# sky.py : the life of the far landscape, from GPT's sheets in tools/world/layers/sky/ →
#   public/assets/world/sky/clouds.png (+ each cloud's rect), birds.png (wing-beat strip), falls.png (falling-water strip,
#   grey with alpha, tinted by the game) and src/data/world-sky.json, including where the backdrop's waterfalls are ("spots",
#   found in the landscape joined from tools/world/layers/bg/part*.png: tall streaks of white water; world-areas.json
#   backdrop.falls overrides them).
#   clouds.png : separate clouds on flat magenta       birds.png : bird frames (one wing-beat, left to right) on magenta
#   falls.png  : 8 frames of falling water, 4 x 2 grid, on black
#   python3 tools/world/sky.py   (then tools/world/strip.py is not needed: the game reads world-sky.json directly)
import json, os, sys
import numpy as np, cv2
from PIL import Image
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import bg as bgparts

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


# ---- clouds: each one cut out (its loose wisps kept with it), packed side by side in one picture
if os.path.exists(SRC + 'clouds.png'):
  rgba = unmagenta(SRC + 'clouds.png')
  solid = (rgba[..., 3] > 25).astype(np.uint8)
  near = cv2.dilate(solid, np.ones((31, 31), np.uint8))          # a wisp beside a cloud belongs to it
  n, lab, st, _ = cv2.connectedComponentsWithStats(near, 8)
  boxes = []
  for i in range(1, n):
    x, y, w, h, a = st[i]
    if (solid[lab == i]).sum() < 2500: continue
    ys, xs = np.nonzero(solid * (lab == i))
    boxes.append((int(xs.min()), int(ys.min()), int(xs.max() - xs.min() + 1), int(ys.max() - ys.min() + 1), i))
  boxes.sort(key=lambda b: (b[1] // 200, b[0]))
  pad = 4; W = sum(b[2] + pad * 2 for b in boxes); H = max(b[3] for b in boxes) + pad * 2
  atlas = np.zeros((H, W, 4), np.float32); x = 0
  for (bx, by, bw, bh, i) in boxes:
    piece = rgba[by:by + bh, bx:bx + bw].copy(); piece[..., 3] *= (lab[by:by + bh, bx:bx + bw] == i)   # only this cloud
    atlas[pad:pad + bh, x + pad:x + pad + bw] = piece
    sky['clouds'].append({'x': x + pad, 'y': pad, 'w': bw, 'h': bh}); x += bw + pad * 2
  half = cv2.resize(atlas, (atlas.shape[1] // 2, atlas.shape[0] // 2), interpolation=cv2.INTER_AREA)   # shown ≤ 400 px wide
  sky['clouds'] = [{k: v // 2 for k, v in c.items()} for c in sky['clouds']]
  Image.fromarray(cv2.cvtColor(np.clip(half, 0, 255).astype(np.uint8), cv2.COLOR_BGRA2RGBA), 'RGBA').save(OUT + 'clouds.png', optimize=True)
  print('clouds', len(boxes), [b[2:4] for b in boxes])

# ---- birds: the frames left to right (split where the columns are empty), each laid so its beak tip (the rightmost point:
#      the bird flies right) is at the same spot in every frame — the body stays put while the wings beat
if os.path.exists(SRC + 'birds.png'):
  rgba = unmagenta(SRC + 'birds.png')
  op = rgba[..., 3] > 128
  cols = op.any(0)
  runs, x = [], 0
  while x < len(cols):
    if not cols[x]: x += 1; continue
    x0 = x
    while x < len(cols) and (cols[x] or cols[x:x + 18].any()): x += 1
    runs.append((x0, x))
  frames = []
  for (x0, x1) in runs:
    sub = op[:, x0:x1]
    if sub.sum() < 400: continue
    ys, xs = np.nonzero(sub)
    tip_x = xs.max(); tip_y = int(np.median(ys[xs >= tip_x - 2]))
    frames.append((x0, x1, int(ys.min()), int(ys.max()) + 1, x0 + tip_x, tip_y))
  # one cell for all: as far left of / above / below the beak as any frame reaches
  left = max(f[4] - f[0] for f in frames) + 4; up = max(f[5] - f[2] for f in frames) + 4; down = max(f[3] - f[5] for f in frames) + 4
  cw, ch = left + 6, up + down
  strip = np.zeros((ch, cw * len(frames), 4), np.float32)
  for i, (x0, x1, y0, y1, tx, ty) in enumerate(frames):
    ox, oy = i * cw + left - (tx - x0), up - (ty - y0)
    strip[oy:oy + (y1 - y0), ox:ox + (x1 - x0)] = rgba[y0:y1, x0:x1]
  k = 96 / cw   # shown ~30 px wide: no need for more
  cw, ch = round(cw * k), round(ch * k)
  strip = cv2.resize(strip, (cw * len(frames), ch), interpolation=cv2.INTER_AREA)
  Image.fromarray(cv2.cvtColor(np.clip(strip, 0, 255).astype(np.uint8), cv2.COLOR_BGRA2RGBA), 'RGBA').save(OUT + 'birds.png', optimize=True)
  sky['birds'] = {'w': cw, 'h': ch, 'n': len(frames)}
  print('birds', len(frames), 'frames', cw, 'x', ch)

# ---- falling water: 4 x 2 cells on black → one strip of the falling column only (no splash: the landscape's falls vanish
#      into mist), grey with the brightness as alpha — the game tints it to the sunset and lays it over each painted fall
if os.path.exists(SRC + 'falls.png'):
  im = cv2.imread(SRC + 'falls.png').astype(np.float32)
  floor = np.percentile(im.max(2), 35) + 6
  im = np.clip((im - floor) * (255 / (255 - floor)), 0, 255)
  H, W = im.shape[:2]; cw, ch = W // 4, H // 2; m = max(2, int(min(cw, ch) * 0.015))
  cells = [im[r * ch + m:(r + 1) * ch - m, c * cw + m:(c + 1) * cw - m] for r in range(2) for c in range(4)]
  lum = [c.max(2) for c in cells]
  # the column: rows where the lit width stays narrow (the splash at the bottom spreads wide)
  lit = np.zeros(cells[0].shape[:2], bool)
  for L in lum: lit |= L > 40
  width = lit.sum(1); top = int(np.argmax(width > 0))
  base = np.median(width[top:top + max(10, int(ch * 0.25))])
  bottom = top + int(np.argmax(width[top:] > base * 1.35))
  if bottom <= top + 20: bottom = top + int((lit.shape[0] - top) * 0.6)
  xs = np.nonzero(lit[top:bottom].any(0))[0]; x0, x1 = int(xs.min()), int(xs.max()) + 1
  frames = []
  for c in cells:
    f = c[top:bottom, x0:x1]
    g = f.mean(2); a = np.clip(f.max(2) / 255 * 1.4, 0, 1)
    a[-int(f.shape[0] * 0.18):] *= np.linspace(1, 0, int(f.shape[0] * 0.18))[:, None]   # the foot fades out
    frames.append(np.dstack([g, g, g, a * 255]))
  scale = min(1, 300 / frames[0].shape[0])
  frames = [cv2.resize(f, (max(8, round(f.shape[1] * scale)), round(f.shape[0] * scale)), interpolation=cv2.INTER_AREA) for f in frames]
  strip = np.hstack(frames)
  Image.fromarray(np.clip(strip, 0, 255).astype(np.uint8), 'RGBA').save(OUT + 'falls.png', optimize=True)
  sky['falls'] = {'w': frames[0].shape[1], 'h': frames[0].shape[0], 'n': len(frames)}
  print('falls', len(frames), 'frames', frames[0].shape[1], 'x', frames[0].shape[0], '(column rows', top, '..', bottom, 'of', ch, ')')

# ---- where the backdrop's waterfalls are: marked by hand per landscape part (world-areas.json backdrop.falls, part px),
#      else found in the part (bright vertical streaks); in the joined landscape, part n starts at (n - 1) × (width - KEEP)
def find_falls(part, x_from):
  L = cv2.cvtColor(part, cv2.COLOR_BGR2GRAY).astype(np.float32)
  sat = cv2.cvtColor(part, cv2.COLOR_BGR2HSV)[..., 1].astype(np.float32)
  gx = cv2.Sobel(L, cv2.CV_32F, 1, 0, ksize=3); gy = cv2.Sobel(L, cv2.CV_32F, 0, 1, ksize=3)
  Jxx = cv2.GaussianBlur(gx * gx, (0, 0), 3); Jyy = cv2.GaussianBlur(gy * gy, (0, 0), 3)
  cand = (((Jxx - Jyy) / (Jxx + Jyy + 1e-3) > 0.45) & (Jxx + Jyy > 300) & (cv2.GaussianBlur(L, (0, 0), 2) > 150) & (sat < 175)).astype(np.uint8)
  cand[:150] = 0; cand[:, :x_from] = 0
  cand = cv2.morphologyEx(cand, cv2.MORPH_OPEN, np.ones((3, 1), np.uint8))
  cand = cv2.morphologyEx(cand, cv2.MORPH_CLOSE, np.ones((17, 5), np.uint8))
  n, lab, st, _ = cv2.connectedComponentsWithStats(cand, 8)
  return [[int(v) for v in st[i][:4]] for i in range(1, n) if st[i][3] >= 28 and st[i][3] >= 1.4 * st[i][2] and st[i][4] >= 0.3 * st[i][2] * st[i][3]]


marks = D.get('backdrop', {}).get('falls', {})
for i, path in enumerate(bgparts.PARTS):
  n = i + 1; ox = i * (bgparts.AW - bgparts.KEEP)
  rects = marks.get(str(n))
  if rects is None:
    rects = find_falls(cv2.imread(path), 0 if n == 1 else bgparts.KEEP)
    print(f'part {n}: waterfalls found (mark them in world-areas.json backdrop.falls."{n}" to fix):', rects)
  sky['spots'] += [{'x': x + ox, 'y': y, 'w': w, 'h': h} for x, y, w, h in rects]
print('waterfalls:', len(sky['spots']))

json.dump(sky, open(R + 'src/data/world-sky.json', 'w'), separators=(',', ':'), default=int)
print('→ src/data/world-sky.json')
