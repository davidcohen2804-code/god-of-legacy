# relabel.py : robust hair labels (40) on every base frame. The hair is the biggest brown blob of the figure that is
# not a shoe (shoes are brown too, at the feet) — wherever the head is (bowed, looking up, behind the arms).
import json, os, numpy as np
from PIL import Image
from scipy import ndimage as nd
G = os.path.dirname(os.path.abspath(__file__)) + '/../../'; S = 352
BASE = G + 'public/assets/final/body/warrior/base/'
anims = json.load(open(G + 'src/data/base-sheets.json'))
def relabel_frame(p, mk):
  """p: RGBA frame (float), mk: packed mask → new hair-labelled R channel (or None if no figure)."""
  fig = p[..., 3] > 128
  if fig.sum() < 300: return None
  R, Gc, B = p[..., 0], p[..., 1], p[..., 2]; mx = np.maximum(np.maximum(R, Gc), B); mn = np.minimum(np.minimum(R, Gc), B); sat = (mx - mn) / np.maximum(mx, 1)
  skin = mk[..., 0] == 60; sword = mk[..., 1] > 127
  brown = fig & (R > Gc + 12) & (Gc > B + 4) & (mx < 225) & (sat > 0.22) & ~sword
  brown &= ~(skin & (mx > 200))
  ys = np.nonzero(fig.any(1))[0]; bot = ys.max()
  lab, k = nd.label(nd.binary_closing(brown, iterations=1)); best, bs = 0, 0
  for i in range(1, k + 1):
    cm = lab == i; cy = np.nonzero(cm)[0].mean()
    if cy > bot - 45: continue
    if cm.sum() > bs: best, bs = i, cm.sum()
  if not best: return None
  hair = lab == best; near = nd.binary_dilation(hair, iterations=3)
  for i in range(1, k + 1):
    cm = lab == i
    if i != best and (cm & near).any() and np.nonzero(cm)[0].mean() < bot - 45: hair |= cm
  hair = nd.binary_fill_holes(hair) & brown | (nd.binary_fill_holes(hair) & fig & ~skin & ~sword & (mx < 140))
  old = mk[..., 0] == 40; newlab = mk[..., 0].copy(); newlab[hair] = 40
  lost = old & ~hair
  if lost.any():
    keep = (newlab != 40) & (newlab != 0)
    idx = nd.distance_transform_edt(~keep, return_distances=False, return_indices=True)
    newlab[lost] = newlab[idx[0][lost], idx[1][lost]]
  return newlab

if __name__ == '__main__':
 for a in anims:
  px = np.array(Image.open(BASE + a + '.png').convert('RGBA')); m = np.array(Image.open(BASE + a + '_m.png'))
  n = px.shape[1] // S; changed = 0
  for c in range(n):
    nl = relabel_frame(px[:, c * S:(c + 1) * S].astype(np.float32), m[:, c * S:(c + 1) * S])
    if nl is None: continue
    changed += int((nl != m[:, c * S:(c + 1) * S, 0]).sum()); m[:, c * S:(c + 1) * S, 0] = nl
  Image.fromarray(m).save(BASE + a + '_m.png', optimize=True); print(a, 'changed px', changed)
