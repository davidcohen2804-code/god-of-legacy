# strips.py <in.png> <out.png> : a GPT sheet of wide frames stacked in one column, cut apart by thin grey lines (its own
#   frame borders, uneven heights) → the same frames, borders gone (painted with the background), each centred in a cell of
#   one height — ready for gpt_sheet.py fx <out.png> <cls> <id> 1 <rows> <width> [out].
import sys
import numpy as np
from PIL import Image

src, dst = sys.argv[1], sys.argv[2]
a = np.asarray(Image.open(src).convert('RGB')).astype(np.float32)
H, W, _ = a.shape
m = a.mean(2)
sat = a.max(2) - a.min(2)
bg = np.median(np.concatenate([a[:, -4:].reshape(-1, 3), a[-4:].reshape(-1, 3)]), 0)
line_row = ((m > 110).mean(1) > 0.97) & (sat.mean(1) < 8)          # a full-width grey line, not the effect's own beams
line_col = ((m > 110).mean(0) > 0.85) & (sat.mean(0) < 8)
a[line_row] = bg; a[:, line_col] = bg
cuts, y = [], 0
while y < H:                                                         # the frames: the bands between the lines
    if line_row[y]:
        y += 1; continue
    y0 = y
    while y < H and not line_row[y]: y += 1
    if y - y0 > 20: cuts.append((y0, y))
ch = max(b - t for t, b in cuts) + 16
out = np.tile(bg, (ch * len(cuts), W, 1)).astype(np.float32)
for k, (t, b) in enumerate(cuts):
    o = k * ch + (ch - (b - t)) // 2
    out[o:o + b - t] = a[t:b]
Image.fromarray(out.round().clip(0, 255).astype(np.uint8), 'RGB').save(dst)
print('strips', len(cuts), 'frames of', W, 'x', ch, [b - t for t, b in cuts])
