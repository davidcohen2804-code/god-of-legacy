# item.py <gpt_image> <item_id> : one GPT edit of tools/base/item_master.png → a head item on EVERY base frame.
# 1) per master cell: register GPT's cell to the base frame (body unchanged), take what changed around the head = the
#    piece, and mark base hair that GPT removed (magenta = hide that hair).
# 2) master frames use GPT's own drawing; every other frame gets the closest master drawing, rotated/shifted so its
#    head lands on this frame's head, then hair poking out above the piece is hidden.
# Output: public/assets/final/cosmetics/warrior/<id>/layers/base/<anim>.png (+ QC sheet tools/base/qc/<id>.png).
import json, sys, os, numpy as np
from PIL import Image
from scipy import ndimage as nd
G = os.path.dirname(os.path.abspath(__file__)) + '/../../'; S = 352; C = 256
img, iid = sys.argv[1], sys.argv[2]
BASE = G + 'public/assets/final/body/warrior/base/'
cells = json.load(open(G + 'tools/base/master.json'))['cells']
OUT = G + f'public/assets/final/cosmetics/warrior/{iid}/layers/base/'; os.makedirs(OUT, exist_ok=True)

def keyed(rgb):
  R, Gc, B = rgb[..., 0], rgb[..., 1], rgb[..., 2]
  a = 1 - np.clip(((np.minimum(R, B) - Gc) - 60) / 90, 0, 1)
  sp = np.clip(np.minimum(R, B) - Gc - 12, 0, None) * (a < 0.98); rgb = rgb.copy(); rgb[..., 0] -= sp * 0.75; rgb[..., 2] -= sp * 0.75
  return rgb, a
strips = {}
def strip(a):
  if a not in strips: strips[a] = (np.array(Image.open(BASE + a + '.png').convert('RGBA')), np.array(Image.open(BASE + a + '_m.png')))
  return strips[a]
def frame(a, c):
  px, m = strip(a); return px[:, c * S:(c + 1) * S], m[:, c * S:(c + 1) * S]

# ---- 1) pieces on the master cells
gi = Image.open(img).convert('RGB')
if gi.size != (1536, 1024):
  k = 1024 / gi.size[1]; gi = gi.resize((min(1536, round(gi.size[0] * k)), 1024), Image.LANCZOS)
