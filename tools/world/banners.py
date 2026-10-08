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
# (picture, x, y of the red cloth there — strip: world px —, which red: 1 bright / 2 deep)
KEEP = [('strip', 1625, 141, 1),
        ('strip', 338, 155, 1),
        ('strip', 1922, 155, 1),
        ('strip', 42, 157, 1),
        ('strip', 1083, 165, 1),
        ('strip', 594, 166, 1),
        ('strip', 1377, 168, 1),
        ('strip', 3213, 157, 1),
        ('strip', 2665, 161, 1),
        ('strip', 2959, 161, 1),
        ('strip', 2178, 165, 1),
        ('strip', 3760, 166, 1),
        ('strip', 2925, 729, 1),
        ('strip', 4248, 167, 1),
        ('strip', 4541, 169, 1),
        ('strip', 9720, 230, 1),
        ('strip', 11278, 219, 1),
        ('strip', 10894, 221, 1),
        ('strip', 11626, 224, 1),
        ('strip', 12151, 228, 1),
        ('strip', 14059, 221, 1),
        ('strip', 13727, 224, 1),
        ('strip', 13203, 228, 1),
        ('strip', 12474, 230, 1),
        ('strip', 12883, 230, 1),
        ('strip', 14489, 159, 1),
        ('strip', 17654, 160, 1),
        ('strip', 17195, 162, 1),
        ('strip', 20359, 162, 1),
        ('strip', 18777, 735, 1),
        ('strip', 20818, 160, 1),
        ('heights/crimson_heights.webp', 1499, 188, 1),
        ('heights/crimson_heights.webp', 2511, 294, 1),
        ('heights/crimson_heights.webp', 83, 300, 1),
        ('heights/ivy_heights.webp', 1918, 181, 1),
        ('heights/ivy_heights.webp', 1462, 183, 1),
        ('heights/ivy_heights.webp', 1107, 190, 1),
        ('heights/ivy_heights.webp', 87, 289, 1),
        ('heights/ivy_heights.webp', 2508, 294, 1),
        ('heights/ivy_heights.webp', 165, 309, 1),
        ('heights/ivy_heights.webp', 2403, 310, 1),
        ('heights/ivy_summit.webp', 927, 190, 1),
        ('heights/ivy_summit.webp', 87, 294, 1),
        ('heights/ivy_summit.webp', 1948, 294, 1),
        ('heights/ivy_summit.webp', 162, 309, 1),
        ('heights/ivy_summit.webp', 1843, 310, 1),
        ('heights/orchard_heights.webp', 1488, 187, 1),
        ('heights/orchard_heights.webp', 1919, 187, 1),
        ('heights/orchard_heights.webp', 2095, 187, 1),
        ('heights/orchard_heights.webp', 498, 188, 1),
        ('heights/orchard_heights.webp', 1107, 192, 1),
        ('heights/orchard_heights.webp', 664, 195, 1),
        ('heights/orchard_heights.webp', 2508, 289, 1),
        ('heights/orchard_heights.webp', 86, 294, 1),
        ('heights/orchard_heights.webp', 164, 309, 1),
        ('heights/orchard_heights.webp', 2403, 309, 1),
        ('gate/front.png', 11, 273, 1),
        ('strip', 272, 721, 2),
        ('strip', 1851, 723, 2),
        ('strip', 852, 724, 2),
        ('strip', 1342, 727, 2),
        ('strip', 3504, 149, 2),
        ('strip', 2428, 723, 2),
        ('strip', 3434, 728, 2),
        ('strip', 4829, 192, 2),
        ('strip', 5268, 197, 2),
        ('strip', 4506, 723, 2),
        ('strip', 5008, 725, 2),
        ('strip', 6870, 193, 2),
        ('strip', 7880, 198, 2),
        ('strip', 7992, 198, 2),
        ('strip', 7427, 200, 2),
        ('strip', 6515, 204, 2),
        ('strip', 6195, 206, 2),
        ('strip', 6562, 725, 2),
        ('strip', 7668, 725, 2),
        ('strip', 9359, 204, 2),
        ('strip', 10040, 218, 2),
        ('strip', 9761, 724, 2),
        ('strip', 9285, 727, 2),
        ('strip', 10562, 217, 2),
        ('strip', 11302, 723, 2),
        ('strip', 10866, 726, 2),
        ('strip', 12415, 724, 2),
        ('strip', 12920, 726, 2),
        ('strip', 14029, 726, 2),
        ('strip', 14502, 718, 2),
        ('strip', 15611, 719, 2),
        ('strip', 16051, 719, 2),
        ('strip', 20324, 718, 2),
        ('strip', 19217, 719, 2),
        ('strip', 21941, 719, 2),
        ('strip', 22416, 730, 2),
        ('strip', 23519, 727, 2),
        ('heights/crimson_heights.webp', 1909, 178, 2),
        ('heights/crimson_heights.webp', 666, 180, 2),
        ('heights/crimson_heights.webp', 1118, 206, 2),
        ('heights/crimson_heights.webp', 2414, 320, 2),
        ('heights/ivy_heights.webp', 660, 180, 2),
        ('heights/ivy_summit.webp', 1362, 180, 2),
        ('heights/orchard_heights.webp', 641, 182, 2),
        ('strip', 4008, 724, 2),
        ('strip', 6119, 725, 2),
        ('strip', 8194, 725, 2)]
