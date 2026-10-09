# phoenix.py : the sky phoenix gliding far behind the world now and then (GPT: 8 wing-beat frames in a row on magenta,
# flying right) → public/assets/world/sky/phoenix.png (one strip, equal cells, the bird centred on its body)
import numpy as np
from PIL import Image
from scipy import ndimage as nd
R = __file__.rsplit('/', 3)[0] + '/'
im = np.asarray(Image.open(R + 'tools/world/sky/phoenix.png').convert('RGB')).astype(np.float32)
r, g, b = im[..., 0], im[..., 1], im[..., 2]
a = 1 - np.clip((np.minimum(r, b) - g - 60) / 90, 0, 1)
k = np.where(np.minimum(r, b) > g, (np.minimum(r, b) - g) * (1 - a), 0); rgb = im.copy(); rgb[..., 0] -= k; rgb[..., 2] -= k
rgba = np.dstack([np.clip(rgb, 0, 255), a * 255]).astype(np.uint8); A = a > 0.35
lab, n = nd.label(nd.binary_dilation(A, iterations=5)); objs = nd.find_objects(lab); sz = nd.sum(A, lab, range(1, n + 1))
big = sorted(np.argsort(sz)[-8:], key=lambda q: objs[q][1].start)
cells = []
for q in big:
  sl = objs[q]; c = rgba[sl].copy(); c[..., 3] = np.where(lab[sl] == q + 1, c[..., 3], 0); cells.append((c, sl))
top = min(sl[0].start for _, sl in cells); bot = max(sl[0].stop for _, sl in cells)
H = 160; s = H * 0.95 / (bot - top); W = int(max(c.shape[1] for c, _ in cells) * s) + 6
strip = Image.new('RGBA', (W * 8, H))
for i, (c, sl) in enumerate(cells):
  im2 = Image.fromarray(c); im2 = im2.resize((max(1, round(im2.width * s)), max(1, round(im2.height * s))), Image.LANCZOS)
  strip.alpha_composite(im2, (i * W + (W - im2.width) // 2, round((sl[0].start - top) * s) + 4))
strip.save(R + 'public/assets/world/sky/phoenix.png', optimize=True)
print('phoenix', W, H)
