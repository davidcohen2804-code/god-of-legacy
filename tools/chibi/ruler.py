import sys, json
from PIL import Image, ImageDraw
d0 = sys.argv[1]; names = sys.argv[2].split(','); out = sys.argv[3]; sheet = sys.argv[4]
P = {p['name']: p for p in json.load(open(f'{d0}/pieces.json'))}
sh = Image.open(sheet).convert('RGB')
crops = []
for n in names:
    x0, y0, x1, y1 = P[n]['crop']; crops.append((n, (x0, y0, x1, y1), sh.crop((x0, y0, x1, y1))))
W = sum(c[2].width for c in crops) + 70 * len(crops); H = max(c[2].height for c in crops) + 60
o = Image.new('RGB', (W, H), (40, 40, 46)); d = ImageDraw.Draw(o); x = 50
for n, (x0, y0, x1, y1), im in crops:
    o.paste(im, (x, 40)); d.text((x, 4), f'{n} x{x0}-{x1} y{y0}-{y1}', fill=(255, 255, 0))
    for yy in range((y0 // 10 + 1) * 10, y1, 10):
        L = 10 if yy % 50 == 0 else 5
        d.line([(x - L, 40 + yy - y0), (x, 40 + yy - y0)], fill=(255, 80, 80))
        if yy % 50 == 0: d.text((x - 40, 34 + yy - y0), str(yy), fill=(255, 200, 200))
    for xx in range((x0 // 10 + 1) * 10, x1, 10):
        L = 10 if xx % 50 == 0 else 5
        d.line([(x + xx - x0, 40 - L), (x + xx - x0, 40)], fill=(255, 80, 80))
        if xx % 50 == 0: d.text((x + xx - x0 - 12, 18), str(xx), fill=(255, 200, 200))
    x += im.width + 70
o.save(out); print(o.size)
