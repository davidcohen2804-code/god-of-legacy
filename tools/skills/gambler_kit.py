"""Gambler effect pieces: cut the GPT sheets (tools/skills/src/gambler_<n>.png, a grid on flat green or black) into one
PNG per piece under public/assets/final/skills/gambler/kit/<name>.png.

Green sheets: the screen green is keyed out (soft edge, green spill pulled down). Black sheets: light pieces — the
brightness becomes the alpha (they are drawn with additive blending, so black = nothing).
Run: python3 tools/skills/gambler_kit.py [sheet ...]
"""
import os
import sys

import numpy as np
from PIL import Image
from scipy import ndimage

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
SRC = os.path.join(ROOT, 'tools', 'skills', 'src')
OUT = os.path.join(ROOT, 'public', 'assets', 'final', 'skills', 'gambler', 'kit')

# sheet -> (background, columns, rows, piece names in reading order, size the piece is kept at (longest side px))
SHEETS = {
    'cards': ('green', 4, 2, ['card_back', 'card_face', 'card_S', 'card_H', 'card_D', 'card_C', 'card_ace', 'card_joker'], 168),
    'kinetic': ('black', 4, 2, ['k_streak', 'k_charge', 'k_pop', 'k_blast', 'k_ring', 'k_beam', 'k_vortex', 'k_arcs'], 320),
}


def key_green(rgb):
    r, g, b = [rgb[..., i].astype(np.float32) for i in range(3)]
    over = g - np.maximum(r, b)                       # how much greener than the other channels
    a = 1 - np.clip((over - 30) / 90, 0, 1)            # pure screen green -> 0
    g2 = np.where(over > 0, np.maximum(r, b), g)      # pull the green spill down on the edge
    out = np.dstack([r, g2, b, a * 255]).clip(0, 255).astype(np.uint8)
    return out


def key_black(rgb):
    f = rgb.astype(np.float32)
    a = f.max(axis=2)
    col = np.where(a[..., None] > 0, f * 255 / np.maximum(a[..., None], 1), 0)
    return np.dstack([col, a]).clip(0, 255).astype(np.uint8)


def cut(name):
    bg, cols, rows, names, keep = SHEETS[name]
    im = np.array(Image.open(os.path.join(SRC, f'gambler_{name}.png')).convert('RGB'))
    rgba = key_green(im) if bg == 'green' else key_black(im)
    H, W = rgba.shape[:2]
    os.makedirs(OUT, exist_ok=True)
    for i, nm in enumerate(names):
        r, c = divmod(i, cols)
        cell = rgba[r * H // rows:(r + 1) * H // rows, c * W // cols:(c + 1) * W // cols]
        a = cell[..., 3] > (40 if bg == 'green' else 14)
        lab, k = ndimage.label(a)
        if k:
            sz = ndimage.sum(a, lab, range(1, k + 1)); big = int(np.argmax(sz)) + 1
            # the piece: its largest blob and everything near it (a neighbour's sliver at the cell edge is left out)
            keepm = ndimage.binary_dilation(lab == big, iterations=6 if bg == 'green' else 28)
            ys, xs = np.where(keepm & a)
            cell = cell[ys.min():ys.max() + 1, xs.min():xs.max() + 1].copy()
            if True:
                m = (keepm & a)[ys.min():ys.max() + 1, xs.min():xs.max() + 1]
                cell[..., 3] = np.where(m, cell[..., 3], 0)
        p = Image.fromarray(cell)
        s = keep / max(p.size)
        p = p.resize((max(1, round(p.width * s)), max(1, round(p.height * s))), Image.LANCZOS)
        p.save(os.path.join(OUT, f'{nm}.png'), optimize=True)
        print(name, nm, p.size)


if __name__ == '__main__':
    for n in (sys.argv[1:] or SHEETS):
        cut(n)
