"""The heroes' pictures painted by GPT (transparent PNG/WebP, the hero facing right): framed alike on the 1024x1536
canvas — the body (the top of the hair to the soles) 88 % of the height whatever the weapon reaches above it, the feet at
97.5 %, the chest in the middle, the whole picture inside the canvas — and the face found (the warm skin of the face, from
the brow down) for the portraits' square.
python3 splash.py IN OUT.webp [face_x face_y]   -> prints the face square: x y s (px on the framed picture)"""
import sys
import numpy as np
from PIL import Image
from scipy import ndimage

W, H = 1024, 1536
src, out = sys.argv[1], sys.argv[2]
im = Image.open(src).convert('RGBA')
a = np.asarray(im).astype(int)
alpha = a[..., 3] > 24
ys, xs = np.nonzero(alpha)
y0, y1, x0, x1 = ys.min(), ys.max(), xs.min(), xs.max()
fh = y1 - y0

# the face: warm skin in the top of the figure (its largest blob), from its brow down
def face_of(rgba, top, bottom):
    t = rgba[top:bottom]
    r, g, b, al = t[..., 0], t[..., 1], t[..., 2], t[..., 3]
    skin = (al > 200) & (r > 150) & (r > g + 15) & (g > b + 5) & (r - b > 45) & (r < 252)
    lab, n = ndimage.label(skin)
    if not n: return None
    # the topmost blob of a face's size (a raised forearm or hand is skin too, lower down)
    sizes = ndimage.sum(skin, lab, range(1, n + 1)); tops = ndimage.minimum(np.indices(skin.shape)[0], lab, range(1, n + 1))
    ok = [i for i in range(n) if sizes[i] >= 0.002 * fh * fh]
    best = (min(ok, key=lambda i: tops[i]) if ok else int(np.argmax(sizes))) + 1
    fy, fx = np.nonzero(lab == best)
    brow = fy.min()
    face = fy < brow + 0.07 * fh  # (the face only, not the neck and the open collar)
    return fx[face].mean(), brow + top
f = face_of(a, y0, y0 + int(fh * 0.4))
brow = f[1] if f else y0 + 0.05 * fh
head_top = max(y0, brow - 0.075 * (y1 - brow))  # (the hair above the brow)
k = H * 0.88 / (y1 - head_top)
# the chest: the middle of the figure's solid band between the shoulders and the waist (weapons are thin)
band = alpha[int(brow + (y1 - brow) * 0.12): int(brow + (y1 - brow) * 0.32)]
cols = band.sum(0)
cx = float(np.average(np.arange(len(cols)), weights=cols.astype(float) ** 3)) if cols.sum() else (x0 + x1) / 2
# the whole picture (a staff's or a bow's top, a blade's point) inside the canvas
k = min(k, H * 0.97 / fh, (W * 0.495) / max(1, cx - x0), (W * 0.495) / max(1, x1 - cx))
img = im.resize((max(1, round(im.width * k)), max(1, round(im.height * k))), Image.LANCZOS)
canvas = Image.new('RGBA', (W, H), (0, 0, 0, 0))
ox, oy = round(W / 2 - cx * k), round(H * 0.975 - y1 * k)
oy = max(oy, round(H * 0.005 - y0 * k))
canvas.alpha_composite(img, (max(0, ox), max(0, oy)), (max(0, -ox), max(0, -oy)))
canvas.save(out, 'WEBP', quality=92, method=6)
s = int(H * 0.88 * 0.145)
if len(sys.argv) > 4: print(sys.argv[3], sys.argv[4], s)  # (the face's place by hand where the skin misleads: a face behind a drawing hand)
elif f: print(int(f[0] * k + ox - s / 2), int(brow * k + oy - 0.32 * s), s)
else: print('no face found')
