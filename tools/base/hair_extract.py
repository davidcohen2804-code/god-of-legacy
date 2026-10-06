# hair_extract.py : the 4 hairstyles per gender (tools/base/gpt/base_hair.png, GPT drew them on our bald figures:
#   men top row, women bottom row, left to right) → hair layers on OUR standing head, in the standing GPT image's
#   space (tools/base/gpt/naked_male_set1.png 0 / naked_female_idle.png 0):
#   tools/base/hair/<gender>_<k>_front.png  hair above the neck (drawn over the head / body)
#   tools/base/hair/<gender>_<k>_back.png   hair below the neck (behind the body), with what GPT's body hid filled in
# Each GPT figure is laid on the standing figure by its face below the eyes (scale + shift); the hair = what GPT drew
# that is hair-coloured where the bald figure is not (or differs), the largest connected pieces.
import json, os, sys, numpy as np
from PIL import Image
from scipy import ndimage as nd
H = os.path.dirname(os.path.abspath(__file__))
sys.argv = [sys.argv[0], H + '/sheets/naked_male.json']
src = open(H + '/naked_frames.py').read()
__file__ = H + '/naked_frames.py'
exec(src[:src.index("idle_path, idle_idx = spec")])                 # figures(), keyed(), neck_of() of the baker
OUTD = H + '/hair/'; os.makedirs(OUTD, exist_ok=True)
STD = {'male': ('naked_male_set1.png', 0), 'female': ('naked_female_idle.png', 0)}
SRC = 'base_hair.png'


def jaw_split_any(sil, nrow):
  rows = range(int(np.argmax(sil.sum(1))), nrow + 1)
  L = {y: np.nonzero(sil[y])[0].min() for y in rows}; R = {y: np.nonzero(sil[y])[0].max() for y in rows}
  back = max(L.values()); yb = min(y for y in rows if L[y] >= back - 1); xb = L[yb]
  yf = max((y for y in rows if y < nrow), key=lambda y: R[y] - R[y + 1]); xf = R[yf]
  yy, xx = np.mgrid[0:sil.shape[0], 0:sil.shape[1]]
  line = yb + (yf - yb) * np.clip((xx - xb) / max(1, xf - xb), 0, 1)
  neck = sil & (yy > line) & (yy > yb)
  return sil & ~neck, neck


def shorts_top_x(f):
  m = f['m']; e, _ = keyed(f['gi'])
  R, Gc, B = e[..., 0], e[..., 1], e[..., 2]; mx = np.maximum(np.maximum(R, Gc), B); mn = np.minimum(np.minimum(R, Gc), B)
  grey = m & ((mx - mn) / np.maximum(mx, 1) < 0.13) & (mx > 105)
  L, n = nd.label(grey); sz = nd.sum(grey, L, range(1, n + 1)); comps = [L == 1 + k for k in range(n) if sz[k] > 400]
  low = max(comps, key=lambda c: np.nonzero(c)[0].mean()); ys, xs = np.nonzero(low)
  return ys.min(), float(np.median(xs))


def warp(f, s, ox, oy, shape):
  """The GPT figure (colour without the magenta, alpha) laid into the standing image: standing = s * gpt + (ox, oy)."""
  e, a = keyed(f['gi']); a = np.where(nd.binary_dilation(f['m'], iterations=3), a, 0)
  pm = np.dstack([e * a[..., None], a * 255]).clip(0, 255).astype(np.uint8)
  im = Image.fromarray(pm, 'RGBA').transform((shape[1], shape[0]), Image.AFFINE, (1 / s, 0, -ox / s, 0, 1 / s, -oy / s), Image.BICUBIC)
  w = np.asarray(im).astype(np.float32); al = w[..., 3] / 255
  return np.where(al[..., None] > 1e-3, w[..., :3] / np.maximum(al[..., None], 1e-3), 0).clip(0, 255), al


