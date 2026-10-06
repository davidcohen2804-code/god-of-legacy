# fix_hilt.py : the starter-outfit drawing (tools/base/gpt/base_outfit.png) has the sword's pommel and grip coming out of the
#   fist at another angle than the blade (the sword looks bent in the hand). The grip above the fist is taken out (the
#   pommel stays hidden behind the wrist, in line with the blade) and the fist's outline closed where the grip left it.
#   → tools/base/outfit/base_outfit_fixed.png
import os, numpy as np
from PIL import Image
from scipy import ndimage as nd
H = os.path.dirname(os.path.abspath(__file__))
im = np.asarray(Image.open(H + '/../gpt/base_outfit.png').convert('RGB')).astype(np.float32)
R, G, B = im[..., 0], im[..., 1], im[..., 2]
mag = (R > 200) & (B > 200) & (G < 90)                                  # the background
skin = (R > 205) & (G > 150) & (B > 90) & (R - B > 50)                  # the fist's light skin
out = im.copy()
for (x0, y0, x1, y1) in ((330, 412, 382, 466), (330, 1177, 382, 1231)):   # man, woman: the hilt above the fist
  box = np.zeros(R.shape, bool); box[y0:y1, x0:x1] = True
  fist = nd.binary_dilation(nd.binary_fill_holes(nd.binary_closing(skin & box, iterations=2)), iterations=3)
  rem = box & ~mag & ~fist                                              # pommel + grip outside the hand
  edge = box & fist & ~skin & ~mag                                      # the hand's rim where the grip crossed it: outline
  lum = 0.3 * R + 0.59 * G + 0.11 * B
  ink = np.median(im[nd.binary_dilation(skin & box, iterations=4) & ~skin & ~mag & (lum < 70) & ~box], 0) if False else \
        np.median(im[(nd.binary_dilation(skin, iterations=3) & ~skin & ~mag & (lum < 70))[y0 - 40:y1 + 40, x0 - 40:x1 + 40].nonzero()[0] + y0 - 40,
                     (nd.binary_dilation(skin, iterations=3) & ~skin & ~mag & (lum < 70))[y0 - 40:y1 + 40, x0 - 40:x1 + 40].nonzero()[1] + x0 - 40], 0)
  out[rem] = (255, 0, 255)
  out[edge] = ink                                                       # the hand's own ink colour
  print('removed', int(rem.sum()), 'outline', int(edge.sum()))
Image.fromarray(out.clip(0, 255).astype(np.uint8)).save(H + '/base_outfit_fixed.png')
