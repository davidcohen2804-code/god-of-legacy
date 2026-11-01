# Lab-only stand-in art for rule tests (not designs): plain coat pieces for the top's chains and waist slot, so the
# chains and the layering can be tested (worn together with the trousers' chain, the Golden tabard) before any coat is
# drawn. Flat shapes in the coat's colours, outlined like the parts.
# Usage: test_standins.py <work dir>  → <work>/parts_test/<name>.png and <work>/parts_test.json (B = 512 px)
import json, os, sys
import numpy as np
from PIL import Image, ImageDraw, ImageFilter

W = sys.argv[1]
BPX, SS = 512, 4  # atlas px per B; supersampling
os.makedirs(f'{W}/parts_test', exist_ok=True)
INK = np.array([26, 22, 28], np.float32)


def finish(rgb, mask, Wp, Hp):
    """Outline the shape (2 px), drop the supersampling."""
    m = np.array(mask).astype(np.float32) / 255
    inner = np.array(mask.filter(ImageFilter.MinFilter(int(2 * SS) * 2 + 1))).astype(np.float32) / 255
    ink = np.clip(m - inner, 0, 1)
    rgb = rgb * (1 - ink[..., None]) + INK * ink[..., None]
    a = np.dstack([np.clip(rgb, 0, 255), m * 255]).astype(np.uint8)
    return Image.fromarray(a, 'RGBA').convert('RGBa').resize((Wp // SS, Hp // SS), Image.LANCZOS).convert('RGBA')


def strip(L, w0, w1, end, body, edge=None, edge_side=1, hem=None, pad=3):
    """A cloth strip hanging from its top centre: length L, widths w0 (top) and w1 (bottom), in B. `end`: 'split'
    (two points), 'point' (one point) or 'slant' (cut across). `edge`: a lining or trim colour along one side."""
    Wp, Hp = round((max(w0, w1) * BPX + 2 * pad) * SS), round((L * BPX + 2 * pad) * SS)
    cx, top, bot = Wp / 2, pad * SS, (L * BPX + pad) * SS
    a0, a1 = w0 * BPX * SS / 2, w1 * BPX * SS / 2
    d = 0.11 * L * BPX * SS
    if end == 'split': shape = [(cx - a0, top), (cx + a0, top), (cx + a1, bot), (cx + a1 * 0.2, bot - d * 0.15), (cx, bot - d), (cx - a1 * 0.2, bot - d * 0.15), (cx - a1, bot)]
    elif end == 'point': shape = [(cx - a0, top), (cx + a0, top), (cx + a1, bot - d), (cx, bot), (cx - a1, bot - d)]
    else: shape = [(cx - a0, top), (cx + a0, top), (cx + a1, bot - d), (cx - a1, bot)]
    mask = Image.new('L', (Wp, Hp), 0); ImageDraw.Draw(mask).polygon(shape, fill=255)
    ys, xs = np.mgrid[0:Hp, 0:Wp].astype(np.float32)
    v = (ys - top) / (bot - top)
    rgb = np.array(body, np.float32) * (1.08 - 0.22 * v)[..., None] * np.ones((Hp, Wp, 3), np.float32)
    fold = np.exp(-((xs - cx + 0.15 * a1 * v) / (0.18 * a1)) ** 2)[..., None]
    rgb = rgb * (1 - 0.16 * fold)
    m = np.array(mask) > 0
    if edge is not None:
        e = cx + edge_side * (a0 + (a1 - a0) * v)
        band = (np.abs(xs - (e - edge_side * 4 * SS)) < 3 * SS) & m
        rgb[band] = np.array(edge, np.float32)
    if hem is not None:
        h = Image.new('L', (Wp, Hp), 0); ImageDraw.Draw(h).line(shape[2:] + [shape[-1]] if end == 'split' else shape[2:], fill=255, width=int(3 * SS))
        hm = np.array(h).astype(np.float32) / 255 * m
        rgb = rgb * (1 - hm[..., None]) + np.array(hem, np.float32) * hm[..., None]
    im = finish(rgb, mask, Wp, Hp)
    return im, (im.width / 2, pad)


def waist():
    """A sash band with a square buckle: rigid on the hips, its pivot at the hip joint (0.027 B behind and 0.072 B
    below the band's centre, as on the Golden hips)."""
    w, h, pad = 0.17, 0.036, 3
    Wp, Hp = round((w * BPX + 2 * pad) * SS), round((h * BPX + 2 * pad) * SS)
    mask = Image.new('L', (Wp, Hp), 0); ImageDraw.Draw(mask).rounded_rectangle((pad * SS, pad * SS, Wp - pad * SS, Hp - pad * SS), radius=6 * SS, fill=255)
    ys, xs = np.mgrid[0:Hp, 0:Wp].astype(np.float32)
    rgb = np.array([150, 38, 44], np.float32) * (1.1 - 0.25 * (ys / Hp))[..., None] * np.ones((Hp, Wp, 3), np.float32)
    b = Image.new('L', (Wp, Hp), 0); cxp = Wp * 0.62
    ImageDraw.Draw(b).rectangle((cxp - 9 * SS, Hp * 0.2, cxp + 9 * SS, Hp * 0.8), outline=255, width=int(3 * SS))
    bm = np.array(b).astype(np.float32) / 255
    rgb = rgb * (1 - bm[..., None]) + np.array([200, 156, 70], np.float32) * bm[..., None]
    im = finish(rgb, mask, Wp, Hp)
    cx = im.width * 0.62
    return im, (cx - 0.027 * BPX, im.height / 2 + 0.072 * BPX)


CRIMSON, DARK, LINING, BRONZE = [150, 38, 44], [62, 56, 64], [150, 38, 44], [178, 128, 70]
PIECES = {
    'coat_tail': lambda: strip(0.27, 0.068, 0.084, 'split', DARK, edge=LINING, edge_side=1, hem=BRONZE),
    'coat_panel_near': lambda: strip(0.26, 0.06, 0.078, 'slant', CRIMSON, edge=BRONZE, edge_side=1),
    'coat_panel_far': lambda: strip(0.23, 0.05, 0.062, 'slant', [128, 32, 38], edge=BRONZE, edge_side=-1),
    'sash_end': lambda: strip(0.19, 0.03, 0.036, 'point', CRIMSON, hem=BRONZE),
    'scarf_end': lambda: strip(0.16, 0.042, 0.03, 'point', [160, 40, 46]),
    'waist_sash': waist,
}
parts = {}
for name, fn in PIECES.items():
    im, piv = fn()
    im.save(f'{W}/parts_test/{name}.png')
    parts[name] = {'w': im.width, 'h': im.height, 'pivots': [[round(piv[0], 2), round(piv[1], 2)]], 'angle': 0}
json.dump({'look': 'test', 'bpx': BPX, 'parts': parts}, open(f'{W}/parts_test.json', 'w'), indent=1)
print(json.dumps(parts))
