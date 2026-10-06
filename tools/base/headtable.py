# headtable.py : THE head transform of every base frame — one table for every head item.
# Template = the head (hair + face) of idle frame 0. Per frame: [tx, ty, angle, scale, score, flip] that lays the
# template head onto that frame's head (anchors.fit), cached per frame state, then the manual corrections of
# tools/base/head_fix.json ({"anim:col": [tx, ty, angle, scale, flip]}) for the frames a fit cannot read (face hidden,
# head turned to the viewer). An item drawn on the idle head is placed with this transform on every frame.
#   python3 tools/base/headtable.py  → refresh the cache and print the weakest fits
import json, os, sys, hashlib, inspect, numpy as np
from PIL import Image
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import anchors
G = os.path.dirname(os.path.abspath(__file__)) + '/../../'; S = 352
BASE = G + 'public/assets/final/body/warrior/base/'
CACHE = G + 'tools/base/head_table.json'; FIXP = G + 'tools/base/head_fix.json'

def template():
  return anchors.masks('idle', 0)

def table(verbose=True):
  T = template()
  code = hashlib.md5((inspect.getsource(anchors.masks) + inspect.getsource(anchors.fit)).encode() + T[0].tobytes() + T[1].tobytes()).hexdigest()
  A = json.load(open(CACHE)) if os.path.exists(CACHE) else {}
  if A.get('code') != code: A = {'code': code, 'frames': {}, 'states': {}}
  anims = sorted(json.load(open(G + 'src/data/base-sheets.json')))
  for a in anims:
    st = hashlib.md5(open(BASE + a + '_m.png', 'rb').read()).hexdigest()
    if A['states'].get(a) == st and a in A['frames']: continue
    n = np.array(Image.open(BASE + a + '_m.png')).shape[1] // S; row = []
    for c in range(n):
      Fm = anchors.masks(a, c)
      if Fm[0].sum() < 50: row.append(None); continue
      r, _ = anchors.fit(T, Fm); row.append(r)
    # weak fits (head hidden behind arms…): search near the angle of the nearest well-fitted frames of the same move
    good = [i for i, x in enumerate(row) if x and x[4] >= 0.7]
    for i, x in enumerate(row):
      if not x or x[4] >= 0.7 or not good: continue
      nb = sorted(good, key=lambda g: abs(g - i))[:2]; am = int(round(np.mean([row[g][2] for g in nb])))
      r2, _ = anchors.fit(T, anchors.masks(a, i), arange=(max(-75, am - 25), min(75, am + 25)))
      row[i] = r2 if (r2[4] >= x[4] - 0.08) else x
    A['frames'][a] = row; A['states'][a] = st
    if verbose: print('fit', a, [(x[2], 'F' if x[5] else '') if x else None for x in row], flush=True)
  ty, tx = np.nonzero(T[0]); A['center'] = [int(round(tx.mean())), int(round(ty.mean()))]
  A['frames'] = {a: A['frames'][a] for a in anims}; A['states'] = {a: A['states'][a] for a in anims}
  json.dump(A, open(CACHE, 'w'))
  fix = json.load(open(FIXP)) if os.path.exists(FIXP) else {}
  out = {'center': A['center'], 'frames': {a: [list(x) if x else None for x in row] for a, row in A['frames'].items()}, 'fixed': []}
  for k, v in fix.items():
    if k.startswith('_'): continue
    a, c = k.split(':'); c = int(c)
    if a in out['frames'] and c < len(out['frames'][a]):
      tx_, ty_, ang, sc, fl = v; out['frames'][a][c] = [tx_, ty_, ang, sc, 9.0, bool(fl)]; out['fixed'].append(k)
  return out

if __name__ == '__main__':
  t = table()
  low = sorted((x[4], a, c) for a, row in t['frames'].items() for c, x in enumerate(row) if x and x[4] < 0.85)
  print('fixed', t['fixed']); print('weakest', low)
