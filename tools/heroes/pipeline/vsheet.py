"""vsheet.py <video> <out.jpg> [step]: key the clip (cached) and lay every <step>th frame out with its index."""
import sys, os, pickle, tempfile
import numpy as np
from PIL import Image, ImageDraw
sys.path.insert(0, '/home/claude/god-of-legacy/tools/heroes/pipeline')
from integrate import key_video
v, out = sys.argv[1], sys.argv[2]; st = int(sys.argv[3]) if len(sys.argv) > 3 else 4
cache = v + '.keyed.pkl'
A = pickle.load(open(cache, 'rb')) if os.path.exists(cache) else key_video(v, tempfile.mkdtemp())
if not os.path.exists(cache): pickle.dump(A, open(cache, 'wb'))
idx = list(range(0, len(A), st)); W, Hh = 140, 180; cols = 12
S = Image.new('RGB', (W * cols, Hh * ((len(idx) + cols - 1) // cols)), (70, 70, 70)); d = ImageDraw.Draw(S)
bb = Image.fromarray(A[0]).getbbox(); box = (bb[0] - 250, bb[1] - 200, bb[2] + 250, bb[3] + 20)
for k, i in enumerate(idx):
    im = Image.fromarray(A[i]).crop(box); im.thumbnail((W, Hh)); x, y = (k % cols) * W, (k // cols) * Hh
    S.paste(im, (x, y), im); d.text((x + 3, y + 3), str(i), fill=(255, 255, 0))
S.save(out, quality=85); print(len(A), 'frames')
