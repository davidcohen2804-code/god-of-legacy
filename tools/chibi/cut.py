#!/usr/bin/env python3
"""Cut a GPT parts sheet (pieces on flat #00FF00) into transparent pieces.
usage: cut.py SHEET.png OUTDIR [min_area]
writes OUTDIR/p<i>.png (cropped RGBA, 6 px margin), OUTDIR/pieces.json (bbox of each in the sheet), OUTDIR/overview.png"""
import sys, json, os
import numpy as np
from PIL import Image, ImageDraw
from scipy import ndimage as ndi

src, out = sys.argv[1], sys.argv[2]
min_area = int(sys.argv[3]) if len(sys.argv) > 3 else 400
os.makedirs(out, exist_ok=True)
im = np.asarray(Image.open(src).convert('RGB')).astype(np.float32)
r, g, b = im[..., 0], im[..., 1], im[..., 2]
# how green a pixel is: green over the larger of red and blue (the flat ground ~255, skin and hair < 0)
gn = g - np.maximum(r, b)
t0, t1 = 40.0, 140.0  # (below t0: all piece; above t1: all ground; between: an edge blended with the ground)
a = np.clip(1.0 - (gn - t0) / (t1 - t0), 0.0, 1.0)
# the ground's spill on the edge: green brought down to the larger of red and blue
rgb = im.copy()
rgb[..., 1] = np.where(gn > 0, np.maximum(r, b), g)
alpha = (a * 255).round().astype(np.uint8)
solid = a > 0.5
# pieces: the solid areas joined across hairline gaps (a lock of hair, a thin finger)
lab, n = ndi.label(ndi.binary_closing(solid, iterations=2))
objs = ndi.find_objects(lab)
pieces = []
for i, sl in enumerate(objs):
    area = int((lab[sl] == i + 1).sum())
    if area < min_area:
        continue
    y0, y1, x0, x1 = sl[0].start, sl[0].stop, sl[1].start, sl[1].stop
    pieces.append({'label': i + 1, 'bbox': [x0, y0, x1, y1], 'area': area})
# reading order: rows (by the top within 60 px), then left to right
pieces.sort(key=lambda p: (round(p['bbox'][1] / 60), p['bbox'][0]))
H, W = solid.shape
ov = Image.open(src).convert('RGB')
d = ImageDraw.Draw(ov)
for k, p in enumerate(pieces):
    x0, y0, x1, y1 = p['bbox']
    m = 6
    X0, Y0, X1, Y1 = max(0, x0 - m), max(0, y0 - m), min(W, x1 + m), min(H, y1 + m)
    own = ndi.binary_dilation(lab == p['label'], iterations=3)[Y0:Y1, X0:X1]
    rgba = np.dstack([rgb[Y0:Y1, X0:X1].round().astype(np.uint8), np.where(own, alpha[Y0:Y1, X0:X1], 0).astype(np.uint8)])
    Image.fromarray(rgba, 'RGBA').save(f'{out}/p{k}.png')
    p['crop'] = [X0, Y0, X1, Y1]
    p['name'] = f'p{k}'
    d.rectangle([x0, y0, x1, y1], outline=(255, 0, 0), width=2)
    d.text((x0 + 4, y0 + 4), str(k), fill=(255, 0, 0))
ov.save(f'{out}/overview.png')
json.dump(pieces, open(f'{out}/pieces.json', 'w'), indent=1)
print(len(pieces), 'pieces:', [(p['name'], p['bbox'], p['area']) for p in pieces])
