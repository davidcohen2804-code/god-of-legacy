# naked_frames.py <sheet json> : the clean base character's animations (male / female) from GPT drawings → game strips
#   public/assets/final/body/naked/<gender>/<anim>.png (+ _m.png labels: skin 60, top 80, shorts 200), one 352 cell per
#   frame, feet origin 176,310; src/data/naked-anims.json lists what each gender has (the game falls back to standing).
# Per figure: magenta keyed, scaled so the HEAD is the same size in every frame (GPT draws each image at its own size;
# the standing frame sets the scale: head top to sole = FIG_H), hips (shorts) on one x, lowest foot on the ground.
# "swap": the near / far leg shading is exchanged (back leg gets the near leg's tones, front leg the far one's) — GPT
# keeps drawing the near leg in front, this gives the step of the other leg. The run plays the walk frames faster.
import json, os, sys, numpy as np
from PIL import Image
from scipy import ndimage as nd
H = os.path.dirname(os.path.abspath(__file__)); G = H + '/../../'; S = 352; GROUND = 310
src = open(H + '/bake_pose.py').read()
exec(src[src.index('def keyed('):src.index('def labels(')])          # keyed() of the pose baker
FIG_H = 185
spec = json.load(open(sys.argv[1])); gender = spec['gender']
OUT = G + 'public/assets/final/body/naked/' + gender + '/'
bm = np.array(Image.open(G + 'public/assets/final/body/warrior/base/idle_m.png'))[:, :S, 0]
HIPX = float(np.median(np.nonzero(bm == 200)[1]))                     # where the beginner always stood
_cache = {}


def figures(path):
  if path in _cache: return _cache[path]
  gi = np.array(Image.open(H + '/gpt/' + path).convert('RGB')).astype(np.float32)
  e, a = keyed(gi); fig = a > 0.5
  L, n = nd.label(fig); sz = nd.sum(fig, L, range(1, n + 1))
  big = [1 + i for i in range(n) if sz[i] > 0.25 * sz.max()]
  figs = []
  for i in sorted(big, key=lambda i: np.nonzero(L == i)[1].mean()):
    m = L == i; ys, xs = np.nonzero(m)
    y0, y1, x0, x1 = ys.min(), ys.max(), xs.min(), xs.max()
    head = m[y0:y0 + int((y1 - y0) * 0.28)]
    hx = np.nonzero(head.any(0))[0]
    R_, G_, B_ = [e[..., k] for k in range(3)]; mx_ = np.maximum(np.maximum(R_, G_), B_); mn_ = np.minimum(np.minimum(R_, G_), B_)
    grey = m & ((mx_ - mn_) / np.maximum(mx_, 1) < 0.13) & (mx_ > 105) & (np.arange(m.shape[0])[:, None] > y0 + (y1 - y0) * 0.45)
    gx = np.nonzero(grey.any(0))[0]
    figs.append(dict(gi=gi, box=(x0, y0, x1, y1), headw=float(hx.max() - hx.min()), shortsw=float(gx.max() - gx.min()) if len(gx) else 0.0))
  _cache[path] = figs
  return figs


def split_legs(e, fig, lab):
  """Leg pixels below the shorts → (back leg, front leg): skin areas parted by the dark outline between them."""
  R, Gc, B = e[..., 0], e[..., 1], e[..., 2]; mx = np.maximum(np.maximum(R, Gc), B)
  sh = np.nonzero(lab == 200); low = np.arange(S)[:, None] > np.percentile(sh[0], 90)
  skin = fig & (lab == 60) & low & (mx >= 120)
  L, n = nd.label(skin); sz = nd.sum(skin, L, range(1, n + 1))
  two = sorted([1 + i for i in np.argsort(-sz)[:2]], key=lambda i: np.nonzero(L == i)[1].mean())
  back, front = L == two[0], L == two[1]
  rest = fig & (lab == 60) & low & ~back & ~front                      # outline pixels: to the nearest leg
  db = nd.distance_transform_edt(~back); df = nd.distance_transform_edt(~front)
  back |= rest & (db <= df); front |= rest & (df < db)
  return back, front


def label(e, a):
  fig = a > 0.5
  R, Gc, B = e[..., 0], e[..., 1], e[..., 2]
  mx = np.maximum(np.maximum(R, Gc), B); mn = np.minimum(np.minimum(R, Gc), B); sat = (mx - mn) / np.maximum(mx, 1)
  grey = nd.binary_opening(fig & (sat < 0.13) & (mx > 105), iterations=1)
  lab = np.where(fig, 60, 0).astype(np.uint8)
  gL, gn = nd.label(grey); ys = np.nonzero(fig.any(1))[0]; top, bot = ys.min(), ys.max()
  for k in range(1, gn + 1):
    cm = gL == k
    if cm.sum() < 40: continue
    part = 80 if np.nonzero(cm)[0].mean() < top + (bot - top) * 0.47 else 200
    lab[nd.binary_fill_holes(nd.binary_closing(cm, iterations=2)) & fig] = part
  for part in (80, 200):
    lab[nd.binary_dilation(lab == part, iterations=2) & fig & (lab == 60) & (mx < 120)] = part
  return fig, lab


