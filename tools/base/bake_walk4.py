# bake_walk4.py <walk_image> [--run <run_image>] [--swap3] : the beginner's WALK and RUN from GPT images of 4 key poses
# (2x2 cells: 1 contact (near leg forward) | 2 passing (near leg under the body, far leg swinging)
#             3 contact (far leg forward)  | 4 passing (far leg under the body, near leg swinging)).
# WALK = the 4 frames of <walk_image>. RUN = the same 4 poses (the game plays them faster): the frames of <run_image>
# (the walk image re-drawn with the sword held back) or, without it, the walk frames themselves.
# Like bake_cycle.py: each frame's hips (shorts) on one fixed x, the lowest foot on the ground line; labels hair /
# skin / shirt / shorts / shoes / sword (the whole sword: blade, guard, grip, pommel). --swap3: cell 3 came back with
# the legs of cell 1 (near leg in front again) — swap its near / far leg shading so the legs alternate.
# Writes base walk / run strips (.png, _m.png, _weapon.png; 4 columns each) and QC tools/base/qc/walk4.png.
import json, sys, os, math, numpy as np
from PIL import Image
from scipy import ndimage as nd
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
G = os.path.dirname(os.path.abspath(__file__)) + '/../../'; S = 352; GROUND = 310
BASE = G + 'public/assets/final/body/warrior/base/'
src = open(os.path.join(os.path.dirname(os.path.abspath(__file__)), 'bake_pose.py')).read()
exec(src[src.index('def keyed('):src.index('frames = []')])   # keyed(), labels() of the pose baker
from relabel import relabel_frame

FIG_H = 193          # head-to-sole height of the beginner figure in a 352 cell (idle / walk frames)
HIPX = 161.0         # shorts centre x of every walk / run frame

args = [a for a in sys.argv[1:] if not a.startswith('--')]
walk_img = args[0]; run_img = sys.argv[sys.argv.index('--run') + 1] if '--run' in sys.argv else None


