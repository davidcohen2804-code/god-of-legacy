# naked_frames.py <sheet json> : the clean base character's animations (male / female) from GPT drawings → game strips
#   public/assets/final/body/naked/<gender>/<anim>.png (+ _m.png labels: skin 60, top 80, shorts 200), one 352 cell per
#   frame, feet origin 176,310; src/data/naked-anims.json lists what each gender has (the game falls back to standing).
# Figures are counted per GPT image row by row (top row first), left to right.
# The standing frame sets the size (head top to sole = FIG_H), hips (shorts) on the beginner's x, sole on the ground.
# MapleStory head: every other frame gets the STANDING head, the same drawing in every frame — GPT's own head of that
# frame is removed and the standing head is set on the frame's neck, always at the same x (the body moves under it).
# Cell options:
#   "bodyR"  one scale for the move: its tallest neck→sole = R x the standing neck→sole (GPT draws its own proportions;
#            the bodies match, the head is the standing one anyway)
#   "tallR"  one scale for the move: its tallest frame = R x the standing height
#   "likeN"  same height as cell N of the move
#   "as:<move>"  the same scale as that move (GPT drew both images at one size: same head width → same scale)
#   "swap"   near / far leg tones exchanged (GPT shaded them and drew the near leg forward again)
#   "farL" / "farR"  the left / right leg (as drawn) is the far one: drawn darker (GPT drew both legs alike)
#   "ownhead"  keep GPT's head (no standing head)
#   "feet"   the feet stay planted: every frame's feet where the move's first frame has them, the head goes with the neck
#   "follow" the head goes with the neck (the frame is not moved under the standing head's x)
#   "swayK"  (walk) the head keeps K of GPT's own forward / back shift of that frame (MapleStory: the same head moves
#            a little with each step); "bobN": the head sits N px lower on the neck (the low point of the step)
#   "asd:<move>"  the same size as that move, measured by the heads' inscribed circles (works with swords / raised arms);
#            "asd:<move>@0,1": by the heads of cells 0 and 1 of this move only
#   "clean:N"  cell N of the move has GPT's head clear: what other frames draw over their head (arm, sword) stays in front
#   "track"  (with clean:N) GPT's head found by matching cell N's head drawing, not by the figure's outline (a sword or a
#            fist raised above the head)
#   "sword"  the sword is found (blade + hilt) and goes to the mask's G channel (not the body labels)
#   "swapg"  the two legs' tones exchanged (found at GPT's size): GPT drew the same leg forward again
#   "airK"   the move's frames keep K of GPT's height off the ground (heads level as drawn, the lowest feet grounded;
#            per GPT image); "liftN": that frame N px higher still (the top of the stride)
#   "sc:N" / "sc:<move>"  the scale of cell N of the move / of that move (GPT drew the body at that size, its head bigger)
#   "holdK"  (with follow) the head stays near the move's mean x, keeping K of GPT's own shift; the frame moves under it
# "run": {"from": "walk", "lean": [body, torso], "lift": [px per frame]} — the walk frames leaning forward (the whole
#   body tilts from the feet, the torso a little more from the waist; the head stays upright), optional lift per frame.
import json, os, sys, numpy as np
from PIL import Image
from scipy import ndimage as nd, signal
H = os.path.dirname(os.path.abspath(__file__)); G = H + '/../../'; S = 352; GROUND = 310
src = open(H + '/bake_pose.py').read()
exec(src[src.index('def keyed('):src.index('def labels(')])          # keyed() of the pose baker
FIG_H = 185
TONE = np.array([1.0, 0.91, 0.83], np.float32)                       # far leg = near leg tone x this (GPT's own shading)
spec = json.load(open(sys.argv[1])); gender = spec['gender']
sys.path.insert(0, H); import sword as SWORD                         # the sword in hand: one picture in every frame's fist
PIC = SWORD.picture(); REACH = SWORD.reach(PIC)
SW_PAD = 48; SWORD_W = S + 2 * SW_PAD                                  # the sword strips' cells: wider, the same middle (a thrust
                                                                       #   reaches past the body's cell)
OUT = G + 'public/assets/final/body/naked/' + gender + '/'
bm = np.array(Image.open(G + 'public/assets/final/body/warrior/base/idle_m.png'))[:, :S, 0]
HIPX = float(np.median(np.nonzero(bm == 200)[1]))                     # where the beginner always stood
_cache = {}


def neck_of(m):
  """Neck = the narrowest row between the head and the shoulders → (row, left, right)."""
  ys = np.nonzero(m.any(1))[0]; top, bot = ys.min(), ys.max(); h = bot - top
  best = None
  for y in range(top + int(h * 0.22), top + int(h * 0.45)):
    xs = np.nonzero(m[y])[0]
    if not len(xs): continue
    if best is None or xs.max() - xs.min() < best[2] - best[1]: best = (y, xs.min(), xs.max())
  return best


def figures(path):
  if path in _cache: return _cache[path]
  gi = np.array(Image.open(H + '/gpt/' + path).convert('RGB')).astype(np.float32)
  e, a = keyed(gi); fig = a > 0.5
  L, n = nd.label(fig); sz = nd.sum(fig, L, range(1, n + 1))
  big = [1 + i for i in range(n) if sz[i] > 0.25 * sz.max()]
  figs = []
  for i in big:
    m = L == i; ys, xs = np.nonzero(m)
    y0, y1, x0, x1 = ys.min(), ys.max(), xs.min(), xs.max()
    head = m[y0:y0 + int((y1 - y0) * 0.28)]
    runs = [np.count_nonzero(np.diff(np.concatenate([[0], r.astype(np.int8), [0]])) == 1) for r in head]
    if max(runs) > 1:                                          # hands up beside the head: the rows above them only
      head = head[:runs.index(next(v for v in runs if v > 1))]
    hx = np.nonzero(head.any(0))[0]
    dt = nd.distance_transform_edt(m[y0:y1 + 1]); dt[int((y1 - y0) * 0.6):] = 0
    headd = 2 * float(dt.max())                                # head size from its inscribed circle (arms, swords: any pose)
    if len(hx) < 2: hx = np.array([0, headd / 0.92])
    R_, G_, B_ = [e[..., k] for k in range(3)]; mx_ = np.maximum(np.maximum(R_, G_), B_); mn_ = np.minimum(np.minimum(R_, G_), B_)
    grey = m & ((mx_ - mn_) / np.maximum(mx_, 1) < 0.13) & (mx_ > 105) & (np.arange(m.shape[0])[:, None] > y0 + (y1 - y0) * 0.45)
    gx = np.nonzero(grey.any(0))[0]
    nk = neck_of(m)
    figs.append(dict(gi=gi, m=m, box=(x0, y0, x1, y1), cx=xs.mean(), cy=ys.mean(), headw=float(hx.max() - hx.min()), headd=headd,
                     shortsw=float(gx.max() - gx.min()) if len(gx) else 0.0, nts=float(y1 - nk[0])))
  # rows (top row first), each left to right
  figs.sort(key=lambda f: f['cy']); hmed = np.median([f['box'][3] - f['box'][1] for f in figs]); row, last = 0, None
  for f in figs:
    if last is not None and f['cy'] - last > 0.5 * hmed: row += 1
    f['row'] = row; last = f['cy']
  figs.sort(key=lambda f: (f['row'], f['cx']))
  _cache[path] = figs
  return figs


def split_legs(e, fig, lab):
  """Leg pixels below the shorts → (left leg, right leg) as drawn: skin areas parted by the dark outline between them."""
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


def gpt_legs(f):
  """The two legs of a GPT figure (its own resolution, where the outline between them is clear) → (left, right) as
  drawn: skin below the shorts parted by the outline, the outline to the nearest leg, up to the shorts' lower edge."""
  m = f['m']; e, _ = keyed(f['gi'])
  R, Gc, B = e[..., 0], e[..., 1], e[..., 2]; mx = np.maximum(np.maximum(R, Gc), B); mn = np.minimum(np.minimum(R, Gc), B)
  x0, y0, x1, y1 = f['box']; yy = np.arange(m.shape[0])[:, None]
  grey = m & ((mx - mn) / np.maximum(mx, 1) < 0.13) & (mx > 105) & (yy > y0 + (y1 - y0) * 0.45)
  hem = int(np.percentile(np.nonzero(grey)[0], 90))
  for thr in (120, 150, 170):                                    # legs touching (a heel kicked up behind): a lighter cut
    skin = m & ~grey & (mx >= thr) & (yy > hem)
    L, n = nd.label(skin); sz = nd.sum(skin, L, range(1, n + 1))
    if n > 1 and np.sort(sz)[-2] > 0.15 * sz.max(): break
  two = sorted([1 + i for i in np.argsort(-sz)[:2]], key=lambda i: np.nonzero(L == i)[1].mean())
  legs = [L == i for i in two]
  # a thigh raised beside the shorts (knee up): the same skin above the hem, up to the shorts' waist, joined to that leg
  gL, gn = nd.label(grey); big = [k for k in range(1, gn + 1) if (gL == k).sum() >= 400]
  if big:
    top = int(np.nonzero(gL == max(big, key=lambda k: np.nonzero(gL == k)[0].mean()))[0].min())
    up = m & ~grey & (mx >= thr) & (yy > top)
    U, _ = nd.label(up)
    ids = [set(np.unique(U[l & up])) - {0} for l in legs]
    legs = [l | np.isin(U, list(ids[k] - ids[1 - k])) for k, l in enumerate(legs)]   # never a piece joined to both
  # under the shorts: per column, the figure below the shorts' lowest pixel (no hands: they hang beside the shorts)
  gb = np.where(grey.any(0), grey.shape[0] - 1 - np.argmax(grey[::-1], 0), m.shape[0])
  under = m & ~grey & (yy > gb[None, :])
  d = [nd.distance_transform_edt(~l) for l in legs]
  near = under & (np.minimum(d[0], d[1]) <= 14)
  return [l | (near & (di <= dj)) for l, di, dj in ((legs[0], d[0], d[1]), (legs[1], d[1], d[0]))]


