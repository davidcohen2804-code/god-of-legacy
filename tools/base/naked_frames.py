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
#   "asd:<move>"  the same size as that move, measured by the heads' inscribed circles (works with swords / raised arms)
#   "clean:N"  cell N of the move has GPT's head clear: what other frames draw over their head (arm, sword) stays in front
#   "sword"  the sword is found (blade + hilt) and goes to the mask's G channel (not the body labels)
#   "swapg"  the two legs' tones exchanged (found at GPT's size): GPT drew the same leg forward again
#   "airK"   the move's frames keep K of GPT's height off the ground (heads level as drawn, the lowest feet grounded;
#            per GPT image); "liftN": that frame N px higher still (the top of the stride)
#   "sc:N"   the scale of cell N of the move (another GPT image of the move, its body drawn at that size)
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
    if ev[1] < 8 * max(ev[0], 1e-3) or np.sqrt(ev[1]) < 25: continue
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
  return r(e), r(a), r(fig), r(lab)


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
  if not sword.any(): return np.zeros((S, S), bool)
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
  return occ | (nd.binary_dilation(skin, iterations=1) & fig & dark & zone & ~nd.binary_dilation(gm, iterations=2))


def put_head(e, a, fig, lab, hd, r, follow=False, ref=None, search=False, sway=0.0, bob=0, hold=None):
  """GPT's head off, the standing head on (the same drawing), on GPT's neck point; its neck goes behind the body (the
  frame keeps its own neck). follow=False: the head stays near the standing x and the frame moves under it (walk):
  sway = how much of GPT's own head shift is kept (MapleStory: the same head, a little forward / back each step);
  bob = the head sits this much lower on the neck (the step's low point). follow=True: the frame stays (planted feet),
  the head goes with it."""
  ax, ay, gm, _ = find_head(fig, hd, r, search)
  dy = int(round(ay - hd['row'])) + bob; hx = int(round(ax - hd['cx']))
  dx = 0
  if not follow: keep_ = int(round(sway * hx)); dx, hx = keep_ - hx, keep_
  elif hold is not None:                                         # near the move's mean x, keeping a part of GPT's own shift
    tgt = hold[0] + hold[1] * (ax - hold[0]); dx = int(round(tgt - ax)); hx = int(round(ax + dx - hd['cx']))
  e, a, fig, lab, gm = [np.roll(v, dx, 1) for v in (e, a, fig, lab, gm)]
  ax += dx
  sh = lambda v: np.roll(np.roll(v, dy, 0), hx, 1)
  cut = nd.binary_dilation(gm, iterations=2)                                       # GPT's head
  occ = occluders(e, fig, lab, gm, cut | sh(hd['head']), ay, ref, ax, int(hd['row'] - hd['top'])) if ref else np.zeros((S, S), bool)
  keep = [v.copy() for v in (e, a, lab)]
  e[cut] = 0; a[cut] = 0; fig[cut] = False; lab[cut] = 0
  he, ha, hl = sh(hd['e']), sh(hd['a']), sh(hd['lab'])
  for m in (sh(hd['neck']) & ~fig, sh(hd['head'])):                               # neck behind, head over
    e[m] = he[m]; a[m] = ha[m]; fig[m] = True; lab[m] = hl[m]
  e[occ], a[occ], lab[occ] = keep[0][occ], keep[1][occ], keep[2][occ]; fig[occ] = True   # arm / sword in front of it
  return e, a, fig, lab, dict(dx=dx, hx=hx, dy=dy, occ=int(occ.sum()))


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