SIDE, BOT, TOP = 14, 16, 4   # the patch's margin of surroundings around the cloth (picture px)


def reds(a, mode):
    r, g, b, al = a[..., 0].astype(int), a[..., 1].astype(int), a[..., 2].astype(int), a[..., 3]
    if mode == 1:
        m = (r > 110) & (r > g * 2.0) & (r > b * 1.8) & (al > 200)
        m = ndimage.binary_closing(ndimage.binary_opening(m, iterations=1), iterations=3)
    else:
        m = (r > 60) & (r > g * 2.3) & (r > b * 1.7) & (al > 200)
        m = ndimage.binary_closing(ndimage.binary_opening(m, iterations=2), iterations=2)
    lab, _ = ndimage.label(m)
    return [(sl[1].start, sl[0].start, sl[1].stop - sl[1].start, sl[0].stop - sl[0].start) for sl in ndimage.find_objects(lab)]


def place(src):
    """Where the picture stands in the world: (x, y, scale world/picture, depth layer)."""
    if src == 'strip': return 0, 0, 1, 'strip'
    kind, name = src.split('/')
    stem = name.split('.')[0]
    if kind == 'heights': h = HEIGHTS[stem]; return h['imgX'], h['imgY'], 1, 'heights:' + stem
    g = GATE['front']; return g['x'], g['y'], 1 / GATE['q'], 'gate'


def picture(src):
    if src != 'strip': return np.asarray(Image.open(A + src).convert('RGBA'))
    im = Image.new('RGBA', (STRIP['w'], STRIP['h']))   # the whole strip (a banner may cross two tiles)
    for i, (tx, _) in enumerate(STRIP['tiles']): im.alpha_composite(Image.open(A + f'strip/{i}.{STRIP["ext"]}').convert('RGBA'), (tx, 0))
    return np.asarray(im)


cache, found, patches = {}, {}, []
for src, kx, ky, mode in KEEP:
    a = cache[src] if src in cache else cache.setdefault(src, picture(src))
    rs = found[(src, mode)] if (src, mode) in found else found.setdefault((src, mode), [r for r in reds(a, mode) if r[3] >= 45])
    x, y, w, h = min(rs, key=lambda r: abs(r[0] - kx) + abs(r[1] - ky))
    if abs(x - kx) + abs(y - ky) > 60: print('far:', src, kx, ky, '->', x, y, w, h)
    if any(p['src'] == src and abs(p['bx'] - x) < 6 and abs(p['by'] - y) < 6 for p in patches): continue
    px0, py0 = max(0, x - SIDE), max(0, y - TOP)
    px1, py1 = min(a.shape[1], x + w + SIDE), min(a.shape[0], y + h + BOT)
    wx, wy, s, layer = place(src)
    patches.append({'src': src, 'bx': x, 'by': y, 'img': a[py0:py1, px0:px1], 'layer': layer, 'x': round(wx + px0 * s, 2), 'y': round(wy + py0 * s, 2), 's': s,
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