def gpt_sword(f):
  """The sword a GPT figure holds: the long thin light-steel blade, and the guard / grip / pommel at its hilt end."""
  m = f['m']; e, _ = keyed(f['gi'])
  R, Gc, B = e[..., 0], e[..., 1], e[..., 2]; mx = np.maximum(np.maximum(R, Gc), B); mn = np.minimum(np.minimum(R, Gc), B)
  sat = (mx - mn) / np.maximum(mx, 1)
  skin = (R > 150) & (Gc > 95) & (B > 60) & (R > Gc + 10) & (Gc > B + 8)
  steel = nd.binary_opening(m & (mx > 120) & (B >= R - 4) & (sat < 0.3) & ~skin, iterations=1)
  L, n = nd.label(steel); blade = np.zeros_like(m); ends = []
  for k in range(1, n + 1):
    ys, xs = np.nonzero(L == k)
    if len(ys) < 300: continue
    c = np.cov(np.vstack([xs, ys])); ev, vec = np.linalg.eigh(c)
    cm_ = L == k; short_ok = np.sqrt(ev[1]) >= 20 and mx[cm_].mean() >= 210 and (B - R)[cm_].mean() >= 16   # a sword planted in the
    if ev[1] < 8 * max(ev[0], 1e-3) or (np.sqrt(ev[1]) < 25 and not short_ok): continue   # ground shows its lower half only (bright cool
                                                                                            # steel, not the underwear's grey band)
    blade |= L == k
    u = vec[:, 1]; t = (xs - xs.mean()) * u[0] + (ys - ys.mean()) * u[1]
    p0, p1 = (xs[t.argmin()], ys[t.argmin()]), (xs[t.argmax()], ys[t.argmax()])
    ln = t.max() - t.min()
    ds = nd.distance_transform_edt(~(skin & m))
    hilt, tip = (p0, p1) if ds[p0[1], p0[0]] < ds[p1[1], p1[0]] else (p1, p0)      # the end at the fist
    ax_ = np.array([hilt[0] - tip[0], hilt[1] - tip[1]], float); ax_ /= np.linalg.norm(ax_)
    ends.append((hilt, ax_, ln))
  if not ends: return blade
  yy, xx = np.mgrid[0:m.shape[0], 0:m.shape[1]]
  hiltm = np.zeros_like(m)
  dark = mx < 150                                                                 # guard, pommel
  brown = (R > Gc + 12) & (Gc > B + 6) & (sat > 0.25) & (mx < 200) & ~skin         # grip
  for (hx_, hy_), (ux, uy), ln in ends:                                           # along the blade's line, past its base:
    along = (xx - hx_) * ux + (yy - hy_) * uy; perp = np.abs((xx - hx_) * uy - (yy - hy_) * ux)
    guard = (along > -0.06 * ln) & (along < 0.06 * ln) & (perp < 0.14 * ln)       # the crossguard
    grip = (along >= 0) & (along < 0.48 * ln) & (perp < 0.06 * ln + 0.12 * np.clip(along, 0, None))   # grip, pommel
    gold = (sat > 0.45) & (R > 120) & (R > B + 60)                                 # a brass guard
    hiltm |= (guard | grip) & m & ((~skin & (dark | brown | steel)) | (guard & gold))
  return nd.binary_closing(blade | hiltm, iterations=1) & m


def label(e, a, excl=None):
  fig = a > 0.5
  R, Gc, B = e[..., 0], e[..., 1], e[..., 2]
  mx = np.maximum(np.maximum(R, Gc), B); mn = np.minimum(np.minimum(R, Gc), B); sat = (mx - mn) / np.maximum(mx, 1)
  grey = nd.binary_opening(fig & (sat < 0.13) & (mx > 105) & (True if excl is None else ~excl), iterations=1)
  lab = np.where(fig, 60, 0).astype(np.uint8)
  gL, gn = nd.label(grey)
  parts = [(np.nonzero(gL == k)[0].mean(), gL == k) for k in range(1, gn + 1) if (gL == k).sum() >= 40]
  low = max((cy for cy, _ in parts), default=0)                  # the shorts: the lowest grey piece; the top: above it
  for cy, cm in parts:
    lab[nd.binary_fill_holes(nd.binary_closing(cm, iterations=2)) & fig] = 200 if cy > low - 15 else 80
  for part in (80, 200):
    lab[nd.binary_dilation(lab == part, iterations=2) & fig & (lab == 60) & (mx < 120)] = part
  if excl is not None: lab[excl & fig] = 255                    # the sword (its own mask channel)
  return fig, lab


def frame(path, idx, sc, opts=()):
  f = figures(path)[idx]; x0, y0, x1, y1 = f['box']
  gi = np.where(nd.binary_dilation(f['m'], iterations=3)[..., None], f['gi'], np.array([255, 0, 255], np.float32))   # this figure only
  pad = 24
  X0, Y0 = max(0, x0 - pad), max(0, y0 - pad)
  sub = gi[Y0:y1 + pad, X0:x1 + pad]
  h, w = sub.shape[:2]
  im = Image.fromarray(sub.clip(0, 255).astype(np.uint8)).resize((max(1, int(round(w * sc))), max(1, int(round(h * sc)))), Image.LANCZOS)
  canvas = Image.new('RGB', (S, S), (255, 0, 255)); canvas.paste(im, (int(S / 2 - im.width / 2), int(GROUND - im.height + pad * sc)))
  e, a = keyed(np.array(canvas).astype(np.float32))
  def to_cell(mask):                                            # a GPT-space mask → this cell, exactly like the picture
    lm = Image.fromarray((mask[Y0:y1 + pad, X0:x1 + pad] * 255).astype(np.uint8)).resize(im.size, Image.LANCZOS)
    cm = Image.new('L', (S, S), 0); cm.paste(lm, (int(S / 2 - im.width / 2), int(GROUND - im.height + pad * sc)))
    return np.array(cm).astype(np.float32) / 255
  sw = to_cell(gpt_sword(f)) > 0.5 if 'sword' in opts else None
  fig, lab = label(e, a, sw)
  if 'swap' in opts:
    back, front = split_legs(e, fig, lab)
    deep = np.arange(S)[:, None] > np.percentile(np.nonzero(lab == 200)[0], 97) + 3
    mb, mf = e[back & deep & (e.max(-1) > 120)].mean(0), e[front & deep & (e.max(-1) > 120)].mean(0)
    e = np.where(back[..., None], np.clip(e * (mf / mb), 0, 255), np.where(front[..., None], np.clip(e * (mb / mf), 0, 255), e))
  if 'swapg' in opts:                                           # near / far leg tones exchanged (GPT drew the same leg again)
    legs = gpt_legs(f); eg, _ = keyed(f['gi']); bright = eg.max(-1) > 150
    px_ = [eg[l & bright] for l in legs]; med = [np.median(p, 0) for p in px_]
    skin_ = ((e.max(-1) - 120) / 30).clip(0, 1)[..., None]                          # not the outline
    out = e.copy(); q = np.linspace(0, 100, 101)
    for k in (0, 1):
      s = nd.gaussian_filter(to_cell(legs[k]), 0.6).clip(0, 1)[..., None]
      if med[k].sum() < med[1 - k].sum():                       # the shaded leg lit like the other one: its own light / dark
        tgt = np.stack([np.interp(e[..., ch], np.percentile(px_[k][:, ch], q) + q * 1e-6, np.percentile(px_[1 - k][:, ch], q))
                        for ch in range(3)], -1)                #   order kept, never lighter than the lit leg (a lit sole)
      else: tgt = e * (med[1 - k] / med[k]).clip(0.7, 1.4)      # the lit leg in the shaded leg's tone
      out += (tgt - e) * s * skin_
    e = out
  far = [o for o in opts if o in ('farL', 'farR')]
  if far:                                                       # the far leg darker: its GPT mask through the same resize
    legs = gpt_legs(f); k = 0 if far[0] == 'farL' else 1
    eg, _ = keyed(f['gi']); bright = eg.max(-1) > 150
    gain = (np.median(eg[legs[1 - k] & bright], 0) * TONE / np.median(eg[legs[k] & bright], 0)).clip(0.7, 1.05)
    soft = nd.gaussian_filter(to_cell(legs[k]), 0.6).clip(0, 1)
    e = e * (1 - (1 - gain) * soft[..., None])
  sh = np.nonzero(lab == 200)
  dx = int(round(HIPX - np.median(sh[1]))); dy = GROUND - int(np.nonzero(fig.any(1))[0].max())
  r = lambda v: np.roll(np.roll(v, dy, 0), dx, 1)
  global LAST_GEOM
  LAST_GEOM = dict(X0=X0, Y0=Y0, x1=x1, y1=y1, pad=pad, size=im.size, at=(int(S / 2 - im.width / 2), int(GROUND - im.height + pad * sc)), dy=dy, dx=dx)
  return r(e), r(a), r(fig), r(lab)


def layer_to_cell(rgba, g_):
  """A layer drawn in the GPT image's space (RGBA, straight alpha) → the cell, exactly as frame() placed that figure —
  all of the layer, not only the figure's own box (long hair flows past the bald figure's back and above its head)."""
  ww, wh = g_['x1'] + g_['pad'] - g_['X0'], g_['y1'] + g_['pad'] - g_['Y0']            # the figure's box → size, at at + (dx, dy)
  kx, ky = g_['size'][0] / ww, g_['size'][1] / wh
  ox, oy = g_['at'][0] + g_['dx'], g_['at'][1] + g_['dy']
  M = 2 * S                                                                         # room around the layer (all of the cell maps inside)
  src = np.zeros((rgba.shape[0] + 2 * M, rgba.shape[1] + 2 * M, 4), np.float32); src[M:-M, M:-M] = rgba
  al = src[..., 3:4] / 255; pm = np.concatenate([src[..., :3] * al, al * 255], -1).clip(0, 255).astype(np.uint8)
  box = (g_['X0'] + M - ox / kx, g_['Y0'] + M - oy / ky, g_['X0'] + M + (S - ox) / kx, g_['Y0'] + M + (S - oy) / ky)   # the cell, in layer px
  w = np.asarray(Image.fromarray(pm, 'RGBA').resize((S, S), Image.LANCZOS, box=box)).astype(np.float32); a_ = w[..., 3:4] / 255
  return np.concatenate([np.where(a_ > 1e-3, w[..., :3] / np.maximum(a_, 1e-3), 0), a_], -1)   # colour 0..255, alpha 0..1


def over(top, bot):
  """Straight-alpha 'top over bottom' (colour 0..255, alpha 0..1 in the last channel)."""
  ta, ba = top[..., 3:4], bot[..., 3:4]; oa = ta + ba * (1 - ta)
  oc = np.where(oa > 1e-4, (top[..., :3] * ta + bot[..., :3] * ba * (1 - ta)) / np.maximum(oa, 1e-4), 0)
  return np.concatenate([oc, oa], -1)


def jaw_split(sil, nrow):
  """Standing head (everything above the neck row) → (head, neck stub): parted by the jaw line, from the corner where
  the back of the skull meets the neck to the bottom of the chin."""
  rows = range(int(np.argmax(sil.sum(1))), nrow + 1)
  L = {y: np.nonzero(sil[y])[0].min() for y in rows}; R = {y: np.nonzero(sil[y])[0].max() for y in rows}
  back = max(L.values()); yb = min(y for y in rows if L[y] >= back - 1); xb = L[yb]
  yf = max((y for y in rows if y < nrow), key=lambda y: R[y] - R[y + 1]); xf = R[yf]
  yy, xx = np.mgrid[0:S, 0:S]
  line = yb + (yf - yb) * np.clip((xx - xb) / max(1, xf - xb), 0, 1)
  neck = sil & (yy > line) & (yy > yb)
  return sil & ~neck, neck


def find_head(fig, hd, r, search=False):
  if search:                                                    # several sizes: the best fit (score per template pixel)
    best = None
    for k in np.arange(0.9, 1.101, 0.025):
      res = find_head(fig, hd, r * k)
      if best is None or res[3] > best[3]: best = res
    return best
  return _find_head(fig, hd, r)


