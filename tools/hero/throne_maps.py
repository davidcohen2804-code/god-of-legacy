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

MW, MH = 512, 768   # half resolution; BOX filter (no ringing -> no stray displacement on still pixels)
yy, xx = np.mgrid[0:H, 0:W].astype(np.float32)
def ell(cx, cy, rx, ry):  # fractions of the painting
    return (((xx / W - cx) / rx) ** 2 + ((yy / H - cy) / ry) ** 2) <= 1
# breathing: chest plate (1.0) and face (0.7) only, weights reach zero INSIDE the figure, so the throne behind the
# head / shoulders never moves (a pixel at distance d from a zero-weight pixel is displaced by < d)
w = ell(0.44, 0.345, 0.12, 0.06).astype(np.float32) * 1.0
w = np.maximum(w, ell(0.447, 0.205, 0.042, 0.045).astype(np.float32) * 0.7)
w = ndimage.gaussian_filter(w, sigma=W * 0.012)
w = np.where(ell(0.44, 0.345, 0.15, 0.08) | ell(0.447, 0.205, 0.055, 0.058), w, 0)
w /= max(1e-6, w.max())
def save(name, m):
    img = Image.fromarray(np.clip(np.round(m * 255), 0, 255).astype(np.uint8), 'L').resize((MW, MH), Image.BOX)
    img.convert('RGB').save(f'{out}/{name}.png', optimize=True)
save('throne_breath', 0.5 + 0.5 * w)

# wind: only the cloth moves. Cloth = red-hue pixels (+ the gold embroidery they enclose) inside hand-drawn regions of
# THIS painting (the left lion banner, the right cape) minus the right armrest pillar. O = every other opaque pixel
# (throne, armour, sword). The weight fades to zero within 20 px of O, so no throne / armour pixel moves and no cloth
# pixel can pull throne pixels in; where the cloth borders the transparent background the hem keeps full weight.
from PIL import ImageDraw
REGIONS = [  # painting px (1024x1536)
    [(266, 835), (330, 820), (400, 835), (455, 850), (452, 1000), (447, 1150), (447, 1268), (400, 1265), (330, 1245),
     (285, 1205), (266, 1185)],                                                         # left lion banner
    [(600, 640), (800, 640), (870, 660), (920, 720), (960, 850), (1000, 1000), (1015, 1150), (1024, 1300), (1024, 1440),
     (600, 1440)],                                                                      # right cape (all of it)
]
CUT: list = []   # (the cape also hangs in front of the lower right pillar, so the pillar is separated by colour)
reg = Image.new('L', (W, H), 0); dr = ImageDraw.Draw(reg)
for poly in REGIONS: dr.polygon(poly, fill=255)
for poly in CUT: dr.polygon(poly, fill=0)
reg = np.array(reg) > 0
# cape red: g/r ~0.13-0.24, b/r ~0.12-0.16; copper armour / throne stone / gold: g/r ~0.6-0.7 (measured on the painting)
r, g, b = col[..., 0], col[..., 1], col[..., 2]
rr = np.maximum(r, 1)
redcloth = (g / rr < 0.36) & (b / rr < 0.36) & (r > 50) & (al > 0.5)
red = ndimage.binary_opening(redcloth & reg, iterations=1)
cloth = ndimage.binary_closing(red, iterations=12) & (al > 0.5) & reg                 # embroidery inside the cloth
cloth = ndimage.binary_fill_holes(cloth) & (al > 0.5) & reg
# gold fringe / embroidery specks at the hem (not enclosed, so fill_holes misses them) belong to the cloth too:
# small non-red pieces inside the cloth regions that touch the cloth
rest = (al > 0.5) & ~cloth & reg
lab, n = ndimage.label(rest)
if n:
    sizes = ndimage.sum(rest, lab, range(1, n + 1))
    touch = ndimage.maximum(ndimage.binary_dilation(cloth, iterations=2), lab, range(1, n + 1))
    small = np.isin(lab, 1 + np.nonzero((sizes < 900) & (touch > 0))[0])
    cloth |= small
O = (al > 0.5) & ~cloth
dO = ndimage.distance_transform_edt(~O)
near = (dO / 20.0).clip(0, 1); near = near * near * (3 - 2 * near)
zone = cloth | (ndimage.binary_dilation(cloth, iterations=10) & (al <= 0.5))   # cloth + a margin of background at the hem
hang = np.clip((yy / H - 0.40) / 0.30, 0, 1)
wc = ndimage.gaussian_filter((zone * hang).astype(np.float32), sigma=3) * near * zone
v = yy / H
for name, ph in (('throne_wind_a', 0.0), ('throne_wind_b', np.pi / 2)):
    save(name, 0.5 + 0.5 * wc * np.sin(v * np.pi * 2 * 2.2 + ph))
if os.environ.get('DEBUG_DIR'):
    Image.fromarray((O * 255).astype(np.uint8), 'L').save(os.path.join(os.environ['DEBUG_DIR'], 'still_mask.png'))
ys, xs = np.nonzero(al > 0.5)
print('ok', W, H, 'bbox', xs.min(), ys.min(), xs.max(), ys.max(), 'breath px', int((w > 0.1).sum()), 'cape px', int(red.sum()))
