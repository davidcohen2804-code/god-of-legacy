# urns.py : the flower urns on the front railing stand in front of the floor — each one's silhouette (foliage + bowl,
# above the railing) is cut from the joined world picture and becomes a prop of the area it stands in (world-areas.json,
# id "urn-<n>", foot below the floor's front edge so it never blocks, drawn over anyone behind it).
#   python3 tools/world/strip.py && python3 tools/world/urns.py && python3 tools/world/strip.py
import json, os
import numpy as np, cv2
G = os.path.dirname(os.path.abspath(__file__)) + '/'
R = G + '../../'
D = json.load(open(R + 'src/data/world-areas.json'))
S = json.load(open(R + 'src/data/world-strip.json'))
W, H = S['w'], S['h']
pic = np.zeros((H, W, 3), np.uint8)
from PIL import Image
for i, (x, w) in enumerate(S['tiles']):
  pic[:, x:x + w] = cv2.cvtColor(np.asarray(Image.open(R + f"public/assets/world/strip/{i}.{S.get('ext', 'jpg')}").convert('RGB')), cv2.COLOR_RGB2BGR)
hsv = cv2.cvtColor(pic, cv2.COLOR_BGR2HSV).astype(np.int32)
Hh, Ss, Vv = hsv[..., 0], hsv[..., 1], hsv[..., 2]
leaf = (((Hh <= 7) | (Hh >= 165) | ((Hh >= 18) & (Hh <= 50))) & (Ss > 120)) | (Vv < 85)   # red / yellow-green leaves, shade
X = {a: S['areas'][a]['x'] for a in D['row']}
URNS_LOCAL = {'courtyard': [60, 586, 1097], 'training': [547, 1162], 'plaza': [547, 1162], 'ruins': [547, 1159], 'temple': [547, 1162, 1626],
              'terraces_1': [580, 1095]}
AW = D['size'][0]
for a in D['row']:   # stand-in maps (tools/world/expand.py): their picture's urns, mirrored with it
  A = D['areas'][a]
  if A.get('standin') in URNS_LOCAL: URNS_LOCAL[a] = [round(AW - u) if A.get('mirrored') else u for u in URNS_LOCAL[A['standin']]]
centres = sorted({round(X[a] + u) for a, us in URNS_LOCAL.items() for u in us} | {X[b] + 60 for b in D['row'][1:]})  # + one urn on every seam
TOP, CUT = 560, 668                                  # search band; the part that can overlap a player ends at the railing
for a in D['row']: D['areas'][a]['props'] = [p for p in D['areas'][a]['props'] if not p['id'].startswith('urn-')]
n = 0
for c in centres:
  x0, x1 = max(0, c - 95), min(W, c + 95)
  m = leaf[TOP:CUT, x0:x1].astype(np.uint8)
  m = cv2.morphologyEx(m, cv2.MORPH_OPEN, np.ones((3, 3), np.uint8))
  m = cv2.morphologyEx(m, cv2.MORPH_CLOSE, np.ones((7, 7), np.uint8))
  k, lab, st, cen = cv2.connectedComponentsWithStats(m, 8)
  # the biggest piece reaching the bottom (the urn sits on the railing) near the centre
  cand = [i for i in range(1, k) if st[i][4] > 800 and st[i][1] + st[i][3] >= (CUT - TOP) - 6 and abs(st[i][0] + st[i][2] / 2 - (c - x0)) < 80]
  if not cand: print('no urn at', c); continue
  i = max(cand, key=lambda i: st[i][4])
  piece = (lab == i).astype(np.uint8)
  cnts, _ = cv2.findContours(piece, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_NONE)
  full = np.zeros_like(piece); cv2.drawContours(full, cnts, -1, 1, -1)
  # the urn proper: its foliage (not the leaves lying on the floor or the railing beside it) and its stone bowl
  ys, xs = np.nonzero(full[60:85]); mid = int(np.median(xs)) if len(xs) else c - x0   # the bowl's middle (rows 620..645)
  keep = np.zeros_like(full); keep[:, max(0, mid - 80):mid + 81] = 1
  full = full * keep
  full[76:, max(0, mid - 44):mid + 45] = 1                     # the bowl, from just under the foliage to the railing
  full = cv2.erode(full, np.ones((5, 5), np.uint8))          # 2 px inside the outline: never a bite out of someone behind
  cnts, _ = cv2.findContours(full, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_NONE)
  cnt = max(cnts, key=cv2.contourArea)
  poly = cv2.approxPolyDP(cnt, 1.6, True)[:, 0, :]
  pts = [[int(px) + x0, int(py) + TOP] for px, py in poly]
  a = next(r for r in reversed(D['row']) if X[r] <= c)        # the area it stands in
  bx0, bx1 = min(p[0] for p in pts), max(p[0] for p in pts)
  D['areas'][a]['props'].append({'id': f'urn-{n}', 'foot': [[bx0 - X[a], 672], [bx1 - X[a], 672], [bx1 - X[a], 698], [bx0 - X[a], 698]], 'h': 999,
                                 'occ': [[px - X[a], py] for px, py in pts]})
  print('urn', n, 'at', c, '→', a, 'x', bx0, bx1, 'top', min(p[1] for p in pts), 'points', len(pts))
  n += 1
open(R + 'src/data/world-areas.json', 'w').write(json.dumps(D, indent=1, ensure_ascii=False) + '\n')
