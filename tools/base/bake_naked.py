# bake_naked.py [gpt_image] : the clean BASE character (no hair, no clothes, no weapon; plain underwear) from one GPT
# drawing of two standing figures — LEFT = male, RIGHT = female — into game frames:
#   public/assets/final/body/naked/<male|female>/idle.png  (+ idle_m.png labels: skin 60, top 80, shorts 200)
# Same cell as every body frame (352 px, feet origin 176,310). One scale for both figures: head top to sole = FIG_H.
# The figure stands where the beginner stood (hips on his idle hips x, soles on the ground line).
import os, sys, numpy as np
from PIL import Image
from scipy import ndimage as nd
G = os.path.dirname(os.path.abspath(__file__)) + '/../../'; S = 352; GROUND = 310
src = open(os.path.join(os.path.dirname(os.path.abspath(__file__)), 'bake_pose.py')).read()
exec(src[src.index('def keyed('):src.index('def labels(')])        # keyed() of the pose baker
img = sys.argv[1] if len(sys.argv) > 1 else G + 'tools/base/gpt/naked_base.png'
OUT = G + 'public/assets/final/body/naked/'
FIG_H = 185            # bald head top to sole (the beginner's hair added ~10 px on top of this)

gi = np.array(Image.open(img).convert('RGB')).astype(np.float32)
e0, a0 = keyed(gi)
fig0 = a0 > 0.5
L, n = nd.label(fig0); sz = nd.sum(fig0, L, range(1, n + 1))
figs = sorted([1 + int(i) for i in np.argsort(-sz)[:2]], key=lambda i: np.nonzero(L == i)[1].mean())
boxes = []
for i in figs:
  ys, xs = np.nonzero(L == i); boxes.append((xs.min(), ys.min(), xs.max(), ys.max()))
sc = FIG_H / np.mean([b[3] - b[1] for b in boxes])

# where the beginner stands: his idle hips (shorts) x
bm = np.array(Image.open(G + 'public/assets/final/body/warrior/base/idle_m.png'))[:, :S, 0]
HIPX = float(np.median(np.nonzero(bm == 200)[1]))


def label(e, a):
  fig = a > 0.5
  R, Gc, B = e[..., 0], e[..., 1], e[..., 2]
  mx = np.maximum(np.maximum(R, Gc), B); mn = np.minimum(np.minimum(R, Gc), B); sat = (mx - mn) / np.maximum(mx, 1)
  grey = fig & (sat < 0.13) & (mx > 105)                           # the plain light-grey underwear
  grey = nd.binary_opening(grey, iterations=1)
  lab = np.where(fig, 60, 0).astype(np.uint8)                      # everything else is the body (skin, face, outline)
  gL, gn = nd.label(grey)
  ys = np.nonzero(fig.any(1))[0]; top, bot = ys.min(), ys.max()
  for k in range(1, gn + 1):
    cm = gL == k
    if cm.sum() < 40: continue
    cy = np.nonzero(cm)[0].mean()
    part = 80 if cy < top + (bot - top) * 0.47 else 200            # tank top (upper body) / shorts
    cm = nd.binary_fill_holes(nd.binary_closing(cm, iterations=2)) & fig
    lab[cm] = part
  # the dark outline right around the underwear belongs to it (recolours keep their edge)
  for part in (80, 200):
    ring = nd.binary_dilation(lab == part, iterations=2) & fig & (lab == 60) & (mx < 120)
    lab[ring] = part
  return fig, lab


os.makedirs(OUT, exist_ok=True)
qc = []
for name, (x0, y0, x1, y1) in zip(('male', 'female'), boxes):
  pad = 20
  sub = gi[max(0, y0 - pad):y1 + pad, max(0, x0 - pad):x1 + pad]
  h, w = sub.shape[:2]
  im = Image.fromarray(sub.clip(0, 255).astype(np.uint8)).resize((int(round(w * sc)), int(round(h * sc))), Image.LANCZOS)
  canvas = Image.new('RGB', (S, S), (255, 0, 255))
  canvas.paste(im, (0, 0))
  e, a = keyed(np.array(canvas).astype(np.float32))
  fig, lab = label(e, a)
  # place: shorts centre on the beginner's hips x, lowest sole on the ground
  sh = np.nonzero(lab == 200)
  dx = int(round(HIPX - np.median(sh[1]))); dy = GROUND - int(np.nonzero(fig.any(1))[0].max())
  e = np.roll(np.roll(e, dy, 0), dx, 1); a = np.roll(np.roll(a, dy, 0), dx, 1); fig = np.roll(np.roll(fig, dy, 0), dx, 1); lab = np.roll(np.roll(lab, dy, 0), dx, 1)
  px = np.zeros((S, S, 4), np.uint8); px[..., :3] = e.clip(0, 255).astype(np.uint8); px[..., 3] = np.where(fig, (a * 255).clip(0, 255), 0).astype(np.uint8)
  mk = np.zeros((S, S, 4), np.uint8); mk[..., 0] = np.where(fig, lab, 0); mk[..., 3] = 255
  os.makedirs(OUT + name, exist_ok=True)
  Image.fromarray(px).save(OUT + name + '/idle.png', optimize=True)
  Image.fromarray(mk).save(OUT + name + '/idle_m.png', optimize=True)
  ys, xs = np.nonzero(fig)
  print(name, 'scale', round(sc, 4), 'bbox', xs.min(), ys.min(), xs.max(), ys.max(), 'labels', {int(v): int((lab[fig] == v).sum()) for v in np.unique(lab[fig])})
  qc.append(px)

# QC: beginner idle | male | female on the game background, 2x
boy = np.array(Image.open(G + 'public/assets/final/body/warrior/base/idle.png').convert('RGBA'))[:, :S]
row = Image.new('RGB', (3 * 260, 230), (62, 66, 76))
for k, px in enumerate([boy] + qc):
  bg = Image.new('RGBA', (S, S), (62, 66, 76, 255)); bg.alpha_composite(Image.fromarray(px))
  row.paste(bg.convert('RGB').crop((40, 95, 300, 325)), (k * 260, 0))
os.makedirs(G + 'tools/base/qc', exist_ok=True)
row.resize((row.width * 2, row.height * 2), Image.LANCZOS).save(G + 'tools/base/qc/naked_base.png')
