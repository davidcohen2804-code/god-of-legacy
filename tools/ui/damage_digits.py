"""Damage numbers, MapleStory style: chubby, puffy digits (Rubik Black, grown and rounded), a thick dark outline, a light
rim and a shine on top; orange for a normal hit, pink-red for a critical one.
Output: public/assets/final/ui/hud/dmg_normal.png, dmg_crit.png — one row of 20 cells: frames 0-9 the digits' fill,
10-19 their outlines (the game lays every outline first, then the fills, so the digits of a number merge into one piece) —
and src/data/damage-digits.json {cell: [w, h], widths: [fill width per digit], overlap}.
usage: python3 tools/ui/damage_digits.py
"""
import json, os
import numpy as np
from PIL import Image, ImageDraw, ImageFont
from scipy import ndimage as nd

H = os.path.dirname(os.path.abspath(__file__)); G = H + '/../../'
FONT = H + '/fonts/rubik/rubik-latin-900-normal.woff'   # (SIL Open Font License: fonts/rubik/LICENSE)
K = 3                     # drawn K x larger, then averaged down (smooth edges)
SIZE = 100                # font px in the sheet
PUFF, OUT, RIM = 0.015, 0.09, 0.03                       # x SIZE: grown (rounder, fatter), the outline, the light rim
OVERLAP = 0.06            # neighbouring digits overlap by this much of a digit's width
STYLES = {
  'normal': dict(top=(255, 248, 200), mid=(255, 204, 56), bot=(255, 124, 22), rim=(255, 244, 196), out=(58, 22, 0)),
  'crit': dict(top=(255, 232, 244), mid=(255, 104, 180), bot=(226, 18, 95), rim=(255, 214, 236), out=(74, 6, 38)),
}


def disk(r):
  r = max(1, int(round(r))); y, x = np.mgrid[-r:r + 1, -r:r + 1]
  return x * x + y * y <= r * r


font = ImageFont.truetype(FONT, SIZE * K)
pad = SIZE * K
masks = []
for d in '0123456789':                                    # every digit on the same baseline
  im = Image.new('L', (SIZE * K * 2, SIZE * K * 3), 0)
  ImageDraw.Draw(im).text((pad // 2, pad), d, font=font, fill=255)
  m = np.asarray(im) > 127
  m = nd.binary_dilation(m, structure=disk(PUFF * SIZE * K))
  masks.append(nd.gaussian_filter(m.astype(np.float32), PUFF * SIZE * K * 0.9) > 0.5)
rows = np.nonzero(np.any([m.any(1) for m in masks], 0))[0]; y0, y1 = int(rows.min()), int(rows.max())
ow = int(round(OUT * SIZE * K)); m_ = ow + 2 * K           # the outline, and a margin
boxes = []
for m in masks:
  xs = np.nonzero(m.any(0))[0]; boxes.append((int(xs.min()), int(xs.max())))
cw = max(b - a + 1 for a, b in boxes) + 2 * m_; cw += (-cw) % K
ch = (y1 - y0 + 1) + 2 * m_; ch += (-ch) % K
t = np.clip((np.arange(ch) - m_) / max(1, y1 - y0), 0, 1)[:, None]   # the gradient: the same rows for every digit


def layers(i, style):
  """Digit i's fill and outline (straight RGBA, float), cell size, the digit in the middle."""
  S = {k: np.array(v, np.float32) for k, v in STYLES[style].items()}
  m, (a, b) = masks[i], boxes[i]
  x0 = a - (cw - (b - a + 1)) // 2
  fill = np.zeros((ch, cw), bool)
  src = m[y0 - m_:y0 - m_ + ch, max(0, x0):x0 + cw]
  fill[:, max(0, -x0):max(0, -x0) + src.shape[1]] = src
  outer = nd.binary_dilation(fill, structure=disk(ow))
  inner = nd.binary_erosion(fill, structure=disk(RIM * SIZE * K))
  col = np.where((t < 0.45)[..., None], S['top'] + (S['mid'] - S['top']) * (t / 0.45)[..., None],
                 S['mid'] + (S['bot'] - S['mid']) * ((t - 0.45) / 0.55)[..., None])
  col = np.broadcast_to(col, (ch, cw, 3))
  rgb = np.zeros((ch, cw, 3), np.float32); al = np.zeros((ch, cw), np.float32)
  rgb[fill] = S['rim']; al[fill] = 1
  rgb[inner] = col[inner]
  shine = inner & (t < 0.42) & ~nd.binary_erosion(inner, structure=disk(SIZE * K * 0.09))   # a soft white shine on top
  sh = nd.gaussian_filter(shine.astype(np.float32), SIZE * K * 0.012) * inner
  rgb = rgb * (1 - 0.55 * sh[..., None]) + 255 * 0.55 * sh[..., None]
  orgb = np.zeros((ch, cw, 3), np.float32); orgb[:] = S['out']; oal = outer.astype(np.float32)
  return np.dstack([rgb, al]), np.dstack([orgb, oal])


def down(L):
  """K x K average (premultiplied) → straight RGBA uint8."""
  h, w = L.shape[0] // K, L.shape[1] // K
  pm = np.dstack([L[..., :3] * L[..., 3:4], L[..., 3:4]]).reshape(h, K, w, K, 4).mean((1, 3))
  rgb = np.where(pm[..., 3:4] > 1e-4, pm[..., :3] / np.maximum(pm[..., 3:4], 1e-4), 0)
  return np.dstack([rgb, pm[..., 3:4] * 255]).clip(0, 255).astype(np.uint8)


os.makedirs(G + 'public/assets/final/ui/hud', exist_ok=True)
for style in STYLES:
  fills, outs = zip(*[layers(i, style) for i in range(10)])
  sheet = np.concatenate([down(L) for L in list(fills) + list(outs)], 1)
  Image.fromarray(sheet, 'RGBA').save(G + f'public/assets/final/ui/hud/dmg_{style}.png', optimize=True)
widths = [round((b - a + 1) / K, 1) for a, b in boxes]
json.dump(dict(cell=[cw // K, ch // K], widths=widths, overlap=OVERLAP), open(G + 'src/data/damage-digits.json', 'w'))
print('cell', cw // K, ch // K, 'widths', widths)
