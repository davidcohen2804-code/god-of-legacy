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
  'ivy_summit': {'name': 'Ivy Summit', 'src': 'ivy_heights', 'flip': True, 'open_right': True, 'crop': (560, 1672), 'over': 'terraces_2', 'dx': 40, 'H': 680, 'front': 122,
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
  # at the Sky Path's end: a whole map made of one huge cloud, floating (no wall below it, no towers at its ends; its
  # painted cloud cubes are its blocks)
  'cloud_haven': {'name': 'Cloud Haven', 'over': 'training_2', 'dx': 22, 'H': 800, 'front': 122, 'floor': (345, 575), 'sky': (140, 300),
                  'cloud': True, 'depth': -1.25, 'mirror': True,
                  'blocks': [{'id': 'block-l', 'x': (262, 452), 'front': 505, 'h': 82, 'depth': 30},
                             {'id': 'block-r', 'x': (1302, 1438), 'front': 512, 'h': 76, 'depth': 26}],
                  'mobs': {'kind': 'puffling', 'spawns': [[160, 470], [640, 430], [900, 540], [1120, 450], [1560, 500]]},
                  'boss': {'kind': 'big_grumble', 'spawns': [[2560, 480]]}},
  # on to the right: the pass where the sun hangs low (only a cloud gets through: the game burns anyone else)
  'sunfall_pass': {'name': 'Sunfall Pass', 'src': 'sunfall_pass', 'over': 'training_3', 'dx': 1564, 'H': 800, 'front': 122, 'floor': (505, 625),
                   'sky': (0, 150), 'cloud': True, 'depth': -1.24, 'blocks': [], 'mobs': {'kind': 'puffling', 'spawns': []}},
  # past the sun: a quiet cloud closed by the great cloud wall (GPT's painted end), a treasure for the brave
  'afterglow': {'name': 'Afterglow Rest', 'src': 'cloud_haven_end', 'over': 'plaza', 'dx': 1434, 'H': 800, 'front': 122, 'floor': (345, 575),
                'sky': (140, 300), 'cloud': True, 'depth': -1.245, 'wall_x': 1170,
                'blocks': [{'id': 'block-l', 'x': (262, 452), 'front': 505, 'h': 82, 'depth': 30}],
                'mobs': {'kind': 'puffling', 'spawns': [[700, 470], [980, 520]]},
                'reward': {'x': 357, 'item': 'storm_core', 'every': 600}},
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
  if m.get('mirror'):   # twice as wide: its mirror image, then itself (they meet seamlessly); blocks and monsters on both
    W0 = w; im = np.hstack([cv2.flip(im, 1), im]); h, w = im.shape[:2]
    m = dict(m, blocks=[dict(b, id=b['id'] + '-m', x=(W0 - b['x'][1], W0 - b['x'][0])) for b in m['blocks']] + [dict(b, x=(W0 + b['x'][0], W0 + b['x'][1])) for b in m['blocks']],
             mobs={'kind': m['mobs']['kind'], 'spawns': [[W0 - x, y] for x, y in m['mobs']['spawns']] + [[W0 + x, y] for x, y in m['mobs']['spawns']]})
  if m.get('wall_x'): W0 = w; m = dict(m, wall_r=w - m['wall_x'])
  if m.get('end'):   # twice as wide: its mirror image first, then GPT's own picture of its right end (that picture's left part
    # is this one's left part — the two meet seamlessly), where the floor ends against a towering wall of cloud
    W0 = w; end = cv2.imread(G + f"heights/{m['end']}.png"); end = cv2.resize(end, (W0, h)) if end.shape[:2] != (h, W0) else end
    im = np.hstack([cv2.flip(im, 1), end]); h, w = im.shape[:2]
    m = dict(m, blocks=[dict(b, id=b['id'] + '-m', x=(W0 - b['x'][1], W0 - b['x'][0])) for b in m['blocks']] + [dict(b, x=(W0 + b['x'][0], W0 + b['x'][1])) for b in m['blocks'][:1]],
             mobs={'kind': m['mobs']['kind'], 'spawns': [[W0 - x, y] for x, y in m['mobs']['spawns']] + [[W0 + x, y] for x, y in m['mobs']['spawns'] if x < m['wall_x'] - 80]},
             wall_r=W0 - m['wall_x'])
  if m.get('cloud'):   # cloud on cloud: no GrabCut — the sky fades out above the rim, the underside fades out below, the
    # two ends fade out (it floats), the floor solid
    yy = np.arange(h, dtype=np.float32)[:, None]; xx = np.arange(w, dtype=np.float32)[None, :]
    a = np.clip((yy - m['sky'][0]) / (m['sky'][1] - m['sky'][0]), 0, 1) * np.clip((h - 20 - yy) / 160, 0, 1)
    edge = np.minimum(xx, w - 1 - xx)
    a = a * np.clip(edge / 320, 0, 1) ** 1.5                       # its sky and underside melt away toward both ends
    if m.get('end') or m.get('wall_x'):   # the cloud wall at its right end: whole, from near the top down to the underside (its right edge soft)
      wall = np.clip((xx - (w - (W0 - m['wall_x']) - 80)) / 120, 0, 1) * np.clip(yy / 90, 0, 1) * np.clip((w - 1 - xx) / 150, 0, 1)
      a = np.maximum(a, wall)
    up = np.clip((m['floor'][0] - 12 - yy) / 70, 0, 1)   # 0 at the floor's back edge, 1 from 70 px above it (no hard line)
    if m.get('mirror') or m.get('wall_x'):
      sm = np.clip((xx - 80) / 1300, 0, 1); sm = sm * sm * (3 - 2 * sm)   # a long, smooth fade: no edge in the sky
      a = a * (1 - up * (1 - sm))   # the left end (where the Sky Path's clouds come in): its own sky gone, only the floor
    band = (yy >= m['floor'][0] + 6) & (yy < m['floor'][1] + 60)
    wob = 18 * np.sin(yy / 23.0) + 10 * np.sin(yy / 9.0 + 1)      # the floor's own ends: soft, uneven cloud edges
    a = np.where(band & ((xx < w / 2) if (m.get('end') or m.get('wall_x')) else True), np.maximum(a, np.clip((edge - 14 - wob) / 40, 0, 1)), a)   # (a closed right end: the wall's own edge)
    if m.get('end') or m.get('wall_x'): a = np.where(band & (xx >= w / 2), np.maximum(a, np.clip((w - 1 - xx) / 150, 0, 1)), a)
    rgba = np.dstack([cv2.cvtColor(im, cv2.COLOR_BGR2RGB), (a * 255).astype(np.uint8)])
    EXT = CAP_X1 - CAP_J1; wide = np.zeros((h, w + 2 * EXT, 4), np.uint8); wide[:, EXT:EXT + w] = rgba; rgba = wide
  else:
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
    for side in ((0,) if m.get('open_right') else (1, 0)):   # open on the right: the Sky Path's clouds go on from there
      c = r if side else r[:, ::-1]; rr = ramp if side else ramp[:, ::-1]
      x0 = EXT + w - bl if side else 0
      reg = wide[:, x0:x0 + c.shape[1]].astype(np.float32)
      ca = c[..., 3:4] / 255 * rr
      reg[..., :3] = c[..., :3] * ca + reg[..., :3] * (1 - ca); reg[..., 3:4] = reg[..., 3:4] * (1 - rr) + c[..., 3:4] * rr   # (a max of the two left the seam half see-through)
      wide[:, x0:x0 + c.shape[1]] = reg.clip(0, 255).astype(np.uint8)
    rgba = wide
    if m.get('open_right'):   # its right end melts into cloud (no tower, no cut edge)
      fx = np.clip((EXT + w - 1 - np.arange(rgba.shape[1])) / 90, 0, 1)[None, :]
      rgba[..., 3] = (rgba[..., 3] * fx).astype(np.uint8)
  cv2.imwrite(out_dir + f'{id_}.webp', cv2.cvtColor(rgba, cv2.COLOR_RGBA2BGRA), [cv2.IMWRITE_WEBP_QUALITY, 90])
  EXT = CAP_X1 - CAP_J1; w = rgba.shape[1] - 2 * EXT
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
  data.append({'id': id_, 'name': m['name'], 'x': X0, 'w': w, 'walk': [X0 + WALK_IN, X0 + w - m.get('wall_r', WALK_IN)], 'H': H, 'front': F, 'back': gy(f0),
               'img': f'assets/world/heights/{id_}.webp', 'cloud': bool(m.get('cloud')), 'imgX': X0 - EXT, 'depth': m.get('depth', -1.2), 'imgY': F - H - f1, 'imgH': h,
               'blocks': [{'id': b['id'], 'x0': X0 + b['x'][0], 'x1': X0 + b['x'][1], 'front': gy(b['front']), 'h': b['h'], 'depth': b['depth'], 'occ': o} for b, o in zip(m['blocks'], occ)],
               'mobs': {'kind': m['mobs']['kind'], 'spawns': [[X0 + x, gy(p)] for x, p in m['mobs']['spawns']]},
               **({'reward': {'x0': X0 + m['reward']['x'] - 40, 'x1': X0 + m['reward']['x'] + 40, 'item': m['reward']['item'], 'every': m['reward']['every']}} if m.get('reward') else {}),
               **({'boss': {'kind': m['boss']['kind'], 'spawns': [[X0 + x, gy(p)] for x, p in m['boss']['spawns']]}} if m.get('boss') else {})})
  print(id_, 'x', X0, 'H', H, 'floor y', gy(f0), '..', F)
json.dump(data, open(R + 'src/data/world-heights.json', 'w'), indent=1)
