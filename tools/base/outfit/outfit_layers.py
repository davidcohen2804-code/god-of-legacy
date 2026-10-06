# outfit_layers.py : the starter outfit for the character-creation preview (man / woman).
#   tools/base/outfit/base_outfit_fixed.png (GPT dressed our standing figures: green T-shirt, blue pants, brown boots,
#   a starter sword; the hilt straightened by fix_hilt.py) → laid on OUR standing figure (scale + shift by the face),
#   our head put back on, then, in the menu image's space (same size as Base_<Gender>.png):
#   public/assets/characters/base/outfit/<Gender>_body.png        the dressed figure (our head, bald)
#   public/assets/characters/base/outfit/<Gender>_<part>_<c>.png   each piece (top / pants / shoes) in each colour, over it
#   src/data/outfit-colors.json                                    the colours offered (names + swatches)
import json, os, sys, numpy as np
from PIL import Image
from scipy import ndimage as nd
H = os.path.dirname(os.path.abspath(__file__)) + '/..'
sys.argv = [sys.argv[0], H + '/sheets/naked_male.json']
src = open(H + '/naked_frames.py').read()
__file__ = H + '/naked_frames.py'
exec(src[:src.index("idle_path, idle_idx = spec")])                 # figures(), keyed(), neck_of() of the baker
hx_src = open(H + '/hair_extract.py').read()
exec(hx_src[hx_src.index('def jaw_split_any('):hx_src.index('for g, (sp, si) in STD.items():')])   # jaw_split_any, shorts_top_x, warp
OUTD = H + '/../../public/assets/characters/base/outfit/'; os.makedirs(OUTD, exist_ok=True)
SRC = '../outfit/base_outfit_fixed.png'
STD = {'male': ('naked_male_set1.png', 0), 'female': ('naked_female_idle.png', 0)}
# the colours offered: base tone of each, shaded like GPT's own folds and highlights
COLORS = {
  'top': [('white', (236, 233, 226)), ('blue', (62, 112, 184)), ('red', (196, 64, 52))],
  'pants': [('denim', (60, 96, 168)), ('brown', (124, 84, 50)), ('black', (52, 52, 60))],
  'shoes': [('brown', (128, 78, 40)), ('black', (46, 42, 42)), ('red', (142, 44, 36))],
}


def ramp(lum, lo, md, hi, c):
  """Each pixel's light / dark through the new colour's ramp: the piece's middle tone = the colour itself, its shadows
  down to 45 %, its highlights a little lighter."""
  t = np.where(lum < md, 0.5 * np.clip((lum - lo) / max(md - lo, 1), 0, 1), 0.5 + 0.5 * np.clip((lum - md) / max(hi - md, 1), 0, 1))[..., None]
  c = np.array(c, np.float32); dark, light = c * 0.45, c + (255 - c) * 0.3
  return np.where(t < 0.5, dark + (c - dark) * (t / 0.5), c + (light - c) * ((t - 0.5) / 0.5))


def face_reg(fs, es, fh):
  m = fs['m']; shape = m.shape
  nrow = neck_of(m)[0]; sil = m & (np.arange(shape[0])[:, None] <= nrow); head, neck = jaw_split_any(sil, nrow)
  hy, hx = np.nonzero(head); hh = hy.max() - hy.min(); hx0, hx1 = hx.min(), hx.max()
  face = head & (np.arange(shape[0])[:, None] > hy.min() + 0.50 * hh) & (np.arange(shape[1])[None, :] > hx0 + 0.42 * (hx1 - hx0))
  st_sole = fs['box'][3]; h_sole = fh['box'][3]
  st_top = fs['box'][1]; h_top = fh['box'][1]
  s0 = (st_sole - st_top) / (h_sole - h_top)
  fy, fx = np.nonzero(face); ry0, ry1, rx0, rx1 = fy.min(), fy.max(), fx.min(), fx.max()
  A = es[ry0:ry1 + 1, rx0:rx1 + 1]; M = face[ry0:ry1 + 1, rx0:rx1 + 1]
  e_, _ = keyed(fh['gi']); x0, y0, x1, y1 = fh['box']; crop = e_[y0:y1 + 1, x0:x1 + 1]
  best = None
  for s in np.arange(s0 * 0.94, s0 * 1.06, 0.004):
    big = np.array(Image.fromarray(crop.clip(0, 255).astype(np.uint8)).resize((round(crop.shape[1] * s), round(crop.shape[0] * s)), Image.BICUBIC)).astype(np.float32)
    ox0 = (fs['box'][0] + fs['box'][2]) / 2 - s * (x0 + x1) / 2; oy0 = st_sole - s * y1
    bx0, by0 = s * x0 + ox0, s * y0 + oy0
    for ty in range(-30, 31, 2):
      for tx in range(-30, 31, 2):
        px, py = int(round(ry0 - (by0 + ty))), int(round(rx0 - (bx0 + tx)))
        if px < 0 or py < 0 or px + A.shape[0] > big.shape[0] or py + A.shape[1] > big.shape[1]: continue
        err = float((np.abs(A - big[px:px + A.shape[0], py:py + A.shape[1]]).sum(-1))[M].mean())
        if best is None or err < best[0]: best = (err, s, ox0 + tx, oy0 + ty)
  err, s, ox, oy = best
  for dy in (-1, 0, 1):
    for dx in (-1, 0, 1):
      w, al = warp(fh, s, ox + dx, oy + dy, shape)
      e2 = float(np.abs(es - w).sum(-1)[face].mean())
      if e2 < err: err, best = e2, (e2, s, ox + dx, oy + dy)
  return best, head, neck, nrow


