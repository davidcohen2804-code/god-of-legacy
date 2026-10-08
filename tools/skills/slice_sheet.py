# Slice a GPT 4x2 effect sheet (black background) into a game strip of 8 frames, alpha from brightness, colour kept
# for normal blending. usage: slice_sheet.py src dst cellW cellH align [gamma] ; align: cell | center | ground | tip
import sys, numpy as np
from PIL import Image
src, dst, CW, CH, align = sys.argv[1], sys.argv[2], int(sys.argv[3]), int(sys.argv[4]), sys.argv[5]
im = Image.open(src).convert('RGB'); W, H = im.size; cw, ch = W / 4, H / 2
def alpha_rgba(c):
    a = np.asarray(c).astype(np.float32) / 255
    v = a.max(-1); al = np.clip((v - 0.06) / 0.5, 0, 1) ** 1.1          # black -> clear, bright -> solid
    norm = a / (v[..., None] + 1e-4)
    shade = 0.5 + 0.5 * np.clip(v / 0.8, 0, 1)[..., None]                # keep the art's own light and dark
    rgb = np.clip(norm * shade, 0, 1)
    return np.concatenate([rgb, al[..., None]], -1)
cells = [im.crop((int(i % 4 * cw), int(i // 4 * ch), int((i % 4 + 1) * cw), int((i // 4 + 1) * ch))) for i in range(8)]
rg = [alpha_rgba(c) for c in cells]
# edge fade (never a hard cut at the cell border)
for r in rg:
    h, w = r.shape[:2]; m = int(min(h, w) * 0.03) + 1
    ys = np.clip(np.minimum(np.arange(h), np.arange(h)[::-1]) / m, 0, 1); xs = np.clip(np.minimum(np.arange(w), np.arange(w)[::-1]) / m, 0, 1)
    r[..., 3] *= ys[:, None] * xs[None, :]
def bbox(r, t=0.15):
    ys, xs = np.where(r[..., 3] > t)
    return (xs.min(), ys.min(), xs.max(), ys.max()) if len(xs) else (0, 0, r.shape[1] - 1, r.shape[0] - 1)
boxes = [bbox(r) for r in rg]
# one common scale so the frames stay in proportion
if align == 'cell':
    s = min(CW / rg[0].shape[1], CH / rg[0].shape[0])
else:
    bw = max(b[2] - b[0] for b in boxes) + 1; bh = max(b[3] - b[1] for b in boxes) + 1
    s = min(CW * 0.96 / bw, CH * 0.96 / bh)
out = Image.new('RGBA', (CW * 8, CH), (0, 0, 0, 0))
for i, (r, b) in enumerate(zip(rg, boxes)):
    fr = Image.fromarray((r * 255).astype(np.uint8), 'RGBA')
    if align == 'cell':
        fr = fr.resize((int(fr.width * s), int(fr.height * s)), Image.LANCZOS); x = (CW - fr.width) // 2; y = (CH - fr.height) // 2
    else:
        fr = fr.crop((b[0], b[1], b[2] + 1, b[3] + 1)); fr = fr.resize((max(1, int(fr.width * s)), max(1, int(fr.height * s))), Image.LANCZOS)
        if align == 'center': x = (CW - fr.width) // 2; y = (CH - fr.height) // 2
        elif align == 'ground': x = (CW - fr.width) // 2; y = int(CH * 0.98) - fr.height
        elif align == 'tip': x = int(CW * 0.98) - fr.width; y = (CH - fr.height) // 2
    out.alpha_composite(fr, (i * CW + max(0, x), max(0, y)))
out.save(dst)
print(dst, out.size)
