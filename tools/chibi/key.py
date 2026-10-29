#!/usr/bin/env python3
"""A GPT picture on flat green made see-through (soft edge, the green spill taken off), its largest figure kept.
usage: key.py IN OUT [--fit W H [bottom_margin]]  (fit: the figure scaled into a W x H canvas, feet near the bottom)"""
import sys
import numpy as np
from PIL import Image
from scipy import ndimage as ndi

src, out = sys.argv[1], sys.argv[2]
im = np.asarray(Image.open(src).convert('RGB')).astype(np.float32)
r, g, b = im[..., 0], im[..., 1], im[..., 2]
gn = g - np.maximum(r, b)
a = np.clip(1.0 - (gn - 36) / 110, 0, 1)
rgb = im.copy(); rgb[..., 1] = np.where(gn > 0, np.maximum(r, b), g)
lab, n = ndi.label(a > 0.5)
if n > 1:
    sizes = ndi.sum(np.ones_like(lab), lab, range(1, n + 1)); big = sizes.max()
    keep = np.isin(lab, [i + 1 for i, s in enumerate(sizes) if s > big * 0.02])
    a = np.where(ndi.binary_dilation(keep, iterations=3), a, 0)
rgba = Image.fromarray(np.dstack([rgb.round().clip(0, 255).astype(np.uint8), (a * 255).round().astype(np.uint8)]), 'RGBA')
if '--fit' in sys.argv:
    i = sys.argv.index('--fit'); W, H = int(sys.argv[i + 1]), int(sys.argv[i + 2]); mb = int(sys.argv[i + 3]) if len(sys.argv) > i + 3 else 20
    bb = rgba.getbbox(); fig = rgba.crop(bb)
    k = min((W - 20) / fig.width, (H - mb - 20) / fig.height)
    fig = fig.resize((round(fig.width * k), round(fig.height * k)), Image.LANCZOS)
    canvas = Image.new('RGBA', (W, H), (0, 0, 0, 0)); canvas.paste(fig, ((W - fig.width) // 2, H - mb - fig.height), fig)
    print('figure', fig.size, 'at', ((W - fig.width) // 2, H - mb - fig.height), 'scale', round(k, 4), 'bbox in source', bb)
    rgba = canvas
if out.endswith('.webp'): rgba.save(out, 'WEBP', quality=92, method=6)
else: rgba.save(out, optimize=True)
print(out, rgba.size)