def frame(path, idx, sc, opts=()):
  f = figures(path)[idx]; x0, y0, x1, y1 = f['box']; gi = f['gi']
  pad = 24
  X0, Y0 = max(0, x0 - pad), max(0, y0 - pad)
  sub = gi[Y0:y1 + pad, X0:x1 + pad]
  h, w = sub.shape[:2]
  im = Image.fromarray(sub.clip(0, 255).astype(np.uint8)).resize((max(1, int(round(w * sc))), max(1, int(round(h * sc)))), Image.LANCZOS)
  canvas = Image.new('RGB', (S, S), (255, 0, 255)); canvas.paste(im, (int(S / 2 - im.width / 2), int(GROUND - im.height + pad * sc)))
  e, a = keyed(np.array(canvas).astype(np.float32))
  fig, lab = label(e, a)
  if 'swap' in opts:
    back, front = split_legs(e, fig, lab)
    deep = np.arange(S)[:, None] > np.percentile(np.nonzero(lab == 200)[0], 97) + 3
    mb, mf = e[back & deep & (e.max(-1) > 120)].mean(0), e[front & deep & (e.max(-1) > 120)].mean(0)
    e = np.where(back[..., None], np.clip(e * (mf / mb), 0, 255), np.where(front[..., None], np.clip(e * (mb / mf), 0, 255), e))
  sh = np.nonzero(lab == 200)
  dx = int(round(HIPX - np.median(sh[1]))); dy = GROUND - int(np.nonzero(fig.any(1))[0].max())
  r = lambda v: np.roll(np.roll(v, dy, 0), dx, 1)
  return r(e), r(a), r(fig), r(lab)


idle_path, idle_idx = spec['anims']['idle'][0][:2]
fi = figures(idle_path)[idle_idx]
SC0 = FIG_H / (fi['box'][3] - fi['box'][1]); HEADW = fi['headw'] * SC0; SHORTSW = fi['shortsw'] * SC0     # the standing frame sets the size
os.makedirs(OUT, exist_ok=True)
strips = {}
for anim, cells in spec['anims'].items():
  n = len(cells); px = np.zeros((S, n * S, 4), np.uint8); mk = np.zeros((S, n * S, 4), np.uint8)
  for c, cell in enumerate(cells):
    path, idx = cell[0], cell[1]
    sc = HEADW / figures(path)[idx]['headw']
    tall = [o for o in cell[2:] if str(o).startswith('tall')]
    if tall:                                                   # one scale for the move: its tallest frame = ratio x standing height
      hmax = max(figures(cc[0])[cc[1]]['box'][3] - figures(cc[0])[cc[1]]['box'][1] for cc in cells)
      sc = FIG_H * float(tall[0][4:]) / hmax
    like = [o for o in cell[2:] if str(o).startswith('like')]
    if like:                                                   # same pose as cell N of this move: same height as it
      rp, ri = cells[int(like[0][4:])][:2]; rf = figures(rp)[ri]; tf = figures(path)[idx]
      sc = (HEADW / rf['headw']) * (rf['box'][3] - rf['box'][1]) / (tf['box'][3] - tf['box'][1])
    e, a, fig, lab = frame(path, idx, sc, cell[2:])
    px[:, c * S:(c + 1) * S, :3] = e.clip(0, 255).astype(np.uint8); px[:, c * S:(c + 1) * S, 3] = np.where(fig, (a * 255).clip(0, 255), 0).astype(np.uint8)
    mk[:, c * S:(c + 1) * S, 0] = np.where(fig, lab, 0); mk[:, c * S:(c + 1) * S, 3] = 255
  Image.fromarray(px).save(OUT + anim + '.png', optimize=True); Image.fromarray(mk).save(OUT + anim + '_m.png', optimize=True)
  strips[anim] = px
  print(gender, anim, n, 'frames')
# what each gender has (the game draws standing for the rest)
lp = G + 'src/data/naked-anims.json'
have = json.load(open(lp)) if os.path.exists(lp) else {}
have[gender] = {a: len(c) for a, c in spec['anims'].items()}
json.dump(have, open(lp, 'w'), indent=1)
# menu image (full size standing figure) for character select / create / portraits
pp, pi = spec.get('preview', spec['anims']['idle'][0][:2])
f = figures(pp)[pi]; x0, y0, x1, y1 = f['box']
gh, gw = f['gi'].shape[:2]
e, a = keyed(f['gi'][max(0, y0 - 30):min(gh, y1 + 13), max(0, x0 - 40):min(gw, x1 + 41)])
fig = a > 0.5; L, n = nd.label(fig); sz = nd.sum(fig, L, range(1, n + 1)); fig = L == 1 + int(np.argmax(sz))
Image.fromarray(np.dstack([e, np.where(fig, a * 255, 0)]).clip(0, 255).astype(np.uint8)).save(G + f'public/assets/characters/base/Base_{gender.capitalize()}.png', optimize=True)
# QC: every strip on the game background
rows = []
for anim, px in strips.items():
  n = px.shape[1] // S; row = Image.new('RGB', (n * 220, 230), (62, 66, 76))
  for c in range(n):
    bg = Image.new('RGBA', (S, S), (62, 66, 76, 255)); bg.alpha_composite(Image.fromarray(px[:, c * S:(c + 1) * S]))
    row.paste(bg.convert('RGB').crop((66, 95, 286, 325)), (c * 220, 0))
  rows.append(row)
qc = Image.new('RGB', (max(r.width for r in rows), sum(r.height for r in rows)), (30, 30, 30)); y = 0
for r in rows: qc.paste(r, (0, y)); y += r.height
qc.resize((qc.width * 2, qc.height * 2), Image.LANCZOS).save(G + f'tools/base/qc/naked_{gender}.png')
