# headqc.py [anim:col,... | weak[=0.9] | all] [out.png] : the head table drawn on the frames — the idle head's hair
# outline (cyan) and face outline (yellow) laid with each frame's transform. Where the outlines sit on the drawn head,
# every head item sits right. Default: the frames whose fit is weakest (score < 0.9) and the hand-set ones.
import json, os, sys, hashlib, numpy as np
from PIL import Image, ImageDraw
from scipy import ndimage as nd
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import headtable
G = os.path.dirname(os.path.abspath(__file__)) + '/../../'; S = 352
BASE = G + 'public/assets/final/body/warrior/base/'
t = headtable.table(verbose=False); T = headtable.template(); cx, cy = t['center']
arg = sys.argv[1] if len(sys.argv) > 1 else 'weak'
out = sys.argv[2] if len(sys.argv) > 2 else G + 'tools/base/qc/headqc.png'
seen = set(); frames = []
for a, row in t['frames'].items():
  P = np.array(Image.open(BASE + a + '.png').convert('RGBA'))
  for c, x in enumerate(row):
    if not x: continue
    h = hashlib.md5(P[:, c * S:(c + 1) * S].tobytes()).hexdigest()
    if h in seen: continue
    seen.add(h); frames.append((a, c, x))
if arg == 'all': sel = frames
elif arg.startswith('weak'):
  th = float(arg.split('=')[1]) if '=' in arg else 0.9
  sel = [f for f in frames if f[2][4] < th or f'{f[0]}:{f[1]}' in t['fixed']]
else:
  want = {tuple(x.split(':')) for x in arg.split(',')}; sel = [f for f in frames if (f[0], str(f[1])) in want]
def warp(m, tx, ty, ang, k, fl):
  if fl: m = np.roll(m[:, ::-1], int(2 * cx - (S - 1)), axis=1)
  im = Image.fromarray(m.astype(np.uint8) * 255)
  if abs(k - 1) > 1e-6:
    w = round(S * k); r = im.resize((w, w), Image.NEAREST); c2 = Image.new('L', (S, S)); c2.paste(r, (round(cx - cx * k), round(cy - cy * k))); im = c2
  return np.array(im.rotate(ang, resample=Image.NEAREST, center=(cx, cy), translate=(tx, ty))) > 127
Z = 3; W = 120; tiles = []
for a, c, x in sel:
  P = np.array(Image.open(BASE + a + '.png').convert('RGBA'))[:, c * S:(c + 1) * S]
  tx, ty, ang, k, sc, fl = x
  hh = warp(T[0], tx, ty, ang, k, fl); ff = warp(T[1], tx, ty, ang, k, fl)
  eh = hh & ~nd.binary_erosion(hh); ef = ff & ~nd.binary_erosion(ff)
  ys, xs = np.nonzero(hh); my, mx = int(ys.mean()), int(xs.mean())
  bg = Image.new('RGBA', (S, S), (60, 70, 60, 255)); bg.alpha_composite(Image.fromarray(P)); im = np.array(bg.convert('RGB'))
  im[eh] = (0, 255, 255); im[ef] = (255, 255, 0)
  crop = Image.fromarray(im).crop((mx - W // 2, my - W // 2 - 5, mx + W // 2, my + W // 2 - 5)).resize((W * Z, W * Z), Image.NEAREST)
  d = ImageDraw.Draw(crop); d.text((4, 4), f'{a}:{c}  {ang}° k{k} s{sc}{" F" if fl else ""}', fill=(255, 255, 255))
  tiles.append(crop)
cols = 4; o = Image.new('RGB', (W * Z * cols, W * Z * max(1, (len(tiles) + cols - 1) // cols)), (20, 20, 20))
for i, tl in enumerate(tiles): o.paste(tl, ((i % cols) * W * Z, (i // cols) * W * Z))
o.save(out); print(len(tiles), 'frames →', out)
