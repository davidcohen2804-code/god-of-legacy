# face_extract.py : the face styles per gender (GPT redrew our bald heads with other faces: men top row, women bottom
#   row, left to right; tools/base/gpt/base_faces*.png) → face layers on OUR standing head, in the standing GPT image's
#   space (tools/base/gpt/naked_male_set1.png 0 / naked_female_idle.png 0), like the hair layers:
#   tools/base/face/<gender>_<k>.png   face k (1..): drawn over the head, covers our own eyes / brows / mouth
# Face 0 is our own face (no layer). Each GPT head is laid on ours by its skull, ear and outline (scale + shift, then
# sub-pixel); the layer = GPT's face where either face has eyes / brows / mouth / nose, with room around them, its skin
# brought to ours (a smooth gain field), soft at the edge. Registration is cached in <gender>_reg.json (--reg redoes it).
import json, os, sys, numpy as np
from PIL import Image
from scipy import ndimage as nd
H = os.path.dirname(os.path.abspath(__file__))
FLAGS = sys.argv[1:]
sys.argv = [sys.argv[0], H + '/sheets/naked_male.json']
src = open(H + '/naked_frames.py').read()
__file__ = H + '/naked_frames.py'
exec(src[:src.index("idle_path, idle_idx = spec")])                 # figures(), keyed(), neck_of() of the baker
hx_src = open(H + '/hair_extract.py').read()
exec(hx_src[hx_src.index('def jaw_split_any('):hx_src.index('for g, (sp, si) in STD.items():')])   # jaw_split_any, warp
OUTD = H + '/face/'; os.makedirs(OUTD, exist_ok=True)
STD = {'male': ('naked_male_set1.png', 0), 'female': ('naked_female_idle.png', 0)}
# the faces offered after our own, in order: (GPT image, column) — the same column in the women's row
FACES = [('base_faces.png', 1), ('base_faces.png', 3), ('base_faces2.png', 2)]
# where face_ref.png put our heads (GPT keeps its layout): bust = top part of the figure, scaled to a 250 px head
REF = {'male': (0.40, 188), 'female': (0.36, 221)}


def skin_est(e, inside, it=3):
  """The skin colour under every pixel: the skin around it, smoothed, the features (lines, eyes, mouth) left out."""
  use = inside.copy()
  for _ in range(it):
    w = nd.gaussian_filter(use.astype(np.float32), 6)
    est = np.stack([nd.gaussian_filter(np.where(use, e[..., c], 0), 6) for c in range(3)], -1) / np.maximum(w, 1e-3)[..., None]
    use = inside & (np.abs(e - est).sum(-1) < 40)
  return est


def feats(e, inside, dist_in, eye_bot):
  """Eyes, brows, mouth, nose: far from the skin around them. Not the jaw's own outline (thin strips along the edge,
  below the eyes)."""
  f = inside & (np.abs(e - skin_est(e, inside)).sum(-1) > 45)
  L, n = nd.label(f); keep = []
  for i in range(1, n + 1):
    c = L == i; ys = np.nonzero(c)[0]
    if c.sum() < 12: continue
    if (dist_in[c] <= 8).mean() > 0.6 and ys.mean() > eye_bot: continue
    keep.append(i)
  return np.isin(L, keep)


def register(fs, es, as_, R, fh, s0, ox0, oy0):
  """GPT head → ours: scale, then shift (2 px), then sub-pixel, on the head without its face (outline, ear, skull)."""
  ry, rx = np.nonzero(R); ry0, ry1, rx0, rx1 = ry.min(), ry.max(), rx.min(), rx.max()
  A = es[ry0:ry1 + 1, rx0:rx1 + 1]; Aa = as_[ry0:ry1 + 1, rx0:rx1 + 1] * 255; M = R[ry0:ry1 + 1, rx0:rx1 + 1]
  e_, a_ = keyed(fh['gi']); a_ = np.where(nd.binary_dilation(fh['m'], iterations=3), a_, 0)
  x0, y0, x1, y1 = fh['box']; x0 -= 20; y0 -= 20; x1 += 20; y1 += 20
  crop = np.dstack([e_[y0:y1 + 1, x0:x1 + 1], a_[y0:y1 + 1, x0:x1 + 1] * 255])
  best = None
  for s in np.arange(s0 * 0.92, s0 * 1.08, 0.002):
    big = np.array(Image.fromarray(crop.clip(0, 255).astype(np.uint8), 'RGBA').resize((round(crop.shape[1] * s), round(crop.shape[0] * s)), Image.BICUBIC)).astype(np.float32)
    bxo, byo = s * x0 + ox0, s * y0 + oy0
    for ty in range(-24, 25, 2):
      for tx in range(-24, 25, 2):
        oy_, ox_ = int(round(ry0 - (byo + ty))), int(round(rx0 - (bxo + tx)))
        if oy_ < 0 or ox_ < 0 or oy_ + A.shape[0] > big.shape[0] or ox_ + A.shape[1] > big.shape[1]: continue
        sub = big[oy_:oy_ + A.shape[0], ox_:ox_ + A.shape[1]]
        err = float((np.abs(A - sub[..., :3]).sum(-1) + 2 * np.abs(Aa - sub[..., 3]))[M].mean())
        if best is None or err < best[0]: best = (err, s, ox0 + tx, oy0 + ty)
  err, s, ox, oy = best
  fine = None
  for dy in np.arange(-1.5, 1.51, 0.5):
    for dx in np.arange(-1.5, 1.51, 0.5):
      Fe, Fa = warp(fh, s, ox + dx, oy + dy, es.shape[:2])
      e2 = float((np.abs(es - Fe).sum(-1) + 2 * np.abs(as_ - Fa) * 255)[R].mean())
      if fine is None or e2 < fine[0]: fine = (e2, dx, dy)
  return dict(scale=round(float(s), 5), ox=round(float(ox + fine[1]), 2), oy=round(float(oy + fine[2]), 2), err=round(fine[0], 2))