def _find_head(fig, hd, r):
  """Where GPT drew its head: the standing head's outline (scaled to GPT's head size, r) laid over this figure — the
  head inside the figure, the band just outside its upper half clear of it. → GPT's neck point (x, y), the scaled
  standing head (without its neck) laid there = GPT's head."""
  sm = hd['sil']; ys, xs = np.nonzero(sm); y0, x0, y1, x1 = ys.min(), xs.min(), ys.max(), xs.max()
  size = (max(1, round((x1 - x0 + 1) * r)), max(1, round((y1 - y0 + 1) * r)))
  rs = lambda m: np.array(Image.fromarray((m[y0:y1 + 1, x0:x1 + 1] * 255).astype(np.uint8)).resize(size, Image.LANCZOS)) > 127
  T, TH = rs(sm), rs(hd['head'])
  wide = int(np.argmax(T.sum(1)))
  ring = nd.binary_dilation(np.pad(T, 4), iterations=3) & ~np.pad(T, 4); ring[4 + wide:] = False
  K = np.pad(T, 4).astype(np.float32) - ring.astype(np.float32)
  sc = signal.correlate(fig.astype(np.float32), K, mode='valid', method='fft')
  top = int(np.nonzero(fig.any(1))[0].min())
  win = np.full(sc.shape, -1e9, np.float32); lo, hi = max(0, top - 20), min(sc.shape[0], top + 60); win[lo:hi] = sc[lo:hi]
  ty, tx = np.unravel_index(np.argmax(win), win.shape); score = float(win[ty, tx]) / T.sum(); ty, tx = ty + 4, tx + 4
  m = np.zeros((S, S), bool); m[ty:ty + TH.shape[0], tx:tx + TH.shape[1]] = TH
  return tx + (hd['cx'] - x0) * r, ty + (hd['row'] - y0) * r, m, score


def track_head(e, fig, ref):
  """GPT's head in this frame found by its own drawing: the move's clean head (ref: its colours and mask, GPT draws the
  same head in every figure) laid where it matches best — an arm or a sword in front of part of it costs a fixed amount,
  no more (a raised arm or sword makes the figure's top useless for finding the head) → neck point (x, y), head mask."""
  gm = ref['gm']; ys, xs = np.nonzero(gm); te = ref['e'][ys, xs]
  def err(dx, dy):
    Y, X = ys + dy, xs + dx
    ok = (Y >= 0) & (Y < S) & (X >= 0) & (X < S)
    if ok.mean() < 0.9: return 1e9
    Y, X = Y[ok], X[ok]
    return float((np.minimum(np.abs(e[Y, X] - te[ok]).sum(-1), 150) + 150 * ~fig[Y, X]).mean())
  best = min((err(dx, dy), dx, dy) for dy in range(-75, 76, 3) for dx in range(-75, 76, 3))
  best = min((err(dx, dy), dx, dy) for dy in range(best[2] - 3, best[2] + 4) for dx in range(best[1] - 3, best[1] + 4))
  _, dx, dy = best
  return ref['ax'] + dx, ref['ay'] + dy, np.roll(np.roll(gm, dy, 0), dx, 1), -best[0]


def occluders(e, fig, lab, gm, zone, ay, ref, ax, reach):
  """What GPT drew in front of its own head — the sword and the arm holding it — kept in front of the standing head.
  The arm = what is within an arm's length of the sword's hilt, going through the inside of the arm (not across
  outlines); over GPT's head, only where this frame differs from the same head drawn clean (another frame)."""
  sx0, sy0 = int(round(ax - ref['ax'])), int(round(ay - ref['ay']))
  best = None                                                    # the clean head laid exactly over this one
  for oy in range(-4, 5):
    for ox in range(-4, 5):
      xe_ = np.roll(np.roll(ref['e'], sy0 + oy, 0), sx0 + ox, 1)
      err = float(np.minimum(np.abs(e - xe_).sum(-1), 200)[gm & fig].mean())
      if best is None or err < best[0]: best = (err, ox, oy)
  sh = lambda v: np.roll(np.roll(v, sy0 + best[2], 0), sx0 + best[1], 1)
  xe, xf = sh(ref['e']), sh(ref['fig'])
  sword = fig & (lab == 255)
  if not sword.any(): return np.zeros((S, S), bool), np.zeros((S, S), bool)
  inner = nd.binary_dilation(gm, iterations=1)
  through = fig & ((e.max(-1) >= 140) | sword) & ~inner                                # never through GPT's head
  arm = sword.copy(); front = arm.copy()
  for _ in range(int(reach * 0.85)):                             # within an arm's length of the sword, inside the arm
    front = nd.binary_dilation(front) & through & ~arm
    if not front.any(): break
    arm |= front
  diff = np.abs(e - xe).sum(-1)
  cand = nd.binary_opening(gm & fig & (~xf | (diff > 150)), iterations=2)   # no thin strips (outlines 1-2 px apart)
  L, n = nd.label(cand); near = nd.binary_dilation(arm & ~gm, iterations=2)
  over = np.isin(L, [k for k in range(1, n + 1) if ((L == k) & near).any()])   # over GPT's head: joined to the arm
  skin = zone & ~inner & arm & ~sword
  occ = skin | over | (sword & zone)
  occ = nd.binary_fill_holes(nd.binary_closing(occ, iterations=2)) & fig & zone          # one solid arm, no see-through
  dark = e.max(-1) < 140                                         # the arm's own outline (not GPT's head outline at its edge)
  occ = occ | (nd.binary_dilation(skin, iterations=1) & fig & dark & zone & ~nd.binary_dilation(gm, iterations=2))
  whole = nd.binary_dilation(arm, iterations=2) & fig & ~inner   # the sword arm with its outline (in front of any hair)
  return occ, whole


def put_head(e, a, fig, lab, hd, r, follow=False, ref=None, search=False, sway=0.0, bob=0, hold=None, track=False):
  """GPT's head off, the standing head on (the same drawing), on GPT's neck point; its neck goes behind the body (the
  frame keeps its own neck). follow=False: the head stays near the standing x and the frame moves under it (walk):
  sway = how much of GPT's own head shift is kept (MapleStory: the same head, a little forward / back each step);
  bob = the head sits this much lower on the neck (the step's low point). follow=True: the frame stays (planted feet),
  the head goes with it. track: GPT's head found by its drawing (the move's clean head, ref), not by its outline."""
  ax, ay, gm, _ = track_head(e, fig, ref) if track and ref is not None and 'gm' in ref else find_head(fig, hd, r, search)
  dy = int(round(ay - hd['row'])) + bob; hx = int(round(ax - hd['cx']))
  dx = 0
  if not follow: keep_ = int(round(sway * hx)); dx, hx = keep_ - hx, keep_
  elif hold is not None:                                         # near the move's mean x, keeping a part of GPT's own shift
    tgt = hold[0] + hold[1] * (ax - hold[0]); dx = int(round(tgt - ax)); hx = int(round(ax + dx - hd['cx']))
  e, a, fig, lab, gm = [np.roll(v, dx, 1) for v in (e, a, fig, lab, gm)]
  ax += dx
  sh = lambda v: np.roll(np.roll(v, dy, 0), hx, 1)
  cut = nd.binary_dilation(gm, iterations=2)                                       # GPT's head
  occ, arm = occluders(e, fig, lab, gm, cut | sh(hd['head']), ay, ref, ax, int(hd['row'] - hd['top'])) if ref else (np.zeros((S, S), bool), np.zeros((S, S), bool))
  keep = [v.copy() for v in (e, a, lab)]
  e[cut] = 0; a[cut] = 0; fig[cut] = False; lab[cut] = 0
  he, ha, hl = sh(hd['e']), sh(hd['a']), sh(hd['lab'])
  pasted = np.zeros((S, S), bool)
  for m in (sh(hd['neck']) & ~fig, sh(hd['head'])):                               # neck behind, head over
    e[m] = he[m]; a[m] = ha[m]; fig[m] = True; lab[m] = hl[m]; pasted |= m
  e[occ], a[occ], lab[occ] = keep[0][occ], keep[1][occ], keep[2][occ]; fig[occ] = True   # arm / sword in front of it
  # in front of the hair: the sword arm as it shows — none of it when it passes behind the head
  front = arm & fig & ~(pasted & ~occ)
  if (arm & pasted).sum() > 30 and occ.sum() < 0.25 * (arm & pasted).sum(): front[:] = False
  return e, a, fig, lab, dict(dx=dx, hx=hx, dy=dy, occ=int(occ.sum()), front=front, head=sh(hd['head']) & ~occ)


def feet_x(fig):
  """Middle of the feet (the lowest rows of the figure)."""
  ys = np.nonzero(fig.any(1))[0]; xs = np.nonzero(fig[ys.max() - 14:ys.max() + 1].any(0))[0]
  return (xs.min() + xs.max()) / 2


def lean(px, mk, kb, kt, lift):
  """Run lean: each row shifted forward by kb·(height above the sole) + kt·(height above the waist), the head rows all by
  the neck's amount (upright head); then the whole figure lifted by `lift` px."""
  al = px[..., 3] > 0
  ys = np.nonzero(al.any(1))[0]
  sh = np.nonzero(mk[..., 0] == 200)[0]; waist = int(np.percentile(sh, 5)) if len(sh) else int(ys.mean())
  row = neck_of(al)[0]
  out = np.zeros_like(px, dtype=np.float32); mo = np.zeros_like(mk)
  pm = px.astype(np.float32); pm[..., :3] *= pm[..., 3:4] / 255
  xs = np.arange(S, dtype=np.float32)
  for y in range(S):
    yy = max(y, row)
    d = kb * (GROUND - yy) + kt * max(0, waist - yy)
    src = xs - d; x0 = np.floor(src).astype(int); f = (src - x0)[:, None]
    ok = (x0 >= 0) & (x0 + 1 < S)
    v = np.zeros((S, 4), np.float32)
    v[ok] = pm[y, x0[ok]] * (1 - f[ok]) + pm[y, x0[ok] + 1] * f[ok]
    out[y] = v
    xi = np.clip(np.round(src).astype(int), 0, S - 1); mo[y] = mk[y, xi]
  if lift: out = np.roll(out, -lift, 0); mo = np.roll(mo, -lift, 0)
  a = out[..., 3]
  rgb = np.where(a[..., None] > 0, out[..., :3] / np.maximum(a[..., None], 1e-6) * 255, 0)
  res = np.dstack([rgb, a]).round().clip(0, 255).astype(np.uint8)
  mo[..., 3] = 255; mo[..., 0] = np.where(res[..., 3] > 0, mo[..., 0], 0)
  return res, mo, kb * (GROUND - row) + kt * max(0, waist - row)


# ---- worn gear (equipment): GPT dressed our figures in place (tools/base/gpt/dressed/<image>: the same figures in a green
# T-shirt, blue pants, brown boots, the starter sword in hand). Each piece is lifted off the dressed figure, laid on the bare
# one (scale + shift by the bald head, which GPT left as it was) and goes through the very same cell placement as the bare
# frame, so the game draws it on that frame; the clothes are re-coloured into the offered colours (outfit-colors.json).
GEAR_PIECES = ('pants', 'shoes', 'top')
GEAR_COLORS = {k: [tuple(int(c['swatch'][i:i + 2], 16) for i in (1, 3, 5)) for c in v] for k, v in json.load(open(G + 'src/data/outfit-colors.json')).items()}
_dcache = {}


