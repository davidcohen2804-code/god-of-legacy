# nosun.py : paints the sun out of every map's sky (one world has one sun: the game draws it over the sky, fixed on screen)
#   → tools/world/work/<area>_nosun.png ; strip.py also uses find_sun / unsun on GPT's join paintings.
# Only pixels brighter than the surrounding sky are pulled down, so a pillar or castle in front of the sun stays untouched.
import cv2, numpy as np, os
G = os.path.dirname(os.path.abspath(__file__)) + '/'
SUN = {'falls': (1465, 25, 31), 'courtyard': (1508, 14, 51), 'plaza': (1481, 48, 33), 'terraces': (1617, 36, 45),
       'training': (1392, 45, 32), 'ruins': (1613, 50, 35), 'temple': (1595, 77, 34)}  # centre x, y, disk radius


def find_sun(im, x0=0, x1=None):
  """The sun disk in the top of the sky between columns x0..x1: (cx, cy, R) or None."""
  top = im[:260, x0:x1].astype(np.float32)
  lum = top[..., 2] * .299 + top[..., 1] * .587 + top[..., 0] * .114
  m = ((lum > 228) & (top[..., 0] > 120)).astype(np.uint8)  # GPT paints its suns a little warmer than the maps'
  n, lab, st, cen = cv2.connectedComponentsWithStats(m, 8)
  best = None
  for i in range(1, n):
    x, y, w, h, a = st[i]
    fill, asp = a / (w * h), min(w, h) / max(w, h)
    if a < 150 or fill < 0.6 or asp < 0.7: continue  # a round disk, not a bright cloud or a glint on the water
    score = a * fill * asp
    if best is None or score > best[0]: best = (score, x + w / 2 + x0, y + h / 2, max(w, h) / 2 + 16)
  return None if best is None else best[1:]


def unsun(im, cx, cy, R):
  im = im.astype(np.float32)
  H, W = im.shape[:2]; yy, xx = np.mgrid[:H, :W]; d = np.hypot(xx - cx, yy - cy)
  lum = im[..., 2] * .299 + im[..., 1] * .587 + im[..., 0] * .114
  sky = ((lum > 150) & (d >= R * 2.2) & (d < R * 6)).astype(np.float32)  # sky around the sun, outside its halo
  s = R * 2.4
  est = cv2.GaussianBlur(im * sky[..., None], (0, 0), s) / np.maximum(cv2.GaussianBlur(sky, (0, 0), s), 1e-4)[..., None]
  wgt = np.clip(1 - (d - R * 1.1) / (R * 1.1), 0, 1)[..., None]      # full on the disk, fading out over the halo
  return im - wgt * np.maximum(0, im - est) * 0.92


if __name__ == '__main__':
  os.makedirs(G + 'work', exist_ok=True)
  for k, (cx, cy, R) in SUN.items():
    out = unsun(cv2.imread(G + f'src/{k}.png'), cx, cy, R)
    cv2.imwrite(G + f'work/{k}_nosun.png', np.clip(out, 0, 255).astype(np.uint8))
    print('nosun', k)
