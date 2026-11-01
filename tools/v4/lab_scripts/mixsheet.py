# Mixed-equipment sheet: rows = looks, columns = (anim, index) moments from probe4 captures.
import json, sys
from PIL import Image, ImageDraw, ImageFont
d, outp = sys.argv[1], sys.argv[2]
rows = [r.split('=') for r in sys.argv[3].split(';')]          # look=label
cols = [c.split(':') for c in sys.argv[4].split(',')]          # anim:index
crop = tuple(map(int, sys.argv[5].split(','))); tw = int(sys.argv[6]); title = sys.argv[7] if len(sys.argv) > 7 else ''
f = ImageFont.truetype('/usr/share/fonts/opentype/inter/Inter-Regular.otf', 14)
fb = ImageFont.truetype('/usr/share/fonts/opentype/inter/Inter-Regular.otf', 17)
meta = {}
for a in set(c[0] for c in cols):
    for m in json.load(open(f'{d}/meta_{a}.json')): meta[m['name']] = m
th = round(tw * (crop[3] - crop[1]) / (crop[2] - crop[0])); LW = 230; top = 44 if title else 30
sh = Image.new('RGB', (LW + len(cols) * (tw + 4), top + len(rows) * (th + 6)), (20, 26, 38)); dr = ImageDraw.Draw(sh)
if title: dr.text((10, 10), title, font=fb, fill=(230, 230, 230))
for j, (a, k) in enumerate(cols):
    m = meta[f'{rows[0][0]}_{a}_{k}']; dr.text((LW + j * (tw + 4) + 4, top - 22), f'{a} {m["t"]:.2f} s', font=f, fill=(200, 200, 200))
for i, (look, label) in enumerate(rows):
    y = top + i * (th + 6)
    for li, line in enumerate(label.split('|')): dr.text((10, y + th // 2 - 20 + li * 20), line, font=f, fill=(230, 230, 230))
    for j, (a, k) in enumerate(cols):
        im = Image.open(f'{d}/{look}_{a}_{k}.png').convert('RGB').crop(crop).resize((tw, th), Image.LANCZOS)
        sh.paste(im, (LW + j * (tw + 4), y))
sh.save(outp); print(sh.size)
