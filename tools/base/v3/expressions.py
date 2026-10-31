#!/usr/bin/env python3
"""The new base's face expressions as layers on OUR standing head (MapleStory: the face is its own layer, its expression
swapped — a blink every few seconds, a wince when hit).
GPT drew the bald standing figure once per expression, only the face changed (the spec's expr_src, one row, in the order of
its expressions). Each figure is laid on ours: the scale from the body (shorts top → sole), then the shift and the scale
refined on the head without its face (skull, ear, outline); the layer = GPT's face where either face has eyes, brows or
mouth, with room around them, its skin brought to ours (a smooth gain field), soft at the edge.
→ tools/base/<facedir>/<gender>_x_<name>.png (the standing GPT image's space; the baker turns them into the idle cell's).
Usage (from tools/base): python3 v3/expressions.py [sheets/v3_male.json]"""
import json, os, sys, numpy as np
from PIL import Image
from scipy import ndimage as nd
H = os.path.dirname(os.path.abspath(__file__)) + '/..'
SPECF = sys.argv[1] if len(sys.argv) > 1 else 'sheets/v3_male.json'
sys.argv = [sys.argv[0], H + '/' + SPECF]
src = open(H + '/naked_frames.py').read(); __file__ = H + '/naked_frames.py'
exec(src[:src.index("idle_path, idle_idx = spec")])                          # figures(), keyed(), neck_of() of the baker
V3_ = True
hx_ = open(H + '/hair_extract.py').read()
exec(hx_[hx_.index('def jaw_split_any('):hx_.index('for g, (sp, si) in STD.items():')])   # jaw_split_any, shorts_top_x, skin_est, warp
fx_ = open(H + '/face_extract.py').read()
exec(fx_[fx_.index('def feats('):fx_.index('def register(')])               # feats
SPEC = json.load(open(H + '/' + SPECF)); g = SPEC['gender']; sp, si = SPEC['anims']['idle'][0][:2]
NAMES, SRC = SPEC['expressions'], SPEC['expr_src']; OUTD = os.environ.get('EXPR_OUT') or H + '/' + SPEC['facedir'] + '/'; os.makedirs(OUTD, exist_ok=True)
fs = figures(sp)[si]; es, as_ = keyed(fs['gi']); m = fs['m']; shape = m.shape
nrow = neck_of(m)[0]; sil = m & (np.arange(shape[0])[:, None] <= nrow); head, _ = jaw_split_any(sil, nrow)
hy, hx = np.nonzero(head); hh = hy.max() - hy.min(); hx0, hx1 = hx.min(), hx.max()
yy, xx = np.mgrid[0:shape[0], 0:shape[1]]
area = head & (yy > hy.min() + 0.38 * hh) & (xx > hx0 + 0.27 * (hx1 - hx0))   # the face (not the ear, not the skull; three-quarter: the near eye far left)
inside = nd.binary_erosion(head, iterations=4); dist_in = nd.distance_transform_edt(head)
eye_bot = hy.min() + 0.72 * hh
f0 = feats(es, inside & area, dist_in, eye_bot)                                # our own eyes, brows, mouth
R = nd.binary_dilation(sil, iterations=3) & (yy <= nrow + 25) & ~nd.binary_dilation(f0, iterations=8)   # the head without its face
st_top, st_mx = shorts_top_x(fs); st_sole = fs['box'][3]
ry, rx = np.nonzero(R); RY0, RY1, RX0, RX1 = ry.min(), ry.max(), rx.min(), rx.max()


WY0, WY1, WX0, WX1 = max(0, RY0 - 4), RY1 + 5, max(0, RX0 - 4), RX1 + 5           # the head's window: only it is warped
ES, AS, RW = es[WY0:WY1, WX0:WX1], as_[WY0:WY1, WX0:WX1], R[WY0:WY1, WX0:WX1]
_src = {}


def warp_win(fh, s, ox, oy):
  """GPT's figure laid into the head's window only (standing = s * gpt + (ox, oy)) — fast enough to search."""
  if id(fh) not in _src:
    e, a = keyed(fh['gi']); a = np.where(nd.binary_dilation(fh['m'], iterations=3), a, 0)
    _src[id(fh)] = Image.fromarray(np.dstack([e * a[..., None], a * 255]).clip(0, 255).astype(np.uint8), 'RGBA')
  im = _src[id(fh)].transform((WX1 - WX0, WY1 - WY0), Image.AFFINE, (1 / s, 0, (WX0 - ox) / s, 0, 1 / s, (WY0 - oy) / s), Image.BILINEAR)
  w = np.asarray(im).astype(np.float32); al = w[..., 3] / 255
  return np.where(al[..., None] > 1e-3, w[..., :3] / np.maximum(al[..., None], 1e-3), 0), al


