# zoom.py <area> x0 y0 x1 y1 [scale] [out] : a 25 px grid zoom of an area image for tracing floors
import sys
from PIL import Image, ImageDraw
a, x0, y0, x1, y1 = sys.argv[1], *map(int, sys.argv[2:6])
k = float(sys.argv[6]) if len(sys.argv) > 6 else 2
out = sys.argv[7] if len(sys.argv) > 7 else f'/tmp/claude-0/-home-claude-god-of-legacy/c85fc190-b33a-5bca-926c-5e9bad9c95aa/scratchpad/maps/z_{a}_{x0}_{y0}.png'
import os
src = f'tools/world/qc/{a}.png' if os.environ.get('QC') else f'tools/world/src/{a}.png'
c = Image.open(src).convert('RGB').crop((x0, y0, x1, y1)); c = c.resize((int(c.size[0] * k), int(c.size[1] * k)), Image.LANCZOS)
d = ImageDraw.Draw(c)
for x in range((x0 // 25) * 25, x1, 25):
  if x < x0: continue
  X = (x - x0) * k; d.line([(X, 0), (X, c.size[1])], fill=(0, 255, 255) if x % 100 == 0 else (0, 110, 110), width=1)
  if x % 50 == 0: d.text((X + 2, 2), str(x), fill=(255, 255, 0))
for y in range((y0 // 25) * 25, y1, 25):
  if y < y0: continue
  Y = (y - y0) * k; d.line([(0, Y), (c.size[0], Y)], fill=(0, 255, 255) if y % 100 == 0 else (0, 110, 110), width=1)
  if y % 50 == 0: d.text((2, Y + 2), str(y), fill=(255, 255, 0))
c.save(out); print(out, c.size)
