# mobs.py : monster sprite sheets from GPT → the game's monster frames.
#   in : tools/mobs/<id>.png — 5 rows on magenta, the creature facing right: idle 4, walk 6, attack 6, hurt 2, death 6
#   out: public/assets/enemy/<id>/{right,left}/{idle,walk,attack,hurt,death}/NN.png (one canvas size per monster, the feet
#        at 95% of its height, centred — Monster.ts draws them at kind.scale / Q), printed: the frame size and Q
#   python3 tools/mobs/mobs.py
import os
import numpy as np
from PIL import Image
from scipy import ndimage as nd
R = __file__.rsplit('/', 3)[0] + '/'
ACTIONS = [('idle', 4), ('walk', 6), ('attack', 6), ('hurt', 2), ('death', 6)]
# per monster: its height in the game (world px, standing) and texture px per world px
MOBS = {'puffling': {'height': 72, 'q': 2}, 'big_grumble': {'height': 250, 'q': 2, 'same': {('attack', 4): ('attack', 3)}}}   # same: a frame drawn as another (GPT's frame unusable)


def key(path):
  im = np.asarray(Image.open(path).convert('RGB')).astype(np.float32)
  r, g, b = im[..., 0], im[..., 1], im[..., 2]
  a = 1 - np.clip((np.minimum(r, b) - g - 60) / 90, 0, 1)
  k = np.where(np.minimum(r, b) > g, (np.minimum(r, b) - g) * (1 - a), 0)
  rgb = im.copy(); rgb[..., 0] -= k; rgb[..., 2] -= k
  return np.dstack([np.clip(rgb, 0, 255), a * 255]).astype(np.uint8)


def bands(mask, axis, min_gap):
  """Runs of rows (axis=1) / columns (axis=0) with content, split where the gap is at least min_gap."""
  on = mask.any(axis=axis); runs, s, gap = [], None, 0
  for i, v in enumerate(on):
    if v:
      if s is None: s = i
      gap = 0
    elif s is not None:
      gap += 1
      if gap >= min_gap: runs.append((s, i - gap + 1)); s = None; gap = 0
  if s is not None: runs.append((s, len(on)))
  return runs