info = {}
for g, (sp, si) in STD.items():
  fs = figures(sp)[si]; es, as_ = keyed(fs['gi']); m = fs['m']; shape = m.shape
  fh = figures(SRC)[0 if g == 'male' else 1]
  (err, s, ox, oy), head, neck, nrow = face_reg(fs, es, fh)
  Fe, Fa = warp(fh, s, ox, oy, shape)
  # GPT's own head off (everything of it above its neck), ours on: neck stub behind the collar, head over it
  gfig = Fa > 0.5; gn = neck_of(gfig)[0]
  cut = nd.binary_dilation(gfig & (np.arange(shape[0])[:, None] <= gn), iterations=2) & (np.arange(shape[0])[:, None] <= gn + 2)
  Fa = np.where(cut, 0, Fa)
  ours = as_ * m
  nx = np.nonzero(neck.any(0))[0]; yy_ = np.arange(shape[0])[:, None]; xx_ = np.arange(shape[1])[None, :]
  under = (yy_ > nrow - 2) & (yy_ <= max(nrow, gn) + 5) & (xx_ >= nx.min() - 2) & (xx_ <= nx.max() + 2) & (ours > 0.5) & (Fa < 0.9)   # our neck down to GPT's
  for part in (neck & (Fa < 0.5), under, head):
    Fe = np.where(part[..., None], es, Fe); Fa = np.where(part, np.maximum(ours, Fa * (part == 0)), Fa)
  # the pieces: green T-shirt, blue pants, brown boots (below the pants), each with its own dark outline
  R_, G_, B_ = Fe[..., 0], Fe[..., 1], Fe[..., 2]; mx = np.maximum(np.maximum(R_, G_), B_); mn = np.minimum(np.minimum(R_, G_), B_)
  lum = 0.3 * R_ + 0.59 * G_ + 0.11 * B_; sat = (mx - mn) / np.maximum(mx, 1)
  fig = Fa > 0.05; yy = np.arange(shape[0])[:, None]
  top = fig & (G_ > R_ + 25) & (G_ > B_ + 15)
  pants = fig & (B_ > R_ + 25) & (B_ > G_ + 8)
  top = nd.binary_opening(top, iterations=1); pants = nd.binary_opening(pants, iterations=1)
  py = np.nonzero(pants)[0]; pbot = int(np.percentile(py, 97))
  shoes = fig & (yy > pbot - 40) & (R_ > G_ + 12) & (G_ > B_ + 4) & (mx < 215) & (sat > 0.25) & ~nd.binary_dilation(pants, iterations=1)
  L_, n_ = nd.label(shoes); sz = nd.sum(shoes, L_, range(1, n_ + 1)); shoes = np.isin(L_, [1 + i for i in range(n_) if sz[i] > 0.05 * sz.max()])
  parts = {'top': top, 'pants': pants, 'shoes': shoes}
  # a piece's dark rim (its outline) recolours with it — darkest end of the new colour
  ink = fig & (lum < 75)
  soft = {}
  taken = np.zeros(shape, bool)
  for name in ('top', 'pants', 'shoes'):
    p = nd.binary_fill_holes(nd.binary_closing(parts[name], iterations=2)) & fig
    rim = nd.binary_dilation(p, iterations=3) & ink & ~taken
    soft[name] = (p | rim) & ~taken; taken |= soft[name]
  # menu crop (the same window as Base_<Gender>.png)
  x0, y0, x1, y1 = fs['box']; gh, gw = shape
  cy0, cy1, cx0, cx1 = max(0, y0 - 30), min(gh, y1 + 13), max(0, x0 - 40), min(gw, x1 + 41)
  crop = lambda v: v[cy0:cy1, cx0:cx1]
  G2 = g.capitalize()
  Image.fromarray(crop(np.dstack([Fe, Fa * 255])).clip(0, 255).astype(np.uint8), 'RGBA').save(OUTD + f'{G2}_body.png', optimize=True)
  for name, cols in COLORS.items():
    msk = soft[name]
    v = lum[msk & ~ink]; lo, md, hi = np.percentile(v, 2), np.percentile(v, 50), np.percentile(v, 99.5)
    a_ = np.where(msk, Fa, 0)
    a_ = np.maximum(a_, nd.gaussian_filter(a_, 0.6) * (Fa > 0.5)) * (Fa > 0.02)          # soft inner edge
    for ci, (cname, c) in enumerate(cols):
      col = ramp(lum, lo, md, hi, c)
      col = np.where(ink[..., None] & msk[..., None], np.minimum(col, lum[..., None] * 0.55 + np.array(c) * 0.1), col)   # the outline stays ink (no green in it)
      Image.fromarray(crop(np.dstack([col, a_ * 255])).clip(0, 255).astype(np.uint8), 'RGBA').save(OUTD + f'{G2}_{name}_{ci}.png', optimize=True)
  info[g] = dict(scale=round(float(s), 4), err=round(float(err), 1), top=int(soft['top'].sum()), pants=int(soft['pants'].sum()), shoes=int(soft['shoes'].sum()))
  print(g, info[g])
json.dump({k: [{'name': n, 'swatch': '#%02x%02x%02x' % c} for n, c in v] for k, v in COLORS.items()},
          open(H + '/../../src/data/outfit-colors.json', 'w'), indent=1)