info = {}
for gi_, (g, (sp, si)) in enumerate(STD.items()):
  fs = figures(sp)[si]; es, as_ = keyed(fs['gi']); m = fs['m']; shape = m.shape
  nrow = neck_of(m)[0]; sil = m & (np.arange(shape[0])[:, None] <= nrow); head, _ = jaw_split_any(sil, nrow)
  hy, hx = np.nonzero(head); hh = hy.max() - hy.min(); hx0, hx1 = hx.min(), hx.max()
  yy, xx = np.mgrid[0:shape[0], 0:shape[1]]
  area = head & (yy > hy.min() + 0.38 * hh) & (xx > hx0 + 0.40 * (hx1 - hx0))      # the face (not the ear, not the skull)
  inside = nd.binary_erosion(head, iterations=4); dist_in = nd.distance_transform_edt(head)
  eye_bot = hy.min() + 0.72 * hh
  f0 = feats(es, inside & area, dist_in, eye_bot)
  R = nd.binary_dilation(sil, iterations=3) & (yy <= nrow + 25) & ~nd.binary_dilation(f0, iterations=8)
  cut, hw = REF[g]; sr = 250 / hw
  bx0, by0 = fs['box'][0], fs['box'][1]
  bw, bh = round((fs['box'][2] - bx0 + 1) * sr), round(int((fs['box'][3] - by0 + 1) * cut) * sr)
  rp = OUTD + f'{g}_reg.json'
  CACHE = json.load(open(rp)) if os.path.exists(rp) and '--reg' not in FLAGS else {}
  for old in [f for f in os.listdir(OUTD) if f.startswith(g + '_') and f.endswith('.png')]: os.remove(OUTD + old)
  k = 0
  for path, col in FACES:
    if not os.path.exists(H + '/gpt/' + path): continue
    k += 1
    fh = figures(path)[gi_ * 4 + col]
    key = f'{path}:{col}'
    if key not in CACHE:
      px, py = col * 384 + (384 - bw) // 2 + 6, gi_ * 512 + (512 - bh) // 2
      CACHE[key] = register(fs, es, as_, R, fh, 1 / sr, bx0 - px / sr, by0 - py / sr)
    r = CACHE[key]
    Fe, Fa = warp(fh, r['scale'], r['ox'], r['oy'], shape)
    fk = feats(Fe, nd.binary_erosion((Fa > 0.5) & head, iterations=4) & area, dist_in, eye_bot)
    # the layer: both faces' features with room around them (the far eye is on the outline: past it too)
    zone = nd.binary_fill_holes(nd.binary_dilation(f0 | fk, iterations=7)) & nd.binary_dilation(area, iterations=10)
    # GPT's skin brought to ours: a smooth gain field from the skin around the features
    skin = inside & ~nd.binary_dilation(f0 | fk, iterations=3) & (Fa > 0.95) & nd.binary_dilation(zone, iterations=14)
    w = nd.gaussian_filter(skin.astype(np.float32), 10)
    gain = np.stack([nd.gaussian_filter(np.where(skin, es[..., c], 0), 10) / np.maximum(nd.gaussian_filter(np.where(skin, Fe[..., c], 0), 10), 1e-3) for c in range(3)], -1)
    gain = np.where(w[..., None] > 0.02, gain, 1).clip(0.8, 1.25)
    col_ = (Fe * gain).clip(0, 255)
    al = nd.gaussian_filter(zone.astype(np.float32), 2.0) * Fa
    al = np.where(nd.binary_dilation(f0, iterations=2), np.maximum(al, (Fa > 0.02).astype(np.float32)), al)   # ours fully covered
    Image.fromarray(np.dstack([col_, al * 255]).clip(0, 255).astype(np.uint8), 'RGBA').save(OUTD + f'{g}_{k}.png', optimize=True)
    info[f'{g}_{k}'] = dict(src=key, **r, zone=int(zone.sum()))
    print(g, k, info[f'{g}_{k}'])
  json.dump(CACHE, open(rp, 'w'), indent=1)