def warp_fig(f, s, ox, oy, shape):
  """A GPT figure (colour without the magenta, alpha) laid into another image: there = s * here + (ox, oy)."""
  e, a = keyed(f['gi']); a = np.where(nd.binary_dilation(f['m'], iterations=3), a, 0)
  pm = np.dstack([e * a[..., None], a * 255]).clip(0, 255).astype(np.uint8)
  im = Image.fromarray(pm, 'RGBA').transform((shape[1], shape[0]), Image.AFFINE, (1 / s, 0, -ox / s, 0, 1 / s, -oy / s), Image.BICUBIC)
  w = np.asarray(im).astype(np.float32); al = w[..., 3] / 255
  return np.where(al[..., None] > 1e-3, w[..., :3] / np.maximum(al[..., None], 1e-3), 0).clip(0, 255), al


def across(p, blade):
  """The blade's pixels with the piece p on both sides of it (across the blade's width): p goes on behind the blade there."""
  if not blade.any() or not p.any(): return np.zeros_like(blade)
  ys, xs = np.nonzero(blade); ev, vec = np.linalg.eigh(np.cov(np.vstack([xs, ys]))); u = vec[:, 1]; nx_, ny_ = -u[1], u[0]
  w = int(2 * nd.distance_transform_edt(blade).max() + 6); s1 = np.zeros_like(blade); s2 = np.zeros_like(blade)
  for k in range(1, w + 1):
    dx_, dy_ = int(round(nx_ * k)), int(round(ny_ * k))
    s1 |= np.roll(np.roll(p, -dy_, 0), -dx_, 1); s2 |= np.roll(np.roll(p, dy_, 0), dx_, 1)
  return blade & s1 & s2


_bcache = {}


def _body(fn):
  """The bare GPT figure without the sword it holds (an attack image): the body's own mask and box."""
  if id(fn) in _bcache: return _bcache[id(fn)]
  sw_ = gpt_sword(fn); out = fn
  if sw_.any():
    m_ = fn['m'] & ~nd.binary_dilation(sw_, iterations=2); L_, n_ = nd.label(m_)
    m_ = L_ == 1 + int(np.argmax(nd.sum(m_, L_, range(1, n_ + 1)))); ys_, xs_ = np.nonzero(m_)
    out = dict(fn, m=m_, box=(xs_.min(), ys_.min(), xs_.max(), ys_.max()))
  _bcache[id(fn)] = out
  return out


def _laid(dp, fn, body=False):
  """GPT's dressed copy (image dp) of the bare GPT figure fn, laid on it by the bald head, which GPT left as it was (scale,
  then shift by 1 px, then half a pixel; body: then the whole figure's outline on ours) → colour, alpha in the bare image's
  space; the scale / the boxes' ratio, the head's error. (The bare figure's own sword, in an attack, is not body.)"""
  fn = _body(fn); en, an = keyed(fn['gi']); shape = fn['m'].shape
  cxy = lambda f: ((f['box'][0] + f['box'][2]) / 2, (f['box'][1] + f['box'][3]) / 2)
  fd = min(figures(dp), key=lambda f: (cxy(f)[0] - cxy(fn)[0]) ** 2 + (cxy(f)[1] - cxy(fn)[1]) ** 2)   # the same figure, dressed
  x0, y0, x1, y1 = fn['box']; yy = np.arange(shape[0])[:, None]
  R = nd.binary_dilation(fn['m'], iterations=2) & (yy < y0 + 0.30 * (y1 - y0))      # the bald head: GPT left it as it was
  ry, rx = np.nonzero(R); ry0, rx0 = ry.min(), rx.min()
  A = en[ry0:ry.max() + 1, rx0:rx.max() + 1]; Aa = (an * fn['m'])[ry0:ry.max() + 1, rx0:rx.max() + 1] * 255; M = R[ry0:ry.max() + 1, rx0:rx.max() + 1]
  ed, ad = keyed(fd['gi']); ad = np.where(nd.binary_dilation(fd['m'], iterations=3), ad, 0)
  X0, Y0, X1, Y1 = fd['box']; X0 -= 16; Y0 -= 16; X1 += 16; Y1 += 16
  crop = np.dstack([ed[Y0:Y1 + 1, X0:X1 + 1], ad[Y0:Y1 + 1, X0:X1 + 1] * 255])
  def head_cx(f):                                                  # the head's middle (a raised sword widens the box, not this)
    m_ = f['m']; t_ = f['box'][1]; rows_ = m_[t_:t_ + int(0.18 * (f['box'][3] - t_))]; xs_ = np.nonzero(rows_.any(0))[0]
    return (xs_.min() + xs_.max()) / 2
  hn_, hd_ = head_cx(fn), head_cx(fd)
  s0 = (y1 - y0) / (fd['box'][3] - fd['box'][1]); best = None
  for s_ in np.arange(s0 * 0.96, s0 * 1.04, 0.004):                 # scale, then shift (1 px), then half a pixel
    big = np.array(Image.fromarray(crop.clip(0, 255).astype(np.uint8), 'RGBA').resize((round(crop.shape[1] * s_), round(crop.shape[0] * s_)), Image.BICUBIC)).astype(np.float32)
    ox0, oy0 = hn_ - s_ * hd_, y0 - s_ * fd['box'][1]
    for ty in range(-12, 13):
      for tx in range(-12, 13):
        oy_, ox_ = int(round(ry0 - (s_ * Y0 + oy0 + ty))), int(round(rx0 - (s_ * X0 + ox0 + tx)))
        if oy_ < 0 or ox_ < 0 or oy_ + A.shape[0] > big.shape[0] or ox_ + A.shape[1] > big.shape[1]: continue
        sub = big[oy_:oy_ + A.shape[0], ox_:ox_ + A.shape[1]]
        err = float((np.abs(A - sub[..., :3]).sum(-1) + 2 * np.abs(Aa - sub[..., 3]))[M].mean())
        if best is None or err < best[0]: best = (err, s_, ox0 + tx, oy0 + ty)
  err, s_, ox, oy = best; fine = (1e9, 0, 0)
  for dy_ in (-0.5, 0, 0.5):
    for dx_ in (-0.5, 0, 0.5):
      Fe, Fa = warp_fig(fd, s_, ox + dx_, oy + dy_, shape)
      e2 = float((np.abs(en - Fe).sum(-1) + 2 * np.abs(an * fn['m'] - Fa) * 255)[R].mean())
      if e2 < fine[0]: fine = (e2, dx_, dy_)
  ox, oy = ox + fine[1], oy + fine[2]
  if body:                                                     # then the whole body: GPT's redraw may be a little bigger or
    B = fn['m']; dt = np.minimum(nd.distance_transform_edt(~(B & ~nd.binary_erosion(B))), 15)   # smaller than its head says —
    Md = fd['m']; ys_, xs_ = np.nonzero(Md & ~nd.binary_erosion(Md)); sh_ = np.arange(-10, 11)   # its outline laid on ours
    cost = lambda X, Y: dt[np.clip(np.round(Y).astype(int), 0, shape[0] - 1), np.clip(np.round(X).astype(int), 0, shape[1] - 1)].mean(-1)
    bb = None
    for k in np.arange(0.97, 1.0301, 0.005):
      X = s_ * k * xs_ + ox + (s_ - s_ * k) * (fd['box'][0] + fd['box'][2]) / 2; Y = s_ * k * ys_ + oy + (s_ - s_ * k) * fd['box'][1]
      c_ = cost(X[None, None, :] + sh_[None, :, None], Y[None, None, :] + sh_[:, None, None])   # [dy, dx]
      i_ = np.unravel_index(np.argmin(c_), c_.shape)
      if bb is None or c_[i_] < bb[0]: bb = (float(c_[i_]), k, sh_[i_[1]], sh_[i_[0]])
    _, k, dx_, dy_ = bb
    ox, oy = ox + (s_ - s_ * k) * (fd['box'][0] + fd['box'][2]) / 2 + dx_, oy + (s_ - s_ * k) * fd['box'][1] + dy_; s_ = s_ * k
  Fe, Fa = warp_fig(fd, s_, ox, oy, shape)
  return Fe, Fa, s_ / s0, fine[0]


def _sword_of(Fe, Fa):
  """The sword the dressed figure holds (steel blade, guard, grip): one solid piece — nicks and holes filled, its own dark
  outline, no bits of the cloth / skin around it."""
  Rc, Gc, Bc = Fe[..., 0], Fe[..., 1], Fe[..., 2]; lum = 0.3 * Rc + 0.59 * Gc + 0.11 * Bc; fig = Fa > 0.05
  gi = np.where((Fa > 0.5)[..., None], Fe, np.array([255, 0, 255], np.float32))
  sword = gpt_sword(dict(gi=gi, m=Fa > 0.5))
  if sword.any():
    sword = nd.binary_fill_holes(nd.binary_closing(sword, iterations=2)) & fig
    cloth = ((Bc > Rc + 25) & (Bc > Gc + 8)) | ((Gc > Rc + 25) & (Gc > Bc + 15))
    sword &= ~(cloth | (((Rc - Bc) > 45) & (lum > 140)))
    sword |= nd.binary_dilation(sword, iterations=3) & fig & (lum < 110) & ~cloth & ~(((Rc - Bc) > 45) & (lum > 140))
    Ls, ns = nd.label(sword); szs = nd.sum(sword, Ls, range(1, ns + 1))
    sword = np.isin(Ls, [i + 1 for i in range(ns) if szs[i] >= max(20, 0.01 * szs.max())])
  return sword


