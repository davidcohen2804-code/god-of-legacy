# props.py : occluder cut-outs of the open-world areas — each prop's silhouette (its "occ" polygon in
# src/data/world-areas.json) cut from the area picture exactly as the game shows it (the JPG), soft-edged, so the prop is
# drawn over whoever stands behind it → public/assets/world/props/<area>-<prop>.png + src/data/world-props.json
# ({area: {prop: [x, y, w, h]}} in area px). Also the mist band drawn over the seam while the camera glides between areas.
import json, math, os, random
from PIL import Image, ImageDraw, ImageFilter
G = os.path.dirname(os.path.abspath(__file__)) + '/../../'
D = json.load(open(G + 'src/data/world-areas.json'))
OUT = G + 'public/assets/world/props/'; os.makedirs(OUT, exist_ok=True)
for f in os.listdir(OUT): os.remove(OUT + f)
SS = 4
meta = {}
for aid, A in D['areas'].items():
  props = [p for p in A.get('props', []) if p.get('occ')]
  if not props: continue
  pic = Image.open(G + f'public/assets/world/areas/{aid}.jpg').convert('RGB')
  for p in props:
    xs = [q[0] for q in p['occ']]; ys = [q[1] for q in p['occ']]
    x0, y0, x1, y1 = math.floor(min(xs)) - 1, math.floor(min(ys)) - 1, math.ceil(max(xs)) + 1, math.ceil(max(ys)) + 1
    w, h = x1 - x0, y1 - y0
    m = Image.new('L', (w * SS, h * SS), 0)
    ImageDraw.Draw(m).polygon([((q[0] - x0) * SS, (q[1] - y0) * SS) for q in p['occ']], fill=255)
    m = m.resize((w, h), Image.LANCZOS)
    cut = pic.crop((x0, y0, x1, y1)).convert('RGBA'); cut.putalpha(m)
    cut.save(OUT + f"{aid}-{p['id']}.png", optimize=True)
    meta.setdefault(aid, {})[p['id']] = [x0, y0, w, h]
json.dump(meta, open(G + 'src/data/world-props.json', 'w'))
print('props', {a: list(v) for a, v in meta.items()})

# mist band (vertical: 760 × 1100; drawn rotated for up / down glides)
W, H = 760, 1100
rnd = random.Random(11)
band = Image.new('RGBA', (W, H), (0, 0, 0, 0))
for _ in range(140):
  r = rnd.uniform(70, 190); x = rnd.gauss(W / 2, W * 0.16); y = rnd.uniform(-60, H + 60)
  c = rnd.choice([(255, 244, 236), (250, 232, 222), (246, 226, 214), (255, 250, 245)])
  blob = Image.new('RGBA', (int(2 * r), int(2 * r)), (0, 0, 0, 0))
  ImageDraw.Draw(blob).ellipse([0, 0, 2 * r - 1, 2 * r - 1], fill=c + (int(rnd.uniform(60, 120)),))
  band.alpha_composite(blob.filter(ImageFilter.GaussianBlur(r * 0.45)), (int(x - r), int(y - r)))
# fade the sides out (smooth across the band)
al = band.split()[3]; fade = Image.new('L', (W, H))
for x in range(W):
  t = abs(x - W / 2) / (W / 2); v = max(0.0, 1 - t) ** 1.6
  ImageDraw.Draw(fade).line([(x, 0), (x, H)], fill=int(255 * v))
from PIL import ImageChops
band.putalpha(ImageChops.multiply(al, fade))
core = Image.new('RGBA', (W, H), (0, 0, 0, 0)); cd = ImageDraw.Draw(core)
for x in range(W):   # a soft continuous veil under the blobs, so no seam line shows through
  t = abs(x - W / 2) / (W / 2); cd.line([(x, 0), (x, H)], fill=(250, 238, 228, int(215 * max(0.0, 1 - t) ** 2.2)))
core.alpha_composite(band)
os.makedirs(G + 'public/assets/world/fx', exist_ok=True)
core.save(G + 'public/assets/world/fx/mist_band.png', optimize=True)
print('mist band', core.size)
