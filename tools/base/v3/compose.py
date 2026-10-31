#!/usr/bin/env python3
"""One GPT sheet out of figures from several GPT images, each scaled so its head (inscribed circle) is the size of the
reference figure's head — a move's frames drawn in separate images then bake at one scale (the pipeline's "body" / "asd"
sizes and the moves measured against them stay right).
Usage (from tools/base): python3 v3/compose.py [--body] <out png> <ref image>:<figure> <image>:<figure> ...   (images under
gpt/; figures counted like naked_frames.py: rows top first, left to right). --body: scaled by the body (neck → sole) instead
of the head (GPT drew a lone figure with its own proportions: the body is what must match; our head goes on every frame);
<image>:<figure>*K: that figure K times bigger still (its neck as high as the others'); --like=<other sheet .json>:
the sizes that sheet was made with (a dressed copy made from dressed figures lies exactly on the bare one)."""
import os, sys, json, numpy as np
from PIL import Image
from scipy import ndimage as nd
H = os.path.dirname(os.path.abspath(__file__)) + '/..'
BY = 'nts' if '--body' in sys.argv else 'headd'; LIKE = next((a.split('=', 1)[1] for a in sys.argv if a.startswith('--like=')), None)
args = [a for a in sys.argv[1:] if a != '--body' and not a.startswith('--like=')]
out, ref, items = args[0], args[1], args[2:]
sys.argv = [sys.argv[0], H + '/sheets/v3_male.json']
src = open(H + '/naked_frames.py').read(); __file__ = H + '/naked_frames.py'
exec(src[:src.index("idle_path, idle_idx = spec")])                  # figures() of the baker
def fig(spec_):
  p, i = spec_.split('*')[0].rsplit(':', 1); return figures(p)[int(i)]
hd0 = fig(ref)[BY]; cells = []; ks = []
KS = json.load(open(H + '/gpt/' + LIKE))['k'] if LIKE else None   # (another sheet's sizes: its dressed copy lies exactly on it)
for n_, it in enumerate(items):
  f = fig(it); k = 1.0 if it.rsplit(':', 1)[0] == ref.rsplit(':', 1)[0] else hd0 / f[BY]   # (the reference image's own: as drawn)
  if '*' in it: k *= float(it.split('*')[1])                    # (image:figure*1.05: that much bigger still)
  if KS: k = KS[n_]
  ks.append(k)
  x0, y0, x1, y1 = f['box']; pad = 12
  gi = np.where(nd.binary_dilation(f['m'], iterations=3)[..., None], f['gi'], np.array([255, 0, 255], np.float32))
  sub = gi[max(0, y0 - pad):y1 + pad, max(0, x0 - pad):x1 + pad].clip(0, 255).astype(np.uint8)
  im = Image.fromarray(sub).resize((max(1, round(sub.shape[1] * k)), max(1, round(sub.shape[0] * k))), Image.LANCZOS)
  cells.append(im); print(it, 'x', round(k, 3))
gap = 40; W = sum(c.width for c in cells) + gap * (len(cells) + 1); Hh = max(c.height for c in cells) + 2 * gap
sheet = Image.new('RGB', (W, Hh), (255, 0, 255)); x = gap
for c in cells: sheet.paste(c, (x, Hh - gap - c.height)); x += c.width + gap      # one baseline, apart
sheet.save(H + '/gpt/' + out); print(out, sheet.size)
json.dump(dict(items=items, k=[round(float(v), 6) for v in ks]), open(H + '/gpt/' + out[:-4] + '.json', 'w'), indent=1)   # (its sizes: --like)
