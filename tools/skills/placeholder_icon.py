# placeholder_icon.py <cls> <frame_from_id> <id> [<id> ...] : a "coming soon" icon for skills whose art is not made yet —
#   the gold frame of an existing icon (its gold, joined to the outer edge), a dark crimson inside and a gold "?" →
#   public/assets/final/skills/<cls>/<id>/icon.png (128 px). Replaced by the real icon when it comes (tools/skills/gpt_sheet.py).
import os, sys
import numpy as np
from PIL import Image, ImageDraw, ImageFont, ImageFilter
from scipy import ndimage

G = os.path.dirname(os.path.abspath(__file__)) + '/../../'
cls, src, ids = sys.argv[1], sys.argv[2], sys.argv[3:]
a = np.asarray(Image.open(G + f'public/assets/final/skills/{cls}/{src}/icon.png').convert('RGBA')).astype(np.float32)
r, g, b, al = a[..., 0], a[..., 1], a[..., 2], a[..., 3]
gold = (r > 120) & (g > 80) & (r - b > 50) & (g - b > 25) & (al > 200)
dark = (r + g + b < 140) & (al > 200) & ndimage.binary_dilation(al < 128, iterations=4)   # the frame's dark outline
yy0, xx0 = np.mgrid[0:a.shape[0], 0:a.shape[1]]
corner = (np.minimum(xx0, a.shape[1] - 1 - xx0) < 30) & (np.minimum(yy0, a.shape[0] - 1 - yy0) < 30)
pink = (r > 170) & (g > 110) & (b > 100) & (al > 200) & corner   # the corner blossoms
cand = gold | dark | pink
lab, _ = ndimage.label(cand)
edge = ndimage.binary_dilation(al < 128, iterations=2)                   # joined to the clear outside
frame = np.isin(lab, np.unique(lab[edge & cand])) & ndimage.binary_dilation(al < 128, iterations=22) & cand
frame = ndimage.binary_closing(frame, iterations=1)
inside = ndimage.binary_fill_holes(al > 128) & ~frame
yy, xx = np.mgrid[0:128, 0:128]
rad = np.clip(np.hypot(xx - 64, yy - 60) / 70, 0, 1)
fill = np.dstack([110 - 80 * rad, 14 - 10 * rad, 22 - 14 * rad])         # crimson in the middle, near black at the edge
out = a.copy()
out[inside, :3] = fill[inside]; out[inside, 3] = 255
im = Image.fromarray(out.round().clip(0, 255).astype(np.uint8), 'RGBA')
glyph = Image.new('RGBA', (128, 128), (0, 0, 0, 0)); d = ImageDraw.Draw(glyph)
font = ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSerif-Bold.ttf', 66)
d.text((64, 62), '?', font=font, anchor='mm', fill=(255, 214, 120, 255), stroke_width=3, stroke_fill=(60, 20, 8, 255))
glow = glyph.filter(ImageFilter.GaussianBlur(5)); glow = Image.fromarray((np.asarray(glow).astype(np.float32) * [1, 0.55, 0.2, 0.8]).clip(0, 255).astype(np.uint8), 'RGBA')
im.alpha_composite(glow); im.alpha_composite(glyph)
fr = Image.fromarray(np.where(frame[..., None], a, 0).astype(np.uint8), 'RGBA')   # the frame stays on top
im.alpha_composite(fr)
for i in ids:
    p = G + f'public/assets/final/skills/{cls}/{i}/'
    os.makedirs(p, exist_ok=True)
    im.save(p + 'icon.png', optimize=True)
    print('placeholder icon', cls, i)