def _clothes(Fe, Fa, sword, fn):
  """The clothes on the dressed figure (laid on the bare one, fn) by GPT's colours, each with its own dark outline; where a
  sword (mask) is in front of a piece, the piece goes on behind it in its own colour, over the bare body."""
  shape = fn['m'].shape; yy = np.arange(shape[0])[:, None]
  Rc, Gc, Bc = Fe[..., 0], Fe[..., 1], Fe[..., 2]; mx = np.maximum(np.maximum(Rc, Gc), Bc); mn = np.minimum(np.minimum(Rc, Gc), Bc)
  lum = 0.3 * Rc + 0.59 * Gc + 0.11 * Bc; sat = (mx - mn) / np.maximum(mx, 1); fig = Fa > 0.05
  top = nd.binary_opening(fig & (Gc > Rc + 25) & (Gc > Bc + 15) & ~sword, iterations=1)
  pants = nd.binary_opening(fig & (Bc > Rc + 25) & (Bc > Gc + 8) & ~sword, iterations=1)
  # the boots: brown (darker and redder than skin: green / red < 0.66, blue / red < 0.34), solid blobs at the pants' leg ends
  # — wherever the foot is (a foot kicked up behind too), never a thin outline stroke
  shoes = fig & (Gc < 0.66 * Rc) & (Bc < 0.34 * Rc) & (lum > 30) & (lum < 160) & (sat > 0.3) & ~nd.binary_dilation(pants, iterations=1) & ~sword
  shoes = nd.binary_opening(shoes, iterations=2); L_, n_ = nd.label(shoes)
  if n_:
    sz = nd.sum(shoes, L_, range(1, n_ + 1)); touch = nd.maximum(nd.binary_dilation(pants, iterations=8), L_, range(1, n_ + 1))
    shoes = np.isin(L_, [1 + i for i in range(n_) if touch[i] and sz[i] > 0.05 * sz.max()])
  ink = fig & (lum < 75) & ~sword & ~((sat < 0.12) & (lum > 40)); out = {}; taken = sword.copy()   # cloth outlines, not grey steel
  blade = sword & (lum > 120) & (sat < 0.3)                    # the steel (not the guard / grip at the fist)
  hand = nd.binary_dilation(fig & ((Rc - Bc) > 40) & (lum > 140) & nd.binary_dilation(sword, iterations=40), iterations=10)   # the fist on it
  def in_rows(p):                                              # the piece's own rows and columns
    if not p.any(): return np.zeros_like(p)
    ys_, xs_ = np.nonzero(p); yy_, xx_ = np.mgrid[0:shape[0], 0:shape[1]]
    return (yy_ >= ys_.min()) & (yy_ <= ys_.max()) & (xx_ >= xs_.min() - 10) & (xx_ <= xs_.max() + 10)
  # our bare figure under the clothes: GPT drew its dressed body a little narrower here and there, so our body (a calf, the
  # bra's edge) would peek out from under a piece — the piece is drawn over it too (cover). Our underwear is always covered;
  # skin only where that part of our body (a leg, the midriff: one patch of skin inside its outline) is under the piece
  fn = _body(fn); eb, ab = keyed(fn['gi']); ab = ab * fn['m']; bare = ab > 0.5; _, lab_b = label(eb, ab); lum_b = eb @ np.array([0.3, 0.59, 0.11])
  dfig = Fa > 0.5; dd, (ny, nx) = nd.distance_transform_edt(~dfig, return_indices=True)
  outside = bare & ~dfig & (dd <= 12)                          # our body where GPT's dressed figure is narrower
  SL, sn = nd.label(bare & (lab_b == 60) & (lum_b >= 100))     # our skin, patch by patch (parted by the outline): the ones the
  if sn:                                                       #   clothes cover (a leg in pants and a boot) are clothed parts
    frac = nd.mean(((top | pants | shoes) & fig).astype(np.float32), SL, range(1, sn + 1))
    parts = np.isin(SL, [i + 1 for i in range(sn) if frac[i] > 0.75])
  allp = top | pants | shoes; allp = allp | (nd.binary_dilation(allp, iterations=3) & ink)   # every piece GPT drew (a piece
                                                               #   never covers another one's place)
  for name, p in (('top', top), ('pants', pants), ('shoes', shoes)):
    p = nd.binary_fill_holes(nd.binary_closing(p, iterations=2)) & fig; col = Fe
    hid = (across(p, sword) | (nd.binary_dilation(sword, iterations=1) & fn['m'] & in_rows(p))) & ~p & ~hand   # the piece behind the sword (over the bare body)
    if hid.any():                                                      # its cloth's colour there, smoothed (no streaks)
      inner_ = p & ~sword & ~ink; w_ = nd.gaussian_filter(inner_.astype(np.float32), 8)
      sm = np.stack([nd.gaussian_filter(np.where(inner_, Fe[..., k], 0), 8) for k in range(3)], -1) / np.maximum(w_, 1e-3)[..., None]
      _, (iy, ix) = nd.distance_transform_edt(~inner_, return_indices=True)
      col = np.where(hid[..., None], np.where((w_ > 0.02)[..., None], sm, Fe[iy, ix]), Fe); p = p | hid
    rim = nd.binary_dilation(p, iterations=3) & ink & ~taken
    m_ = (p | rim) & ~(taken & ~hid); taken |= m_
    cov = np.zeros_like(m_)
    if m_.any() and sn:                                        # our clothed parts left bare next to this piece (sticking out of
      near_ = nd.distance_transform_edt(~m_) <= (16 if name == 'shoes' else 8)   #   GPT's narrower drawing, or where GPT drew a
                                                               #   hand / an outline; a pointed foot reaches further out of a boot)
      cov = (ab > 0.05) & ~m_ & near_ & ~allp & (parts | (nd.binary_dilation(parts, iterations=2) & (lum_b < 100)))   # (our soft edge too)
      under = {'top': 80, 'pants': 200}.get(name)
      if under: cov |= bare & (lab_b == under) & ~m_ & nd.binary_dilation(m_, iterations=30)   # (all of it: GPT may draw the hem higher)
      if name == 'shoes' and (lab_b == 200).any():             # a leg GPT drew a little elsewhere: our leg's bare end (skin of a
        sk_ = bare & (lab_b == 60) & (lum_b >= 100)            #   leg: joined to the shorts, no outline between) gets the boot
        LL_, nl_ = nd.label(sk_); th_ = np.unique(LL_[sk_ & nd.binary_dilation(lab_b == 200, iterations=3)]); th_ = th_[th_ > 0]
        left_ = np.isin(LL_, th_) & ~taken & ~m_
        left_ &= np.arange(shape[0])[:, None] > np.nonzero((lab_b == 200).any(1))[0].max() - 4   # below the shorts
        if left_.any(): cov |= left_ | (nd.binary_dilation(left_, iterations=2) & bare & (lum_b < 100) & ~taken)
      cov &= ~taken
    if cov.any():                                              # its colour there: our body's outer outline → the piece's outline,
      inner = m_ & ~ink & (Fa > 0.5)                           #   the rest the piece's cloth around (smoothed: no streaks, none of
      _, (iy, ix) = nd.distance_transform_edt(~inner, return_indices=True)   #   our toes' / knuckles' lines); its old outline,
      w_ = nd.gaussian_filter(inner.astype(np.float32), 4)     #   now inside it, cloth too
      sm_ = np.stack([nd.gaussian_filter(np.where(inner, Fe[..., k], 0), 4) for k in range(3)], -1) / np.maximum(w_, 1e-3)[..., None]
      fill_ = np.where((w_ > 0.05)[..., None], sm_, Fe[iy, ix])
      edge_ = nd.distance_transform_edt(ab > 0.05) <= 2.0       # our silhouette's own edge
      inkc = np.median(Fe[m_ & ink], 0) if (m_ & ink).any() else Fe[inner].mean(0) * 0.35
      col = np.where(cov[..., None], np.where(edge_[..., None], inkc, fill_), col)
      col = np.where((m_ & ink & nd.binary_dilation(cov, iterations=2) & bare & ~edge_)[..., None], fill_, col)
      m_ = m_ | cov; taken |= cov
    a_ = np.where(m_, np.where(hid, 1.0, np.where(cov, np.maximum(Fa, ab), Fa)), 0)
    a_ = np.maximum(a_, nd.gaussian_filter(a_, 0.6) * (Fa > 0.5)) * ((Fa > 0.02) | hid | cov)
    out[name] = np.dstack([col, a_ * 255]).clip(0, 255)
  return out


def dressed(path, idx):
  """The worn clothes on GPT figure idx of path, as layers in the bare image's space: {piece: RGBA (colour 0..255, alpha
  0..255)} for pants / shoes / top, or None when GPT has not dressed this image. GPT dressed every image without any sword
  (tools/base/gpt/dressed_nosword/<image>: the clothes, whole — nothing in front of them); the sword in hand is ours
  (tools/base/sword.py). An image GPT dressed with a sword in hand (tools/base/gpt/dressed/<image>) serves only when
  there is no sword-free one: its clothes are filled in behind the sword."""
  if (path, idx) in _dcache: return _dcache[(path, idx)]
  ws, ns = 'dressed/' + path, 'dressed_nosword/' + path
  hw, hn = [os.path.exists(H + '/gpt/' + p_) for p_ in (ws, ns)]
  if not (hw or hn): _dcache[(path, idx)] = None; return None
  fn = figures(path)[idx]
  if hn: Ce, Ca, k_, err = _laid(ns, fn, body=True); csw = np.zeros(fn['m'].shape, bool)
  else: Ce, Ca, k_, err = _laid(ws, fn, body=True); csw = _sword_of(Ce, Ca)
  out = _clothes(Ce, Ca, csw, fn)
  out['all'] = np.dstack([Ce, Ca * 255]).clip(0, 255)        # the whole dressed figure (what is there without a sword)
  print('  dressed', path, idx, 'sword-free' if hn else 'with a sword', 'scale', round(k_, 4), 'head err', round(err, 1), {k: int((v[..., 3] > 127).sum()) for k, v in out.items()})
  _dcache[(path, idx)] = out
  return out


def gear_ramp(lum, lo, md, hi, c):
  """A piece's light / dark through the new colour's ramp: its middle tone = the colour, shadows down to 45 %, highlights
  a little lighter (the menus' rule, tools/base/outfit/outfit_layers.py)."""
  t = np.where(lum < md, 0.5 * np.clip((lum - lo) / max(md - lo, 1), 0, 1), 0.5 + 0.5 * np.clip((lum - md) / max(hi - md, 1), 0, 1))[..., None]
  c = np.array(c, np.float32); dark, light = c * 0.45, c + (255 - c) * 0.3
  return np.where(t < 0.5, dark + (c - dark) * (t / 0.5), c + (light - c) * ((t - 0.5) / 0.5))


def gear_colours(layers, piece):
  """The piece's layers (straight RGBA, alpha 0..1) in each offered colour: one ramp for all of them (their pooled light /
  dark), the dark outline kept dark."""
  pool = np.concatenate([L[..., :3][L[..., 3] > 0.5] for L in layers if (L[..., 3] > 0.5).any()]) if any((L[..., 3] > 0.5).any() for L in layers) else None
  if pool is None: return [[L.copy() for L in layers] for _ in GEAR_COLORS[piece]]
  lp = pool @ np.array([0.3, 0.59, 0.11]); lpi = lp[lp >= 75]
  lo, md, hi = np.percentile(lpi, 2), np.percentile(lpi, 50), np.percentile(lpi, 99.5)
  res = []
  for c in GEAR_COLORS[piece]:
    out = []
    for L in layers:
      lum = L[..., :3] @ np.array([0.3, 0.59, 0.11]); col = gear_ramp(lum, lo, md, hi, c)
      col = np.where((lum < 75)[..., None], np.minimum(col, lum[..., None] * 0.55 + np.array(c) * 0.1), col)
      out.append(np.concatenate([col, L[..., 3:4]], -1))
    res.append(out)
  return res


def swing_grip(sw, fig, lab, e):
  """GPT's sword in an attack frame (mask): the fist on it (grip point), the blade's angle, grip → tip. The sword's solid
  part only (a thin line GPT ran on through the fist, under the arm, is not the sword's end)."""
  so = nd.binary_opening(sw, iterations=1); L_, n_ = nd.label(so)
  if n_: sw = L_ == 1 + int(np.argmax(nd.sum(so, L_, range(1, n_ + 1))))
  ys, xs = np.nonzero(sw); ev, vec = np.linalg.eigh(np.cov(np.vstack([xs, ys]))); u = vec[:, 1]
  t = (xs - xs.mean()) * u[0] + (ys - ys.mean()) * u[1]
  ends = [(int(xs[t.argmin()]), int(ys[t.argmin()])), (int(xs[t.argmax()]), int(ys[t.argmax()]))]
  ds = nd.distance_transform_edt(~SWORD.skin_of(fig, lab, e))
  hilt, tip = sorted(ends, key=lambda p: ds[p[1], p[0]])        # the end at the fist, the tip
  at = SWORD.fist_at(fig, lab, e, hilt, it=4)
  return at, float(np.degrees(np.arctan2(tip[1] - at[1], tip[0] - at[0]))), float(np.hypot(tip[0] - at[0], tip[1] - at[1]))


