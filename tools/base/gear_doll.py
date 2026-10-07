# gear_doll.py : the inventory's equipment doll with the starter gear's sockets in its left column, head to toe —
#   weapon (sword socket), top (armour socket), bottom (was gloves: a pants glyph), shoes (was a ring: a boots glyph).
#   public/assets/final/ui/kit/doll_panel.png → doll_panel_gear.png. The new glyphs are the pants / boots item icons
#   (gear_icons.py) turned into the panel's dark metal look (its grey range, a cool tint); the old glyph under them is
#   painted out with the socket's own background.
import numpy as np
from PIL import Image
from scipy import ndimage as nd
import os
G = os.path.dirname(os.path.abspath(__file__)) + '/../../'
K = G + 'public/assets/final/ui/kit/'
panel = np.asarray(Image.open(K + 'doll_panel.png').convert('RGBA')).astype(np.float32)
H, W = panel.shape[:2]
yy, xx = np.mgrid[0:H, 0:W]


def glyph(art, box):
  """Our art (RGBA) as a socket glyph fitting box px: its light / dark mapped into the painted glyphs' grey range."""
  a = art[..., 3] / 255.0
  ys, xs = np.nonzero(a > 0.1); art = art[ys.min():ys.max() + 1, xs.min():xs.max() + 1]
  im = Image.fromarray(art.astype(np.uint8), 'RGBA'); k = box / max(im.size)
  im = np.asarray(im.resize((max(1, round(im.width * k)), max(1, round(im.height * k))), Image.LANCZOS)).astype(np.float32)
  lum = im[..., :3] @ np.array([0.3, 0.59, 0.11]); al = im[..., 3] / 255.0
  v = lum[al > 0.5]; lo, hi = np.percentile(v, 3), np.percentile(v, 97)
  t = np.clip((lum - lo) / max(1, hi - lo), 0, 1)
  rgb = np.stack([46 + 58 * t, 49 + 60 * t, 56 + 62 * t], -1)                 # the painted glyphs: dark cool grey metal
  edge = (al > 0.5) & ~nd.binary_erosion(al > 0.5, iterations=1)
  rgb[edge] *= 0.55                                                            # their dark rim
  return rgb, al


def repaint(cx, cy, rgb, al):
  disc = np.hypot(xx - cx, yy - cy) <= 29
  lum = panel[..., :3] @ np.array([0.3, 0.59, 0.11])
  old = disc & (lum > 30)                                                      # the old glyph (the socket is dark navy)
  old = nd.binary_dilation(old, iterations=2) & disc
  keep = disc & ~old
  w = nd.gaussian_filter(keep.astype(np.float32), 6)
  bg = np.stack([nd.gaussian_filter(np.where(keep, panel[..., c], 0), 6) for c in range(3)], -1) / np.maximum(w, 1e-3)[..., None]
  panel[..., :3] = np.where(old[..., None], bg, panel[..., :3])
  h, w_ = al.shape; y0, x0 = int(round(cy - h / 2)), int(round(cx - w_ / 2))
  reg = panel[y0:y0 + h, x0:x0 + w_]
  reg[..., :3] = reg[..., :3] * (1 - al[..., None]) + rgb * al[..., None]


I = G + 'public/assets/items/'                                   # the item icons (gear_icons.py)
pants = np.asarray(Image.open(I + 'starter_pants_c0.png').convert('RGBA')).astype(np.float32)
boots = np.asarray(Image.open(I + 'starter_boots_c0.png').convert('RGBA')).astype(np.float32)
repaint(79, 372, *glyph(pants, 44))
repaint(85, 464, *glyph(boots, 42))
Image.fromarray(panel.clip(0, 255).astype(np.uint8), 'RGBA').save(K + 'doll_panel_gear.png', optimize=True)
print('doll_panel_gear.png')
