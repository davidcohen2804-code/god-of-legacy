# strip.py : the open world, left to right, in two layers.
#   terrace  — the maps of world-areas.json "row" (tools/world/src/<area>.png gives the colours) cut out along GPT's copy of
#              the same map with everything beyond the terrace painted magenta (tools/world/layers/gpt/<area>.png), joined
#              where neighbours overlap ("blend": N px; the cut runs where the two agree; the left-to-right sunlight of
#              every map levelled and what is left at a join evened out over both sides)
#              → public/assets/world/strip/<i>.webp (2048-px tiles with alpha)
#   backdrop — the far landscape behind it (tools/world/layers/bg.png, made by bg.py), scrolled slower than the terrace by
#              the game (parallax) → public/assets/world/bg/<i>.jpg
#   Until the backdrop exists (or a map has no cut-out) the maps stay whole — their own painted sky — as one layer (jpg).
# Also: the walkable floor, every prop in world px, occluder cut-outs (from the terrace), the minimap
#   → src/data/world-strip.json, src/data/world-props.json, public/assets/world/props/<id>.png, public/assets/world/minimap/
# Re-run after any change to world-areas.json floors / props / joins, the cut-outs or the backdrop.
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
TILE = 2048
BG = next((a[5:] for a in sys.argv if a.startswith('--bg=')), G + 'layers/bg.png')   # --bg=<file>: try another backdrop
TEST = '--test' in sys.argv   # development: layered even with cut-outs missing (those maps stay whole)
LAYERED = os.path.exists(BG) and (TEST or all(os.path.exists(G + f'layers/gpt/{k}.png') for k in ROW))
if not LAYERED: print('one layer (the maps whole):', 'no backdrop yet' if not os.path.exists(BG) else 'cut-outs missing: ' + ', '.join(k for k in ROW if not os.path.exists(G + f'layers/gpt/{k}.png')))

# ------------------------------------------------------------------ layout
xs = {ROW[0]: 0}
for a, b in zip(ROW, ROW[1:]): xs[b] = xs[a] + AW - J[f'{a}|{b}']['blend']
W = xs[ROW[-1]] + AW


def load(k):
  im = cv2.imread(G + f'src/{k}.png')
  sun = find_sun(im)
  if sun: print('sun painted out:', k, [round(v) for v in sun]); return unsun(im, *sun).astype(np.float32)
  return im.astype(np.float32)


def guided(I, p, r, eps):
  """Guided filter (He et al.): p smoothed but following the edges of I (both 0..1)."""
  box = lambda x: cv2.boxFilter(x, -1, (2 * r + 1, 2 * r + 1))
  mI, mp = box(I), box(p)
  a = (box(I * p) - mI * mp) / (box(I * I) - mI * mI + eps)
  b = mp - a * mI
  return box(a) * I + box(b)


def cutout(k, im):
  """The terrace's alpha (1 = terrace, 0 = beyond it) from GPT's magenta copy, snapped to the map's own edges (guided
  filter on the map), with the old sky taken out of the edge pixels' colours. Without a cut-out: all terrace."""
  if not LAYERED or not os.path.exists(G + f'layers/gpt/{k}.png'): return np.ones((AH, AW), np.float32)
  g = cv2.imread(G + f'layers/gpt/{k}.png').astype(np.float32)
  if g.shape[:2] != (AH, AW): g = cv2.resize(g, (AW, AH), interpolation=cv2.INTER_AREA)
  gray = lambda x: cv2.cvtColor(np.clip(x, 0, 255).astype(np.uint8), cv2.COLOR_BGR2GRAY).astype(np.float32)
  mag = np.sqrt((g[..., 2] - 255) ** 2 + g[..., 1] ** 2 + (g[..., 0] - 255) ** 2)
  a = np.clip((mag - 70) / 80, 0, 1)
  keep = (a > 0.5).astype(np.float32)
  (dx, dy), _ = cv2.phaseCorrelate(gray(im) * keep, gray(g) * keep)
  if max(abs(dx), abs(dy)) > 1.5: sys.exit(f'{k}: the cut-out is {dx:.1f}, {dy:.1f} px off the map — not the same picture?')
  for val, small in ((1, 40), (0, 30)):     # specks: terrace crumbs in the sky, magenta dots in the terrace
    m = ((a > 0.5) == bool(val)).astype(np.uint8)
    n, lab, st, _ = cv2.connectedComponentsWithStats(m, 8)
    for i in range(1, n):
      if st[i][4] < small: a[lab == i] = 1 - val
  a = np.clip(guided(gray(im) / 255, a, 3, 1e-3), 0, 1)
  a[a < 0.03] = 0; a[a > 0.97] = 1
  # the edge pixels' colour without the old sky behind them (matting: I = aF + (1 - a)B)
  sky = (a == 0).astype(np.float32)
  B = cv2.GaussianBlur(im * sky[..., None], (0, 0), 5) / np.maximum(cv2.GaussianBlur(sky, (0, 0), 5), 1e-3)[..., None]
  e = (a > 0) & (a < 1)
  aa = np.maximum(a, 0.3)[..., None]
  im[e] = np.clip((im - (1 - aa) * B) / aa, 0, 255)[e]
  return a


