# Pack BASE-01 for the studio: every piece the builder cut (the body, the grip hands, each item) on one atlas page at
# 512 px per B, plus the data the runtime reads (frames with pivots and strip rows, the rig measured on the master, the
# items with their pieces).
# Usage: pack.py <build dir> <out dir>
import json, os, sys
from PIL import Image

BUILD, OUT = sys.argv[1], sys.argv[2]
P = json.load(open(os.path.join(BUILD, 'parts.json')))
frames = []
for name, f in P['frames'].items():
    im = Image.open(os.path.join(BUILD, name + '.png')).convert('RGBA')
    frames.append((name, im, f['pivot'], {'rows': f['rows']} if 'rows' in f else {}))


def pack(W):
    page = Image.new('RGBA', (W, W), (0, 0, 0, 0))
    x = y = shelf = 0
    out = []
    for name, im, piv, extra in sorted(frames, key=lambda f: -f[1].height):
        w, h = im.width + 2, im.height + 2
        if x + w > W: x, y, shelf = 0, y + shelf, 0
        if y + h > W: return None, None
        page.alpha_composite(im, (x + 1, y + 1))
        out.append({'name': name, 'x': x + 1, 'y': y + 1, 'w': im.width, 'h': im.height,
                    'px': round(piv[0] / im.width, 5), 'py': round(piv[1] / im.height, 5), **extra})
        x += w; shelf = max(shelf, h)
    H = 1
    while H < y + shelf: H *= 2
    return page.crop((0, 0, W, H)), out


for W in (1024, 2048, 4096):
    page, out = pack(W)
    if page is not None: break
os.makedirs(OUT, exist_ok=True)
page.save(os.path.join(OUT, 'base01.png'), optimize=True)
json.dump({'id': 'base01', 'bpx': P['bpx'], 'frames': out, 'rig': P['rig'], 'items': P['items'], 'report': P.get('report', [])},
          open(os.path.join(OUT, 'base01.json'), 'w'), indent=1)
print('frames', len(out), 'page', page.size)