def bake_cells(path, sc=None):
  """GPT image (2x2 cells) → 4 keyed, scaled 352 frames + labels; one scale for the 4 frames (or the given one)."""
  gi = np.array(Image.open(path).convert('RGB')); C = gi.shape[1] // 2
  cells = []
  for k in range(4):
    cy, cx = (k // 2) * C, (k % 2) * C
    sub = gi[cy:cy + C, cx:cx + C]
    e0, a0 = keyed(sub.astype(np.float32)); fig0 = a0 > 0.5
    lb, n = nd.label(fig0); sz = nd.sum(fig0, lb, range(1, n + 1)); fig0 = lb == 1 + int(np.argmax(sz))
    ys, xs = np.nonzero(fig0)
    cells.append((sub, ys.min(), ys.max(), xs.min(), xs.max()))
  if sc is None: sc = FIG_H / np.median([c[2] - c[1] for c in cells])
  out = []
  for sub, y0, y1, x0, x1 in cells:
    w = int(round(C * sc))
    im = Image.fromarray(sub).resize((w, w), Image.LANCZOS)
    canvas = Image.new('RGB', (S, S), (255, 0, 255))
    canvas.paste(im, (int(round(S / 2 - (x0 + x1) / 2 * sc)), int(round(GROUND - y1 * sc))))
    e, a = keyed(np.array(canvas).astype(np.float32))
    fig, lab, sword = labels(e, a)
    out.append(dict(e=e, a=a, fig=fig, lab=lab, sword=sword))
  return out, sc


frames, SC = bake_cells(walk_img)
runs = bake_cells(run_img, SC)[0] if run_img else None


def legs_of(f):
  """Skin / shoe pixels below the shorts, split into the back leg (left) and the front leg (right)."""
  lab, fig = f['lab'], f['fig']
  sh = np.nonzero(lab == 200); bottom = int(np.percentile(sh[0], 97)); hx = sh[1].mean()
  yy, xx = np.mgrid[0:S, 0:S]
  leg = fig & np.isin(lab, [60, 160]) & (yy > bottom - 6)
  # per row: pixels left / right of the gap between the two legs (or of the hip centre where they touch)
  back = np.zeros_like(leg); front = np.zeros_like(leg)
  for y in np.nonzero(leg.any(1))[0]:
    xs = np.nonzero(leg[y])[0]
    runs = np.split(xs, np.nonzero(np.diff(xs) > 1)[0] + 1)
    if len(runs) >= 2:
      cut = (runs[0][-1] + runs[-1][0]) / 2 if len(runs) == 2 else xs.mean()
    else:
      cut = hx
    back[y, xs[xs < cut]] = True; front[y, xs[xs >= cut]] = True
  return back, front


def swap_legs(f):
  e, lab = f['e'], f['lab']
  back, front = legs_of(f)
  bottom = int(np.percentile(np.nonzero(lab == 200)[0], 97))
  wy = np.clip((np.arange(S) - (bottom - 10)) / 12.0, 0, 1)[:, None, None]
  for part in (60, 160):
    b = back & (lab == part); fr = front & (lab == part)
    if b.sum() < 20 or fr.sum() < 20: continue
    deep = np.arange(S)[:, None] > bottom + 4                       # gains measured below the hem
    mb, mf = e[b & deep].mean(0), e[fr & deep].mean(0)
    gb = 1 + (mf / mb - 1) * wy; gf = 1 + (mb / mf - 1) * wy
    e[:] = np.where(b[..., None], np.clip(e * gb, 0, 255), np.where(fr[..., None], np.clip(e * gf, 0, 255), e))

if '--swap3' in sys.argv:
  # cell 3: near (lighter) leg was drawn in front again — give the back leg the near leg's tones and the front leg the
  # far one's (faded in under the shorts' hem, so no seam)
  for f in [frames[2]] + ([runs[2]] if runs else []):
    swap_legs(f)


def axis(sw):
  L, n = nd.label(nd.binary_dilation(sw, iterations=2)); sz = nd.sum(sw, L, range(1, n + 1))
  main = (L == 1 + int(np.argmax(sz))) & sw
  sy, sx = np.nonzero(main); P = np.vstack([sx, sy]).astype(float); mu = P.mean(1)
  _, ev = np.linalg.eigh(np.cov(P - mu[:, None])); d = ev[:, 1]
  if d[0] < 0: d = -d                                            # hilt -> tip, pointing right (forward)
  return main, mu, d


def gold_of(e):
  R, Gc, B = e[..., 0], e[..., 1], e[..., 2]
  mx = np.maximum(np.maximum(R, Gc), B); mn = np.minimum(np.minimum(R, Gc), B); sat = (mx - mn) / np.maximum(mx, 1)
  return (R > 110) & (Gc > 0.42 * R) & (Gc < 0.9 * R) & (B < 0.6 * R) & (sat > 0.3)


def clean_sword(f):
  """The sword mask = the whole sword: the blade's pieces along its line, the guard (gold touching the blade), the
  pommel (gold on the line past the fist) and the dark grip on the line; stray 'sword' specks elsewhere get their
  region back (else a sword skin would cut holes in the legs)."""
  e, fig, lab, sw = f['e'], f['fig'], f['lab'], f['sword']
  if sw.sum() < 40: return
  blade, mu, d = axis(sw)
  yy, xx = np.mgrid[0:S, 0:S].astype(float)
  T = (xx - mu[0]) * d[0] + (yy - mu[1]) * d[1]; Q = np.abs((xx - mu[0]) * -d[1] + (yy - mu[1]) * d[0])
  tb0, t1 = T[blade].min(), T[blade].max()
  # the blade: its own band around the line (a boot or leg touching the blade is not blade)
  tb = np.arange(int(tb0) + 8, int(t1) - 8)
  W = np.median([np.percentile(Q[blade & (np.abs(T - t) <= 2.5)], 80) for t in tb if (blade & (np.abs(T - t) <= 2.5)).sum() > 3])
  keep = blade & ((T <= tb0 + 7) | (Q <= W + 2))                 # guard end: all of it; the rest: the blade's width
  L, n = nd.label(sw)
  for i in range(1, n + 1):
    cm = L == i
    if not (cm & blade).any() and Q[cm].mean() < 9 and tb0 - 45 < T[cm].mean() < tb0: keep |= cm     # pommel / grip bits
  skin = (lab == 60) & fig
  gold = gold_of(e) & fig & ~skin
  gL, gn = nd.label(gold); near_blade = nd.binary_dilation(blade, iterations=4)
  for i in range(1, gn + 1):
    cm = gL == i
    if ((cm & near_blade).any() and abs(T[cm].mean() - tb0) < 12) or (Q[cm].mean() <= 8 and tb0 - 50 < T[cm].mean() < tb0 - 4):
      keep |= cm                                                  # guard (at the blade's start) / pommel
  lum = 0.3 * e[..., 0] + 0.59 * e[..., 1] + 0.11 * e[..., 2]
  keep |= fig & ~skin & (lum < 110) & (Q <= 4.5) & (T >= tb0 - 40) & (T <= tb0 + 2)
  stray = sw & ~keep
  ok = fig & ~keep & (lab > 0)
  if stray.any():
    ii = nd.distance_transform_edt(~ok, return_distances=False, return_indices=True)
    lab[stray] = lab[ii[0], ii[1]][stray]
  lab[keep] = 0
  f['sword'] = keep & fig


def place(fs):
  """Hips on one x, the lowest foot on the ground."""
  for f in fs:
    clean_sword(f)
    sh = np.nonzero(f['lab'] == 200); fy = np.nonzero((f['lab'] == 160) & f['fig'])
    dx = int(round(HIPX - sh[1].mean())); dy = GROUND - int(fy[0].max())
    for key in ('e', 'a', 'fig', 'lab', 'sword'):
      f[key] = np.roll(np.roll(f[key], dy, 0), dx, 1)
    f['shift'] = (dx, dy)


place(frames)
if runs: place(runs)


def write(an, fs):
  n = len(fs); px = np.zeros((S, n * S, 4), np.uint8); mk = np.zeros((S, n * S, 4), np.uint8); wp = np.zeros((S, n * S, 4), np.uint8)
  for c, f in enumerate(fs):
    e, a, fig, lab, sword = f['e'], f['a'], f['fig'], f['lab'], f['sword']
    px[:, c * S:(c + 1) * S, :3] = e.clip(0, 255).astype(np.uint8); px[:, c * S:(c + 1) * S, 3] = np.where(fig, (a * 255).clip(0, 255), 0).astype(np.uint8)
    mk[:, c * S:(c + 1) * S, 0] = np.where(fig, lab, 0); mk[:, c * S:(c + 1) * S, 1] = np.where(sword, 255, 0); mk[:, c * S:(c + 1) * S, 3] = 255
    lum = np.where(sword, (0.3 * e[..., 0] + 0.59 * e[..., 1] + 0.11 * e[..., 2]).clip(0, 255), 0)
    wp[:, c * S:(c + 1) * S] = np.dstack([lum, lum, lum, np.where(sword, 255, 0)]).astype(np.uint8)
  for s, arr in zip(('.png', '_m.png', '_weapon.png'), (px, mk, wp)):
    Image.fromarray(arr).save(BASE + an + s, optimize=True)
  # hair labels like every other base frame
  p = px.astype(np.float32); m = np.array(Image.open(BASE + an + '_m.png'))
  for c in range(n):
    nl = relabel_frame(p[:, c * S:(c + 1) * S], m[:, c * S:(c + 1) * S])
    if nl is not None: m[:, c * S:(c + 1) * S, 0] = nl
  Image.fromarray(m).save(BASE + an + '_m.png', optimize=True)
  return px


walk = write('walk', frames)
run = write('run', runs or frames)
print('scale', round(SC, 4), 'walk shifts', [f['shift'] for f in frames], 'run', 'own frames' if runs else 'walk frames')
# QC: walk row, run row (game background)
qc = Image.new('RGB', (4 * 240, 2 * 220), (62, 66, 76))
for row, strip in enumerate((walk, run)):
  for c in range(4):
    t = Image.fromarray(strip[:, c * S:(c + 1) * S]); bg = Image.new('RGBA', (S, S), (62, 66, 76, 255)); bg.alpha_composite(t)
    qc.paste(bg.convert('RGB').crop((40, 100, 280, 320)), (c * 240, row * 220))
os.makedirs(G + 'tools/base/qc', exist_ok=True); qc.save(G + 'tools/base/qc/walk4.png')