for mid, spec in MOBS.items():
  rgba = key(R + f'tools/mobs/{mid}.png'); A = rgba[..., 3] > 100
  rows = bands(A, 1, 14)
  rows = [r for r in rows if r[1] - r[0] > 40]
  assert len(rows) == 5, (mid, rows)
  frames = []   # (action, i, crop rgba, anchor x in crop, baseline y in crop)
  # the grid's columns: the walk row's six frames (well apart); every row uses its first n of them
  wc = [c for c in bands(A[rows[1][0]:rows[1][1]], 0, 10) if c[1] - c[0] > 20]
  if len(wc) == 6: mids = [(wc[j][1] + wc[j + 1][0]) // 2 for j in range(5)]
  else: mids = [round(A.shape[1] * (j + 1) / 6) for j in range(5)]   # frames too close to tell apart: the sheet's even grid
  grid = list(zip([0] + mids, mids + [A.shape[1]]))
  for (act, n), (y0, y1) in zip(ACTIONS, rows):
    # each frame: seeds = its body (the mask worn down until the bodies part); every piece goes to the nearest body — a
    # piece touching two bodies (a gust against the next frame) split along the line between them
    band = rgba[y0:y1]; m = band[..., 3] > 60
    er = nd.binary_erosion(m, iterations=14); lb, kk = nd.label(er)
    seeds = np.zeros(m.shape, np.int32)
    if kk >= n:
      ss = nd.sum(er, lb, range(1, kk + 1)); big = sorted(np.argsort(ss)[-n:], key=lambda q: nd.find_objects(lb)[q][1].start)
      for t, q in enumerate(big): seeds[lb == q + 1] = t + 1
    else:   # dissolving frames: their columns' centres (as in the walk row)
      for t, (x0, x1) in enumerate(grid[:n]): seeds[m.shape[0] // 2 - 4:m.shape[0] // 2 + 4, (x0 + x1) // 2 - 4:(x0 + x1) // 2 + 4] = t + 1
    _, (iy, ix) = nd.distance_transform_edt(seeds == 0, return_indices=True)
    near = seeds[iy, ix]
    lab, k = nd.label(nd.binary_dilation(m, iterations=2) & (m | nd.binary_dilation(m, iterations=2)))
    owner = np.zeros(m.shape, np.int32)
    for q, sl in enumerate(nd.find_objects(lab)):
      cm = lab[sl] == q + 1; ids = np.unique(seeds[sl][cm & (seeds[sl] > 0)])
      if len(ids) >= 2:   # facing right: a gust reaches right, into the next frame — each pixel to the rightmost body begun left of it
        xs_ = np.arange(sl[1].start, sl[1].stop)[None, :].repeat(cm.shape[0], 0); o = np.full(cm.shape, ids[0])
        for t in ids:
          x0t = np.nonzero((seeds == t).any(0))[0].min() - 18
          o = np.where(xs_ >= x0t, t, o)
        owner[sl][cm] = o[cm]
      else:
        v = np.bincount(near[sl][cm]).argmax() if cm.any() else 0
        if act == 'attack' and kk >= n and len(ids) == 0:   # a loose gust: to the body it blows from (the nearest one left of it)
          cxq = (sl[1].start + sl[1].stop) / 2
          left = [t for t in range(1, n + 1) if np.nonzero((seeds == t).any(0))[0].max() < cxq]
          if left: v = max(left)
        owner[sl][cm] = v
    if act == 'attack' and kk >= n:   # a gust blows right: everything outside the bodies goes to the nearest body on its left
      def body_of(t):
        bm = nd.binary_dilation(seeds == t, iterations=16) & m
        core = nd.binary_opening(bm, iterations=3); lb_, k_ = nd.label(core)   # thin gust tendrils cut off, the body kept
        if k_: core = lb_ == 1 + int(np.argmax(nd.sum(core, lb_, range(1, k_ + 1))))
        return nd.binary_dilation(core, iterations=3) & bm
      bodies_ = [body_of(t) for t in range(1, n + 1)]
      bx1 = [np.nonzero(bm.any(0))[0].max() for bm in bodies_]; bx0 = [np.nonzero(bm.any(0))[0].min() for bm in bodies_]
      xs_ = np.arange(m.shape[1])[None, :].repeat(m.shape[0], 0)
      owner = np.zeros(m.shape, np.int32)   # the body only (the game blows its gust itself: the sheet's gusts overlap)
      for t in range(n): owner = np.where(bodies_[t], t + 1, owner)
      del bx1
    owner = np.where(m, owner, 0)
    base = None
    for i in range(n):
      keep = owner == i + 1
      ys, xs = np.nonzero(keep); X0, X1 = xs.min(), xs.max() + 1
      cell = band[:, X0:X1].copy(); cell[..., 3] = np.where(keep[:, X0:X1], cell[..., 3], 0)
      sy, sx = np.nonzero(seeds == i + 1)
      body = keep & (nd.binary_dilation(seeds == i + 1, iterations=14)) if kk >= n else keep
      by, bx = np.nonzero(body[:, X0:X1])
      if base is None: base = by.max(); width0 = bx.max() - bx.min()
      ax = (bx.min() + width0 / 2) if (act != 'death' or i == 0) else None
      cc = (sx.min() + sx.max()) / 2
      frames.append((act, i, cell, ax, base, X0, cc))
  # death frames: anchored like their row's first frame (the cloud dissolves where it stood)
  out, last = [], None
  for act, i, cell, ax, base, X0, cc in frames:
    if ax is None: ax = cell.shape[1] / 2   # a dissolving frame: centred where the body stood
    out.append((act, i, cell, ax, base))
  # one canvas for all: the figure's scale from the idle height
  idle_h = max(f[4] - np.nonzero(f[2][..., 3] > 100)[0].min() for f in out if f[0] == 'idle')
  s = spec['height'] * spec['q'] / idle_h
  L = max(f[3] for f in out) * s; Rr = max(f[2].shape[1] - f[3] for f in out) * s
  U = max(f[4] for f in out) * s; D = max(f[2].shape[0] - f[4] for f in out) * s
  W = int(2 * max(L, Rr)) + 8; H = int(max(U / 0.95, (U + D) * 1.0)) + 8; feet = int(H * 0.95)
  pick = {(f[0], f[1]): f for f in out}
  out = [pick[spec.get('same', {}).get((f[0], f[1]), (f[0], f[1]))][:0] + (f[0], f[1]) + pick[spec.get('same', {}).get((f[0], f[1]), (f[0], f[1]))][2:] for f in out]
  for act, i, cell, ax, base in out:
    im = Image.fromarray(cell, 'RGBA'); im = im.resize((max(1, round(im.width * s)), max(1, round(im.height * s))), Image.LANCZOS)
    cv = Image.new('RGBA', (W, H)); cv.alpha_composite(im, (round(W / 2 - ax * s), round(feet - base * s)))
    for d, img in (('right', cv), ('left', cv.transpose(Image.FLIP_LEFT_RIGHT))):
      p = R + f'public/assets/enemy/{mid}/{d}/{act}/'; os.makedirs(p, exist_ok=True); img.save(p + f'{i:02d}.png', optimize=True)
  print(mid, 'frame', W, 'x', H, 'q', spec['q'], 'figure scale', round(s, 3))