def paint(k, im):
  """Boxes of a map ("paint" in world-areas.json) whose pixels come from its cut-out picture — something GPT added there
  (a stage, a block) — with GPT's colours pulled onto the map's own (a smooth offset measured around the box), feathered in."""
  boxes = D['areas'][k].get('paint', [])
  if not boxes or not os.path.exists(G + f'layers/gpt/{k}.png'): return im
  g = cv2.imread(G + f'layers/gpt/{k}.png').astype(np.float32)
  mag = np.sqrt((g[..., 2] - 255) ** 2 + g[..., 1] ** 2 + (g[..., 0] - 255) ** 2) > 120     # GPT's terrace
  for (x0, y0, x1, y1) in boxes:
    inside = np.zeros((AH, AW), np.float32); inside[y0:y1, x0:x1] = 1
    ring = (cv2.dilate(inside, np.ones((241, 241), np.uint8)) - inside) * mag                # around the box, terrace only
    s = 70
    off = cv2.GaussianBlur((im - g) * ring[..., None], (0, 0), s) / np.maximum(cv2.GaussianBlur(ring, (0, 0), s), 1e-3)[..., None]
    m = cv2.GaussianBlur(cv2.erode(inside, np.ones((25, 25), np.uint8)), (0, 0), 6)               # feathered inside the box
    m = (m * cv2.GaussianBlur(mag.astype(np.float32), (0, 0), 1.0))[..., None]                     # only GPT's terrace, never its magenta
    im = im * (1 - m) + np.clip(g + off, 0, 255) * m
    print('painted in from the cut-out:', k, [x0, y0, x1, y1])
  return im


maps, alpha = {}, {}
for k in ROW:
  maps[k] = paint(k, load(k))
  alpha[k] = cutout(k, maps[k])


def level_light():
  """Every map is lit from its right (bright right edge, dark left edge), so where two meet bright meets dark. Per row,
  the left-to-right trend of the terrace's brightness (a straight line, fitted where it is terrace) is taken out and the
  row brought to the level all maps share there; local light (shafts, glows, shade) stays as painted."""
  x = np.arange(AW, dtype=np.float32) - AW / 2
  fits = {}
  for k, im in maps.items():
    w = cv2.GaussianBlur(alpha[k], (0, 0), sigmaX=40, sigmaY=20) + 1e-4
    L = cv2.GaussianBlur(im.mean(2) * alpha[k], (0, 0), sigmaX=40, sigmaY=20) / w
    W0, W1, W2 = w.sum(1), (w * x).sum(1), (w * x * x).sum(1)
    S0, S1 = (w * L).sum(1), (w * L * x).sum(1)
    det = W0 * W2 - W1 * W1
    b = np.where(det > 1e-3, (W0 * S1 - W1 * S0) / np.maximum(det, 1e-3), 0)
    a0 = (S0 - b * W1) / np.maximum(W0, 1e-3)
    ok = alpha[k].sum(1) > AW * 0.08                      # rows with enough terrace to fit
    sm = lambda v: cv2.GaussianBlur((v * ok)[:, None], (0, 0), 15)[:, 0] / np.maximum(cv2.GaussianBlur(ok.astype(np.float32)[:, None], (0, 0), 15)[:, 0], 1e-3)
    fits[k] = (sm(a0), sm(b), ok)
  level = np.mean([f[0] for f in fits.values()], axis=0)
  for k, (a0, b, ok) in fits.items():
    trend = a0[:, None] + b[:, None] * x[None, :]
    gain = np.clip(level[:, None] / np.maximum(trend, 1), 0.6, 1.6)
    maps[k] = np.clip(maps[k] * gain[..., None], 0, 255)
    print('light levelled:', k, 'gain left/right (floor row 500):', round(float(gain[500, 0]), 2), round(float(gain[500, -1]), 2))


