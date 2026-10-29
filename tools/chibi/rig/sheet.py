#!/usr/bin/env python3
"""A contact sheet of rendered frames, each action a row, frames aligned on their feet anchor.
usage: sheet.py OUTDIR out.png act1,act2,... [scale]"""
import sys, json
from PIL import Image, ImageDraw
d, outp, acts = sys.argv[1], sys.argv[2], sys.argv[3].split(',')
k = float(sys.argv[4]) if len(sys.argv) > 4 else 0.35
meta = {m['name']: m for m in json.load(open(f'{d}/frames.json'))}
rows = []
for a in acts:
    names = sorted([n for n in meta if n.rsplit('-', 1)[0] == a], key=lambda n: int(n.rsplit('-', 1)[1]))
    rows.append((a, names))
CW, ABOVE, BELOW = 0, 0, 0
for a, names in rows:
    for n in names:
        m = meta[n]; CW = max(CW, m['ax'] * 2, (m['w'] - m['ax']) * 2); ABOVE = max(ABOVE, m['ay']); BELOW = max(BELOW, m['h'] - m['ay'])
cw, ch = int(CW * k * 0.62) + 10, int((ABOVE + BELOW) * k) + 22
ncol = max(len(n) for _, n in rows)
img = Image.new('RGB', (cw * ncol, ch * len(rows)), (38, 39, 46)); dr = ImageDraw.Draw(img)
for r, (a, names) in enumerate(rows):
    for c, n in enumerate(names):
        m = meta[n]; im = Image.open(f'{d}/{n}.png'); im = im.resize((max(1, int(im.width * k)), max(1, int(im.height * k))), Image.LANCZOS)
        ox = c * cw + cw // 2 - int(m['ax'] * k); oy = r * ch + 18 + int(ABOVE * k) - int(m['ay'] * k)
        dr.line([(c * cw + 4, r * ch + 18 + int(ABOVE * k)), (c * cw + cw - 4, r * ch + 18 + int(ABOVE * k))], fill=(70, 72, 84))
        img.paste(im, (ox, oy), im)
        dr.text((c * cw + 4, r * ch + 3), n, fill=(230, 220, 160))
img.save(outp); print(img.size)
