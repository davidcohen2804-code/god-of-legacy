# strip.py : the open world as ONE long picture — the maps of world-areas.json "row" (sun painted out: work/<area>_nosun.png
# from nosun.py) side by side, every pair of neighbours joined so the player walks straight on:
#   blend : the two maps overlap N px and meet along the line where they look most alike (min-cost cut), feathered
#   gap   : GPT's painting of the gap between them (bridges/gpt_<a>_<b>.png, painted on bridge_req.py's canvas), registered
#           onto that canvas and blended into both maps; a mirrored stand-in until it exists
# The floors: every map's walk polygon (minus the edges a bridge repaints; only floor of both maps where two overlap) and
# each bridge's own polygon ("walk" of its join, canvas px) merged into one polygon.
#   → public/assets/world/strip/<i>.jpg (2048-px tiles), public/assets/world/minimap/world.jpg (the strip, small),
#     public/assets/world/props/<id>.png + src/data/world-props.json (occluder cut-outs, world px),
#     src/data/world-strip.json (size, tiles, each area's x and span, the walkable floor, every prop in world px)
# Re-run after any change to world-areas.json floors / props / joins (the game reads world px from world-strip.json).
#   python3 tools/world/strip.py [--preview]   (--preview: also tools/world/qc/strip.jpg with the floor drawn)
import json, os, sys
import numpy as np, cv2
from PIL import Image, ImageDraw
from shapely.geometry import Polygon, box
from shapely.ops import unary_union
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from nosun import find_sun, unsun

G = os.path.dirname(os.path.abspath(__file__)) + '/'
R = G + '../../'
D = json.load(open(R + 'src/data/world-areas.json'))
AW, AH = D['size']
ROW, J = D['row'], D['joins']
KEEP = 636   # bridge canvas = last KEEP px of the left map | gap | first KEEP px of the right map (as bridge_req.py)
TILE = 2048

# ------------------------------------------------------------------ layout
xs = {ROW[0]: 0}
for a, b in zip(ROW, ROW[1:]):
  j = J[f'{a}|{b}']
  xs[b] = xs[a] + AW - j['blend'] if 'blend' in j else xs[a] + AW + j['gap']
W = xs[ROW[-1]] + AW
maps = {k: cv2.imread(G + f'work/{k}_nosun.png').astype(np.float32) for k in ROW}
strip = np.zeros((AH, W, 3), np.float32)
for k in ROW: strip[:, xs[k]:xs[k] + AW] = maps[k]


def blend_join(a, b, ov):
  """Overlap of ov px: the cut runs top to bottom where the two pictures differ least; feathered around it."""
  A = maps[a][:, AW - ov:]; B = maps[b][:, :ov]
  cost = np.abs(cv2.GaussianBlur(A, (0, 0), 2) - cv2.GaussianBlur(B, (0, 0), 2)).sum(2)
  margin = 28  # keep the cut (and its feather) inside the overlap
  cost[:, :margin] += 1e5; cost[:, -margin:] += 1e5
  H, Wd = cost.shape
  acc = cost.copy(); back = np.zeros((H, Wd), np.int8)
  for y in range(1, H):
    p = acc[y - 1]
    st = np.vstack([np.r_[np.inf, p[:-1]], p, np.r_[p[1:], np.inf]]); i = st.argmin(0)
    acc[y] += st[i, np.arange(Wd)]; back[y] = i - 1
  path = np.zeros(H, int); path[-1] = int(acc[-1].argmin())
  for y in range(H - 1, 0, -1): path[y - 1] = path[y] + back[y, path[y]]
  m = (np.arange(Wd)[None, :] >= path[:, None]).astype(np.float32)
  m = cv2.GaussianBlur(m, (0, 0), 9)[..., None]
  strip[:, xs[b]:xs[b] + ov] = A * (1 - m) + B * m


def canvas(a, b, gap, ea, eb):
  """bridge_req.py's canvas (float) and its paint mask (1 = magenta, painted by GPT)."""
  cw = KEEP * 2 + gap
  req = np.zeros((AH, cw, 3), np.float32); M = np.ones((AH, cw), np.float32)
  req[:, :KEEP - ea] = maps[a][:, AW - KEEP:AW - ea]; M[:, :KEEP - ea] = 0
  req[:, KEEP + gap + eb:] = maps[b][:, eb:KEEP]; M[:, KEEP + gap + eb:] = 0
  return req, M


