# Ember Duelist on the rig vs its approved concept v2, at the same B and root.
# Usage: ember_cmp.py <lab capture dir with ember_idle_0.png [+ _iso_*.png]> <out.png> [zoom box x0,y0,x1,y1 in clip px]
# Panels: concept | lab | overlay 50/50 | concept with the lab's coat pieces outlined (from the tinted captures).
import glob, os, sys
import numpy as np
import cv2
from PIL import Image, ImageDraw, ImageFont

D, OUT = sys.argv[1], sys.argv[2]
ZOOM = [int(v) for v in sys.argv[3].split(',')] if len(sys.argv) > 3 else None
CONCEPT, CROOT, CB = '/home/claude/v4-phase4/ember_concept_v2.png', (745.1, 888.0), 731.2
LB, LROOT, CW, CH = 370.0, (310.0, 629.4), 620, 820
BG = np.array([24, 30, 42], np.float32)

src = np.array(Image.open(CONCEPT).convert('RGB')).astype(np.float32)
r, g, b = src[..., 0], src[..., 1], src[..., 2]
al = np.clip(1.0 - ((np.minimum(r, b) - g) - 70.0) / 80.0, 0.0, 1.0)
fg = np.clip(np.where(al[..., None] > 0.02, (src - (1 - al[..., None]) * np.array([255.0, 0, 255.0])) / np.maximum(al[..., None], 0.02), 0), 0, 255)
k = LB / CB
con = Image.fromarray(np.dstack([fg, al * 255]).astype(np.uint8)).convert('RGBa')
con = con.resize((round(con.width * k), round(con.height * k)), Image.LANCZOS).convert('RGBA')
T = Image.new('RGBA', (CW, CH), (0, 0, 0, 0)); T.alpha_composite(con, (round(LROOT[0] - CROOT[0] * k), round(LROOT[1] - CROOT[1] * k)))
Tb = Image.new('RGBA', (CW, CH), tuple(BG.astype(int)) + (255,)); Tb.alpha_composite(T); Tb = Tb.convert('RGB')

lab = Image.open(f'{D}/ember_idle_0.png').convert('RGB')
ov = Image.blend(Tb, lab, 0.5)
# outlines of the coat pieces (where the tinted capture differs from the plain one)
lin = np.array(Tb).copy()
base = np.array(lab).astype(np.int32)
COLS = {'hipB-back': (0, 229, 255), 'hipC-front': (57, 255, 20), 'hipD-mid': (255, 230, 0), 'sashE-front': (255, 61, 240), 'neckA-scarf': (255, 255, 255)}
legend = []
for p in sorted(glob.glob(f'{D}/ember_idle_0_iso_*.png')):
    nm = p.split('_iso_')[1][:-4]
    t = np.array(Image.open(p).convert('RGB')).astype(np.int32)
    m = (np.abs(t - base).sum(2) > 60).astype(np.uint8)
    m = cv2.morphologyEx(m, cv2.MORPH_OPEN, np.ones((2, 2), np.uint8))
    cs, _ = cv2.findContours(m, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_NONE)
    cv2.drawContours(lin, cs, -1, COLS.get(nm, (255, 128, 0)), 2)
    legend.append((nm, COLS.get(nm, (255, 128, 0))))
lin = Image.fromarray(lin)

panels = [(Tb, 'concept v2 (same B, same root)'), (lab, 'lab: Ember Duelist on the rig'), (ov, 'overlay 50/50'), (lin, 'concept + lab coat pieces (outlines)')]
if ZOOM:
    x0, y0, x1, y1 = ZOOM; z = 2
    panels = [(im.crop(ZOOM).resize(((x1 - x0) * z, (y1 - y0) * z), Image.LANCZOS), lab_) for im, lab_ in panels]
W_, H_ = panels[0][0].size
sheet = Image.new('RGB', (len(panels) * (W_ + 10) - 10, H_ + 50), (14, 18, 26)); d = ImageDraw.Draw(sheet)
f = ImageFont.truetype('/usr/share/fonts/opentype/inter/Inter-Regular.otf', 15)
for i, (im, lab_) in enumerate(panels):
    sheet.paste(im, (i * (W_ + 10), 26)); d.text((i * (W_ + 10) + 6, 5), lab_, font=f, fill=(230, 230, 230))
x = 6
for nm, c in legend:
    d.rectangle((x, H_ + 32, x + 14, H_ + 44), fill=c); d.text((x + 18, H_ + 30), nm, font=f, fill=(230, 230, 230)); x += 30 + 9 * len(nm)
sheet.save(OUT); print(OUT, sheet.size)
