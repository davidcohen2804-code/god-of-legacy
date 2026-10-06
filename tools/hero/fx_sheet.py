"""Turn a GPT effect sheet painted on black into a game strip for additive blending.
usage: fx_sheet.py <gpt_image> <cols> <rows> <out.png> [--single]
  Splits the image into cols x rows equal cells, crushes the near-black background to pure black (no grey haze under
  ADD), crops every cell to the union bounding box of the lit pixels (same box for all frames, so the animation keeps
  its anchor) and writes them side by side as one horizontal strip. Prints the frame size for the Phaser spritesheet.
  --single: one effect, no grid (crop to its lit box)."""
import sys
import numpy as np
from PIL import Image

src, cols, rows, out = sys.argv[1], int(sys.argv[2]), int(sys.argv[3]), sys.argv[4]
im = np.array(Image.open(src).convert('RGB')).astype(np.float32)
H, W = im.shape[:2]
# crush: anything darker than the background noise floor -> 0, then re-stretch
lum = im.max(axis=2)
floor = np.percentile(lum, 35) + 6
im = np.clip((im - floor) * (255.0 / (255.0 - floor)), 0, 255)

cw, ch = W // cols, H // rows
cells = [im[r * ch:(r + 1) * ch, c * cw:(c + 1) * cw] for r in range(rows) for c in range(cols)]
# trim a thin margin of every cell (GPT sometimes paints faint separators on the cell edges)
m = max(2, int(min(cw, ch) * 0.015))
cells = [c[m:-m, m:-m] for c in cells]
lit = np.zeros(cells[0].shape[:2], bool)
for c in cells:
    lit |= c.max(axis=2) > 10
ys, xs = np.nonzero(lit)
pad = 4
y0, y1 = max(0, ys.min() - pad), min(lit.shape[0], ys.max() + pad + 1)
x0, x1 = max(0, xs.min() - pad), min(lit.shape[1], xs.max() + pad + 1)
frames = [c[y0:y1, x0:x1] for c in cells]
fw, fh = x1 - x0, y1 - y0
strip = np.zeros((fh, fw * len(frames), 3), np.float32)
for i, f in enumerate(frames):
    strip[:, i * fw:(i + 1) * fw] = f
Image.fromarray(strip.astype(np.uint8), 'RGB').save(out, optimize=True)
print(f'frames {len(frames)} frameWidth {fw} frameHeight {fh}')