def standin(req, M):
  """No painting yet: each side reflected into the gap (folding back and forth, never stretched), crossfaded in the middle."""
  cw = req.shape[1]; cols = np.where(M[0] > 0)[0]; l, r = int(cols[0]), int(cols[-1]) + 1
  out = req.copy(); mid = (l + r) / 2
  def fold(i, n):  # 0..n-1 back and forth
    i %= 2 * n; return i if i < n else 2 * n - 1 - i
  for x in range(l, r):
    xa = l - 1 - fold(x - l, l); xb = r + fold(r - 1 - x, cw - r)
    t = np.clip((x - (mid - 100)) / 200, 0, 1)
    out[:, x] = req[:, xa] * (1 - t) + req[:, xb] * t
  return out


def register(gpt, req, M):
  """GPT's picture laid exactly over the canvas (it may come back resized or slightly shifted): SIFT on the kept parts."""
  cw = req.shape[1]
  sift = cv2.SIFT_create(6000)
  keep = cv2.erode(((1 - M) * 255).astype(np.uint8), np.ones((1, 25), np.uint8))
  k1, d1 = sift.detectAndCompute(cv2.cvtColor(req.astype(np.uint8), cv2.COLOR_BGR2GRAY), keep)
  k2, d2 = sift.detectAndCompute(cv2.cvtColor(gpt, cv2.COLOR_BGR2GRAY), None)
  good = [m for m, n in cv2.BFMatcher().knnMatch(d2, d1, k=2) if m.distance < 0.72 * n.distance]
  src = np.float32([k2[m.queryIdx].pt for m in good]); dst = np.float32([k1[m.trainIdx].pt for m in good])
  T, inl = cv2.estimateAffine2D(src, dst, method=cv2.RANSAC, ransacReprojThreshold=3, maxIters=5000)
  print(f'   registered: {int(inl.sum())}/{len(good)} matches, scale {T[0, 0]:.3f} {T[1, 1]:.3f}, shift {T[0, 2]:.1f} {T[1, 2]:.1f}')
  return cv2.warpAffine(gpt, T, (cw, AH), flags=cv2.INTER_CUBIC, borderMode=cv2.BORDER_REFLECT).astype(np.float32)


def merge(req, fill, M, poisson):
  """The painted gap into the canvas. GPT paints the whole picture again (the kept parts slightly re-coloured), so its
  colours are first pulled onto the maps' own (a smooth offset measured on the kept parts, carried across the gap),
  then it fades into the maps over a wide band (no seam line, no colour step); the stand-in uses a short feather."""
  if not poisson:
    d = cv2.distanceTransform((M < 0.5).astype(np.uint8), cv2.DIST_L2, 5)
    t = np.clip(1 - d / 44, 0, 1); a = (t * t * (3 - 2 * t))[..., None]
    return req * (1 - a) + fill * a
  K = (1 - M).astype(np.float32)
  K = cv2.erode(K, np.ones((1, 9), np.uint8))                      # away from the magenta edge
  diff = (req - fill) * K[..., None]
  sig = 110
  off = cv2.GaussianBlur(diff, (0, 0), sig) / np.maximum(cv2.GaussianBlur(K, (0, 0), sig), 1e-3)[..., None]
  fixed = fill + off
  d = cv2.distanceTransform((M < 0.5).astype(np.uint8), cv2.DIST_L2, 5)   # px from the painted area
  t = np.clip(1 - d / 110, 0, 1); a = (t * t * (3 - 2 * t))[..., None]      # 1 inside it, easing to 0 over 110 px
  return req * (1 - a) + fixed * a


for a, b in zip(ROW, ROW[1:]):
  j = J[f'{a}|{b}']
  if 'blend' in j: blend_join(a, b, j['blend']); print('join', a, b, 'blend', j['blend']); continue
  ea, eb = j.get('edge', [0, 0])
  req, M = canvas(a, b, j['gap'], ea, eb)
  f = G + f'bridges/gpt_{a}_{b}.png'
  if os.path.exists(f):
    print('join', a, b, 'GPT painting')
    fill = register(cv2.imread(f), req, M)
    cols = np.where(M[0] > 0)[0]; sun = find_sun(fill, int(cols[0]), int(cols[-1]) + 1)
    if sun: print('   sun painted out at', [round(v) for v in sun]); fill = unsun(fill, *sun)
    out = merge(req, fill, M, True)
  else:
    print('join', a, b, 'stand-in (no painting yet)'); out = merge(req, standin(req, M), M, False)
  cx = xs[a] + AW - KEEP
  strip[:, cx:cx + out.shape[1]] = out

