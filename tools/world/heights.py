# heights.py : maps ABOVE the terrace — a whole floor high up behind it (its tall front wall standing behind the
# terrace's back balustrade), reached by jumping up a stair of blocks; you run, fight and drop back down.
#   in : tools/world/heights/<id>.png (GPT: sky on top, the floor in the middle band, its front wall below)
#   out: public/assets/world/heights/<id>.webp (the sky taken out: GrabCut seeded by the bands, edges feathered, the
#        picture's two ends fading out), src/data/world-heights.json (where it stands, how high, its floor, its blocks
#        and monsters — in the game's world px)
#   python3 tools/world/heights.py   (then tools/world/strip.py: the floor reaches up there)
import json, os
import numpy as np, cv2
G = os.path.dirname(os.path.abspath(__file__)) + '/'
R = G + '../../'
STRIP = json.load(open(R + 'src/data/world-strip.json'))
# per map: the area it stands over, its height (z of its floor), its floor's front edge on the terrace's ground (y), and
# in its picture: the floor's back / front edge rows, the sky seeds (rows surely sky / surely not), its blocks, monsters
MAPS = {
  'ivy_heights': {'name': 'Ivy Heights', 'over': 'terraces_2', 'H': 350, 'front': 350, 'floor': (352, 580), 'sky': (120, 350),
                  'blocks': [{'id': 'block-l', 'x': (266, 449), 'front': 503, 'h': 85, 'depth': 26},
                             {'id': 'block-r', 'x': (1321, 1434), 'front': 510, 'h': 70, 'depth': 23}],
                  'mobs': {'kind': 'sprout', 'spawns': [[300, 545], [620, 470], [820, 545], [1010, 445], [1180, 530], [1400, 480]]}},
  'orchard_heights': {'name': 'Orchard Heights', 'over': 'orchard_1', 'H': 350, 'front': 350, 'floor': (352, 580), 'sky': (120, 350),
                  'blocks': [{'id': 'block-l', 'x': (266, 449), 'front': 503, 'h': 85, 'depth': 26},
                             {'id': 'block-r', 'x': (1321, 1434), 'front': 510, 'h': 70, 'depth': 23}],
                  'mobs': {'kind': 'thorn', 'spawns': [[300, 545], [620, 470], [820, 545], [1010, 445], [1180, 530], [1400, 480]]}},
}
FADE = 220  # px
WALK_IN = 150   # the walkable floor stops this far in from each end (the faded part is out of reach): the picture's left / right ends fade out (the floor ends in the air there; you cannot walk off it)
out_dir = R + 'public/assets/world/heights/'; os.makedirs(out_dir, exist_ok=True)
data = []
for id_, m in MAPS.items():
  im = cv2.imread(G + f"heights/{m.get('src', id_)}.png"); h, w = im.shape[:2]
  if m.get('flip'): im = cv2.flip(im, 1)
  seed = np.full((h, w), cv2.GC_PR_BGD, np.uint8); seed[:m['sky'][0]] = cv2.GC_BGD; seed[m['sky'][1]:] = cv2.GC_FGD
  seed[m['sky'][0] + 80:m['sky'][1]] = cv2.GC_PR_FGD
  bg, fg = np.zeros((1, 65)), np.zeros((1, 65))
  cv2.grabCut(im, seed, None, bg, fg, 6, cv2.GC_INIT_WITH_MASK)
  a = np.where((seed == cv2.GC_FGD) | (seed == cv2.GC_PR_FGD), 255, 0).astype(np.uint8)
  a = cv2.morphologyEx(a, cv2.MORPH_OPEN, np.ones((3, 3), np.uint8))
  a = cv2.GaussianBlur(a, (3, 3), 0).astype(np.float32)
  ramp = np.clip(np.minimum(np.arange(w), w - 1 - np.arange(w)) / FADE, 0, 1)
  a *= ramp[None, :]
  rgba = np.dstack([cv2.cvtColor(im, cv2.COLOR_BGR2RGB), a.astype(np.uint8)])
  cv2.imwrite(out_dir + f'{id_}.webp', cv2.cvtColor(rgba, cv2.COLOR_RGBA2BGRA), [cv2.IMWRITE_WEBP_QUALITY, 90])
  X0 = STRIP['areas'][m['over']]['x']; f0, f1 = m['floor']; F = m['front']; H = m['H']
  occ = []   # each block's own cut-out: drawn over whoever walks behind it up there
  for b in m['blocks']:
    x0, x1 = b['x'][0] - 3, b['x'][1] + 3; y0, y1 = b['front'] - b['h'] - b['depth'] - 4, b['front'] + 2
    cv2.imwrite(out_dir + f"{id_}-{b['id']}.webp", cv2.cvtColor(rgba[y0:y1, x0:x1], cv2.COLOR_RGBA2BGRA), [cv2.IMWRITE_WEBP_QUALITY, 92])
    occ.append({'img': f"assets/world/heights/{id_}-{b['id']}.webp", 'x': X0 + x0, 'py': y0})
  gy = lambda p: F - (f1 - p)          # picture row on the floor → the terrace's ground y
  data.append({'id': id_, 'name': m['name'], 'x': X0, 'w': w, 'walk': [X0 + WALK_IN, X0 + w - WALK_IN], 'H': H, 'front': F, 'back': gy(f0),
               'img': f'assets/world/heights/{id_}.webp', 'imgY': F - H - f1, 'imgH': h,
               'blocks': [{'id': b['id'], 'x0': X0 + b['x'][0], 'x1': X0 + b['x'][1], 'front': gy(b['front']), 'h': b['h'], 'depth': b['depth'], 'occ': o} for b, o in zip(m['blocks'], occ)],
               'mobs': {'kind': m['mobs']['kind'], 'spawns': [[X0 + x, gy(p)] for x, p in m['mobs']['spawns']]}})
  print(id_, 'x', X0, 'H', H, 'floor y', gy(f0), '..', F)
json.dump(data, open(R + 'src/data/world-heights.json', 'w'), indent=1)