idle_path, idle_idx = spec['anims']['idle'][0][:2]
fi = figures(idle_path)[idle_idx]
SC0 = FIG_H / (fi['box'][3] - fi['box'][1]); HEADW = fi['headw'] * SC0; SHORTSW = fi['shortsw'] * SC0     # the standing frame sets the size
# the standing head (and neck) every other frame wears
e0, a0, f0, l0 = frame(idle_path, idle_idx, SC0)
IDLE_GEOM = dict(LAST_GEOM)
nrow, nl, nr = neck_of(f0)
sil0 = f0 & (np.arange(S)[:, None] <= nrow); hp0, nk0 = jaw_split(sil0, nrow)
HEAD = dict(e=e0, a=a0, fig=f0, lab=l0, row=nrow, cx=(nl + nr) / 2, sil=sil0, head=hp0, neck=nk0, top=int(np.nonzero(f0.any(1))[0].min()))
BODY_H = GROUND - nrow                                                  # standing neck → sole
HEADD = fi['headd'] * SC0                                               # the standing head's inscribed size (cell px)
print(gender, 'standing neck row', nrow, 'x', HEAD['cx'], 'width', nr - nl, 'neck→sole', BODY_H)
os.makedirs(OUT, exist_ok=True)
# hairstyles (tools/base/hair_extract.py): drawn on the standing head, in the standing GPT image's space → the idle cell
# The game draws them as layers on the frame's head (MapleStory): back hair behind the body, front hair over the head,
# then the sword arm again where it passes in front of the head (<anim>_o.png).
NSTY = 0
while os.path.exists(H + f'/hair/{gender}_{NSTY}_c0_front.png'): NSTY += 1
NCOL = 0
while os.path.exists(H + f'/hair/{gender}_0_c{NCOL}_front.png'): NCOL += 1
os.makedirs(OUT + 'hair', exist_ok=True)
def save_cell(L_, path_):                                      # a layer in the idle cell (straight alpha 0..1) → png
  Image.fromarray(np.dstack([L_[..., :3], L_[..., 3] * 255]).clip(0, 255).astype(np.uint8)).save(path_, optimize=True)
for old in [OUT + 'hair/' + f_ for f_ in os.listdir(OUT + 'hair')]: os.remove(old)
GAPS = []                                                      # hairstyles with forehead between the bangs (its own layer)
HAIRZONE = HEAD['head'].copy()                                 # where the head and any hairstyle's front are (idle cell): what
for k_ in range(NSTY):                                         #   the sword arm is drawn again over
  for c_ in range(NCOL):
    for n_ in ('front', 'back'):
      L_ = layer_to_cell(np.asarray(Image.open(H + f'/hair/{gender}_{k_}_c{c_}_{n_}.png').convert('RGBA')), IDLE_GEOM)
      save_cell(L_, OUT + f'hair/h{k_}c{c_}_{n_}.png')
      if c_ == 0 and n_ == 'front': HAIRZONE |= L_[..., 3] > 0.05
  gp_ = np.asarray(Image.open(H + f'/hair/{gender}_{k_}_gap.png').convert('RGBA'))
  GAPS.append(bool((gp_[..., 3] > 0).any()))
  if GAPS[-1]: save_cell(layer_to_cell(gp_, IDLE_GEOM), OUT + f'hair/h{k_}_gap.png')
# face styles (tools/base/face_extract.py): face 0 is the head's own; the others are layers over it, on the head
NFACE = 1
while os.path.exists(H + f'/face/{gender}_{NFACE}.png'): NFACE += 1
os.makedirs(OUT + 'face', exist_ok=True)
for old in [OUT + 'face/' + f_ for f_ in os.listdir(OUT + 'face')]: os.remove(old)
for k_ in range(1, NFACE):
  save_cell(layer_to_cell(np.asarray(Image.open(H + f'/face/{gender}_{k_}.png').convert('RGBA')), IDLE_GEOM), OUT + f'face/f{k_}.png')