def match_seam(a, b, ov, ramp=460):
  """What is left of a light / colour step where two maps meet: per row, the difference of their average colour near the
  join (terrace only) is split between them, fading out over `ramp` px on each side."""
  A, B = maps[a], maps[b]
  n = ov + 80
  wa, wb = alpha[a][:, AW - n:], alpha[b][:, :n]
  ma = (A[:, AW - n:] * wa[..., None]).sum(1) / np.maximum(wa.sum(1), 1)[:, None]
  mb = (B[:, :n] * wb[..., None]).sum(1) / np.maximum(wb.sum(1), 1)[:, None]
  ok = ((wa.sum(1) > n * 0.25) & (wb.sum(1) > n * 0.25)).astype(np.float32)[:, None]
  d = np.clip(cv2.GaussianBlur(((ma - mb) * ok)[:, None, :], (0, 0), sigmaX=1, sigmaY=30)[:, 0, :], -40, 40)
  t = np.clip(np.arange(ramp, dtype=np.float32) / ramp, 0, 1); w = 1 - t * t * (3 - 2 * t)   # 1 at the join → 0
  A[:, AW - ramp:] -= (w[::-1][None, :, None] * d[:, None, :] / 2)
  B[:, :ramp] += (w[None, :, None] * d[:, None, :] / 2)
  maps[a] = np.clip(A, 0, 255); maps[b] = np.clip(B, 0, 255)


level_light()
for a, b in zip(ROW, ROW[1:]): match_seam(a, b, J[f'{a}|{b}']['blend'])
strip = np.zeros((AH, W, 4), np.float32)
for k in ROW: strip[:, xs[k]:xs[k] + AW] = np.dstack([maps[k], alpha[k] * 255])


def blend_join(a, b, ov):
  """Overlap of ov px: the cut runs top to bottom where the two maps look most alike (colour and cut-out), feathered."""
  A = strip[:, xs[b]:xs[b] + ov].copy(); A[..., :3] = maps[a][:, AW - ov:]; A[..., 3] = alpha[a][:, AW - ov:] * 255
  B = np.dstack([maps[b][:, :ov], alpha[b][:, :ov] * 255])
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


for a, b in zip(ROW, ROW[1:]): blend_join(a, b, J[f'{a}|{b}']['blend']); print('join', a, b, 'blend', J[f'{a}|{b}']['blend'])
strip = np.clip(strip, 0, 255).astype(np.uint8)


def tiles_of(img, folder, ext, save):
  """Cut a picture into TILE-wide tiles (2 px overlap: no hairline between them) → [[x, w], ...]."""
  out = R + f'public/assets/world/{folder}/'; os.makedirs(out, exist_ok=True)
  for f in os.listdir(out): os.remove(out + f)
  t = []
  for i in range(0, img.shape[1], TILE):
    w = min(TILE + 2, img.shape[1] - i)
    save(img[:, i:i + w], out + f'{len(t)}.{ext}'); t.append([i, w])
  return t


def save_webp(a, path):
  Image.fromarray(cv2.cvtColor(a, cv2.COLOR_BGRA2RGBA), 'RGBA').save(path, 'WEBP', quality=88, alpha_quality=100, method=6)


def save_jpg(a, path): cv2.imwrite(path, a, [cv2.IMWRITE_JPEG_QUALITY, 88])


# ------------------------------------------------------------------ tiles (the game shows these; everything else is cut from them)
if LAYERED:
  tiles = tiles_of(strip, 'strip', 'webp', save_webp)
  terrace = np.zeros_like(strip)
  for n, (i, w) in enumerate(tiles): terrace[:, i:i + w] = cv2.cvtColor(np.asarray(Image.open(R + f'public/assets/world/strip/{n}.webp').convert('RGBA')), cv2.COLOR_RGBA2BGRA)
  bg = cv2.imread(BG)
  if bg.shape[0] != AH: bg = cv2.resize(bg, (round(bg.shape[1] * AH / bg.shape[0]), AH), interpolation=cv2.INTER_AREA)
  bg_tiles = tiles_of(bg, 'bg', 'jpg', save_jpg)
  print('backdrop', bg.shape[1], 'x', AH, '|', len(bg_tiles), 'tiles')
else:
  tiles = tiles_of(strip[..., :3], 'strip', 'jpg', save_jpg)
  terrace = np.zeros_like(strip)
  for n, (i, w) in enumerate(tiles): terrace[:, i:i + w, :3] = cv2.imread(R + f'public/assets/world/strip/{n}.jpg')
  terrace[..., 3] = 255
  bg, bg_tiles = None, []
  b = R + 'public/assets/world/bg/'
  if os.path.isdir(b):
    for f in os.listdir(b): os.remove(b + f)
pic = Image.fromarray(cv2.cvtColor(terrace, cv2.COLOR_BGRA2RGBA), 'RGBA')   # the terrace as the game shows it