strip = np.clip(strip, 0, 255).astype(np.uint8)

# ------------------------------------------------------------------ tiles (the game shows these; everything else is cut from them)
OUT = R + 'public/assets/world/strip/'; os.makedirs(OUT, exist_ok=True)
for f in os.listdir(OUT): os.remove(OUT + f)
tiles = []
for i in range(0, W, TILE):
  w = min(TILE + 2, W - i)  # 2 px overlap: no hairline between tiles
  cv2.imwrite(OUT + f'{len(tiles)}.jpg', strip[:, i:i + w], [cv2.IMWRITE_JPEG_QUALITY, 88])
  tiles.append([i, w])
shown = np.zeros_like(strip)
for n, (i, w) in enumerate(tiles): shown[:, i:i + w] = cv2.imread(OUT + f'{n}.jpg')
pic = Image.fromarray(cv2.cvtColor(shown, cv2.COLOR_BGR2RGB))

MM = R + 'public/assets/world/minimap/'; os.makedirs(MM, exist_ok=True)
for f in os.listdir(MM): os.remove(MM + f)
pic.resize((W // 4, AH // 4), Image.LANCZOS).save(MM + 'world.jpg', quality=82)  # the whole strip, small

# ------------------------------------------------------------------ props (world px) + occluder cut-outs
# Every prop of the maps (area px) and of the joins (canvas px), in world px; id = "<area>-<prop>" / "<a>_<b>-<prop>".
props = []
for aid in ROW:
  for p in D['areas'][aid].get('props', []): props.append((f"{aid}-{p['id']}", p, xs[aid]))
for a, b in zip(ROW, ROW[1:]):
  for p in J[f'{a}|{b}'].get('props', []): props.append((f"{a}_{b}-{p['id']}", p, xs[a] + AW - KEEP))
PR = R + 'public/assets/world/props/'; os.makedirs(PR, exist_ok=True)
for f in os.listdir(PR): os.remove(PR + f)
SS = 4; meta = {}; world_props = []
for pid, p, ox in props:
  wp = {'id': pid, 'foot': [[q[0] + ox, q[1]] for q in p['foot']], 'h': p['h']}
  if 'top' in p: wp['top'] = p['top']
  world_props.append(wp)
  if not p.get('occ'): continue
  qx = [q[0] + ox for q in p['occ']]; qy = [q[1] for q in p['occ']]
  x0, y0, x1, y1 = int(np.floor(min(qx))) - 1, int(np.floor(min(qy))) - 1, int(np.ceil(max(qx))) + 1, int(np.ceil(max(qy))) + 1
  w, h = x1 - x0, y1 - y0
  m = Image.new('L', (w * SS, h * SS), 0)
  ImageDraw.Draw(m).polygon([((q[0] + ox - x0) * SS, (q[1] - y0) * SS) for q in p['occ']], fill=255)
  cut = pic.crop((x0, y0, x1, y1)).convert('RGBA'); cut.putalpha(m.resize((w, h), Image.LANCZOS))
  cut.save(PR + f'{pid}.png', optimize=True)
  meta[pid] = [x0, y0, w, h]
json.dump(meta, open(R + 'src/data/world-props.json', 'w'))

# ------------------------------------------------------------------ the floor: one polygon for the whole world
def poly(pts, ox=0): return Polygon([(x + ox, y) for x, y in pts]).buffer(0)
part = {k: poly(D['areas'][k]['walk'], xs[k]) for k in ROW}
extra = []
for a, b in zip(ROW, ROW[1:]):
  j = J[f'{a}|{b}']
  if 'blend' in j:  # where the two overlap: floor only where both are floor
    ov = box(xs[b], 0, xs[a] + AW, AH)
    both = part[a].intersection(part[b]).intersection(ov)
    part[a] = part[a].difference(ov); part[b] = part[b].difference(ov); extra.append(both)
    continue
  ea, eb = j.get('edge', [0, 0])
  if ea: part[a] = part[a].difference(box(xs[a] + AW - ea, 0, xs[a] + AW, AH))
  if eb: part[b] = part[b].difference(box(xs[b], 0, xs[b] + eb, AH))
  cx = xs[a] + AW - KEEP
  if j.get('walk'): extra.append(poly(j['walk'], cx)); continue
  # stand-in path: straight from the left map's floor to the right map's (until the bridge is painted and traced)
  def band(p, x):
    s = p.intersection(box(x - 1, 0, x + 1, AH)).bounds; return s[1], s[3]
  xa = part[a].bounds[2] - 40; xb = part[b].bounds[0] + 40
  (y0, y1), (y2, y3) = band(part[a], xa), band(part[b], xb)
  extra.append(Polygon([(xa, y0), (xb, y2), (xb, y3), (xa, y1)]))
# a block you can jump on is floor too (its top: you stand there; at ground level the block itself stops you)
extra += [Polygon(p['foot']) for p in world_props if 'top' in p]
floor = unary_union(list(part.values()) + extra)
if floor.geom_type != 'Polygon':
  sys.exit(f'floor is not one piece: {floor.geom_type} {[round(g.area) for g in floor.geoms]}')
floor = floor.simplify(0.6)
walk = [[round(x, 1), round(y, 1)] for x, y in list(floor.exterior.coords)[:-1]]
# Walkable in one piece? (the floor shrunk by the foot radius, minus every prop grown by it: a pinch or a prop in a narrow
# path would cut the world in two)
free = floor.buffer(-10).difference(unary_union([Polygon(p['foot']).buffer(10) for p in world_props]))
pieces = sorted([free] if free.geom_type == 'Polygon' else list(free.geoms), key=lambda g: -g.area)
if len(pieces) > 1 and pieces[1].area > 1500:
  sys.exit('the world is cut in two: ' + ', '.join(f'{round(g.area)} px² at {[round(v) for v in g.bounds]}' for g in pieces[:4]))
for i, ring in enumerate(floor.interiors):  # a hole in the floor (a block standing in the middle): an obstacle
  world_props.append({'id': f'hole-{i}', 'foot': [[round(x, 1), round(y, 1)] for x, y in list(ring.coords)[:-1]], 'h': 999})
  print('hole in the floor → obstacle', i, [round(v) for v in ring.bounds])

# each area's span on the strip (the area title / minimap switch halfway through a join)
span = {}
for i, k in enumerate(ROW):
  l = 0 if i == 0 else None; r = W if i == len(ROW) - 1 else None
  if l is None:
    j = J[f'{ROW[i - 1]}|{k}']; l = xs[k] + j['blend'] / 2 if 'blend' in j else xs[k] - j['gap'] / 2
  if r is None:
    j = J[f'{k}|{ROW[i + 1]}']; r = xs[k] + AW - j['blend'] / 2 if 'blend' in j else xs[k] + AW + j['gap'] / 2
  span[k] = [round(l), round(r)]

json.dump({'w': W, 'h': AH, 'tiles': tiles, 'areas': {k: {'x': xs[k], 'span': span[k]} for k in ROW}, 'walk': walk, 'props': world_props},
          open(R + 'src/data/world-strip.json', 'w'), separators=(',', ':'))
print('strip', W, 'x', AH, '|', len(tiles), 'tiles |', 'floor', len(walk), 'points |', len(world_props), 'props |', {k: xs[k] for k in ROW})

if '--preview' in sys.argv:
  ov = pic.convert('RGBA'); lay = Image.new('RGBA', ov.size, (0, 0, 0, 0)); d = ImageDraw.Draw(lay)
  d.polygon([tuple(p) for p in walk], fill=(40, 255, 90, 60), outline=(40, 255, 90, 255))
  for k in ROW: d.line([(span[k][0], 0), (span[k][0], AH)], fill=(255, 255, 255, 120), width=2)
  for p in world_props: d.polygon([tuple(q) for q in p['foot']], fill=(255, 40, 40, 90), outline=(255, 60, 60, 255))
  ov.alpha_composite(lay); os.makedirs(G + 'qc', exist_ok=True)
  ov.convert('RGB').resize((W // 4, AH // 4), Image.LANCZOS).save(G + 'qc/strip.jpg', quality=85)
  ov.convert('RGB').save(G + 'qc/strip_full.jpg', quality=85)
