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
  # the summit: higher still, behind Ivy Heights' left part (its wall rises from Ivy Heights' back balustrade); its
  # stair of cubes stands on Ivy Heights
  'ivy_summit': {'name': 'Ivy Summit', 'src': 'ivy_heights', 'flip': True, 'crop': (560, 1672), 'over': 'terraces_2', 'dx': 40, 'H': 680, 'front': 122,
                 'floor': (352, 580), 'sky': (120, 350), 'depth': -1.3,
                 'blocks': [{'id': 'block-l', 'x': (663, 846), 'front': 503, 'h': 85, 'depth': 26}],
                 'mobs': {'kind': 'thorn', 'spawns': [[300, 470], [520, 540], [960, 460]]}},
  'crimson_heights': {'name': 'Crimson Heights', 'over': 'ruins', 'H': 350, 'front': 350, 'floor': (345, 585), 'sky': (120, 345), 'recolor': True,
                  'blocks': [{'id': 'block-l', 'x': (268, 447), 'front': 503, 'h': 80, 'depth': 26},
                             {'id': 'block-r', 'x': (1318, 1437), 'front': 508, 'h': 70, 'depth': 23}],
                  'mobs': {'kind': 'cursed', 'spawns': [[160, 545], [620, 470], [860, 545], [1060, 450], [1200, 540], [1560, 480]]}},
  'orchard_heights': {'name': 'Orchard Heights', 'over': 'orchard_1', 'H': 350, 'front': 350, 'floor': (352, 580), 'sky': (120, 350),
                  'blocks': [{'id': 'block-l', 'x': (266, 449), 'front': 503, 'h': 85, 'depth': 26},
                             {'id': 'block-r', 'x': (1321, 1434), 'front': 510, 'h': 70, 'depth': 23}],
                  'mobs': {'kind': 'thorn', 'spawns': [[300, 545], [620, 470], [820, 545], [1010, 445], [1180, 530], [1400, 480]]}},
}
EDGE_SHADE = 34   # px: the ends shaded toward their edge (they turn away from the light: volume)
WALK_IN = 12    # the walkable floor stops this far in from each end (the corner towers stand just beyond): the picture's left / right ends fade out (the floor ends in the air there; you cannot walk off it)
# the end tower (GPT), sky keyed out: terrace from CAP_J0, fully the cap from CAP_J1, the tower's far side at CAP_X1
_ci = cv2.imread(G + 'heights/end_tower.png'); _h, _w = _ci.shape[:2]
_sd = np.full((_h, _w), cv2.GC_PR_BGD, np.uint8); _sd[:110] = cv2.GC_BGD; _sd[:, 1385:] = cv2.GC_BGD
_sd[250:360, :980] = cv2.GC_PR_FGD; _sd[360:, :1050] = cv2.GC_FGD; _sd[10:300, 1075:1335] = cv2.GC_PR_FGD; _sd[300:, 1060:1300] = cv2.GC_FGD
_bg, _fg = np.zeros((1, 65)), np.zeros((1, 65))
cv2.grabCut(_ci, _sd, None, _bg, _fg, 6, cv2.GC_INIT_WITH_MASK)
_a = cv2.GaussianBlur(np.where((_sd == 1) | (_sd == 3), 255, 0).astype(np.uint8), (3, 3), 0)
CAP = np.dstack([cv2.cvtColor(_ci, cv2.COLOR_BGR2RGB), _a])
CAP_J0, CAP_J1, CAP_X1 = 760, 900, 1380
out_dir = R + 'public/assets/world/heights/'; os.makedirs(out_dir, exist_ok=True)
data = []
for id_, m in MAPS.items():
  im = cv2.imread(G + f"heights/{m.get('src', id_)}.png"); h, w = im.shape[:2]
  if m.get('flip'): im = cv2.flip(im, 1)
  if m.get('crop'): im = im[:, m['crop'][0]:m['crop'][1]].copy()
  h, w = im.shape[:2]
  seed = np.full((h, w), cv2.GC_PR_BGD, np.uint8); seed[:m['sky'][0]] = cv2.GC_BGD; seed[m['sky'][1]:] = cv2.GC_FGD
  seed[m['sky'][0] + 80:m['sky'][1]] = cv2.GC_PR_FGD
  bg, fg = np.zeros((1, 65)), np.zeros((1, 65))
  cv2.grabCut(im, seed, None, bg, fg, 6, cv2.GC_INIT_WITH_MASK)
  a = np.where((seed == cv2.GC_FGD) | (seed == cv2.GC_PR_FGD), 255, 0).astype(np.uint8)
  a = cv2.morphologyEx(a, cv2.MORPH_OPEN, np.ones((3, 3), np.uint8))
  a = cv2.GaussianBlur(a, (3, 3), 0).astype(np.float32)
  a[m['floor'][0] - 12:] = 255   # the floor and its wall: solid (GrabCut may leave thin spots in them)
  rgba = np.dstack([cv2.cvtColor(im, cv2.COLOR_BGR2RGB), a.astype(np.uint8)])
  # its two ends, anchored: a corner pier (one of its wall's pilasters, from the ground up to the floor's front lip) and a
  # balustrade post with its urn at the back corner; the floor's cut edge a little shaded
  P = m.get('pier', (527, 612, 578)); Q = m.get('post', (80, 155, 190, 352))
  pier = rgba[P[2]:, P[0]:P[1]].copy(); pier[..., 3] = 255
  post = rgba[Q[2]:Q[3], Q[0]:Q[1]].copy()
  # its two ends: GPT's corner tower (heights/end_tower.png: the same terrace ending against a domed stone bastion) —
  # its last stretch of terrace cross-faded over this map's end, the tower beyond it (mirrored on the left)
  EXT = CAP_X1 - CAP_J1
  wide = np.zeros((h, w + 2 * EXT, 4), np.uint8); wide[:, EXT:EXT + w] = rgba
  cap = CAP[:h]
  if m.get('recolor'):
    ref = rgba[m['floor'][1] + 40:, 100:w - 100, :3].reshape(-1, 3).astype(np.float32)
    src = CAP[400:, 200:950, :3].reshape(-1, 3).astype(np.float32)
    c = cap.astype(np.float32); c[..., :3] = (c[..., :3] - src.mean(0)) / (src.std(0) + 1e-3) * ref.std(0) + ref.mean(0)
    cap = c.clip(0, 255).astype(np.uint8)
  r = cap[:, CAP_J0:CAP_X1].astype(np.float32); bl = CAP_J1 - CAP_J0
  ramp = np.clip(np.arange(r.shape[1]) / bl, 0, 1)[None, :, None]
  for side in (1, 0):
    c = r if side else r[:, ::-1]; rr = ramp if side else ramp[:, ::-1]
    x0 = EXT + w - bl if side else 0
    reg = wide[:, x0:x0 + c.shape[1]].astype(np.float32)
    ca = c[..., 3:4] / 255 * rr
    reg[..., :3] = c[..., :3] * ca + reg[..., :3] * (1 - ca); reg[..., 3:4] = reg[..., 3:4] * (1 - rr) + c[..., 3:4] * rr   # (a max of the two left the seam half see-through)
    wide[:, x0:x0 + c.shape[1]] = reg.clip(0, 255).astype(np.uint8)
  rgba = wide
  cv2.imwrite(out_dir + f'{id_}.webp', cv2.cvtColor(rgba, cv2.COLOR_RGBA2BGRA), [cv2.IMWRITE_WEBP_QUALITY, 90])
  w = rgba.shape[1] - 2 * EXT
  X0 = STRIP['areas'][m['over']]['x'] + m.get('dx', 0); f0, f1 = m['floor']; F = m['front']; H = m['H']
  occ = []   # each block's own cut-out: drawn over whoever walks behind it up there
  for b in m['blocks']:
    # the block only (a little inside its outline, feathered): no floor around it, so nothing shows that differs from the
    # picture under it
    x0, x1 = b['x'][0] + 2, b['x'][1] - 2; y0, y1 = b['front'] - b['h'] - b['depth'] + 2, b['front'] - 2
    cut = rgba[y0:y1, EXT + x0:EXT + x1].copy()
    mk = np.zeros(cut.shape[:2], np.float32); mk[2:-2, 2:-2] = 1; mk = cv2.GaussianBlur(mk, (5, 5), 0)
    cut[..., 3] = (cut[..., 3] * mk).astype(np.uint8)
    cv2.imwrite(out_dir + f"{id_}-{b['id']}.webp", cv2.cvtColor(cut, cv2.COLOR_RGBA2BGRA), [cv2.IMWRITE_WEBP_QUALITY, 92])
    occ.append({'img': f"assets/world/heights/{id_}-{b['id']}.webp", 'x': X0 + x0, 'py': y0})
  gy = lambda p: F - (f1 - p)          # picture row on the floor → the terrace's ground y
  data.append({'id': id_, 'name': m['name'], 'x': X0, 'w': w, 'walk': [X0 + WALK_IN, X0 + w - WALK_IN], 'H': H, 'front': F, 'back': gy(f0),
               'img': f'assets/world/heights/{id_}.webp', 'imgX': X0 - EXT, 'depth': m.get('depth', -1.2), 'imgY': F - H - f1, 'imgH': h,
               'blocks': [{'id': b['id'], 'x0': X0 + b['x'][0], 'x1': X0 + b['x'][1], 'front': gy(b['front']), 'h': b['h'], 'depth': b['depth'], 'occ': o} for b, o in zip(m['blocks'], occ)],
               'mobs': {'kind': m['mobs']['kind'], 'spawns': [[X0 + x, gy(p)] for x, p in m['mobs']['spawns']]}})
  print(id_, 'x', X0, 'H', H, 'floor y', gy(f0), '..', F)
json.dump(data, open(R + 'src/data/world-heights.json', 'w'), indent=1)
