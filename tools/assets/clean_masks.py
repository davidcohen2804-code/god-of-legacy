"""Shrink the weapon-mask sheets (*_weapon.png) without changing a single visible pixel.

The masks are full luminance copies of their body sheet with alpha only on the sword, so ~99.9 % of every file is
colour hidden under alpha 0 that the game can never show (WebGL uploads premultiplied, canvas reads lose it too).
Zeroing that hidden colour cuts each mask from ~1.5 MB to a few KB (about 40 MB less to download per world load).

usage: python3 tools/assets/clean_masks.py [root=public]     (idempotent: clean files are left untouched)
"""
import glob
import os
import sys

import numpy as np
from PIL import Image


def clean(path: str) -> tuple[int, int] | None:
    im = Image.open(path)
    if im.mode != 'RGBA':
        return None
    a = np.array(im)
    hidden = a[..., 3] == 0
    if not a[..., :3][hidden].any():
        return None
    out = a.copy()
    out[hidden, :3] = 0
    before = os.path.getsize(path)
    tmp = path + '.tmp.png'
    Image.fromarray(out, 'RGBA').save(tmp, optimize=True)
    chk = np.array(Image.open(tmp))
    vis = ~hidden
    assert (chk[..., 3] == a[..., 3]).all() and (chk[vis] == a[vis]).all(), path  # alpha + visible pixels identical
    os.replace(tmp, path)
    return before, os.path.getsize(path)


if __name__ == '__main__':
    root = sys.argv[1] if len(sys.argv) > 1 else 'public'
    tb = ta = n = 0
    for f in sorted(glob.glob(os.path.join(root, '**', '*_weapon.png'), recursive=True)):
        r = clean(f)
        if r:
            n += 1; tb += r[0]; ta += r[1]
            print(f'{r[0] / 1e6:6.2f} MB -> {r[1] / 1e6:6.3f} MB  {f}')
    print(f'cleaned {n} masks: {tb / 1e6:.1f} MB -> {ta / 1e6:.1f} MB')