idle_path, idle_idx = spec['anims']['idle'][0][:2]
fi = figures(idle_path)[idle_idx]
SC0 = FIG_H / (fi['box'][3] - fi['box'][1]); HEADW = fi['headw'] * SC0; SHORTSW = fi['shortsw'] * SC0     # the standing frame sets the size
# the standing head (and neck) every other frame wears
e0, a0, f0, l0 = frame(idle_path, idle_idx, SC0)
nrow, nl, nr = neck_of(f0)
sil0 = f0 & (np.arange(S)[:, None] <= nrow); hp0, nk0 = jaw_split(sil0, nrow)
HEAD = dict(e=e0, a=a0, fig=f0, lab=l0, row=nrow, cx=(nl + nr) / 2, sil=sil0, head=hp0, neck=nk0, top=int(np.nonzero(f0.any(1))[0].min()))
BODY_H = GROUND - nrow                                                  # standing neck → sole
HEADD = fi['headd'] * SC0                                               # the standing head's inscribed size (cell px)
print(gender, 'standing neck row', nrow, 'x', HEAD['cx'], 'width', nr - nl, 'neck→sole', BODY_H)
os.makedirs(OUT, exist_ok=True)
strips, masks, heads, refs, holds = {}, {}, {}, {}, {}         # heads: where the standing head sits per frame (cell px)
move_sc, move_hw, move_hd = {}, {}, {}                         # per move: its scale, its GPT head width / inscribed size
for anim, cells in spec['anims'].items():
  if isinstance(cells, dict): continue                         # derived moves (run) below
  n = len(cells); px = np.zeros((S, n * S, 4), np.uint8); mk = np.zeros((S, n * S, 4), np.uint8); heads[anim] = []
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
      ref_ = samed[0][4:]; cl = [o for o in opts if str(o).startswith('clean:')]
      hd_ = figures(cells[int(cl[0][6:])][0])[cells[int(cl[0][6:])][1]]['headd'] if cl else np.mean([figures(cc[0])[cc[1]]['headd'] for cc in cells if cc[0] == path])
      sc = move_sc[ref_] * move_hd[ref_] / hd_
    same = [o for o in opts if str(o).startswith('as:')]
    if same:                                                   # drawn at the size of that move's GPT image: its scale
      ref = same[0][3:]
      sc = move_sc[ref] * move_hw[ref] / np.mean([figures(cc[0])[cc[1]]['headw'] for cc in cells])
    scn = [o for o in opts if str(o).startswith('sc:')]
    if scn: sc = cell_sc[int(scn[0][3:])]                      # another GPT image, the body drawn at that cell's size
    cell_sc[c] = sc
    e, a, fig, lab = frame(path, idx, sc, opts)
    air = [float(o[3:]) for o in opts if str(o).startswith('air')]
    if air:                                                    # off the ground as GPT drew it (same head height, feet up)
      hs = {k: figures(cc[0])[cc[1]]['box'][3] - figures(cc[0])[cc[1]]['box'][1] for k, cc in enumerate(cells) if cc[0] == path}
      up = int(round((max(hs.values()) - hs[c]) * sc * air[0])) + sum(int(o[4:]) for o in opts if str(o).startswith('lift'))
      if up: e, a, fig, lab = [np.roll(v, -up, 0) for v in (e, a, fig, lab)]
    if 'feet' in opts:                                         # planted: the feet of the move's first frame done
      if c == order[0]: feet0 = feet_x(fig)
      else:
        k = int(round(feet0 - feet_x(fig))); e, a, fig, lab = [np.roll(v, k, 1) for v in (e, a, fig, lab)]
    if cl and c == order[0] and anim not in refs:              # the clean GPT head every frame of the move is compared to
      rr = sc * figures(path)[idx]['headd'] / HEADD
      rax, ray, _, _ = find_head(fig, HEAD, rr, True)
      refs[anim] = dict(e=e.copy(), fig=fig.copy(), ax=rax, ay=ray)
    hxy = [0, 0]
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
                                      hold=(holds[anim], hold[0]) if hold else None)
      print(' ', anim, c, 'scale', round(sc, 4), 'head', info); hxy = [int(info['hx']), int(info['dy'])]
    heads[anim].append((c, hxy))
    px[:, c * S:(c + 1) * S, :3] = e.clip(0, 255).astype(np.uint8); px[:, c * S:(c + 1) * S, 3] = np.where(fig, (a * 255).clip(0, 255), 0).astype(np.uint8)
    mk[:, c * S:(c + 1) * S, 0] = np.where(fig & (lab != 255), lab, 0); mk[:, c * S:(c + 1) * S, 1] = np.where(fig & (lab == 255), 255, 0)
    mk[:, c * S:(c + 1) * S, 3] = 255
  heads[anim] = [h for _, h in sorted(heads[anim], key=lambda t: t[0])]
  strips[anim] = px; masks[anim] = mk
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