# minimap: the terrace over the backdrop squeezed to the world's width
MM = R + 'public/assets/world/minimap/'; os.makedirs(MM, exist_ok=True)
for f in os.listdir(MM): os.remove(MM + f)
mini = Image.new('RGBA', (W, AH), (0, 0, 0, 255))
if bg is not None: mini.paste(Image.fromarray(cv2.cvtColor(bg, cv2.COLOR_BGR2RGB)).resize((W, AH), Image.LANCZOS), (0, 0))
mini.alpha_composite(pic)
mini.convert('RGB').resize((W // 4, AH // 4), Image.LANCZOS).save(MM + 'world.jpg', quality=82)

# ------------------------------------------------------------------ props (world px) + occluder cut-outs
# Every prop of the maps (area px) in world px; id = "<area>-<prop>".
props = [(f"{aid}-{p['id']}", p, xs[aid]) for aid in ROW for p in D['areas'][aid].get('props', [])]
PR = R + 'public/assets/world/props/'; os.makedirs(PR, exist_ok=True)
for f in os.listdir(PR): os.remove(PR + f)
SS = 4; meta = {}; world_props = []
for pid, p, ox in props:
  wp = {'id': pid, 'foot': [[q[0] + ox, q[1]] for q in p['foot']], 'h': p['h']}
  if 'top' in p: wp['top'] = p['top']
  if 'stand' in p: wp['stand'] = p['stand']
  world_props.append(wp)
  if not p.get('occ'): continue
  qx = [q[0] + ox for q in p['occ']]; qy = [q[1] for q in p['occ']]
  x0, y0, x1, y1 = int(np.floor(min(qx))) - 1, int(np.floor(min(qy))) - 1, int(np.ceil(max(qx))) + 1, int(np.ceil(max(qy))) + 1
  w, h = x1 - x0, y1 - y0
  m = Image.new('L', (w * SS, h * SS), 0)
  ImageDraw.Draw(m).polygon([((q[0] + ox - x0) * SS, (q[1] - y0) * SS) for q in p['occ']], fill=255)
  cut = pic.crop((x0, y0, x1, y1))
  a = np.asarray(m.resize((w, h), Image.LANCZOS), np.float32) * np.asarray(cut.getchannel('A'), np.float32) / 255
  cut.putalpha(Image.fromarray(a.astype(np.uint8)))
  cut.save(PR + f'{pid}.png', optimize=True)
  meta[pid] = [x0, y0, w, h]
json.dump(meta, open(R + 'src/data/world-props.json', 'w'))

# ------------------------------------------------------------------ the floor: one polygon for the whole world
def poly(pts, ox=0): return Polygon([(x + ox, y) for x, y in pts]).buffer(0)
part = {k: poly(D['areas'][k]['walk'], xs[k]) for k in ROW}
extra = []
for a, b in zip(ROW, ROW[1:]):  # where two maps overlap: floor only where both are floor
  ov = box(xs[b], 0, xs[a] + AW, AH)
  both = part[a].intersection(part[b]).intersection(ov)
  part[a] = part[a].difference(ov); part[b] = part[b].difference(ov); extra.append(both)
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
  l = 0 if i == 0 else xs[k] + J[f'{ROW[i - 1]}|{k}']['blend'] / 2
  r = W if i == len(ROW) - 1 else xs[k] + AW - J[f'{k}|{ROW[i + 1]}']['blend'] / 2
  span[k] = [round(l), round(r)]

out = {'w': W, 'h': AH, 'tiles': tiles, 'ext': 'webp' if LAYERED else 'jpg', 'areas': {k: {'x': xs[k], 'span': span[k]} for k in ROW},
       'walk': walk, 'props': world_props}
if LAYERED: out['bg'] = {'w': int(bg.shape[1]), 'tiles': bg_tiles, **D.get('backdrop', {})}
json.dump(out, open(R + 'src/data/world-strip.json', 'w'), separators=(',', ':'))
print('strip', W, 'x', AH, '|', len(tiles), 'tiles', out['ext'], '|', 'floor', len(walk), 'points |', len(world_props), 'props |', {k: xs[k] for k in ROW})

if '--preview' in sys.argv:
  ov = mini.copy(); lay = Image.new('RGBA', ov.size, (0, 0, 0, 0)); d = ImageDraw.Draw(lay)
  d.polygon([tuple(p) for p in walk], fill=(40, 255, 90, 60), outline=(40, 255, 90, 255))
  for k in ROW: d.line([(span[k][0], 0), (span[k][0], AH)], fill=(255, 255, 255, 120), width=2)
  for p in world_props: d.polygon([tuple(q) for q in p['foot']], fill=(255, 40, 40, 90), outline=(255, 60, 60, 255))
  ov.alpha_composite(lay); os.makedirs(G + 'qc', exist_ok=True)
  ov.convert('RGB').resize((W // 4, AH // 4), Image.LANCZOS).save(G + 'qc/strip.jpg', quality=85)
  ov.convert('RGB').save(G + 'qc/strip_full.jpg', quality=85)
