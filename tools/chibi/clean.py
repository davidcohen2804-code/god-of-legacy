"""A shrunk reference frame → a first clean pass on the fixed palette, written as an ASCII grid (one palette letter per
pixel, '.' transparent) plus an ×8 preview. The hand pass that follows edits the ASCII file itself.
Usage: python3 clean.py raw.png out.txt [preview.png]"""
import sys
import numpy as np
from PIL import Image
sys.path.insert(0, __file__.rsplit('/', 1)[0])
from palette import RGB

KEYS = list(RGB)
P = np.array([RGB[k] for k in KEYS], float)


def lab(c):
    """sRGB → a rough perceptual space (good enough to pick the nearest palette tone)."""
    c = np.asarray(c, float) / 255
    r, g, b = c[..., 0], c[..., 1], c[..., 2]
    return np.stack([0.30 * r + 0.59 * g + 0.11 * b, (r - g) * 0.6, (r + g - 2 * b) * 0.35], -1)


PL = lab(P)


def clean(a):
    h, w, _ = a.shape
    op = a[..., 3] > 0
    rgb = a[..., :3].astype(float)
    # greys from the background's blend (low saturation, light): out where they touch the outside
    sat = rgb.max(2) - rgb.min(2); lum = rgb.mean(2)
    grey = (sat < 18) & (lum > 85)
    for _ in range(3):
        out = ~op
        edge = np.zeros_like(op)
        edge[1:] |= out[:-1]; edge[:-1] |= out[1:]; edge[:, 1:] |= out[:, :-1]; edge[:, :-1] |= out[:, 1:]
        op &= ~(grey & edge)
    d = ((lab(rgb)[:, :, None, :] - PL[None, None]) ** 2).sum(-1)
    idx = d.argmin(-1)
    g = [[KEYS[idx[y, x]] if op[y, x] else '.' for x in range(w)] for y in range(h)]
    # the silhouette's rim is the outline
    for y in range(h):
        for x in range(w):
            if g[y][x] == '.': continue
            if any(not (0 <= y + dy < h and 0 <= x + dx < w) or g[y + dy][x + dx] == '.' for dy, dx in ((1, 0), (-1, 0), (0, 1), (0, -1))):
                g[y][x] = 'O'
    return [''.join(r) for r in g]


def render(rows, k=8, bg=(236, 236, 240)):
    h, w = len(rows), max(len(r) for r in rows)
    im = Image.new('RGBA', (w, h), bg + (255,))
    px = im.load()
    for y, r in enumerate(rows):
        for x, ch in enumerate(r):
            if ch in RGB: px[x, y] = RGB[ch] + (255,)
    return im.resize((w * k, h * k), Image.NEAREST)


if __name__ == '__main__':
    im = Image.open(sys.argv[1]).convert('RGBA'); im = im.crop(im.getbbox())
    rows = clean(np.asarray(im))
    open(sys.argv[2], 'w').write('\n'.join(rows) + '\n')
    if len(sys.argv) > 3: render(rows).save(sys.argv[3])
