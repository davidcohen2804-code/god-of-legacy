# icons.py [item_id ...] : shop icon of a worn head item — the item on the idle head, framed to hold the whole item and
# the whole head (square, a little margin), 128 px. Without ids: every warrior item with base layers.
import json, os, sys, numpy as np
from PIL import Image
G = os.path.dirname(os.path.abspath(__file__)) + '/../../'; S = 352
BASE = G + 'public/assets/final/body/warrior/base/'

def icon(iid):
  ly = np.array(Image.open(G + f'public/assets/final/cosmetics/warrior/{iid}/layers/base/idle.png').convert('RGBA'))[:, 0:S].copy()
  fr = np.array(Image.open(BASE + 'idle.png').convert('RGBA'))[:, 0:S].copy(); mk = np.array(Image.open(BASE + 'idle_m.png'))[:, 0:S, 0]
  mg = (ly[..., 0] == 255) & (ly[..., 1] == 0) & (ly[..., 2] == 255) & (ly[..., 3] > 0); fr[mg, 3] = 0; ly[mg] = 0
  im = Image.fromarray(fr); im.alpha_composite(Image.fromarray(ly))
  hy, hx = np.nonzero(mk[:200] == 40); iy, ix = np.nonzero(ly[..., 3] > 40)   # the head (its hair reaches the chin) + the item
  ys = np.concatenate([hy, iy]); xs = np.concatenate([hx, ix])
  y0, y1, x0, x1 = ys.min(), ys.max(), xs.min(), xs.max()
  side = int(max(y1 - y0, x1 - x0) * 1.12) + 8; cy, cx = (y0 + y1) // 2, (x0 + x1) // 2
  box = (cx - side // 2, cy - side // 2, cx - side // 2 + side, cy - side // 2 + side)
  out = G + f'public/assets/final/cosmetics/warrior/{iid}/icon.png'
  im.crop(box).resize((128, 128), Image.LANCZOS).save(out, optimize=True)
  return out

if __name__ == '__main__':
  ids = sys.argv[1:] or [x['id'] for x in json.load(open(G + 'src/data/cosmetics.json'))['classes']['warrior']
                         if x.get('layers') and not x.get('wip') and os.path.exists(G + f"public/{x['layers']}/base/idle.png")]
  for i in ids: print(icon(i))
