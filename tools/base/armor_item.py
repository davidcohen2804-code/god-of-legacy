# armor_item.py <id> : a worn armour ITEM (an overall: top + pants as one piece, and boots) on every frame of both bodies,
#   from GPT's redraw of the same sheets the starter clothes came from: tools/base/gpt/armor/<id>/<sheet> is
#   tools/base/gpt/dressed_nosword/<sheet> (green shirt / blue pants / brown boots) with the armour drawn instead.
#   Each game frame already has the starter clothes (naked/<g>/gear/<move>_<piece>_c0.png, laid by naked_frames.py):
#   the dressed figure's green / blue / brown is registered onto them (scale + shift, best overlap) and the armour figure
#   (registered onto the dressed one) goes through the same placement; the armour's own pixels (not skin, by the clothes)
#   are split into top / pants / shoes by the nearest starter piece of that frame, 'topo' (the top again over the sword
#   arm drawn over the hair) where the starter's is. → naked/<g>/gear/<move>_<piece>_<id>.png (a frame without its sheet
#   yet keeps nothing: the game draws the starter piece there). QC: tools/base/qc/armor_<id>_<g>.png
import json, os, sys, numpy as np
from PIL import Image
from scipy import ndimage as nd
H = os.path.dirname(os.path.abspath(__file__)); G = H + '/../../'; S = 352
iid = sys.argv[1]; AD = H + f'/gpt/armor/{iid}/'


def keyed(rgb):
  R, Gc, B = rgb[..., 0], rgb[..., 1], rgb[..., 2]
  a = 1 - np.clip(((np.minimum(R, B) - Gc) - 60) / 90, 0, 1)
  sp = np.clip(np.minimum(R, B) - Gc - 12, 0, None) * (a < 0.98); rgb = rgb.copy(); rgb[..., 0] -= sp * 0.75; rgb[..., 2] -= sp * 0.75
  return rgb.clip(0, 255), a


def figures(img):
  """The figures of a sheet (big blobs), row by row from the top, each row left to right: [box (x0, y0, x1, y1), mask]."""
  e, a = keyed(img); fig = a > 0.5; L, n = nd.label(fig); sz = nd.sum(fig, L, range(1, n + 1))
  fs = []
  for i in [1 + i for i in range(n) if sz[i] > 0.25 * sz.max()]:
    m = L == i; ys, xs = np.nonzero(m); fs.append(dict(box=(xs.min(), ys.min(), xs.max(), ys.max()), cy=ys.mean(), cx=xs.mean(), m=m))
  fs.sort(key=lambda f: f['cy']); hmed = np.median([f['box'][3] - f['box'][1] for f in fs]); rows, cur = [], []
  for f in fs:
    if cur and f['cy'] - cur[-1]['cy'] > hmed * 0.5: rows.append(cur); cur = []
    cur.append(f)
  if cur: rows.append(cur)
  return [f for r in rows for f in sorted(r, key=lambda f: f['cx'])]


def clothes_masks(e, a):
  R, Gc, B = e[..., 0], e[..., 1], e[..., 2]; lum = 0.3 * R + 0.59 * Gc + 0.11 * B; fig = a > 0.5
  top = fig & (Gc > R + 25) & (Gc > B + 15); pants = fig & (B > R + 25) & (B > Gc + 8)
  shoes = fig & (Gc < 0.66 * R) & (B < 0.34 * R) & (lum > 30) & (lum < 160) & ~nd.binary_dilation(pants, iterations=1)
  return [nd.binary_opening(m, iterations=1) for m in (top, pants, shoes)]


def skin(e, a):
  R, Gc, B = e[..., 0], e[..., 1], e[..., 2]
  return (a > 0.5) & (R > 150) & (Gc > 95) & (B > 60) & (R > Gc + 10) & (Gc > B + 8) & (Gc > 0.62 * R) & (B < 0.85 * Gc) & (B > 0.5 * Gc)


def warp(arr, s, tx, ty, shape, order=1):
  """arr (source px) → shape: target = s * source + t."""
  M = np.array([[1 / s, 0], [0, 1 / s]])
  if arr.ndim == 2: return nd.affine_transform(arr.astype(np.float32), M, offset=(-ty / s, -tx / s), output_shape=shape, order=order)
  return np.stack([nd.affine_transform(arr[..., k].astype(np.float32), M, offset=(-ty / s, -tx / s), output_shape=shape, order=order) for k in range(arr.shape[2])], -1)


