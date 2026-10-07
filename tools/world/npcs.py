# npcs.py : NPC idle strips for the open world → public/assets/world/npc/<id>.png (+ <id>_face.png dialog portrait)
# and src/data/npc-sprites.json ({id: {w, h, n, ox, oy, q}}: frame size, frame count, foot anchor, texture px per world px).
# Source per NPC: its GPT sheet (tools/world/src/npc_<id>.png: frames side by side in equal columns on magenta) — the
# figure keyed out, every frame aligned on the feet, scaled to `height` world px. Until the sheet exists, a stand-in
# (the warrior armour idle) keeps the NPC visible in the game.
import json, os
import numpy as np
from PIL import Image
from scipy import ndimage as nd
G = os.path.dirname(os.path.abspath(__file__)) + '/../../'
OUT = G + 'public/assets/world/npc/'; os.makedirs(OUT, exist_ok=True)
Q = 1.5                       # texture px per world px
SHEET_SCALE = 108 / 172       # 352-cell body sheets → world px (Body.ts)
NPCS = {'aldric': {'cols': 4, 'height': 112}}

def strip(frames, name):
  """frames: [(RGBA image, foot x, foot y, world scale)] → one strip, all feet at the same point."""
  scaled = []
  for im, fx, fy, k in frames:
    s = k * Q; w, h = round(im.size[0] * s), round(im.size[1] * s)
    scaled.append((im.resize((w, h), Image.LANCZOS), fx * s, fy * s))
  left = max(fx for _, fx, _ in scaled); right = max(im.size[0] - fx for im, fx, _ in scaled)
  top = max(fy for _, _, fy in scaled); bottom = max(im.size[1] - fy for im, _, fy in scaled)
  W, H = int(left + right) + 4, int(top + bottom) + 4
  cells = []
  for im, fx, fy in scaled:
    c = Image.new('RGBA', (W, H), (0, 0, 0, 0)); c.alpha_composite(im, (int(round(2 + left - fx)), int(round(2 + top - fy)))); cells.append(c)
  bbs = [c.getbbox() for c in cells if c.getbbox()]   # one box for all frames (2 px margin)
  x0, y0 = max(0, min(b[0] for b in bbs) - 2), max(0, min(b[1] for b in bbs) - 2)
  x1, y1 = min(W, max(b[2] for b in bbs) + 2), min(H, max(b[3] for b in bbs) + 2)
  w, h = x1 - x0, y1 - y0
  out = Image.new('RGBA', (w * len(cells), h), (0, 0, 0, 0))
  for i, c in enumerate(cells): out.alpha_composite(c.crop((x0, y0, x1, y1)), (i * w, 0))
  out.save(OUT + name + '.png', optimize=True)
  return {'w': w, 'h': h, 'n': len(cells), 'ox': (2 + left - x0) / w, 'oy': (2 + top - y0) / h, 'q': Q}

def keyed(rgb):
  """Magenta background → alpha (with the magenta spill taken out of the anti-aliased edge)."""
  R, Gc, B = rgb[..., 0], rgb[..., 1], rgb[..., 2]
  a = 1 - np.clip(((np.minimum(R, B) - Gc) - 60) / 90, 0, 1)
  sp = np.clip(np.minimum(R, B) - Gc - 12, 0, None) * (a < 0.98); rgb = rgb.copy(); rgb[..., 0] -= sp * 0.75; rgb[..., 2] -= sp * 0.75
  return rgb.clip(0, 255), a

def from_gpt(path, cols, height):
  im = np.array(Image.open(path).convert('RGB')).astype(np.float32)
  Ws = im.shape[1]; cw = Ws / cols; frames = []; tall = []
  for c in range(cols):
    cell = im[:, int(round(c * cw)):int(round((c + 1) * cw))]
    rgb, a = keyed(cell)
    m = a > 0.5; lab, n = nd.label(m)
    if n: sz = nd.sum(m, lab, range(1, n + 1)); m = np.isin(lab, 1 + np.nonzero(sz >= sz.max() * 0.05)[0])   # the figure (and its staff), no specks
    a = np.where(nd.binary_dilation(m, iterations=2), a, 0)
    ys, xs = np.nonzero(a > 0.5); foot_y = ys.max(); low = ys > foot_y - 0.06 * (foot_y - ys.min())
    fx = xs[low].mean(); tall.append(foot_y - ys.min())
    frames.append((Image.fromarray(np.dstack([rgb, a * 255]).astype(np.uint8)), fx, foot_y))
  k = height / np.median(tall)   # world px per sheet px: the figure stands `height` world px tall
  return [(f, fx, fy, k) for f, fx, fy in frames]

meta = {}
for name, spec in NPCS.items():
  src = G + f'tools/world/src/npc_{name}.png'
  if os.path.exists(src): frames = from_gpt(src, spec['cols'], spec['height'])
  else:   # stand-in until the NPC's own sheet is drawn
    sh = Image.open(G + 'public/assets/final/body/warrior/movement/idle.png').convert('RGBA')
    frames = [(sh.crop((c * 352, 0, c * 352 + 352, 352)), 176, 310, SHEET_SCALE) for c in range(sh.size[0] // 352)]
  meta[name] = strip(frames, name)
  # dialog portrait: head and shoulders of frame 0 (square, 192 px), centred on the head
  v = meta[name]; im = Image.open(OUT + name + '.png').convert('RGBA').crop((0, 0, v['w'], v['h']))
  al = im.split()[3]; bb = al.getbbox(); top, bot = bb[1], bb[3]; fh = bot - top
  hb = al.crop((0, top, v['w'], top + max(4, int(fh * 0.22)))).getbbox()
  hx = (hb[0] + hb[2]) / 2 if hb else v['w'] / 2
  side = int(fh * 0.58); x0 = int(hx - side / 2); y0 = top - int(side * 0.06)
  sq = Image.new('RGBA', (side, side), (0, 0, 0, 0)); sq.alpha_composite(im.crop((x0, y0, x0 + side, y0 + side)))
  sq.resize((192, 192), Image.LANCZOS).save(OUT + name + '_face.png', optimize=True)
  print(name, 'from', 'GPT sheet' if os.path.exists(src) else 'stand-in', v)
for f in os.listdir(OUT):   # NPCs no longer in the world
  if f.split('.')[0].replace('_face', '') not in NPCS: os.remove(OUT + f)
json.dump(meta, open(G + 'src/data/npc-sprites.json', 'w'), indent=1)