ostrips = {}                                                   # per move: the sword arm where it is in front of the head
gcells = {}                                                    # per move, per piece: the worn gear on each frame (cell, straight RGBA)
GEARHAVE = {p_: [] for p_ in GEAR_PIECES + ('topo', 'sword')} # per piece: the moves it is drawn in (topo: the shirt again,
omasks = {}                                                    #   over the sword arm drawn over the hair; omasks: where that is)
os.makedirs(OUT + 'gear', exist_ok=True)
for old in [OUT + 'gear/' + f_ for f_ in os.listdir(OUT + 'gear')]: os.remove(old)
strips, masks, heads, refs, holds = {}, {}, {}, {}, {}         # heads: where the standing head sits per frame (cell px)
move_sc, move_hw, move_hd = {}, {}, {}                         # per move: its scale, its GPT head width / inscribed size
for anim, cells in spec['anims'].items():
  if isinstance(cells, dict): continue                         # derived moves (run) below
  n = len(cells); px = np.zeros((S, n * S, 4), np.uint8); mk = np.zeros((S, n * S, 4), np.uint8); heads[anim] = []
  ostrips[anim] = np.zeros((S, n * S, 4), np.uint8); omasks[anim] = np.zeros((S, n * S), np.float32)
  gcells[anim] = {p_: [None] * n for p_ in GEAR_PIECES + ('sword',)}
  order = list(range(n)); cl = [o for c_ in cells for o in c_[2:] if str(o).startswith('clean:')]; cell_sc = {}
  if cl: k0 = int(cl[0][6:]); order = [k0] + [k for k in order if k != k0]
  for c in order:
    cell = cells[c]
    path, idx = cell[0], cell[1]
    opts = cell[2:]
    sc = HEADW / figures(path)[idx]['headw']
    tall = [o for o in opts if str(o).startswith('tall')]
    if tall:                                                   # one scale for the move: its tallest frame = ratio x standing height
      hmax = max(figures(cc[0])[cc[1]]['box'][3] - figures(cc[0])[cc[1]]['box'][1] for cc in cells)
      sc = FIG_H * float(tall[0][4:]) / hmax
    body = [o for o in opts if str(o).startswith('body')]
    if body:                                                   # one scale for the move: its tallest neck→sole = ratio x standing
      sc = BODY_H * float(body[0][4:]) / max(figures(cc[0])[cc[1]]['nts'] for cc in cells)
    like = [o for o in opts if str(o).startswith('like')]
    if like:                                                   # same pose as cell N of this move: same height as it
      rp, ri = cells[int(like[0][4:])][:2]; rf = figures(rp)[ri]; tf = figures(path)[idx]
      sc = (HEADW / rf['headw']) * (rf['box'][3] - rf['box'][1]) / (tf['box'][3] - tf['box'][1])
    samed = [o for o in opts if str(o).startswith('asd:')]
    if samed:                                                  # the same size as that move by the heads' inscribed circles
      ref_ = samed[0][4:]; cl = [o for o in opts if str(o).startswith('clean:')]; only_ = None
      if '@' in ref_: ref_, only_ = ref_.split('@'); only_ = [int(v) for v in only_.split(',')]   # (the heads of these cells only)
      hd_ = figures(cells[int(cl[0][6:])][0])[cells[int(cl[0][6:])][1]]['headd'] if cl else np.mean([figures(cc[0])[cc[1]]['headd'] for k_, cc in enumerate(cells) if cc[0] == path and (only_ is None or k_ in only_)])
      sc = move_sc[ref_] * move_hd[ref_] / hd_
    same = [o for o in opts if str(o).startswith('as:')]
    if same:                                                   # drawn at the size of that move's GPT image: its scale
      ref = same[0][3:]
      sc = move_sc[ref] * move_hw[ref] / np.mean([figures(cc[0])[cc[1]]['headw'] for cc in cells])
    scn = [o for o in opts if str(o).startswith('sc:')]
    if scn:                                                    # the body drawn at that cell's / move's size (GPT's head may differ)
      sc = cell_sc[int(scn[0][3:])] if scn[0][3:].isdigit() else move_sc[scn[0][3:]]
    cell_sc[c] = sc
    e, a, fig, lab = frame(path, idx, sc, opts)
    geom = dict(LAST_GEOM); shift = [0, 0]                      # the GPT → cell placement, and the shifts after it
    air = [float(o[3:]) for o in opts if str(o).startswith('air')]
    if air:                                                    # off the ground as GPT drew it (same head height, feet up)
      hs = {k: figures(cc[0])[cc[1]]['box'][3] - figures(cc[0])[cc[1]]['box'][1] for k, cc in enumerate(cells) if cc[0] == path}
      up = int(round((max(hs.values()) - hs[c]) * sc * air[0])) + sum(int(o[4:]) for o in opts if str(o).startswith('lift'))
      if up: e, a, fig, lab = [np.roll(v, -up, 0) for v in (e, a, fig, lab)]; shift[0] -= up
    if 'feet' in opts:                                         # planted: the feet of the move's first frame done
      if c == order[0]: feet0 = feet_x(fig)
      else:
        k = int(round(feet0 - feet_x(fig))); e, a, fig, lab = [np.roll(v, k, 1) for v in (e, a, fig, lab)]; shift[1] += k
    if cl and c == order[0] and anim not in refs:              # the clean GPT head every frame of the move is compared to
      rr = sc * figures(path)[idx]['headd'] / HEADD
      rax, ray, rgm, _ = find_head(fig, HEAD, rr, True)
      refs[anim] = dict(e=e.copy(), fig=fig.copy(), ax=rax, ay=ray, gm=rgm)
    hxy = [0, 0]; hfront = None; headm = HEAD['head'] if anim == 'idle' else np.zeros((S, S), bool)
    if anim != 'idle' and 'ownhead' not in opts:
      if samed: r = sc * figures(path)[idx]['headd'] / HEADD       # GPT's head size / the standing head's
      else: r = sc * figures(path)[idx]['headw'] / HEADW
      sway = [float(o[4:]) for o in opts if str(o).startswith('sway')]; bob = [int(o[3:]) for o in opts if str(o).startswith('bob')]
      hold = [float(o[4:]) for o in opts if str(o).startswith('hold')]
      if hold and anim not in holds:                           # the move's heads: where GPT drew them (mean x)
        xs_ = []
        for cc in cells:
          e_, a_, f_, l_ = frame(cc[0], cc[1], sc, cc[2:])
          xs_.append(find_head(f_, HEAD, sc * figures(cc[0])[cc[1]]['headd'] / HEADD if samed else sc * figures(cc[0])[cc[1]]['headw'] / HEADW, bool(samed))[0])
        holds[anim] = float(np.mean(xs_))
      e, a, fig, lab, info = put_head(e, a, fig, lab, HEAD, r, follow='feet' in opts or 'follow' in opts,
                                      ref=refs.get(anim), search=bool(samed), sway=sway[0] if sway else 0.0, bob=bob[0] if bob else 0,
                                      hold=(holds[anim], hold[0]) if hold else None, track='track' in opts and c != order[0])
      hfront = info.pop('front'); headm = info.pop('head'); shift[1] += info['dx']
      print(' ', anim, c, 'scale', round(sc, 4), 'head', info, 'sword arm over hair', int(hfront.sum())); hxy = [int(info['hx']), int(info['dy'])]
    heads[anim].append((c, hxy))
    # the sword is worn gear: off the bare frame (where it crossed the body, the body around it fills in), its own layer
    sw = fig & (lab == 255)
    if sw.any():
      mx_, mn_ = e.max(-1), e.min(-1); sat_ = (mx_ - mn_) / np.maximum(mx_, 1)   # guard / pommel bits beside the hand: grey steel
      sw = sw | (nd.binary_dilation(sw, iterations=6) & fig & (lab == 60) & (sat_ < 0.28) & (mx_ < 215) & ~((e[..., 0] - e[..., 2]) > 30))
      gold_ = (e[..., 2] < 0.4 * e[..., 0]) & (sat_ > 0.55) & (e[..., 0] > 110)   # a brass guard / pommel beside the hand
      sw = sw | (nd.binary_dilation(sw, iterations=8) & fig & gold_)
      rest = fig & ~sw; Lr, nr = nd.label(rest)                # the blade's own outline bits left in the air (small, thin): the sword's too
      if nr > 1:
        szr = nd.sum(rest, Lr, range(1, nr + 1)); dt_ = nd.distance_transform_edt(rest)
        sw = sw | np.isin(Lr, [i + 1 for i in range(nr) if szr[i] < 0.03 * szr.max() and dt_[Lr == i + 1].max() <= 2.5])
      grip = swing_grip(sw, fig, lab, e)[:2] + (REACH,); sw0_ = sw.copy()   # where GPT's sword is: our sword goes there
      front_ = nd.binary_dilation(sw, iterations=3)             #   (always its own size), in front only where GPT's was
      body = fig & ~sw; inner = nd.binary_fill_holes(body) & sw
      _, (iy_, ix_) = nd.distance_transform_edt(~body, return_indices=True)
      e = np.where(inner[..., None], e[iy_, ix_], e); a = np.where(inner, 1.0, np.where(sw, 0, a))
      lab = np.where(inner, 60, np.where(sw, 0, lab)); fig = body | inner
      if hfront is not None: hfront = hfront & ~sw
    else:                                                      # the other moves: the sword in the near fist, at the move's angle,
      at_ = SWORD.fist_at(fig, lab, e, spec['hands'][anim][c]); grip = (at_, spec['sword_angle'][anim], REACH); front_ = None   # in front
    beh_ = None if front_ is None else (fig & ~front_).astype(np.float32)   # behind the head / an arm, as GPT drew it
    padx = lambda m_: np.pad(m_, ((0, 0), (SW_PAD, SW_PAD)))     # the sword's cells are wider (a blade thrust far forward)
    L_ = SWORD.place(PIC, (grip[0][0] + SW_PAD, grip[0][1]), grip[1], grip[2], (S, SWORD_W), hide=padx(SWORD.fist_mask(fig, grip[0])),
                     behind=None if beh_ is None else padx(beh_))
    if front_ is not None:                                     # GPT's sword planted in the ground (its point at the feet):
      body_ = fig & ~sw0_                                      #   ours ends where GPT's went into the ground
      swb_, bb_ = np.nonzero(sw0_.any(1))[0].max(), np.nonzero(body_.any(1))[0].max()
      if swb_ >= bb_ - 8: L_[swb_ + 1:, :, 3] = 0
    gcells[anim]['sword'][c] = L_
    if anim == 'idle': IDLE_GRIP = grip
    D = dressed(path, idx)
    if D and front_ is not None:                               # GPT's sword's last bits by the fist (a pommel, a guard tip):
      dl_ = np.roll(np.roll(layer_to_cell(D['all'], geom), shift[0], 0), shift[1], 1); da_ = dl_[..., 3]   # gone where GPT's
      zone_ = nd.binary_dilation(sw0_, iterations=5) & fig      #   figure without a sword has nothing; where it has its
      gone_ = zone_ & ~nd.binary_dilation(da_ > 0.5, iterations=1)   #   hand (light skin) and ours is dark (a grip end),
      dR_, dG_, dB_ = dl_[..., 0], dl_[..., 1], dl_[..., 2]     #   its hand there
      dskin_ = (da_ > 0.5) & (dR_ > 150) & (dG_ > 95) & (dB_ > 60) & (dR_ > dG_ + 10) & (dG_ > dB_ + 8)
      hand_ = zone_ & ~gone_ & dskin_ & ~SWORD.skin_of(fig, lab, e) & ~headm
      e = np.where(hand_[..., None], dl_[..., :3], e); lab = np.where(hand_, 60, lab)
      a = np.where(gone_, 0, a); fig = fig & ~gone_; lab = np.where(gone_, 0, lab)
      if hfront is not None: hfront = hfront & ~gone_
    if front_ is not None:                                     # GPT's pommel / grip end behind our fist (grey steel on the
      ax_ = np.radians(grip[1]); yy_, xx_ = np.mgrid[0:S, 0:S]  #   blade's line, past the fist): our body's colour there (inside
      al_ = (xx_ - grip[0][0]) * np.cos(ax_) + (yy_ - grip[0][1]) * np.sin(ax_)   #   our silhouette), gone where it sticks out
      pp_ = np.abs(-(xx_ - grip[0][0]) * np.sin(ax_) + (yy_ - grip[0][1]) * np.cos(ax_))
      mx_, mn_ = e.max(-1), e.min(-1); sat_ = (mx_ - mn_) / np.maximum(mx_, 1)
      cand_ = fig & (al_ < -3) & (al_ > -24) & (pp_ < 8) & ~SWORD.skin_of(fig, lab, e) & (lab != 80) & (lab != 200)
      pom_ = nd.binary_dilation(nd.binary_opening(cand_, iterations=1), iterations=1) & cand_   # a blob (grey pommel, brown grip end), not a thin outline
      if pom_.any():
        keep_ = fig & ~pom_; inside_ = pom_ & nd.binary_closing(keep_, iterations=3)
        _, (iy_, ix_) = nd.distance_transform_edt(~keep_, return_indices=True)
        e = np.where(inside_[..., None], e[iy_, ix_], e); lab = np.where(inside_, lab[iy_, ix_], lab)
        out_ = pom_ & ~inside_; a = np.where(out_, 0, a); fig = fig & ~out_; lab = np.where(out_, 0, lab)
        if hfront is not None: hfront = hfront & ~out_
    if front_ is not None:                                     # specks left in the air (bits of GPT's hilt): only the body stays
      Lf_, nf_ = nd.label(fig)
      if nf_ > 1:
        szf_ = nd.sum(fig, Lf_, range(1, nf_ + 1)); speck_ = fig & np.isin(Lf_, [i + 1 for i in range(nf_) if szf_[i] < 0.02 * szf_.max()])
        a = np.where(speck_, 0, a); fig = fig & ~speck_; lab = np.where(speck_, 0, lab)
        if hfront is not None: hfront = hfront & ~speck_
    for piece in GEAR_PIECES if D else ():
      if piece not in D: continue
      L_ = layer_to_cell(D[piece], geom); L_ = np.roll(np.roll(L_, shift[0], 0), shift[1], 1)
      L_[..., 3] *= ~headm                                     # our head in front of the collar
      gcells[anim][piece][c] = L_
    px[:, c * S:(c + 1) * S, :3] = e.clip(0, 255).astype(np.uint8); px[:, c * S:(c + 1) * S, 3] = np.where(fig, (a * 255).clip(0, 255), 0).astype(np.uint8)
    if hfront is not None:                                     # only where it can be over the hair / face (the rest of the
      hfront = hfront & nd.binary_dilation(np.roll(np.roll(HAIRZONE, hxy[1], 0), hxy[0], 1), iterations=3)   # body is under
      for p_ in ('pants', 'shoes'):                            #   the clothes), never over the pants / boots
        if gcells[anim][p_][c] is not None: hfront = hfront & ~(gcells[anim][p_][c][..., 3] > 0.3)
    if hfront is not None and hfront.any():                     # the clothes) — the sword arm, drawn again over the hair / face
      ostrips[anim][:, c * S:(c + 1) * S, :3] = np.where(hfront[..., None], e, 0).clip(0, 255).astype(np.uint8)
      ostrips[anim][:, c * S:(c + 1) * S, 3] = np.where(hfront & fig, (a * 255).clip(0, 255), 0).astype(np.uint8)
      omasks[anim][:, c * S:(c + 1) * S] = nd.binary_dilation(hfront & fig, iterations=1)
    mk[:, c * S:(c + 1) * S, 0] = np.where(fig & (lab != 255), lab, 0); mk[:, c * S:(c + 1) * S, 1] = np.where(fig & (lab == 255), 255, 0)
    mk[:, c * S:(c + 1) * S, 3] = 255
  heads[anim] = [h for _, h in sorted(heads[anim], key=lambda t: t[0])]
  strips[anim] = px; masks[anim] = mk
  for piece, cl_ in gcells[anim].items():                      # the worn gear strips: the frames of the move side by side
    if any(L_ is None for L_ in cl_): continue                  # (every frame has it, or the move has none)
    cl_ = [L_.astype(np.float32) for L_ in cl_]
    W_ = SWORD_W if piece == 'sword' else S
    for ci, cols in enumerate([cl_] if piece == 'sword' else gear_colours(cl_, piece)):
      st_ = np.zeros((S, n * W_, 4), np.uint8)
      for c, L_ in enumerate(cols): st_[:, c * W_:(c + 1) * W_] = np.dstack([L_[..., :3], L_[..., 3] * 255]).clip(0, 255).astype(np.uint8)
      if st_[..., 3].any(): Image.fromarray(st_).save(OUT + f'gear/{anim}_{piece}' + ('' if piece == 'sword' else f'_c{ci}') + '.png', optimize=True)
      if piece == 'top':                                       # the sleeve on the arm drawn over the hair: the shirt there again
        so_ = st_.copy(); so_[..., 3] = (st_[..., 3] * omasks[anim]).round().astype(np.uint8)
        if (so_[..., 3] > 8).sum() > 20:
          Image.fromarray(so_).save(OUT + f'gear/{anim}_topo_c{ci}.png', optimize=True)
          if anim not in GEARHAVE['topo']: GEARHAVE['topo'].append(anim)
    if anim not in GEARHAVE[piece]: GEARHAVE[piece].append(anim)
  move_sc[anim] = sc; move_hw[anim] = float(np.mean([figures(cc[0])[cc[1]]['headw'] for cc in cells]))
  move_hd[anim] = float(np.mean([figures(cc[0])[cc[1]]['headd'] for cc in cells]))
