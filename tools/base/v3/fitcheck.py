"""Usage (from tools/base): python3 v3/fitcheck.py BODY DRESSED   (images under gpt/, e.g. bare_nosword/v3f/sheet_swing12.png
dressed_nosword/v3f/sheet_swing12.png): per figure, the dressed drawing laid on the body by the head
(inscribed circle: centre + size) — how much of the body's legs the clothes leave bare (body below its hips not covered),
and the silhouettes' overlap. High 'bare' = the clothes will not sit on that frame."""
import sys, os, numpy as np
from scipy import ndimage as nd
H = os.path.dirname(os.path.abspath(__file__)) + '/..'
body_p, dres_p = sys.argv[1], sys.argv[2]
sys.argv = [sys.argv[0], H + '/sheets/v3_male.json']
src = open(H + '/naked_frames.py').read(); __file__ = H + '/naked_frames.py'
exec(src[:src.index("idle_path, idle_idx = spec")])
def head(f):
  m = f['m']; x0, y0, x1, y1 = f['box']; dt = nd.distance_transform_edt(m[y0:y1 + 1]); dt[int((y1 - y0) * 0.6):] = 0
  cy, cx = np.unravel_index(np.argmax(dt), dt.shape); return cy + y0, cx, 2 * dt.max()
B, D = figures(body_p), figures(dres_p)
print(len(B), len(D))
for k, (b, d) in enumerate(zip(B, D)):
  by, bx, bd = head(b); dy_, dx_, dd = head(d); s = bd / dd
  ys, xs = np.nonzero(d['m']); ty = np.round((ys - dy_) * s + by).astype(int); tx = np.round((xs - dx_) * s + bx).astype(int)
  ok = (ty >= 0) & (ty < b['m'].shape[0]) & (tx >= 0) & (tx < b['m'].shape[1]); dm = np.zeros_like(b['m']); dm[ty[ok], tx[ok]] = True
  dm = nd.binary_closing(dm, iterations=2)
  x0, y0, x1, y1 = b['box']; low = np.zeros_like(b['m']); low[int(y0 + (y1 - y0) * 0.55):] = True
  legs = b['m'] & low; bare = legs & ~nd.binary_dilation(dm, iterations=3)
  iou = (b['m'] & dm).sum() / max((b['m'] | dm).sum(), 1)
  print(f'  fig {k}: scale {s:.3f}  overlap {iou:.2f}  legs bare {bare.sum() / max(legs.sum(), 1):.1%}')
