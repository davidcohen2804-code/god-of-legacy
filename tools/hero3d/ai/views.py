#!/usr/bin/env python3
"""views.py SRC_DIR OUT_DIR -> v_<view>.png (colours bled past the drawing's edge; the right view's stray sash masked)
+ bbox.json (each cut-out's own silhouette box) for bake.html."""
import sys, json
from PIL import Image
import numpy as np
from scipy import ndimage
src, out = sys.argv[1], sys.argv[2]; bb = {}
for v in ['front', 'back', 'left', 'right']:
    im = np.asarray(Image.open(f'{src}/{v}_cut.png').convert('RGBA')).astype(np.float32)
    rgb, a = im[..., :3], im[..., 3]
    ys, xs = np.where(a > 128); bb[v] = [int(xs.min()), int(xs.max()), int(ys.min()), int(ys.max())]
    if v == 'right':
        r, g, b = rgb[..., 0], rgb[..., 1], rgb[..., 2]
        red = (r > g * 1.45) & (r > b * 1.45) & (r > 70)
        Y = np.arange(a.shape[0])[:, None]
        mask = ndimage.binary_dilation(red & (Y > 560) & (Y < 1000), iterations=6)
        a = np.where(mask, 0, a); print('right: sash px masked', int(mask.sum()))
    fg = a > 128
    idx = ndimage.distance_transform_edt(~fg, return_distances=False, return_indices=True)
    Image.fromarray(np.dstack([rgb[idx[0], idx[1]], a]).clip(0, 255).astype(np.uint8), 'RGBA').save(f'{out}/v_{v}.png')
json.dump(bb, open(f'{out}/bbox.json', 'w')); print(bb)
