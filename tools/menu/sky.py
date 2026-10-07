# sky.py : the main menu painting's own clouds made to drift (public/assets/MainMenu_Background_1920x1080.png →
#   public/assets/final/menu/sky_layer.webp  the sky band, its non-sky parts (tree, castle, the sun's disc) filled with
#                                             sky, padded left and right — the game slides it slowly to and fro
#   public/assets/final/menu/sky_mask.png    where the sky is (alpha, feathered) — it stays put: the clouds slide behind
#                                             the tree, the mountains and the castle; the sun stays where it is
#   src/data/menu-sky.json                    the band height, the padding and how far the clouds slide (painting px)
# python3 tools/menu/sky.py
import json, os
import numpy as np, cv2

G = os.path.dirname(os.path.abspath(__file__)) + '/'
R = G + '../../'
SRC = R + 'public/assets/MainMenu_Background_1920x1080.png'
OUT = R + 'public/assets/final/menu/'
BAND, PAD = 270, 64                 # rows of sky worked on; padding each side
SWAY = 20                           # the most the clouds slide either way (px): the sun's glow stays on the sun
SUN = (1588, 211)                   # the sun's disc in the painting

im = cv2.imread(SRC)
W = im.shape[1]
band = im[:BAND].copy()
hsv = cv2.cvtColor(band, cv2.COLOR_BGR2HSV).astype(np.float32)
Hc, S, V = hsv[..., 0], hsv[..., 1], hsv[..., 2]
L = cv2.cvtColor(band, cv2.COLOR_BGR2LAB)[..., 0].astype(np.float32)
yy, xx = np.mgrid[0:BAND, 0:W]
u8 = lambda m: m.astype(np.uint8)

# the tree (top left): yellow-green / olive leaves, dark brown branches
tree = (xx < 1000) & (((Hc >= 12) & (Hc <= 48) & (S > 70)) | ((V < 70) & (Hc >= 4) & (Hc <= 40) & (S > 60)))
# the castle (right): dark against the bright sunset sky, standing on the ground (dark clouds float free of it)
dark = cv2.morphologyEx(u8((xx > 1640) & (L < 115)), cv2.MORPH_CLOSE, np.ones((3, 3), np.uint8))
n, lab, st, _ = cv2.connectedComponentsWithStats(dark, 8)
castle = cv2.morphologyEx(u8(np.isin(lab, [i for i in range(1, n) if st[i][1] + st[i][3] >= BAND - 2])), cv2.MORPH_CLOSE, np.ones((7, 7), np.uint8)) > 0
# its red pennants (on the spires' tips, out in the sky)
red = (xx > 1640) & ((Hc <= 8) | (Hc >= 168)) & (S > 110) & (V > 70)
castle |= cv2.dilate(u8(red), np.ones((5, 5), np.uint8)) > 0
sun = np.hypot(xx - SUN[0], yy - SUN[1]) < 26

# where the sky slides: away from the tree (its leaves thick with sky between: that sky stays), around the castle and
# the sun's disc, above the mountains (the rows they never reach, by x — eased between)
def ease(x, x0, x1, a, b): t = np.clip((x - x0) / (x1 - x0), 0, 1); t = t * t * (3 - 2 * t); return a + (b - a) * t
y0 = np.where(xx < 1500, ease(xx, 1300, 1500, 148, 192), ease(xx, 1640, 1720, 192, 172))
y1 = y0 + 22
rows = np.clip((y1 - yy) / (y1 - y0), 0, 1)
m_tree = 1 - np.clip(cv2.GaussianBlur(cv2.dilate(u8(tree), np.ones((81, 81), np.uint8)).astype(np.float32), (0, 0), 8), 0, 1)
m_hard = 1 - np.clip(cv2.GaussianBlur(cv2.dilate(u8(castle | sun), np.ones((7, 7), np.uint8)).astype(np.float32), (0, 0), 1.5), 0, 1)
mask = m_tree * m_hard * rows

# the layer: the band with its non-sky parts filled from the sky around them (only sky ever slides into view)
hole = cv2.dilate(u8(tree | castle | sun), np.ones((9, 9), np.uint8)) * 255
fill = cv2.inpaint(band, hole, 9, cv2.INPAINT_TELEA)
layer = cv2.copyMakeBorder(fill, 0, 0, PAD, PAD, cv2.BORDER_REFLECT)
os.makedirs(OUT, exist_ok=True)
cv2.imwrite(OUT + 'sky_layer.webp', layer, [cv2.IMWRITE_WEBP_QUALITY, 92])
rgba = np.dstack([np.full((BAND, W, 3), 255, np.uint8), np.clip(mask * 255 + 0.5, 0, 255).astype(np.uint8)])
cv2.imwrite(OUT + 'sky_mask.png', rgba)
json.dump({'band': BAND, 'pad': PAD, 'sway': SWAY}, open(R + 'src/data/menu-sky.json', 'w'))
print('sky layer', layer.shape[1], 'x', layer.shape[0], '| sliding share of the band', round(float(mask.mean()), 3))
