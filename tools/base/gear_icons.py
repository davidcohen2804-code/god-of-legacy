# gear_icons.py : the starter gear's item icons (bag, doll, tooltips) → public/assets/items/
#   starter_sword.png — the very sword the character holds (tools/base/sword.py), laid diagonally, tip up and right;
#   starter_shirt_c<c>.png, starter_pants_c<c>.png, starter_boots_c<c>.png — from GPT's icon sheet (tools/base/gpt/
#   gear_icons.png: sword, green T-shirt, blue pants, brown boots, left to right, on magenta), each clothes icon in every
#   offered colour (outfit-colors.json) through the same light / dark ramp as the worn pieces;
#   then the doll's empty-socket glyphs for the bottom and shoes sockets (gear_doll.py) from the pants and boots icons.
import json, os, sys, subprocess, numpy as np
from PIL import Image
H = os.path.dirname(os.path.abspath(__file__))
sys.argv = [sys.argv[0], H + '/sheets/naked_male.json']
src = open(H + '/naked_frames.py').read()
__file__ = H + '/naked_frames.py'
exec(src[:src.index("def swing_grip(")])                             # figures(), keyed(), gear_ramp(), GEAR_COLORS, SWORD
OUTD = G + 'public/assets/items/'; os.makedirs(OUTD, exist_ok=True)
SIZE, PAD = 96, 6


def fit(rgba):
  """The icon on a SIZE square, centred, PAD px clear of the edges."""
  im = Image.fromarray(rgba.clip(0, 255).astype(np.uint8), 'RGBA'); k = (SIZE - 2 * PAD) / max(im.size)
  im = im.resize((max(1, round(im.width * k)), max(1, round(im.height * k))), Image.LANCZOS)
  cv = Image.new('RGBA', (SIZE, SIZE), (0, 0, 0, 0)); cv.alpha_composite(im, ((SIZE - im.width) // 2, (SIZE - im.height) // 2))
  return cv


# the sword: the held one, diagonal (MapleStory's weapon icons)
pic = SWORD.picture(); col, al = pic[0], pic[1]
im = Image.fromarray(np.dstack([col * al[..., None], al * 255]).clip(0, 255).astype(np.uint8), 'RGBA').rotate(45, Image.BICUBIC, expand=True)
w = np.asarray(im).astype(np.float32); a = w[..., 3] / 255; ys, xs = np.nonzero(a > 0.02)
w = w[ys.min():ys.max() + 1, xs.min():xs.max() + 1]; a = w[..., 3] / 255
fit(np.dstack([np.where(a[..., None] > 1e-3, w[..., :3] / np.maximum(a[..., None], 1e-3), 0), a * 255])).save(OUTD + 'starter_sword.png', optimize=True)

# the clothes: GPT's icons 2..4 (an icon may be in pieces: a pair of boots — grouped by the gaps between the icons)
if os.path.exists(H + '/gpt/gear_icons.png'):
  figs = sorted(figures('gear_icons.png'), key=lambda f: f['cx'])
  gaps = sorted(range(len(figs) - 1), key=lambda i: figs[i + 1]['box'][0] - figs[i]['box'][2])[-3:]
  groups, cur = [], [figs[0]]
  for i in range(len(figs) - 1):
    if i in gaps: groups.append(cur); cur = []
    cur.append(figs[i + 1])
  groups.append(cur)
  for grp, (name, piece) in zip(groups[1:], [('starter_shirt', 'top'), ('starter_pants', 'pants'), ('starter_boots', 'shoes')]):
    gi = grp[0]['gi']; e, a = keyed(gi); m = np.zeros(a.shape, bool)
    for f in grp: m |= f['m']
    a = np.where(nd.binary_dilation(m, iterations=2), a, 0)                          # this icon only
    ys, xs = np.nonzero(m); y0, y1, x0, x1 = ys.min(), ys.max(), xs.min(), xs.max()
    e, a = e[y0 - 2:y1 + 3, x0 - 2:x1 + 3], a[y0 - 2:y1 + 3, x0 - 2:x1 + 3]
    lum = e @ np.array([0.3, 0.59, 0.11]); cloth = (a > 0.5) & (lum >= 75)
    lo, md, hi = np.percentile(lum[cloth], 2), np.percentile(lum[cloth], 50), np.percentile(lum[cloth], 99.5)
    for ci, c in enumerate(GEAR_COLORS[piece]):
      col = gear_ramp(lum, lo, md, hi, c)
      col = np.where((lum < 75)[..., None], np.minimum(col, lum[..., None] * 0.55 + np.array(c) * 0.1), col)   # the outline stays ink
      fit(np.dstack([col, a * 255])).save(OUTD + f'{name}_c{ci}.png', optimize=True)
  subprocess.run([sys.executable, H + '/gear_doll.py'], check=True)
print('icons:', sorted(os.listdir(OUTD)))