for g, (sp, si) in STD.items():
  fs = figures(sp)[si]; es, as_ = keyed(fs['gi']); m = fs['m']; shape = m.shape
  nrow = neck_of(m)[0]; sil = m & (np.arange(shape[0])[:, None] <= nrow); head, _ = jaw_split_any(sil, nrow)
  hy, hx = np.nonzero(head); hh = hy.max() - hy.min(); hx0, hx1 = hx.min(), hx.max()
  face = head & (np.arange(shape[0])[:, None] > hy.min() + 0.50 * hh) & (np.arange(shape[1])[None, :] > hx0 + 0.42 * (hx1 - hx0))
  st_top, st_mx = shorts_top_x(fs); st_sole = fs['box'][3]
  fy, fx = np.nonzero(face); ry0, ry1, rx0, rx1 = fy.min(), fy.max(), fx.min(), fx.max()
  A = es[ry0:ry1 + 1, rx0:rx1 + 1]; M = face[ry0:ry1 + 1, rx0:rx1 + 1]
  hairs = figures(SRC)[:4] if g == 'male' else figures(SRC)[4:]
  info = {}
  CACHE = json.load(open(OUTD + f'{g}_reg.json')) if os.path.exists(OUTD + f'{g}_reg.json') else {}
  for k, fh in enumerate(hairs):
    h_top, h_mx = shorts_top_x(fh); h_sole = fh['box'][3]
    s0 = (st_sole - st_top) / (h_sole - h_top)
    best = None
    e_, a_ = keyed(fh['gi'])
    if str(k) in CACHE and '--reg' not in sys.argv:                 # registration done before (python3 hair_extract.py --reg)
      c_ = CACHE[str(k)]; best = (c_['err'], c_['scale'], c_['ox'], c_['oy'])
    for s in ([] if best else np.arange(s0 * 0.90, s0 * 1.04, 0.004)):                 # the face below the eyes: scale, then shift
      ox0, oy0 = st_mx - s * h_mx, st_sole - s * h_sole
      x0, y0, x1, y1 = fh['box']
      crop = e_[y0:y1 + 1, x0:x1 + 1]
      big = np.array(Image.fromarray(crop.clip(0, 255).astype(np.uint8)).resize((round(crop.shape[1] * s), round(crop.shape[0] * s)), Image.BICUBIC)).astype(np.float32)
      bx0, by0 = s * x0 + ox0, s * y0 + oy0                           # where the crop's corner lands (standing px)
      for ty in range(-30, 31, 2):
        for tx in range(-30, 31, 2):
          px, py = int(round(ry0 - (by0 + ty))), int(round(rx0 - (bx0 + tx)))
          if px < 0 or py < 0 or px + A.shape[0] > big.shape[0] or py + A.shape[1] > big.shape[1]: continue
          err = float((np.abs(A - big[px:px + A.shape[0], py:py + A.shape[1]]).sum(-1))[M].mean())
          if best is None or err < best[0]: best = (err, s, ox0 + tx, oy0 + ty)
    # 1 px refinement around the best
    err, s, ox, oy = best
    for dy in ((-1, 0, 1) if str(k) not in CACHE or '--reg' in sys.argv else ()):
      for dx in (-1, 0, 1):
        w, al = warp(fh, s, ox + dx, oy + dy, shape)
        e2 = float(np.abs(es - w).sum(-1)[face].mean())
        if e2 < err: err, best = e2, (e2, s, ox + dx, oy + dy)
    err, s, ox, oy = best
    Fe, Fa = warp(fh, s, ox, oy, shape)
    Ba = as_ * m
    # hair: GPT's hair-coloured pixels where the bald figure has nothing or differs (brown hair, its dark outline)
    R_, G_, B_ = Fe[..., 0], Fe[..., 1], Fe[..., 2]; mx = np.maximum(np.maximum(R_, G_), B_); mn = np.minimum(np.minimum(R_, G_), B_)
    lum = 0.3 * R_ + 0.59 * G_ + 0.11 * B_
    hairish = ((mx < 165) & (G_ < 0.78 * np.maximum(R_, 1)) & ((mx - mn) > 18)) | (lum < 70)   # hair: darker than any skin shade
    D = np.abs(Fe - es).sum(-1)
    cand = (Fa > 0.25) & hairish & ((Ba < 0.5) | (D > 110))
    cand = nd.binary_opening(cand, iterations=2)
    L, n = nd.label(cand); sz = nd.sum(cand, L, range(1, n + 1))
    keep = [1 + i for i in range(n) if sz[i] >= 0.04 * sz.max()]
    hair = np.isin(L, keep)
    hair = nd.binary_fill_holes(nd.binary_closing(hair, iterations=2)) & (Fa > 0.05) & (hairish | (Ba < 0.5))
    # its soft edge: the antialiased rim next to the hair (GPT's alpha), never into our head's skin
    rim = nd.binary_dilation(hair, iterations=2) & ~hair & (Fa > 0.02) & (hairish | ((Ba < 0.5) & (Fa < 0.9) & (mx < 190)))   # never GPT's skin edge
    hm = hair | rim
    # GPT let the hair tips blend into the magenta: back to the hair's own brown at the same red (G ≥ (R-4)/1.48, B ≤ 0.68 G)
    Fe = Fe.copy()
    Fe[..., 1] = np.where(hm, np.maximum(Fe[..., 1], (Fe[..., 0] - 4) / 1.48), Fe[..., 1])
    Fe[..., 2] = np.where(hm, np.minimum(Fe[..., 2], 0.68 * Fe[..., 1] + 3), Fe[..., 2])
    front = hm & (np.arange(shape[0])[:, None] <= nrow + 6)
    back = hm.copy()                                             # all of it (under the front part too: no seam at the neck)
    # between the bangs' strands GPT drew its own forehead (no eyebrows there): that, not our eyebrows peeking through
    gap = nd.binary_closing(hair & head, iterations=5) & ~hair & head & (np.arange(shape[0])[:, None] < hy.min() + 0.62 * hh) & (Fa > 0.5)
    out = {}
    for name, part in (('front', front | gap), ('back', back)):
      alpha = np.where(part, Fa, 0)
      if name == 'front':
        alpha = np.where((hair & (Ba > 0.5)) | gap, 1.0, alpha)                # over the head: solid
        alpha = alpha * np.clip((nrow + 6 - np.arange(shape[0])) / 12.0, 0, 1)[:, None]   # fades out at the neck (the back part goes on)
      out[name] = (Fe, alpha)
    # back hair GPT's body hid (behind the near arm / the back): a band filled in next to the visible strands, so a
    # moving arm never shows a hole there — each row's own hair tone (strands run down), smoothed down the band, darker
    Image.fromarray(np.dstack([out['back'][0], out['back'][1] * 255]).clip(0, 255).astype(np.uint8), 'RGBA').save(OUTD + f'{g}_{k}_backm.png', optimize=True)
    bk = back & hair & (Fa > 0.5) & (lum > 40) & (np.arange(shape[0])[:, None] > nrow)   # below the neck
    if bk.sum() > 200:
      Fe_b, al_b = out['back']; Fe_b = Fe_b.copy(); al_b = al_b.copy()
      rows = np.nonzero(bk.any(1))[0]; cx = (hx0 + hx1) / 2; W = int(0.42 * (hx1 - hx0))
      fill = np.zeros(shape, bool); tone = np.zeros((shape[0], 3), np.float32); have = np.zeros(shape[0], bool)
      for y in range(rows.min(), rows.max() + 1):
        xs = np.nonzero(bk[y] & (np.arange(shape[1]) < cx))[0]
        if not len(xs): continue
        xr = xs.max(); tone[y] = np.median(Fe[y, xs], 0); have[y] = True
        if Fa[y, xr + 1:xr + 4].min() < 0.5: continue               # the strands hang free here (nothing hides them)
        run = Fa[y, xr + 1:xr + 1 + W] > 0.5                          # the body right next to the hair, up to W
        n_ = int(np.argmin(run)) if not run.all() else len(run)
        fill[y, xr + 1:xr + 1 + n_] = ~hm[y, xr + 1:xr + 1 + n_]
      fill = nd.binary_closing(nd.binary_opening(fill, iterations=2), iterations=3) & (Fa > 0.5) & ~hm   # no stray rows
      Lf, nf = nd.label(fill)
      if nf > 1: fill = Lf == 1 + int(np.argmax(nd.sum(fill, Lf, range(1, nf + 1))))                    # one band
      if have.any() and fill.any():
        yy_ = np.arange(shape[0]); tone = np.stack([np.interp(yy_, yy_[have], tone[have, c]) for c in range(3)], -1)
        tone = nd.gaussian_filter1d(tone, 4, axis=0) * 0.88
        ys_, xs_ = np.nonzero(fill)
        Fe_b[ys_, xs_] = tone[ys_]; al_b[fill] = 1.0
        fy_ = np.nonzero(fill.any(1))[0]; fade = np.clip((fy_.max() - yy_) / 14.0, 0, 1)[:, None]   # the band's lower end fades
        al_b = np.where(fill, fade, al_b)
      out['back'] = (Fe_b, al_b)
    for name, (ce, al) in out.items():
      Image.fromarray(np.dstack([ce, al * 255]).clip(0, 255).astype(np.uint8), 'RGBA').save(OUTD + f'{g}_{k}_{name}.png', optimize=True)
    info[k] = dict(scale=round(float(s), 4), ox=round(float(ox), 1), oy=round(float(oy), 1), err=round(err, 1), front=int(front.sum()), back=int(back.sum()))
    print(g, k, info[k])
  json.dump(info, open(OUTD + f'{g}_reg.json', 'w'), indent=1)
