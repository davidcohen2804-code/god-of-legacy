"""Render an ASCII pixel grid (or part of it) big, with row / column numbers, for hand editing.
Usage: python3 show.py grid.txt out.png [k] [y0 y1 x0 x1]"""
import sys
from PIL import Image, ImageDraw
sys.path.insert(0, __file__.rsplit('/', 1)[0])
from palette import RGB

rows = [l.rstrip('\n') for l in open(sys.argv[1]) if not l.startswith('#')]
k = int(sys.argv[3]) if len(sys.argv) > 3 else 12
y0, y1, x0, x1 = (list(map(int, sys.argv[4:8])) if len(sys.argv) > 7 else [0, len(rows), 0, max(map(len, rows))])
M = 22
im = Image.new('RGB', ((x1 - x0) * k + M, (y1 - y0) * k + M), (255, 255, 255))
d = ImageDraw.Draw(im)
for y in range(y0, y1):
    for x in range(x0, x1):
        ch = rows[y][x] if x < len(rows[y]) else '.'
        c = RGB.get(ch, (236, 236, 240) if (x + y) % 2 else (226, 226, 232))
        d.rectangle([M + (x - x0) * k, M + (y - y0) * k, M + (x - x0 + 1) * k - 1, M + (y - y0 + 1) * k - 1], fill=c)
for x in range(x0, x1):
    if x % 5 == 0: d.text((M + (x - x0) * k + 1, 2), str(x), fill=(200, 0, 0))
for y in range(y0, y1):
    if y % 5 == 0: d.text((1, M + (y - y0) * k + 1), str(y), fill=(200, 0, 0))
im.save(sys.argv[2])
