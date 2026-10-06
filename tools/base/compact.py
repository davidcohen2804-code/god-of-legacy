# compact.py : keep only the base frames the game shows (fewer frames = less art for every item).
#   idle  → frame 0 only (one still idle frame)        react → frames 0, 1, 7 (hit, heavy stagger, stance)
#   death, recovery → removed (death = the ghost; recovery shows react's stance frame)
# Applies to the base strips (body, mask, weapon) and to every item's base layers. src/data/base-cols.json keeps the
# original column of each kept frame: the game maps its pose columns through it. Safe to run twice.
import json, os, glob, numpy as np
from PIL import Image
G = os.path.dirname(os.path.abspath(__file__)) + '/../../'; S = 352
BASE = G + 'public/assets/final/body/warrior/base/'
KEEP = {'idle': (12, [0]), 'react': (8, [0, 1, 7])}   # anim: (original column count, kept columns)
DROP = ['death', 'recovery']

def compact(path, n0, cols):
  im = np.array(Image.open(path))
  if im.shape[1] != n0 * S: return False   # already compacted (or another geometry): leave it
  Image.fromarray(np.concatenate([im[:, c * S:(c + 1) * S] for c in cols], 1)).save(path, optimize=True); return True

dirs = [BASE] + sorted(glob.glob(G + 'public/assets/final/cosmetics/warrior/*/layers/base/'))
for d in dirs:
  for a, (n0, cols) in KEEP.items():
    for suf in (('.png', '_m.png', '_weapon.png') if d == BASE else ('.png',)):
      p = d + a + suf
      if os.path.exists(p) and compact(p, n0, cols): print('compacted', os.path.relpath(p, G))
  for a in DROP:
    for suf in ('.png', '_m.png', '_weapon.png'):
      p = d + a + suf
      if os.path.exists(p): os.remove(p); print('removed', os.path.relpath(p, G))
lp = G + 'src/data/base-sheets.json'; L = [a for a in json.load(open(lp)) if a not in DROP]; json.dump(sorted(L), open(lp, 'w'))
json.dump({a: cols for a, (_, cols) in KEEP.items()}, open(G + 'src/data/base-cols.json', 'w'))
print('base anims', len(L))
