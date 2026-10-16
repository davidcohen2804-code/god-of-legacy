#!/usr/bin/env python3
"""Cleans a light / white matte rim off cut-out body frames (RGBA PNGs), in place.

The samurai's idle and walk came from a video whose background was removed on white: the outer 3-4 px of the figure
kept the white (semi-see-through white, then a light-grey opaque pixel) — a jagged white outline round hair, cape,
legs and scabbard on the dark arena floor. Each pixel of that outer band that is lighter than the figure just inside it
takes the inside's colour (its alpha stays); the outermost pixel's alpha is softened where it was white. Thin light
parts (the blade) have no inside to borrow from and stay as they are.

--holes also clears the white the background removal left inside the figure (a gap between the ribbon and the hair,
torn holes in the cape, specks in the topknot — near-white, unsaturated blobs): they go see-through, then their rims
are cleaned like the outside's. --keep X0,Y0,X1,Y1 keeps the blobs whose centre is in that box (the blade).
--speck X0,Y0,X1,Y1: light grey specks in that box (left in the gaps of dark hair) take the colour round them.

    python3 tools/heroes/rim_clean.py tools/heroes/motion/samurai/idle_*.png --holes --keep 395,470,768,768 \
        --speck 290,185,480,310 [--dry]
"""
import argparse

import numpy as np
from PIL import Image
from scipy import ndimage as ndi

BAND = 4.5  # px from the outside: the rim
LUM = np.array([0.299, 0.587, 0.114])


def inside_colour(rgb, dist, lo, sigma):
    """The local colour of the figure deeper than `lo` px (normalized Gaussian average) and its weight."""
    m = (dist >= lo).astype(float)
    num = np.stack([ndi.gaussian_filter(rgb[..., c] * m, sigma) for c in range(3)], -1)
    den = ndi.gaussian_filter(m, sigma)
    return num / np.maximum(den, 1e-6)[..., None], den


def clean(rgba):
    """rgba (h, w, 4) uint8 -> cleaned copy, and the share of rim pixels that were near-white before / after."""
    a = rgba[..., 3].astype(float)
    rgb = rgba[..., :3].astype(float)
    solid = a > 8
    dist = ndi.distance_transform_edt(solid)
    ins, have = np.zeros_like(rgb), np.zeros(a.shape, bool)
    for lo, sigma in ((5, 3.0), (3, 2.0), (2, 1.5)):  # (deep inside first; thin parts — ribbon, cape tips — from nearer)
        col, wt = inside_colour(rgb, dist, lo, sigma)
        take = (wt > 0.05) & ~have
        ins[take] = col[take]
        have |= take
    band = solid & (dist <= BAND)
    excess = rgb @ LUM - ins @ LUM  # how much lighter than the figure just inside
    w = np.clip((excess - 12) / 40, 0, 1) * band * have
    out = rgb * (1 - w[..., None]) + ins * w[..., None]
    mn, spread = rgb.min(-1), rgb.max(-1) - rgb.min(-1)
    white = (mn > 170) & (spread < 70)
    outer = solid & (dist <= 1.5)
    # the white fringe itself thinned (a softer, tighter edge) where it is far lighter than the figure under it; white
    # specks with no figure under them at all go faint (the blade, as light as its own inside, is left alone)
    alpha = np.where(outer & white & have & (excess > 30), a * 0.5, np.where(solid & white & ~have, a * 0.3, a))
    res = np.dstack([np.clip(out + 0.5, 0, 255), np.clip(alpha + 0.5, 0, 255)]).astype(np.uint8)
    edge = solid & (dist <= 2)
    o_rgb = res[..., :3].astype(float)
    white_after = (o_rgb.min(-1) > 170) & ((o_rgb.max(-1) - o_rgb.min(-1)) < 70)
    return res, white[edge].mean() if edge.any() else 0.0, white_after[edge].mean() if edge.any() else 0.0


def clear_holes(rgba, keep=()):
    """Near-white unsaturated blobs (the removed background showing through) made see-through, but those in `keep`."""
    rgb = rgba[..., :3].astype(int)
    mn, spread = rgb.min(-1), rgb.max(-1) - rgb.min(-1)
    lab, _ = ndi.label((mn > 185) & (spread < 50) & (rgba[..., 3] > 40))
    out = rgba.copy()
    for i, sl in enumerate(ndi.find_objects(lab), 1):
        comp = lab[sl] == i
        if comp.sum() < 3:
            continue
        ys, xs = np.nonzero(comp)
        cx, cy = xs.mean() + sl[1].start, ys.mean() + sl[0].start
        if any(x0 <= cx <= x1 and y0 <= cy <= y1 for x0, y0, x1, y1 in keep):
            continue
        out[..., 3][sl][comp] = 0
    return out


def despeck(rgba, box):
    """Unsaturated pixels much lighter than their surroundings, inside `box`, take the colour of the figure round them."""
    x0, y0, x1, y1 = (int(v) for v in box)
    a, rgb = rgba[..., 3].astype(float), rgba[..., :3].astype(float)
    solid = a > 40
    L = rgb @ LUM
    Lm = ndi.median_filter(np.where(solid, L, 0.0), size=9)
    mn, spread = rgb.min(-1), rgb.max(-1) - rgb.min(-1)
    inbox = np.zeros(a.shape, bool)
    inbox[y0:y1, x0:x1] = True
    speck = solid & inbox & (spread < 40) & (mn > 110) & (L - Lm > 50)
    speck = ndi.binary_dilation(speck, iterations=1) & solid & inbox & (L - Lm > 25) & (spread < 50)
    good = (solid & ~speck).astype(float)
    num = np.stack([ndi.gaussian_filter(rgb[..., c] * good, 2.0) for c in range(3)], -1)
    den = ndi.gaussian_filter(good, 2.0)
    sel = speck & (den > 0.05)
    out = rgba.copy()
    out[..., :3][sel] = np.clip(num[sel] / den[sel][:, None] + 0.5, 0, 255).astype(np.uint8)
    return out


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('files', nargs='+')
    ap.add_argument('--holes', action='store_true')
    ap.add_argument('--keep', action='append', default=[], help='X0,Y0,X1,Y1: light blobs kept there (the blade)')
    ap.add_argument('--speck', action='append', default=[], help='X0,Y0,X1,Y1: grey specks cleared there (dark hair)')
    ap.add_argument('--dry', action='store_true')
    a = ap.parse_args()
    keep = [tuple(float(v) for v in k.split(',')) for k in a.keep]
    b4, af = [], []
    for f in a.files:
        im = np.asarray(Image.open(f).convert('RGBA'))
        if a.holes:
            im = clear_holes(im, keep)
        for box in a.speck:
            im = despeck(im, [float(v) for v in box.split(',')])
        res, w0, w1 = clean(im)
        b4.append(w0); af.append(w1)
        if not a.dry:
            Image.fromarray(res, 'RGBA').save(f, optimize=True)
    print(f'{len(a.files)} frames: near-white edge pixels {np.mean(b4) * 100:.1f} % -> {np.mean(af) * 100:.1f} %')


if __name__ == '__main__':
    main()