for anim, d in spec['anims'].items():                          # derived: the run = the walk leaning forward
  if not isinstance(d, dict): continue
  base, bmk = strips[d['from']], masks[d['from']]; n = base.shape[1] // S
  px = np.zeros_like(base); mk = np.zeros_like(bmk)
  lifts = d.get('lift', [0] * n); heads[anim] = []
  for c in range(n):
    lf = lifts[c % len(lifts)]
    p, m, dh = lean(base[:, c * S:(c + 1) * S], bmk[:, c * S:(c + 1) * S], d['lean'][0], d['lean'][1], lf)
    px[:, c * S:(c + 1) * S] = p; mk[:, c * S:(c + 1) * S] = m
    heads[anim].append([round(float(dh) + heads[d['from']][c][0], 1), heads[d['from']][c][1] - lf])
  strips[anim] = px; masks[anim] = mk
for anim in strips:
  Image.fromarray(strips[anim]).save(OUT + anim + '.png', optimize=True); Image.fromarray(masks[anim]).save(OUT + anim + '_m.png', optimize=True)
  print(gender, anim, strips[anim].shape[1] // S, 'frames')
OVER = [a_ for a_, v in ostrips.items() if v[..., 3].any()]
for a_ in OVER: Image.fromarray(ostrips[a_]).save(OUT + a_ + '_o.png', optimize=True)
print(gender, NSTY, 'hairstyles x', NCOL, 'colours,', NFACE, 'faces; sword arm over the head in', OVER)
np_ = G + 'src/data/naked-look.json'                            # per gender: hairstyles (with a forehead layer?), hair colours, faces,
nh = json.load(open(np_)) if os.path.exists(np_) else {}        #   moves with a sword-arm strip
nh[gender] = dict(styles=NSTY, colors=NCOL, gaps=GAPS, faces=NFACE, over=OVER, gear={k: v for k, v in GEARHAVE.items() if v}, swordCell=SWORD_W); json.dump(nh, open(np_, 'w'), indent=1)
# what each gender has (the game draws standing for the rest)
lp = G + 'src/data/naked-anims.json'
have = json.load(open(lp)) if os.path.exists(lp) else {}
have[gender] = {a: strips[a].shape[1] // S for a in spec['anims']}
json.dump(have, open(lp, 'w'), indent=1)
hp = G + 'src/data/naked-heads.json'                           # per frame: the head's offset from the standing head
hh = json.load(open(hp)) if os.path.exists(hp) else {}
hh[gender] = heads
open(hp, 'w').write(json.dumps(hh, separators=(',', ':')) + '\n')
# menu image (full size standing figure) for character select / create / portraits
pp, pi = spec.get('preview', spec['anims']['idle'][0][:2])
f = figures(pp)[pi]; x0, y0, x1, y1 = f['box']
gh, gw = f['gi'].shape[:2]
e, a = keyed(f['gi'][max(0, y0 - 30):min(gh, y1 + 13), max(0, x0 - 40):min(gw, x1 + 41)])
fig = a > 0.5; L, n = nd.label(fig); sz = nd.sum(fig, L, range(1, n + 1)); fig = L == 1 + int(np.argmax(sz))
Image.fromarray(np.dstack([e, np.where(fig, a * 255, 0)]).clip(0, 255).astype(np.uint8)).save(G + f'public/assets/characters/base/Base_{gender.capitalize()}.png', optimize=True)
assert (pp, pi) == (idle_path, idle_idx)                        # the hair layers are drawn in this image's space
os.makedirs(G + 'public/assets/characters/base/hair', exist_ok=True)
X0, Y0, X1, Y1 = max(0, x0 - 40), max(0, y0 - 30), min(gw, x1 + 41), min(gh, y1 + 13)   # the menu figure's window
hb_ = [np.nonzero(np.asarray(Image.open(H + f'/hair/{gender}_{k}_c0_{n_}.png'))[..., 3] > 8) for k in range(NSTY) for n_ in ('front', 'backm')]
hx0_ = min(v[1].min() for v in hb_); hx1_ = max(v[1].max() for v in hb_); hy0_ = min(v[0].min() for v in hb_)
EX = max(0, X0 - hx0_, hx1_ - X1) + 10; EY = max(0, Y0 - hy0_) + 10   # both sides alike: the figure stays centred
WX0, WY0, WX1, WY1 = X0 - EX, Y0 - EY, X1 + EX, Y1
def menu_win(L_):                                               # standing-image layer → the wide menu canvas (padded)
  cv = np.zeros((WY1 - WY0, WX1 - WX0, 4), np.uint8)
  sy0, sx0 = max(0, WY0), max(0, WX0); sy1, sx1 = min(L_.shape[0], WY1), min(L_.shape[1], WX1)
  cv[sy0 - WY0:sy1 - WY0, sx0 - WX0:sx1 - WX0] = L_[sy0:sy1, sx0:sx1]
  return Image.fromarray(cv)
json.dump(dict(win=[int(WX0), int(WY0), int(WX1), int(WY1)], ox=int(EX), oy=int(EY), fit=int(Y1 - Y0)), open(H + f'/hair/{gender}_menu.json', 'w'))
bare = menu_win(np.pad(np.asarray(Image.open(G + f'public/assets/characters/base/Base_{gender.capitalize()}.png').convert('RGBA')), ((Y0, 0), (X0, 0), (0, 0))))   # the bare figure, in the wide canvas
bare.save(G + f'public/assets/characters/base/Base_{gender.capitalize()}_wide.png', optimize=True)   # the menus' body: every look layer shares this canvas
ba_ = np.asarray(bare)[..., 3]; mh = np.nonzero(ba_ > 128); mtop = mh[0].min()
hrow = mtop + int(0.36 * (mh[0].max() - mtop)); hx_ = np.nonzero(ba_[mtop:hrow].max(0) > 128)[0]
hcx, hcy, side = (hx_.min() + hx_.max()) / 2, mtop + 0.42 * (hrow - mtop), 1.55 * (hx_.max() - hx_.min())
GB = G + 'public/assets/characters/base/'; G2 = gender.capitalize()
os.makedirs(GB + 'face', exist_ok=True)
for old in [GB + d_ + f_ for d_ in ('hair/', 'face/') for f_ in os.listdir(GB + d_) if f_.startswith(G2 + '_')]: os.remove(old)
for k in range(NSTY):
  for c_ in range(NCOL):
    for n_ in ('front', 'back'):                               # menu: the back hair without the filled band
      menu_win(np.asarray(Image.open(H + f'/hair/{gender}_{k}_c{c_}_{"backm" if n_ == "back" else n_}.png').convert('RGBA'))).save(GB + f'hair/{G2}_{k}_c{c_}_{n_}.png', optimize=True)
  if GAPS[k]: menu_win(np.asarray(Image.open(H + f'/hair/{gender}_{k}_gap.png').convert('RGBA'))).save(GB + f'hair/{G2}_{k}_gap.png', optimize=True)
hu_ = np.zeros(np.asarray(bare).shape[:2], bool)               # the hairstyle buttons: the head and every hairstyle's width
for k in range(NSTY):
  for n_ in ('front', 'back'): hu_ |= np.asarray(Image.open(GB + f'hair/{G2}_{k}_c0_{n_}.png'))[..., 3] > 40
for _ in range(3):
  r0_, r1_ = int(max(0, hcy - side / 2)), int(min(hu_.shape[0], hcy + side / 2)); xs_ = np.nonzero(hu_[r0_:r1_].any(0))[0]
  if not len(xs_): break
  sx0_, sx1_ = min(xs_.min() - 12, hcx - side / 2), max(xs_.max() + 12, hcx + side / 2)
  hcx, side = (sx0_ + sx1_) / 2, sx1_ - sx0_
if hu_.any(): hcy = min(hcy, np.nonzero(hu_.any(1))[0].min() + 0.38 * side)   # the hair's top well inside the round button
# the worn gear on the menu figure: the dressed standing figure's pieces, in each colour, on the wide canvas
os.makedirs(GB + 'gear', exist_ok=True)
for old in [GB + 'gear/' + f_ for f_ in os.listdir(GB + 'gear') if f_.startswith(G2 + '_')]: os.remove(old)
MENU_GEAR = []
D_ = dressed(idle_path, idle_idx)
if D_:
  for piece in GEAR_PIECES:
    L_ = D_[piece].astype(np.float32); L_[..., 3] /= 255
    for ci, (Lc,) in enumerate(gear_colours([L_], piece)):
      menu_win(np.dstack([Lc[..., :3], Lc[..., 3] * 255]).clip(0, 255).astype(np.uint8)).save(GB + f'gear/{G2}_{piece}_c{ci}.png', optimize=True)
    MENU_GEAR.append(piece)
# the sword in the menu figure's hand: the standing frame's grip, back in the standing GPT image's space (its own size there)
g_ = IDLE_GEOM; kx_ = g_['size'][0] / (g_['x1'] + g_['pad'] - g_['X0']); ky_ = g_['size'][1] / (g_['y1'] + g_['pad'] - g_['Y0'])
(cx_, cy_), ang_, rch_ = IDLE_GRIP
mat_ = ((cx_ - g_['dx'] - g_['at'][0]) / kx_ + g_['X0'] - WX0, (cy_ - g_['dy'] - g_['at'][1]) / ky_ + g_['Y0'] - WY0)
mfig_ = np.asarray(bare)[..., 3] > 128
L_ = SWORD.place(PIC, mat_, ang_, rch_ / kx_, mfig_.shape, hide=SWORD.fist_mask(mfig_, mat_, 7.5 / kx_))
Image.fromarray(np.dstack([L_[..., :3], L_[..., 3] * 255]).clip(0, 255).astype(np.uint8)).save(GB + f'gear/{G2}_sword.png', optimize=True)
MENU_GEAR.append('sword')
fb_ = []                                                       # where the faces are (the face buttons show that part)
for k in range(1, NFACE):
  L_ = menu_win(np.asarray(Image.open(H + f'/face/{gender}_{k}.png').convert('RGBA'))); L_.save(GB + f'face/{G2}_{k}.png', optimize=True)
  fb_.append(np.nonzero(np.asarray(L_)[..., 3] > 128))
ml = G + 'src/data/menu-look.json'                              # the game: canvas size, where the bare figure sits in it, its height,
mlj = json.load(open(ml)) if os.path.exists(ml) else {}        #   the head (hairstyle buttons) and the face (face buttons): [cx, cy, side]
mlj[gender] = dict(w=int(WX1 - WX0), h=int(WY1 - WY0), ox=int(EX), oy=int(EY), fit=int(Y1 - Y0), head=[round(float(hcx), 1), round(float(hcy), 1), round(float(side), 1)], gear=MENU_GEAR)
if fb_:
  fy0_, fy1_ = min(v[0].min() for v in fb_), max(v[0].max() for v in fb_); fx0_, fx1_ = min(v[1].min() for v in fb_), max(v[1].max() for v in fb_)
  mlj[gender]['face'] = [round((fx0_ + fx1_) / 2, 1), round((fy0_ + fy1_) / 2, 1), round(1.5 * max(fx1_ - fx0_, fy1_ - fy0_), 1)]   # the whole face inside the round button
json.dump(mlj, open(ml, 'w'), indent=1)
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
