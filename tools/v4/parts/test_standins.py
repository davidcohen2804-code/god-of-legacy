# Lab-only stand-in art for rule tests (not designs): coat tails for a top's hip chain, so a top's chain and the
# trousers' chain (the Golden tabard) can be tested worn together before any coat is drawn. Plain shapes: a charcoal
# split tail with a crimson lining edge and a bronze hem, outlined like the parts.
# Usage: test_standins.py <work dir>  → <work>/parts_test/coat_tail.png and <work>/parts_test.json (B = 512 px)
import json, os, sys
import numpy as np
from PIL import Image, ImageDraw, ImageFilter

W = sys.argv[1]
BPX, SS = 512, 4  # atlas px per B; supersampling
os.makedirs(f'{W}/parts_test', exist_ok=True)


def coat_tail():
    L, w0, w1, notch = 0.27, 0.068, 0.084, 0.032  # length, width at the top and at the hem, depth of the split (B)
    pad = 3
    Wp, Hp = round((w1 * BPX + 2 * pad) * SS), round((L * BPX + 2 * pad) * SS)
    cx, top, bot = Wp / 2, pad * SS, (L * BPX + pad) * SS
    hw0, hw1, nd = w0 * BPX * SS / 2, w1 * BPX * SS / 2, notch * BPX * SS
    # the outline: a tapered strip, split at the hem into two points
    shape = [(cx - hw0, top), (cx + hw0, top), (cx + hw1, bot), (cx + hw1 * 0.2, bot - nd * 0.15), (cx, bot - nd),
             (cx - hw1 * 0.2, bot - nd * 0.15), (cx - hw1, bot)]
    mask = Image.new('L', (Wp, Hp), 0); ImageDraw.Draw(mask).polygon(shape, fill=255)
    m = np.array(mask).astype(np.float32) / 255
    ys, xs = np.mgrid[0:Hp, 0:Wp].astype(np.float32)
    v = (ys - top) / (bot - top)
    # charcoal cloth, lighter at the top, a soft fold down the middle and a darker side
    rgb = np.zeros((Hp, Wp, 3), np.float32)
    base = np.array([62, 56, 64], np.float32) * (1.08 - 0.22 * v)[..., None]
    fold = np.exp(-((xs - cx + 0.15 * hw1 * v) / (0.18 * hw1)) ** 2)[..., None]
    side = np.clip((xs - cx) / hw1, -1, 1)[..., None]
    rgb[:] = base * (1 - 0.18 * fold) * (1 - 0.10 * side)
    # crimson lining along the inner (front) edge, bronze hem along the split
    edge_r = cx + (hw0 + (hw1 - hw0) * v)
    lining = (xs > edge_r - 5 * SS) & (m > 0)
    rgb[lining] = np.array([150, 38, 44], np.float32) * (1.05 - 0.2 * v[lining])[..., None]
    hem = Image.new('L', (Wp, Hp), 0)
    ImageDraw.Draw(hem).line(shape[2:] + [shape[-1]], fill=255, width=int(3 * SS))
    hm = np.array(hem).astype(np.float32) / 255 * m
    rgb = rgb * (1 - hm[..., None]) + np.array([178, 128, 70], np.float32) * hm[..., None]
    # outline: the mask's edge band, 2 px
    inner = np.array(mask.filter(ImageFilter.MinFilter(int(2 * SS) * 2 + 1))).astype(np.float32) / 255
    ink = np.clip(m - inner, 0, 1)
    rgb = rgb * (1 - ink[..., None]) + np.array([26, 22, 28], np.float32) * ink[..., None]
    a = np.dstack([np.clip(rgb, 0, 255), m * 255]).astype(np.uint8)
    im = Image.fromarray(a, 'RGBA').convert('RGBa').resize((Wp // SS, Hp // SS), Image.LANCZOS).convert('RGBA')
    return im, (im.width / 2, pad)


parts = {}
for name, fn in (('coat_tail', coat_tail),):
    im, piv = fn()
    im.save(f'{W}/parts_test/{name}.png')
    parts[name] = {'w': im.width, 'h': im.height, 'pivots': [[round(piv[0], 2), round(piv[1], 2)]], 'angle': 0}
json.dump({'look': 'test', 'bpx': BPX, 'parts': parts}, open(f'{W}/parts_test.json', 'w'), indent=1)
print(json.dumps(parts))
