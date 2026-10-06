# hats.py [item ...] : re-fit worn head pieces (hats) from the armour frames onto the base body frames.
# Per base frame: shift the piece by the offset that best aligns the armour frame's hair with the base frame's hair,
# then recompute the "hide hair" marker (magenta) from the base hair: only hair poking out above the piece is hidden.
# Output: <item>/layers/base/<anim>.png in the base strip geometry (352 cells, one right-facing row).
import json, sys, os, numpy as np
from PIL import Image
from scipy import ndimage as nd
G = os.path.dirname(os.path.abspath(__file__)) + '/../../'
S = 352
cells = json.load(open(G + 'src/data/body-cells.json')); meta = json.load(open(G + 'tools/base/sheets/sheets.json'))
COS = json.load(open(G + 'src/data/cosmetics.json'))['classes']['warrior']
items = sys.argv[1:] or [x['id'] for x in COS if x.get('layers')]
BASE = G + 'public/assets/final/body/warrior/base/'
# base column → (armour sheet key, W, H, col) — from the bake sheets (incl. duplicate columns)
src = {}
for sh in meta:
  for f in sh['frames']:
    for k in [f['k']] + [d[1] for d in f['dups']]: src[(f['anim'], k)] = (f['key'], f['W'], f['H'], f['k'])
src[('recovery', 0)] = src.get(('recovery', 1))
def norm(a, W, H, k, r=1):
  fx = W // 2; fy = 310 + H - S; oy, ox = fy - 310, fx - 176
  out = np.zeros((S, S) + a.shape[2:], a.dtype); sy0, sx0 = max(0, oy), max(0, ox); sy1, sx1 = min(H, oy + S), min(W, ox + S)
  out[sy0 - oy:sy1 - oy, sx0 - ox:sx1 - ox] = a[r * H + sy0:r * H + sy1, k * W + sx0:k * W + sx1]; return out
cache = {}
def load(p):
  if p not in cache: cache[p] = np.array(Image.open(p).convert('RGBA')) if os.path.exists(p) else None
  return cache[p]
anims0 = [fn[:-4] for fn in os.listdir(BASE) if fn.endswith('.png') and not fn.endswith('_m.png') and not fn.endswith('_weapon.png')]
for iid in items:
  L = G + f'public/assets/final/cosmetics/warrior/{iid}/layers/'; os.makedirs(L + 'base', exist_ok=True); n_ok = 0; fit = []
  ref = None
  anims = ['idle'] + [a for a in anims0 if a != 'idle']
  for anim in anims:
    bm = load(BASE + anim + '_m.png'); bm_px = load(BASE + anim + '.png'); n = bm.shape[1] // S; out = np.zeros((S, n * S, 4), np.uint8)
    for c in range(n):
      if (anim, c) not in src or src[(anim, c)] is None: continue
      key, W, H, k = src[(anim, c)]
      lay = load(L + (key.split('/')[-2] if '/skills/' in key else key.split('/')[-1][:-4]) + '.png')
      if lay is None: continue
      om = load(G + 'public/' + key[:-4] + '_m.png')
      ahair = norm(om, W, H, k)[..., 0] == 40; bhair = bm[:, c * S:(c + 1) * S, 0] == 40
      piece = norm(lay, W, H, k)
      best = (-1, 0, 0)
      for dy in range(-16, 17, 2):
        for dx in range(-16, 17, 2):
          sh = np.roll(np.roll(ahair, dy, 0), dx, 1); v = (sh & bhair).sum() / max(1, (sh | bhair).sum())
          if v > best[0]: best = (v, dy, dx)
      p = np.roll(np.roll(piece, best[1], 0), best[2], 1)
      if best[0] < 0.5 and ref is not None:   # the armour frame's head pose doesn't match: fit the idle hat by rotating its head onto this one
        rh, rp = ref; ty, tx = np.nonzero(bhair)
        if len(ty) > 50:
          tcy, tcx = ty.mean(), tx.mean(); ry, rx = np.nonzero(rh); rcy, rcx = ry.mean(), rx.mean(); fb = (-1, 0, 0, 0)
          for ang in range(-100, 101, 5):
            rr = np.array(Image.fromarray(rh.astype(np.uint8) * 255).rotate(ang, center=(rcx, rcy), translate=(tcx - rcx, tcy - rcy))) > 127
            for dy in range(-6, 7, 3):
              for dx in range(-6, 7, 3):
                sh = np.roll(np.roll(rr, dy, 0), dx, 1); v = (sh & bhair).sum() / max(1, (sh | bhair).sum())
                if v > fb[0]: fb = (v, ang, dy, dx)
          if fb[0] > best[0]:
            v, ang, dy, dx = fb
            q = np.array(Image.fromarray(rp).rotate(ang, resample=Image.NEAREST, center=(rcx, rcy), translate=(tcx - rcx, tcy - rcy)))
            p = np.roll(np.roll(q, dy, 0), dx, 1); best = (v, dy, dx)
      mag = (p[..., 0] == 255) & (p[..., 1] == 0) & (p[..., 2] == 255) & (p[..., 3] > 0)
      p[mag] = 0
      # strands of the OLD hair drawn with the piece hang below its brim and read as a beard on the new head:
      # keep only the piece's solid body (per column, the first solid run from the top) and what is above it
      op0 = p[..., 3] > 0
      if op0.any():
        top0 = np.argmax(op0, axis=0); has0 = op0.any(0)
        run0 = np.cumprod(op0 | ~(np.arange(S)[:, None] >= top0[None, :]), axis=0).astype(bool) & op0
        bot0 = np.where(has0, S - 1 - np.argmax(run0[::-1], axis=0), -1)
        bot0 = nd.maximum_filter1d(nd.median_filter(bot0, size=9), size=5)   # smooth brim line (no ragged cut)
        p[(np.arange(S)[:, None] > bot0[None, :] + 1) & op0] = 0
      vis = p[..., 3] > 0
      lab, nl = nd.label(vis)
      if nl > 1:
        sz = nd.sum(vis, lab, range(1, nl + 1)); p[vis & ~np.isin(lab, 1 + np.nonzero((sz >= 60) | (sz == sz.max()))[0])] = 0
      fit.append((anim, c, round(float(best[0]), 2)))
      op = p[..., 3] > 0
      if op.any():   # hide base hair poking out above the piece's solid body (per column)
        top = np.argmax(op, axis=0); has = op.any(0)
        run = np.cumprod(op | ~(np.arange(S)[:, None] >= top[None, :]), axis=0).astype(bool) & op
        bot = np.where(has, S - 1 - np.argmax(run[::-1], axis=0), -1); yy = np.arange(S)[:, None]
        p[(yy <= bot[None, :] - 2) & has[None, :] & bhair & ~op] = [255, 0, 255, 255]
      out[:, c * S:(c + 1) * S] = p; n_ok += 1
      if anim == 'idle' and c == 0: ref = (bhair.copy(), np.where(((p[..., 0] == 255) & (p[..., 1] == 0) & (p[..., 2] == 255))[..., None], 0, p).astype(np.uint8))
    Image.fromarray(out).save(L + f'base/{anim}.png', optimize=True)
  print(iid, 'frames', n_ok, 'weak fits', [f for f in fit if f[2] < 0.45])
