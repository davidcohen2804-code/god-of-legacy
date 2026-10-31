#!/usr/bin/env python3
"""QC strip: every baked move of a base folder on the game's dark background (one row per move). Usage: qc.py DIR OUT [moves]"""
import sys, json
from PIL import Image
d, out = sys.argv[1], sys.argv[2]
S = 352
moves = sys.argv[3].split(',') if len(sys.argv) > 3 else None
import os
names = [f[:-4] for f in sorted(os.listdir(d)) if f.endswith('.png') and not f.endswith('_m.png') and not f.endswith('_o.png')]
if moves: names = [n for n in moves if n in names]
rows = []
for n in names:
    im = Image.open(f'{d}/{n}.png').convert('RGBA'); k = im.width // S
    row = Image.new('RGB', (k * 220 + 90, 250), (62, 66, 76))
    for c in range(k):
        bg = Image.new('RGBA', (S, S), (62, 66, 76, 255)); bg.alpha_composite(im.crop((c * S, 0, (c + 1) * S, S)))
        row.paste(bg.convert('RGB').crop((66, 75, 286, 325)), (90 + c * 220, 0))
    from PIL import ImageDraw
    ImageDraw.Draw(row).text((8, 110), n, fill=(230, 230, 230))
    rows.append(row)
W = max(r.width for r in rows); qc = Image.new('RGB', (W, sum(r.height for r in rows)), (30, 30, 30)); y = 0
for r in rows: qc.paste(r, (0, y)); y += r.height
qc.save(out); print(out, qc.size)
