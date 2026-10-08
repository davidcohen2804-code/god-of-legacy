# banners.py : the cloth banners painted into the world's pictures sway gently in the wind.
#   Each banner (found by its red cloth in the strip tiles, the maps above and the temple gate) is cut out with a margin of
#   its own surroundings into one atlas; the game draws that patch exactly over the picture as a warped grid (OpenWorld:
#   the cloth swings more toward its tip, its top and the patch's edges stay put — no seam, nothing to repaint).
#   in : public/assets/world/strip/*.webp, heights/*.webp, gate/front.png
#   out: public/assets/world/banners.webp, src/data/world-banners.json
#   python3 tools/world/banners.py   (after strip.py / heights.py / gate.py)
import json, os
import numpy as np
from PIL import Image
from scipy import ndimage
G = os.path.dirname(os.path.abspath(__file__)) + '/'
R = G + '../../'
A = R + 'public/assets/world/'
STRIP = json.load(open(R + 'src/data/world-strip.json'))
HEIGHTS = {h['id']: h for h in json.load(open(R + 'src/data/world-heights.json'))}
GATE = json.load(open(R + 'src/data/world-gate.json'))
# the red shapes that are banners (by picture and the red cloth's top-left there); the rest is ivy, statues, runes
KEEP = [('strip/0.webp', 1625, 141), ('strip/0.webp', 338, 155), ('strip/0.webp', 1922, 155), ('strip/0.webp', 42, 157), ('strip/0.webp', 1083, 165), ('strip/0.webp', 594, 166), ('strip/0.webp', 1377, 168),
        ('strip/1.webp', 1165, 157), ('strip/1.webp', 617, 161), ('strip/1.webp', 911, 161), ('strip/1.webp', 130, 165), ('strip/1.webp', 1712, 166), ('strip/1.webp', 877, 729),
        ('strip/2.webp', 152, 167), ('strip/2.webp', 445, 169), ('strip/4.webp', 1528, 230),
        ('strip/5.webp', 1038, 219), ('strip/5.webp', 654, 221), ('strip/5.webp', 1386, 224), ('strip/5.webp', 1911, 228),
        ('strip/6.webp', 1771, 221), ('strip/6.webp', 1439, 224), ('strip/6.webp', 915, 228), ('strip/6.webp', 186, 230), ('strip/6.webp', 595, 230),
        ('strip/7.webp', 153, 159), ('strip/7.webp', 1277, 752), ('strip/8.webp', 1270, 160), ('strip/8.webp', 811, 162), ('strip/9.webp', 1927, 162), ('strip/9.webp', 345, 735), ('strip/10.webp', 338, 160),
        ('heights/crimson_heights.webp', 1499, 188), ('heights/crimson_heights.webp', 2511, 294), ('heights/crimson_heights.webp', 83, 300),
        ('heights/ivy_heights.webp', 1918, 181), ('heights/ivy_heights.webp', 1462, 183), ('heights/ivy_heights.webp', 1107, 190), ('heights/ivy_heights.webp', 87, 289), ('heights/ivy_heights.webp', 2508, 294), ('heights/ivy_heights.webp', 165, 309), ('heights/ivy_heights.webp', 2403, 310),
        ('heights/ivy_summit.webp', 927, 190), ('heights/ivy_summit.webp', 87, 294), ('heights/ivy_summit.webp', 1948, 294), ('heights/ivy_summit.webp', 162, 309), ('heights/ivy_summit.webp', 1843, 310),
        ('heights/orchard_heights.webp', 1488, 187), ('heights/orchard_heights.webp', 1919, 187), ('heights/orchard_heights.webp', 2095, 187), ('heights/orchard_heights.webp', 498, 188), ('heights/orchard_heights.webp', 1107, 192), ('heights/orchard_heights.webp', 664, 195),
        ('heights/orchard_heights.webp', 2508, 289), ('heights/orchard_heights.webp', 86, 294), ('heights/orchard_heights.webp', 164, 309), ('heights/orchard_heights.webp', 2403, 309),
        ('gate/front.png', 11, 273)]
SIDE, BOT, TOP = 14, 16, 4   # the patch's margin of surroundings around the cloth (picture px)


def reds(a):
    r, g, b, al = a[..., 0], a[..., 1], a[..., 2], a[..., 3]
    m = (r > 110) & (r > g * 2.0) & (r > b * 1.8) & (al > 200)
    m = ndimage.binary_closing(ndimage.binary_opening(m, iterations=1), iterations=3)
    lab, _ = ndimage.label(m)
    return [(sl[1].start, sl[0].start, sl[1].stop - sl[1].start, sl[0].stop - sl[0].start) for sl in ndimage.find_objects(lab)]


def place(src):
    """Where the picture stands in the world: (x, y, scale world/picture, depth layer)."""
    kind, name = src.split('/')
    stem = name.split('.')[0]
    if kind == 'strip': return STRIP['tiles'][int(stem)][0], 0, 1, 'strip'
    if kind == 'heights': h = HEIGHTS[stem]; return h['imgX'], h['imgY'], 1, 'heights:' + stem
    g = GATE['front']; return g['x'], g['y'], 1 / GATE['q'], 'gate'


cache, patches = {}, []
for src, kx, ky in KEEP:
    a = cache.setdefault(src, np.asarray(Image.open(A + src).convert('RGBA')))
    found = reds(a)
    if kx is None: x, y, w, h = max(found, key=lambda r: r[2] * r[3])
    else: x, y, w, h = min(found, key=lambda r: abs(r[0] - kx) + abs(r[1] - ky))
    px0, py0 = max(0, x - SIDE), max(0, y - TOP)
    px1, py1 = min(a.shape[1], x + w + SIDE), min(a.shape[0], y + h + BOT)
    wx, wy, s, layer = place(src)
    patches.append({'img': a[py0:py1, px0:px1], 'layer': layer, 'x': round(wx + px0 * s, 2), 'y': round(wy + py0 * s, 2), 's': s,
                    'cloth': [x - px0, y - py0, x + w - px0, y + h - py0]})

# shelf-pack into one atlas
AW, cx, cy, row = 2048, 0, 0, 0
for p in patches:
    ph, pw = p['img'].shape[:2]
    if cx + pw > AW: cx, cy, row = 0, cy + row + 2, 0
    p['at'] = [cx, cy, pw, ph]; cx += pw + 2; row = max(row, ph)
atlas = np.zeros((cy + row, AW, 4), np.uint8)
for p in patches:
    x, y, w, h = p['at']; atlas[y:y + h, x:x + w] = p['img']
Image.fromarray(atlas).save(A + 'banners.webp', lossless=True, quality=100)
out = {'w': AW, 'h': int(atlas.shape[0]), 'banners': [{k: p[k] for k in ('layer', 'x', 'y', 's', 'at', 'cloth')} for p in patches]}
open(R + 'src/data/world-banners.json', 'w').write(json.dumps(out, separators=(',', ':')) + '\n')
print(len(patches), 'banners', atlas.shape)
