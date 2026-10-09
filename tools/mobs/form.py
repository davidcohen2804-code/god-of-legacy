# form.py : the player's Cloud Form (GPT sheet: idle 4, moving 6, facing right, on magenta) → one strip of 10 equal
# frames, the figure floating with its lowest point at 92% of the cell, centred on its body.
#   in : tools/mobs/cloud_form.png     out: public/assets/final/fx/cloud_form.png (cell size printed)
import numpy as np
from PIL import Image
from scipy import ndimage as nd
import importlib.util, os
R = __file__.rsplit('/', 3)[0] + '/'
spec = importlib.util.spec_from_file_location('m', R + 'tools/mobs/mobs.py')
src = open(R + 'tools/mobs/mobs.py').read(); ns = {}
exec(src.split('for mid, spec in MOBS.items():')[0].replace("R = __file__.rsplit('/', 3)[0] + '/'", f"R = {R!r}"), ns)
rgba = ns['key'](R + 'tools/mobs/cloud_form.png'); A = rgba[..., 3] > 90
rows = [r for r in ns['bands'](A, 1, 20) if r[1] - r[0] > 60]; assert len(rows) == 2, rows
cells = []
for (y0, y1), n in zip(rows, (4, 6)):
  m = A[y0:y1]; lab, k = nd.label(nd.binary_dilation(m, iterations=6)); objs = nd.find_objects(lab); sz = nd.sum(m, lab, range(1, k + 1))
  big = sorted(np.argsort(sz)[-n:], key=lambda q: objs[q][1].start)
  for q in big:
    sl = objs[q]; c = rgba[y0:y1][sl].copy(); c[..., 3] = np.where(lab[sl] == q + 1, c[..., 3], 0); cells.append(c)
H = 120; s = H * 0.86 / max(c.shape[0] for c in cells)
W = int(max(c.shape[1] for c in cells) * s) + 8
strip = Image.new('RGBA', (W * len(cells), H))
for i, c in enumerate(cells):
  im = Image.fromarray(c); im = im.resize((max(1, round(im.width * s)), max(1, round(im.height * s))), Image.LANCZOS)
  strip.alpha_composite(im, (i * W + (W - im.width) // 2, round(H * 0.92) - im.height))
os.makedirs(R + 'public/assets/final/fx', exist_ok=True); strip.save(R + 'public/assets/final/fx/cloud_form.png', optimize=True)
print('cloud_form', W, 'x', H, len(cells), 'frames')