gpt = np.full((1024, 1536, 3), (255, 0, 255), np.float32); g0 = np.array(gi).astype(np.float32); gpt[:, :g0.shape[1]] = g0
master = np.array(Image.open(G + 'tools/base/item_master.png').convert('RGB')).astype(np.float32)
pieces = []; report = []
for j, (a, c) in enumerate(cells):
  cy, cx = (j // 6) * C, (j % 6) * C
  bmk = keyed(master[cy:cy + C, cx:cx + C])[1] > 0.5; best = (-1, 0, 0)
  for dy in range(-48, 49, 4):
    for dx in range(-48, 49, 4):
      y0, x0 = cy + dy, cx + dx
      if y0 < 0 or x0 < 0 or y0 + C > 1024 or x0 + C > 1536: continue
      gm = keyed(gpt[y0:y0 + C, x0:x0 + C])[1] > 0.5; v = (gm & bmk).sum() / max(1, (gm | bmk).sum())
      if v > best[0]: best = (v, dy, dx)
  g = gpt[cy + best[1]:cy + best[1] + C, cx + best[2]:cx + best[2] + C]
  e = np.array(Image.fromarray(g.clip(0, 255).astype(np.uint8)).resize((S, S), Image.LANCZOS)).astype(np.float32)
  e, ea = keyed(e)
  b, bm = frame(a, c); ba = b[..., 3] > 128; hair = bm[..., 0] == 40
  hz = nd.binary_dilation(hair, iterations=48)                       # where a head item can be
  low = ~nd.binary_dilation(hair, iterations=30)                      # register on the unchanged body
  best = (-1, 0, 0)
  for dy in range(-10, 11):
    for dx in range(-10, 11):
      sh = np.roll(np.roll(ea > 0.5, dy, 0), dx, 1); v = ((sh & ba) & low).sum() / max(1, ((sh | ba) & low).sum())
      if v > best[0]: best = (v, dy, dx)
  e2 = np.roll(np.roll(e, best[1], 0), best[2], 1); a2 = np.roll(np.roll(ea, best[1], 0), best[2], 1)
  diff = np.abs(e2 - b[..., :3].astype(np.float32)).sum(2)
  strong = (a2 > 0.5) & (~ba | (diff > 90)); weak = (a2 > 0.5) & (diff > 55)
  ch = (strong | (weak & nd.binary_dilation(strong, iterations=2))) & hz
  ch = nd.binary_opening(ch, iterations=1); lab, n = nd.label(ch)
  if n: sz = nd.sum(ch, lab, range(1, n + 1)); ch = np.isin(lab, 1 + np.nonzero(sz >= max(40, sz.max() * 0.2))[0])
  ch = nd.binary_closing(ch, iterations=2) & (a2 > 0.5)
  p = np.zeros((S, S, 4), np.uint8); p[..., :3] = e2.clip(0, 255).astype(np.uint8); p[..., 3] = np.where(ch, 255, 0)
  gone = hair & (a2 < 0.3) & ~ch; p[gone] = [255, 0, 255, 255]          # base hair GPT removed under the piece
  pieces.append(p); report.append((a, c, round(float(best[0]), 2), int(ch.sum())))
bad = [r for r in report if r[2] < 0.8 or r[3] < 150]
print('master cells', len(report), 'flagged', bad)

# ---- 2) every base frame
def hide_poke(p, h):
  op = (p[..., 3] > 0) & ~((p[..., 0] == 255) & (p[..., 1] == 0) & (p[..., 2] == 255))
  if not op.any(): return p
  top = np.argmax(op, axis=0); has = op.any(0)
  run = np.cumprod(op | ~(np.arange(S)[:, None] >= top[None, :]), axis=0).astype(bool) & op
  bot = np.where(has, S - 1 - np.argmax(run[::-1], axis=0), -1); yy = np.arange(S)[:, None]
  p[(yy <= bot[None, :] - 2) & has[None, :] & h & ~op] = [255, 0, 255, 255]; return p
mh = [frame(a, c)[1][..., 0] == 40 for a, c in cells]
anims = [a for a in sorted(json.load(open(G + 'src/data/base-sheets.json')))]
for a in anims:
  px, m = strip(a); n = px.shape[1] // S; out = np.zeros((S, n * S, 4), np.uint8)
  for c in range(n):
    h = m[:, c * S:(c + 1) * S, 0] == 40
    if h.sum() < 50: continue
    direct = [j for j, (ma, mc) in enumerate(cells) if (mh[j] == h).all()]
    if direct: out[:, c * S:(c + 1) * S] = pieces[direct[0]]; continue
    ty, tx = np.nonzero(h); fb = (-1, 0, 0, 0, 0)
    for j in range(len(cells)):
      ry, rx = np.nonzero(mh[j]); rc = (rx.mean(), ry.mean()); tr = (tx.mean() - rc[0], ty.mean() - rc[1])
      for ang in range(-30, 31, 6):
        rr = np.array(Image.fromarray(mh[j].astype(np.uint8) * 255).rotate(ang, center=rc, translate=tr)) > 127
        for dy in range(-6, 7, 3):
          for dx in range(-6, 7, 3):
            s = np.roll(np.roll(rr, dy, 0), dx, 1); v = (s & h).sum() / max(1, (s | h).sum())
            if v > fb[0]: fb = (v, j, ang, dy, dx)
    v, j, ang, dy, dx = fb; ry, rx = np.nonzero(mh[j]); rc = (rx.mean(), ry.mean())
    src = pieces[j].copy(); src[(src[..., 0] == 255) & (src[..., 1] == 0) & (src[..., 2] == 255)] = 0   # its hair marks belong to its own head
    q = np.array(Image.fromarray(src).rotate(ang, resample=Image.NEAREST, center=rc, translate=(tx.mean() - rc[0], ty.mean() - rc[1])))
    out[:, c * S:(c + 1) * S] = hide_poke(np.roll(np.roll(q, dy, 0), dx, 1), h)
  Image.fromarray(out).save(OUT + a + '.png', optimize=True)
# register the item's layers
cp = G + 'src/data/cosmetics.json'; D = json.load(open(cp))
for x in D['classes']['warrior']:
  if x['id'] == iid: x['layers'] = f'assets/final/cosmetics/warrior/{iid}/layers'; x.pop('wip', None)
json.dump(D, open(cp, 'w'), indent=1)
print('baked', iid)