def register(src_masks, dst_masks):
  """Scale + shift taking the source masks onto the destination ones (best summed overlap)."""
  su = np.any(src_masks, 0); du = np.any(dst_masks, 0)
  s0 = np.sqrt(du.sum() / max(su.sum(), 1)); sy, sx = nd.center_of_mass(su); dy, dx = nd.center_of_mass(du)
  best = (-1, s0, dx - s0 * sx, dy - s0 * sy)
  def score(s, tx, ty):
    return sum((warp(m, s, tx, ty, d.shape) > 0.5).__and__(d).sum() * 2 - (warp(m, s, tx, ty, d.shape) > 0.5).sum() - d.sum() for m, d in zip(src_masks, dst_masks))
  for it, (ds, dt) in enumerate(((0.06, 6), (0.02, 2), (0.006, 1))):
    _, s_, tx_, ty_ = best
    for s in np.linspace(s_ - ds, s_ + ds, 5):
      for ox in (-dt, 0, dt):
        for oy in (-dt, 0, dt):
          # keep the centroids together as the scale changes, then nudge
          tx = dx - s * sx + (tx_ - (dx - s_ * sx)) + ox; ty = dy - s * sy + (ty_ - (dy - s_ * sy)) + oy
          v = score(s, tx, ty)
          if v > best[0]: best = (v, s, tx, ty)
  return best[1:]


LOOK = json.load(open(G + 'src/data/naked-look.json'))
for g in ('male', 'female'):
  spec = json.load(open(H + f'/sheets/naked_{g}.json')); D = G + f'public/assets/final/body/naked/{g}/gear/'
  qc = []
  for anim, cells in spec['anims'].items():
    if isinstance(cells, dict): continue
    have = [p for p in ('top', 'pants', 'shoes', 'topo') if anim in LOOK[g]['gear'].get(p, [])]
    starter = {p: np.asarray(Image.open(D + f'{anim}_{p}_c0.png').convert('RGBA')).astype(np.float32) for p in have}
    out = {p: np.zeros_like(starter[p]) for p in have}; got = False
    for c, cell in enumerate(cells):
      path, idx = cell[0], cell[1]
      if not os.path.exists(AD + path): continue
      dimg = np.asarray(Image.open(H + '/gpt/dressed_nosword/' + path).convert('RGB')).astype(np.float32)
      aimg = np.asarray(Image.open(AD + path).convert('RGB')).astype(np.float32)
      if aimg.shape != dimg.shape: aimg = np.asarray(Image.fromarray(aimg.astype(np.uint8)).resize((dimg.shape[1], dimg.shape[0]), Image.LANCZOS)).astype(np.float32)
      dfs, afs = figures(dimg), figures(aimg)
      if idx >= len(dfs) or idx >= len(afs): print('  figure missing', g, anim, c); continue
      df, af = dfs[idx], afs[idx]
      # the armour figure onto the dressed one: its silhouette's box (same pose, same head)
      (ax0, ay0, ax1, ay1), (bx0, by0, bx1, by1) = af['box'], df['box']
      sa = (by1 - by0) / max(ay1 - ay0, 1); ta = (bx0 + bx1) / 2 - sa * (ax0 + ax1) / 2, by1 - sa * ay1
      x0, y0 = max(0, bx0 - 40), max(0, by0 - 40); x1, y1 = min(dimg.shape[1], bx1 + 40), min(dimg.shape[0], by1 + 40)
      de, da = keyed(dimg); da = da * df['m']
      ae, aa = keyed(aimg); aa = aa * af['m']
      A = warp(np.dstack([ae, aa]), sa, ta[0], ta[1], dimg.shape[:2])        # armour, in the dressed sheet's px
      dm = clothes_masks(de[y0:y1, x0:x1], da[y0:y1, x0:x1])
      cs = slice(c * S, (c + 1) * S)
      fm = [starter[p][:, cs, 3] > 127 for p in ('top', 'pants', 'shoes')]
      s, tx, ty = register(dm, fm)
      W = warp(A[y0:y1, x0:x1], s, tx, ty, (S, S))                           # armour in the frame
      e, al = W[..., :3], np.clip(W[..., 3], 0, 1)
      near = nd.binary_dilation(np.any(fm, 0), iterations=max(6, int(14 * s)))
      cloth = (al > 0.05) & near & ~skin(e, al)
      cloth = nd.binary_opening(cloth, iterations=1)
      # split by the nearest starter piece
      dist = np.stack([nd.distance_transform_edt(~m) if m.any() else np.full((S, S), 1e9) for m in fm])
      who = np.argmin(dist, 0)
      for k, p in enumerate(('top', 'pants', 'shoes')):
        m = cloth & (who == k)
        out[p][:, cs] = np.dstack([e * m[..., None], al * m * 255])
      if 'topo' in have:
        tm = starter['topo'][:, cs, 3] > 0
        out['topo'][:, cs] = out['top'][:, cs] * nd.binary_dilation(tm, iterations=2)[..., None]
      got = True
      print(g, anim, c, 'scale', round(s, 3))
    if not got: continue
    for p in have: Image.fromarray(out[p].clip(0, 255).astype(np.uint8)).save(D + f'{anim}_{p}_{iid}.png', optimize=True)
    qc.append(anim)
  print(g, 'moves done:', qc)