def fit(fh, s, ox, oy, step):
  """The best shift (and its error) of GPT's figure at scale s around (ox, oy): colours and outline on R."""
  best = None
  for dy in np.arange(-step * 6, step * 6 + 0.01, step):
    for dx in np.arange(-step * 6, step * 6 + 0.01, step):
      Fe, Fa = warp_win(fh, s, ox + dx, oy + dy)
      e2 = float((np.abs(ES - Fe).sum(-1) + 2 * np.abs(AS - Fa) * 255)[RW].mean())
      if best is None or e2 < best[0]: best = (e2, ox + dx, oy + dy)
  return best


info = {}
for k, fh in enumerate(figures(SRC)[:len(NAMES)]):
  h_top, h_mx = shorts_top_x(fh); h_sole = fh['box'][3]
  s0 = (st_sole - st_top) / (h_sole - h_top)
  # coarse: the heads' tops and backs together (the body's scale), then fine shifts and scales
  e0 = None
  for s in np.arange(s0 * 0.97, s0 * 1.031, 0.01):
    ox, oy = st_mx - s * h_mx, st_sole - s * h_sole
    r_ = fit(fh, s, ox, oy, 4)
    r_ = fit(fh, s, r_[1], r_[2], 1)
    if e0 is None or r_[0] < e0[0]: e0 = (r_[0], s, r_[1], r_[2])
  err, s, ox, oy = e0
  r_ = fit(fh, s, ox, oy, 0.5); err, ox, oy = r_
  Fe, Fa = warp(fh, s, ox, oy, shape)
  fk = feats(Fe, nd.binary_erosion((Fa > 0.5) & head, iterations=4) & area, dist_in, eye_bot)
  # the layer: GPT's face where either face has eyes, brows or mouth, with room around them (its own skin there, brought
  # to ours) — but none of GPT's other lines: its cheek / jaw / socket lines lie a little off ours and showed as faint ghost
  # lines on our face, so a line of GPT's that is no eye, brow or mouth becomes GPT's own skin around it; and our head's
  # outline is always ours
  zone = nd.binary_fill_holes(nd.binary_dilation(f0 | fk, iterations=7)) & nd.binary_dilation(area, iterations=10)
  skin = inside & ~nd.binary_dilation(f0 | fk, iterations=9) & (Fa > 0.95) & nd.binary_dilation(zone, iterations=14)   # (clear of both faces' eyes)
  w = nd.gaussian_filter(skin.astype(np.float32), 10)
  gain = np.stack([nd.gaussian_filter(np.where(skin, es[..., c], 0), 10) / np.maximum(nd.gaussian_filter(np.where(skin, Fe[..., c], 0), 10), 1e-3) for c in range(3)], -1)
  gain = np.where(w[..., None] > 0.02, gain, 1).clip(0.95, 1.05)            # (GPT kept the skin: only a nudge)
  col = (Fe * gain).clip(0, 255)
  lum_ = col @ np.array([0.3, 0.59, 0.11]); feat_ = nd.binary_dilation(fk, iterations=2)
  gsk = (Fa > 0.95) & inside & ~feat_; med = np.median(col[gsk & zone], 0) if (gsk & zone).any() else np.median(col[gsk], 0)
  gsk &= np.abs(col - med).sum(-1) < 45                                         # GPT's skin round about (skin-coloured only)
  wg = nd.gaussian_filter(gsk.astype(np.float32), 5)
  skg = np.stack([nd.gaussian_filter(np.where(gsk, col[..., c], 0), 5) for c in range(3)], -1) / np.maximum(wg, 1e-3)[..., None]
  skg = np.where((wg > 0.05)[..., None], skg, med)
  stray = zone & ~feat_ & (lum_ < skg @ np.array([0.3, 0.59, 0.11]) - 14)      # a darker line that is none of its features
  stray = nd.binary_dilation(stray, iterations=1) & zone & ~feat_
  col = np.where(stray[..., None], skg, col)
  al = nd.gaussian_filter(zone.astype(np.float32), 2.0) * Fa
  al = np.where(nd.binary_dilation(f0, iterations=2), np.maximum(al, (Fa > 0.02).astype(np.float32)), al)   # ours fully covered
  al = np.where((dist_in <= 3) & ~nd.binary_dilation(f0, iterations=2), 0.0, al)   # (our head's own outline; an eye by it covered)
  al = al * head                                                               # on the head only (never past its outline)
  Image.fromarray(np.dstack([col, al * 255]).clip(0, 255).astype(np.uint8), 'RGBA').save(OUTD + f'{g}_x_{NAMES[k]}.png', optimize=True)
  info[NAMES[k]] = dict(scale=round(float(s), 4), ox=round(float(ox), 1), oy=round(float(oy), 1), err=round(err, 1), zone=int(zone.sum()))
  print(g, NAMES[k], info[NAMES[k]])
json.dump(info, open(OUTD + f'{g}_x_reg.json', 'w'), indent=1)
