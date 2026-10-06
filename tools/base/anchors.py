# anchors.py : head anchor of every base frame (MapleStory-style "brow" anchor).
# The upright idle head (hair + face masks) is the template; for each frame we find the rotation, scale and position
# that lay the template head onto this frame's head. Head items are then ONE sprite placed with this transform —
# identical in every frame, so they never jitter, stretch or break.
# Used by headtable.py (the cached table of every frame, tools/base/head_table.json).
import json, os, numpy as np
from PIL import Image
from scipy import ndimage as nd
G = os.path.dirname(os.path.abspath(__file__)) + '/../../'; S = 352
BASE = G + 'public/assets/final/body/warrior/base/'

def masks(a, c):
  m = np.array(Image.open(BASE + a + '_m.png'))[:, c * S:(c + 1) * S]
  hair = m[..., 0] == 40
  lab, n = nd.label(hair)   # the head's hair = the biggest blob + blobs touching it
  if n > 1:
    sz = nd.sum(hair, lab, range(1, n + 1)); big = lab == 1 + int(np.argmax(sz)); near = nd.binary_dilation(big, iterations=3)
    hair = big | (hair & np.isin(lab, [i for i in range(1, n + 1) if (near & (lab == i)).any()]))
  # face: skin touching the hair, inside the head's reach (a disk around the hair), not an elongated arm
  sk = m[..., 0] == 60; face = np.zeros_like(sk)
  if hair.sum() > 30:
    hy, hx = np.nonzero(hair); cy, cx = hy.mean(), hx.mean(); rad = np.sqrt(hair.sum() / np.pi)
    yy, xx = np.mgrid[0:S, 0:S]; disk = (yy - cy) ** 2 + (xx - cx) ** 2 < (1.9 * rad) ** 2
    cand = sk & disk; lab, n = nd.label(cand); near = nd.binary_dilation(hair, iterations=3)
    for i in range(1, n + 1):
      cm = lab == i
      if not (cm & near).any() or cm.sum() < 25: continue
      py, px = np.nonzero(cm)
      if len(py) > 10:
        ev = np.sort(np.linalg.eigvalsh(np.cov(np.vstack([px, py]))))
        if ev[1] > 5 * max(ev[0], 1e-3) and np.sqrt(ev[1]) > 0.6 * rad: continue    # an arm across the head
      face |= cm
  return hair, face

def fit(T, F, R=2, arange=None, allow_flip=True):
  """T, F: (hair, face) of template and frame at full res. Returns [tx, ty, angle, scale, score, flip] — the template
  is mirrored about its head centre (flip: the head turned to look back), scaled, rotated (deg, PIL counter-clockwise)
  about that centre, then moved by (tx, ty) — and the rounded template head centre."""
  th, tf = T; fh, ff = F
  ty, tx = np.nonzero(th); cy, cx = ty.mean(), tx.mean()
  fy, fx = np.nonzero(fh); gy, gx = fy.mean(), fx.mean()
  W = 120   # window around the head centroid
  def win(m, y, x):
    out = np.zeros((2 * W, 2 * W), bool); y, x = int(round(y)), int(round(x))
    y0, x0 = y - W, x - W; sy0, sx0 = max(0, y0), max(0, x0); sy1, sx1 = min(S, y + W), min(S, x + W)
    out[sy0 - y0:sy1 - y0, sx0 - x0:sx1 - x0] = m[sy0:sy1, sx0:sx1]; return out
  Fh, Ff = win(fh, gy, gx), win(ff, gy, gx)
  def xf(m, ang, k, r):
    im = Image.fromarray(m.astype(np.uint8) * 255)
    if k != 1: im2 = im.resize((round(2 * W * k), round(2 * W * k)), Image.NEAREST); im = Image.new('L', (2 * W, 2 * W)); im.paste(im2, (round(W - W * k), round(W - W * k)))
    im = im.rotate(ang, resample=Image.NEAREST, center=(W, W))
    if r > 1: im = im.resize((2 * W // r, 2 * W // r), Image.BOX)
    return np.array(im) > 127
  def score(a, b, c, d):
    s1 = (a & b).sum() / max(1, (a | b).sum()); s2 = (c & d).sum() / max(1, (c | d).sum()) if d.any() and c.any() else 0
    return s1 + 0.6 * s2
  Fhr = np.array(Image.fromarray(Fh.astype(np.uint8) * 255).resize((2 * W // R, 2 * W // R), Image.BOX)) > 127
  Ffr = np.array(Image.fromarray(Ff.astype(np.uint8) * 255).resize((2 * W // R, 2 * W // R), Image.BOX)) > 127
  results = []
  for flip in ((False, True) if allow_flip else (False,)):
    Th, Tf = win(th, cy, cx), win(tf, cy, cx)
    if flip: Th, Tf = Th[:, ::-1], Tf[:, ::-1]   # the window is centred on the head centre: mirror about it
    # a head turns at most ~75° either way; the face tells which way it turned (the hair blob alone is ambiguous)
    lo, hi = arange if arange else (-75, 75)
    angs = range(lo, hi + 1, 5)
    if not arange and tf.sum() > 60 and ff.sum() > 60:
      vy, vx = np.nonzero(Tf); wy, wx = np.nonzero(Ff)
      at = np.degrees(np.arctan2(vy.mean() - W, vx.mean() - W)); af = np.degrees(np.arctan2(wy.mean() - W, wx.mean() - W))
      a0 = -((af - at + 180) % 360 - 180)
      if -75 <= a0 <= 75: angs = range(max(-75, int(a0) - 30), min(75, int(a0) + 30) + 1, 4)
    best = (-1, 0, 0, 0, 1)
    for ang in angs:
      for k in (0.9, 0.95, 1.0, 1.05, 1.1):
        a_, c_ = xf(Th, ang, k, R), xf(Tf, ang, k, R)
        for dy in range(-6, 7, 2):
          for dx in range(-6, 7, 2):
            v = score(np.roll(np.roll(a_, dy, 0), dx, 1), Fhr, np.roll(np.roll(c_, dy, 0), dx, 1), Ffr)
            if v > best[0]: best = (v, ang, k, dy * R, dx * R)
    _, ang0, k0, dy0, dx0 = best; best = (-1, 0, 0, 0, 1)
    for ang in range(ang0 - 5, ang0 + 6, 1):
      for k in (k0 - 0.03, k0, k0 + 0.03):
        a_, c_ = xf(Th, ang, k, 1), xf(Tf, ang, k, 1)
        for dy in range(dy0 - 3, dy0 + 4):
          for dx in range(dx0 - 3, dx0 + 4):
            v = score(np.roll(np.roll(a_, dy, 0), dx, 1), Fh, np.roll(np.roll(c_, dy, 0), dx, 1), Ff)
            if v > best[0]: best = (v, ang, k, dy, dx)
    results.append((best, flip))
  (v, ang, k, dy, dx), flip = results[0]
  if len(results) > 1 and results[1][0][0] > v + 0.08: (v, ang, k, dy, dx), flip = results[1]   # mirror only when clearly better
  # translation of the template head centre (rounded, as used for the windows) onto the frame
  return [int(round(gx)) + dx - int(round(cx)), int(round(gy)) + dy - int(round(cy)), ang, round(k, 3), round(v, 3), bool(flip)], (int(round(cx)), int(round(cy)))

if __name__ == '__main__':   # the table every item uses: tools/base/headtable.py
  import headtable
  headtable.table()
