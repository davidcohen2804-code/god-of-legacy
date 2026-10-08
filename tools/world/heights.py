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
  'orchard_heights': {'name': 'Orchard Heights', 'over': 'orchard_1', 'H': 350, 'front': 350, 'floor': (352, 580), 'sky': (120, 350),
                  'blocks': [{'id': 'block-l', 'x': (266, 449), 'front': 503, 'h': 85, 'depth': 26},
                             {'id': 'block-r', 'x': (1321, 1434), 'front': 510, 'h': 70, 'depth': 23}],
                  'mobs': {'kind': 'thorn', 'spawns': [[300, 545], [620, 470], [820, 545], [1010, 445], [1180, 530], [1400, 480]]}},
}
EDGE_SHADE = 10   # px: the cut ends of the floor shaded a little
WALK_IN = 70    # the walkable floor stops this far in from each end (the corner posts): the picture's left / right ends fade out (the floor ends in the air there; you cannot walk off it)
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
  rgba = np.dstack([cv2.cvtColor(im, cv2.COLOR_BGR2RGB), a.astype(np.uint8)])
  # its two ends, anchored: a corner pier (one of its wall's pilasters, from the ground up to the floor's front lip) and a
  # balustrade post with its urn at the back corner; the floor's cut edge a little shaded
  P = m.get('pier', (527, 612, 578)); Q = m.get('post', (80, 155, 190, 352))
  pier = rgba[P[2]:, P[0]:P[1]].copy(); pier[..., 3] = 255
  post = rgba[Q[2]:Q[3], Q[0]:Q[1]].copy()
  f0r, f1r = m['floor']
  lip = rgba[f1r - 2:f1r + 30, 700:1000].copy(); lip[..., 3] = 255          # the floor's front lip (a stone coping)
  side_lip = cv2.resize(np.rot90(lip), (lip.shape[0], f1r - f0r + 8), interpolation=cv2.INTER_AREA)   # the same coping along the floor's side edge
  for side in (0, 1):
    sw = side_lip.shape[1]; sx = 0 if side == 0 else w - sw
    rgba[f0r - 6:f0r - 6 + side_lip.shape[0], sx:sx + sw] = side_lip if side == 0 else side_lip[:, ::-1]
    pw, qw = pier.shape[1], post.shape[1]
    px = 0 if side == 0 else w - pw; qx = 0 if side == 0 else w - qw
    rgba[P[2]:, px:px + pw] = pier[:, ::-1] if side else pier
    reg = rgba[Q[2]:Q[3], qx:qx + qw]; pa = post[..., 3:4].astype(np.float32) / 255
    reg[..., :3] = (post[..., :3] * pa + reg[..., :3] * (1 - pa)).astype(np.uint8); reg[..., 3] = np.maximum(reg[..., 3], post[..., 3])
    edge = np.arange(EDGE_SHADE)[::-1] if side == 0 else np.arange(EDGE_SHADE)
    cols = slice(0, EDGE_SHADE) if side == 0 else slice(w - EDGE_SHADE, w)
    k = 1 - 0.35 * (edge / EDGE_SHADE)
    rgba[:, cols, :3] = (rgba[:, cols, :3] * k[None, :, None]).astype(np.uint8)
  cv2.imwrite(out_dir + f'{id_}.webp', cv2.cvtColor(rgba, cv2.COLOR_RGBA2BGRA), [cv2.IMWRITE_WEBP_QUALITY, 90])
  X0 = STRIP['areas'][m['over']]['x'] + m.get('dx', 0); f0, f1 = m['floor']; F = m['front']; H = m['H']
  occ = []   # each block's own cut-out: drawn over whoever walks behind it up there
  for b in m['blocks']:
    # the block only (a little inside its outline, feathered): no floor around it, so nothing shows that differs from the
    # picture under it
    x0, x1 = b['x'][0] + 2, b['x'][1] - 2; y0, y1 = b['front'] - b['h'] - b['depth'] + 2, b['front'] - 2
    cut = rgba[y0:y1, x0:x1].copy()
    mk = np.zeros(cut.shape[:2], np.float32); mk[2:-2, 2:-2] = 1; mk = cv2.GaussianBlur(mk, (5, 5), 0)
    cut[..., 3] = (cut[..., 3] * mk).astype(np.uint8)
    cv2.imwrite(out_dir + f"{id_}-{b['id']}.webp", cv2.cvtColor(cut, cv2.COLOR_RGBA2BGRA), [cv2.IMWRITE_WEBP_QUALITY, 92])
    occ.append({'img': f"assets/world/heights/{id_}-{b['id']}.webp", 'x': X0 + x0, 'py': y0})
  gy = lambda p: F - (f1 - p)          # picture row on the floor → the terrace's ground y
  data.append({'id': id_, 'name': m['name'], 'x': X0, 'w': w, 'walk': [X0 + WALK_IN, X0 + w - WALK_IN], 'H': H, 'front': F, 'back': gy(f0),
               'img': f'assets/world/heights/{id_}.webp', 'depth': m.get('depth', -1.2), 'imgY': F - H - f1, 'imgH': h,
               'blocks': [{'id': b['id'], 'x0': X0 + b['x'][0], 'x1': X0 + b['x'][1], 'front': gy(b['front']), 'h': b['h'], 'depth': b['depth'], 'occ': o} for b, o in zip(m['blocks'], occ)],
               'mobs': {'kind': m['mobs']['kind'], 'spawns': [[X0 + x, gy(p)] for x, p in m['mobs']['spawns']]}})
  print(id_, 'x', X0, 'H', H, 'floor y', gy(f0), '..', F)
json.dump(data, open(R + 'src/data/world-heights.json', 'w'), indent=1)
