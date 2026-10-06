"""Throne hero (character select): cut the GPT painting off magenta and bake its displacement maps.
usage: throne_maps.py <gpt_image> <out_dir>
  throne.png        the hero on the throne (RGBA)
  throne_breath.png R = 0.5 + 0.5*w — chest / head lift weight (breathing)
  throne_wind_a.png / throne_wind_b.png  R = 0.5 + 0.5*w*sin/cos(wave) — the hanging cape, in quadrature (wind)
Regions are fractions of the painting (the GPT pose is fixed: seated, legs crossed, light sword on the viewer's left)."""
import sys, os
import numpy as np
from PIL import Image
from scipy import ndimage
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'ui'))
from magenta_cut import unmix

src, out = sys.argv[1], sys.argv[2]
im = Image.open(src).convert('RGB')
W, H = im.size
col, alpha = unmix(im)
core = alpha > 0.5
lab, n = ndimage.label(core)
sizes = ndimage.sum(core, lab, range(1, n + 1))
keep = np.isin(lab, 1 + np.nonzero(sizes > 2000)[0])
al = alpha * ndimage.binary_dilation(keep, iterations=3)
al = np.where(al < 0.06, 0, al)
Image.fromarray(np.dstack([col, al * 255]).astype(np.uint8), 'RGBA').save(f'{out}/throne.png', optimize=True)

MW, MH = 256, 384
yy, xx = np.mgrid[0:H, 0:W].astype(np.float32)
def ell(cx, cy, rx, ry):  # fractions of the painting
    return (((xx / W - cx) / rx) ** 2 + ((yy / H - cy) / ry) ** 2) <= 1
# breathing: chest plate + shoulders (1.0), head (0.8); soft falloff, zero at the belt and on the arms resting on sword / armrest
w = ell(0.44, 0.34, 0.15, 0.075).astype(np.float32) * 1.0
w = np.maximum(w, ell(0.445, 0.21, 0.075, 0.065).astype(np.float32) * 0.8)
w = ndimage.gaussian_filter(w, sigma=W * 0.018) * (al > 0.5)
w = ndimage.gaussian_filter(w, sigma=3)
w /= max(1e-6, w.max())
def save(name, m):
    img = Image.fromarray(np.clip(m * 255, 0, 255).astype(np.uint8), 'L').resize((MW, MH), Image.LANCZOS)
    img.convert('RGB').save(f'{out}/{name}.png', optimize=True)
save('throne_breath', 0.5 + 0.5 * w)

# wind: the red cape where it hangs free (below the armrests), stronger towards the hem
r, g, b = col[..., 0], col[..., 1], col[..., 2]
red = (r > 90) & (r > g * 1.7) & (r > b * 1.5) & (al > 0.5)
red = ndimage.binary_opening(red, iterations=2)
hang = np.clip((yy / H - 0.40) / 0.30, 0, 1)
wc = ndimage.gaussian_filter(red.astype(np.float32), sigma=4) * hang
wc = np.clip(wc * 1.4, 0, 1)
v = yy / H
for name, ph in (('throne_wind_a', 0.0), ('throne_wind_b', np.pi / 2)):
    save(name, 0.5 + 0.5 * wc * np.sin(v * np.pi * 2 * 2.2 + ph))
ys, xs = np.nonzero(al > 0.5)
print('ok', W, H, 'bbox', xs.min(), ys.min(), xs.max(), ys.max(), 'breath px', int((w > 0.1).sum()), 'cape px', int(red.sum()))
