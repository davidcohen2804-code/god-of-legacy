# minimap.py : the minimap's picture with the maps above in it — the strip's minimap (strip.py) with every map above
# (heights.py) laid behind the terrace where they stand, and the sky above them up to the highest one.
#   in : public/assets/world/minimap/world.jpg, strip/*.webp (their alpha), heights/*.webp, src/data/world-heights.json
#   out: public/assets/world/minimap/world_up.jpg, src/data/world-minimap.json ({top, scale})
#   python3 tools/world/minimap.py   (after strip.py / heights.py / descent.py)
import json, os
import numpy as np
from PIL import Image
G = os.path.dirname(os.path.abspath(__file__)) + '/'
R = G + '../../'
A = R + 'public/assets/world/'
S = json.load(open(R + 'src/data/world-strip.json'))
H = json.load(open(R + 'src/data/world-heights.json'))
K = 4                                              # world px per minimap px
TOP = min(h['imgY'] for h in H) - 40               # world y of the picture's top edge
W, AH = S['w'] // K, S['h'] // K
base = Image.open(A + 'minimap/world.jpg').convert('RGB').resize((W, AH), Image.LANCZOS)
oy = (-TOP) // K
out = Image.new('RGB', (W, oy + AH))
sky = np.asarray(base)[:3].reshape(-1, 3).mean(0)   # the sky above: the strip minimap's top colour, deepening upward
grad = np.linspace(0, 1, oy)[:, None] * 0.35
col = (sky * (1 - grad) + np.array([185, 138, 166]) * grad).astype(np.uint8)
out.paste(Image.fromarray(np.repeat(col[:, None, :], W, 1)), (0, 0))
out.paste(base, (0, oy))
# the strip's own alpha (where the terrace is see-through: the maps above show there)
alpha = Image.new('L', (W, AH), 0)
for i, (tx, tw) in enumerate(S['tiles']):
    t = Image.open(A + f'strip/{i}.{S["ext"]}').convert('RGBA')
    alpha.paste(t.getchannel('A').resize((max(1, t.width // K), AH), Image.LANCZOS), (tx // K, 0))
for h in sorted(H, key=lambda h: h.get('depth', -1.2)):
    im = Image.open(R + 'public/' + h['img']).convert('RGBA')
    im = im.resize((im.width // K, im.height // K), Image.LANCZOS)
    x, y = h.get('imgX', h['x']) // K, (h['imgY'] - TOP) // K
    m = np.asarray(im.getchannel('A')).astype(np.float32) / 255
    sy0, sy1 = y, y + im.height                          # under the terrace's opaque parts: hidden
    st = np.zeros_like(m)
    a0, a1 = max(sy0, oy), min(sy1, oy + AH)
    if a1 > a0:
        part = np.asarray(alpha)[a0 - oy:a1 - oy, x:x + im.width] / 255
        st[a0 - sy0:a1 - sy0, :part.shape[1]] = part
    out.paste(im.convert('RGB'), (x, y), Image.fromarray((m * (1 - st) * 255).astype(np.uint8)))
# the Sky Path's clouds (clouds.py), drawn as in the game (OpenWorld.buildSky)
C = json.load(open(R + 'src/data/world-clouds.json')); b0, b1 = C['band']
for c in C['path']:
    sp = C['sprites'][c['s']]; im = Image.open(R + 'public/' + sp['img']).convert('RGBA')
    sc = (c['x'][1] - c['x'][0] + 40) / sp['w']; sy = min(max((b1 - b0) / max(1, (sp['top'][1] - sp['top'][0]) * sc), 1), 1.7) * sc
    y = b0 - c['z'] - sp['top'][0] * sy
    if c.get('flip'): im = im.transpose(Image.FLIP_LEFT_RIGHT)
    im = im.resize((max(1, round(sp['w'] * sc / K)), max(1, round(sp['h'] * sy / K))), Image.LANCZOS)
    out.paste(im.convert('RGB'), (round((c['x'][0] - 20) / K), round((y - TOP) / K)), im.getchannel('A'))
out.save(A + 'minimap/world_up.jpg', quality=82)
open(R + 'src/data/world-minimap.json', 'w').write(json.dumps({'top': TOP, 'scale': K}) + '\n')
print('minimap', out.size, 'top', TOP)
