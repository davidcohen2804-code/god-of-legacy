# bg.py : the far landscape behind the terrace, painted by GPT in parts (tools/world/layers/bg/part1.png, part2.png, ...;
# every part after the first is GPT's continuation of the canvas `next` made from the parts before it).
#   python3 tools/world/bg.py next   → tools/world/next/bg_part<n>.png : the last KEEP px of the landscape so far, the rest
#                                      magenta, for GPT to continue (send it with the continuation request)
#   python3 tools/world/bg.py build  → tools/world/layers/bg.png : the parts joined (each continuation laid exactly over its
#                                      canvas, its colours pulled onto the part before, blended in over the kept stretch)
# then tools/world/strip.py (the game scrolls this picture slower than the terrace; its ends meet the world's ends).
import os, sys, glob
import numpy as np, cv2
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from nosun import find_sun, unsun

G = os.path.dirname(os.path.abspath(__file__)) + '/'
AW, AH = 1672, 941
KEEP = 560
PARTS = sorted(glob.glob(G + 'layers/bg/part*.png'), key=lambda p: int(os.path.basename(p)[4:-4]))


def load(p):
  im = cv2.imread(p)
  if im.shape[:2] != (AH, AW): im = cv2.resize(im, (AW, AH), interpolation=cv2.INTER_AREA if im.shape[1] > AW else cv2.INTER_CUBIC)
  sun = find_sun(im)
  if sun: print('sun painted out:', os.path.basename(p), [round(v) for v in sun]); im = unsun(im, *sun)
  return im.astype(np.float32)


def register(img, ref, keep):
  """img laid exactly over ref, matched on ref's kept columns (GPT may return it a few px off or resized)."""
  sift = cv2.SIFT_create(6000)
  m = np.zeros((AH, AW), np.uint8); m[:, :keep - 12] = 255
  g = lambda x: cv2.cvtColor(np.clip(x, 0, 255).astype(np.uint8), cv2.COLOR_BGR2GRAY)
  k1, d1 = sift.detectAndCompute(g(ref), m)
  k2, d2 = sift.detectAndCompute(g(img), None)
  good = [a for a, b in cv2.BFMatcher().knnMatch(d2, d1, k=2) if a.distance < 0.72 * b.distance]
  if len(good) < 12: print('   few matches to align:', len(good), '(left as it is)'); return img
  src = np.float32([k2[a.queryIdx].pt for a in good]); dst = np.float32([k1[a.trainIdx].pt for a in good])
  T, inl = cv2.estimateAffine2D(src, dst, method=cv2.RANSAC, ransacReprojThreshold=3, maxIters=5000)
  print(f'   aligned: {int(inl.sum())}/{len(good)} matches, scale {T[0, 0]:.3f} {T[1, 1]:.3f}, shift {T[0, 2]:.1f} {T[1, 2]:.1f}')
  return cv2.warpAffine(img, T, (AW, AH), flags=cv2.INTER_CUBIC, borderMode=cv2.BORDER_REPLICATE).astype(np.float32)


def build():
  if not PARTS: sys.exit('no parts yet: tools/world/layers/bg/part1.png')
  pano = load(PARTS[0])
  for p in PARTS[1:]:
    print('joining', os.path.basename(p))
    ref = np.full((AH, AW, 3), (255, 0, 255), np.float32); ref[:, :KEEP] = pano[:, -KEEP:]
    img = register(load(p), ref, KEEP)
    # colours: GPT re-paints the kept stretch a little differently — pull the whole part onto the landscape so far by the
    # difference measured over that stretch (per row, smooth), fading out across the part
    d = (pano[:, -KEEP + 20:-20] - img[:, 20:KEEP - 20]).mean(1)
    d = cv2.GaussianBlur(d[:, None, :], (0, 0), sigmaX=1, sigmaY=25)[:, 0, :]
    fade = np.clip(1 - (np.arange(AW, dtype=np.float32) - KEEP) / AW, 0, 1)[None, :, None]
    img = np.clip(img + d[:, None, :] * np.where(np.arange(AW)[None, :, None] < KEEP, 1, fade), 0, 255)
    # blend over the kept stretch: from the old landscape to the new part (smooth), then the new part on
    t = np.clip((np.arange(KEEP, dtype=np.float32) - 60) / (KEEP - 120), 0, 1); w = (t * t * (3 - 2 * t))[None, :, None]
    joined = pano[:, -KEEP:] * (1 - w) + img[:, :KEEP] * w
    pano = np.concatenate([pano[:, :-KEEP], joined, img[:, KEEP:]], axis=1)
  cv2.imwrite(G + 'layers/bg.png', np.clip(pano, 0, 255).astype(np.uint8))
  print('backdrop', pano.shape[1], 'x', AH, 'from', len(PARTS), 'parts → tools/world/layers/bg.png')


def nxt():
  if not PARTS: sys.exit('no parts yet: tools/world/layers/bg/part1.png')
  build()
  pano = cv2.imread(G + 'layers/bg.png')
  c = np.full((AH, AW, 3), (255, 0, 255), np.uint8); c[:, :KEEP] = pano[:, -KEEP:]
  os.makedirs(G + 'next', exist_ok=True)
  out = G + f'next/bg_part{len(PARTS) + 1}.png'; cv2.imwrite(out, c); print('continuation canvas →', out)


if __name__ == '__main__':
  {'build': build, 'next': nxt}[sys.argv[1] if len(sys.argv) > 1 else 'build']()
