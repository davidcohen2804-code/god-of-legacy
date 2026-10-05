"""Cut GPT UI-kit pieces off a flat magenta background into RGBA PNGs.
usage: magenta_cut.py <image> <outdir> name=x0,y0,x1,y1[,nofill] ...
Alpha: magenta distance for dark pixels; for bright pinkish pixels (gold glow blended with magenta) the
green channel gives coverage (magenta has g=0), which removes the pink fringe around glows."""
import sys
import numpy as np
from PIL import Image
from scipy import ndimage

def unmix(img):
    a = np.array(img.convert('RGB')).astype(float)
    r, g, b = a[..., 0], a[..., 1], a[..., 2]
    m = np.clip((np.minimum(r, b) - g - 70) / 110, 0, 1)
    alpha = 1 - m
    pink = (r > 170) & (b > g + 15)
    alpha = np.where(pink, np.minimum(alpha, np.clip(g / 200, 0, 1)), alpha)
    col = np.clip((a - (1 - alpha)[..., None] * np.array([255, 0, 255.])) / np.maximum(alpha, 1e-3)[..., None], 0, 255)
    return col, alpha

def cut(col, alpha, x0, y0, x1, y1, fill=True):
    al = alpha[y0:y1, x0:x1].copy()
    if fill:
        core = ndimage.binary_fill_holes(al > 0.5)
        al = np.where(ndimage.binary_erosion(core, iterations=3), 1.0, al)
    return Image.fromarray(np.dstack([col[y0:y1, x0:x1], al * 255]).astype(np.uint8), 'RGBA')

if __name__ == '__main__':
    col, alpha = unmix(Image.open(sys.argv[1]))
    for spec in sys.argv[3:]:
        nm, box = spec.split('=')
        parts = box.split(',')
        x0, y0, x1, y1 = map(int, parts[:4])
        cut(col, alpha, x0, y0, x1, y1, fill='nofill' not in parts).save(f'{sys.argv[2]}/{nm}.png')
        print(nm, x1 - x0, y1 - y0)
