# A picture of the body template: the base body drawing with the skeleton measured on it (joints, bones), each limb's
# strip (the band that bends, its joint rows, the round ends), the overlap zones (shoulder and hip discs, the soft cuts
# at the wrists, ankles and across the hips) and the attachment points (the grip in each hand, the hat, the back).
# Usage: template_sheet.py <template dir> <t1.json> <out.png>
import json, math, sys
import numpy as np
from PIL import Image, ImageDraw

TDIR, DATA, OUT = sys.argv[1:4]
T = json.load(open(f'{TDIR}/template.json'))
R = json.load(open(DATA))['rig']
J = {n: np.array(p, float) for n, p in T['joints'].items()}
BPX = T['bpx']
src = Image.open(f"{TDIR}/{T['body']}").convert('RGB')
# key the magenta to a dark ground
a = np.array(src).astype(np.float32)
alpha = np.clip(1.0 - ((np.minimum(a[..., 0], a[..., 2]) - a[..., 1]) - 70.0) / 80.0, 0, 1)[..., None]
fg = np.where(alpha > 0.02, (a - (1 - alpha) * np.array([255, 0, 255])) / np.maximum(alpha, 0.02), 0)
bg = np.array([22, 28, 40], np.float32)
img = Image.fromarray((fg * alpha * 0.55 + bg * (1 - alpha) + 0 * fg).clip(0, 255).astype(np.uint8)).crop((250, 230, 790, 1330))
OX, OY = 250, 230
S = 1.0
over = Image.new('RGBA', img.size, (0, 0, 0, 0))
d = ImageDraw.Draw(over)
P = lambda p: (p[0] - OX, p[1] - OY)


def unit(v): v = np.asarray(v, float); return v / np.linalg.norm(v)


# limb strips: the band each limb picture covers (top extension, the two bones, the bottom extension)
COL = {'arm_B': (90, 220, 240), 'arm_F': (120, 160, 255), 'leg_B': (250, 205, 90), 'leg_F': (110, 215, 140)}
for name, lm in T['limbs'].items():
    j0, j1, j2 = (J[n] for n in lm['joints'])
    w = lm['width'] * BPX / 2
    a1, a2 = unit(j1 - j0), unit(j2 - j1)
    p_top = j0 - a1 * lm['top'] * BPX; p_end = j2 + a2 * lm['bottom'] * BPX
    n1 = np.array([a1[1], -a1[0]]); n2 = np.array([a2[1], -a2[0]])
    nm = unit(n1 + n2)
    poly = [p_top + n1 * w, j1 + nm * w, p_end + n2 * w, p_end - n2 * w, j1 - nm * w, p_top - n1 * w]
    c = COL[name]
    d.polygon([P(p) for p in poly], fill=c + (38,), outline=c + (200,))
    for jp, ax in ((j0, n1), (j1, nm), (j2, n2)):  # the joint rows the picture is tied to
        d.line([P(jp + ax * w), P(jp - ax * w)], fill=c + (230,), width=2)
    # the round ball end at the top joint (the overlap zone that turns into itself)
    r = w * 0.8
    d.ellipse([P(j0 - r)[0], P(j0 - r)[1], P(j0 + r)[0], P(j0 + r)[1]], outline=(255, 120, 200, 230), width=2)
# the soft cuts: wrists, ankles (square to the bone), the shallow V across the hips
for s in 'BF':
    for a_, b_ in (('elbow', 'wrist'), ('knee', 'ankle')):
        p, q = J[f'{a_}_{s}'], J[f'{b_}_{s}']; ax = unit(q - p); n = np.array([ax[1], -ax[0]])
        d.line([P(q + n * 30), P(q - n * 30)], fill=(255, 120, 200, 255), width=3)
px, py = J['pelvis']
d.line([P((J['hip_B'][0] - 20, py + 5)), P((px - 40, py + 5)), P((px, py + 30)), P((px + 40, py + 5)), P((J['hip_F'][0] + 20, py + 5))], fill=(255, 120, 200, 255), width=3)
# skeleton
bones = [('neck', 'waist'), ('waist', 'pelvis'), ('pelvis', 'hip_B'), ('pelvis', 'hip_F'), ('waist', 'shoulder_B'), ('waist', 'shoulder_F')]
for s in 'BF':
    bones += [(f'shoulder_{s}', f'elbow_{s}'), (f'elbow_{s}', f'wrist_{s}'), (f'hip_{s}', f'knee_{s}'), (f'knee_{s}', f'ankle_{s}')]
for a_, b_ in bones: d.line([P(J[a_]), P(J[b_])], fill=(0, 230, 255, 255), width=3)
for n, p in J.items():
    x, y = P(p); d.ellipse([x - 6, y - 6, x + 6, y + 6], fill=(255, 225, 77, 255), outline=(20, 20, 20, 255))
# attachment points: the grips (weapon in the near hand, off-hand), the hat, the back
hl = R['hand_len'] * BPX
for s, col in (('B', (255, 70, 70, 255)), ('F', (255, 160, 60, 255))):
    ax = unit(J[f'wrist_{s}'] - J[f'elbow_{s}']); g = J[f'wrist_{s}'] + ax * hl
    x, y = P(g); d.rectangle([x - 7, y - 7, x + 7, y + 7], outline=col, width=3)
hat = J['neck'] + np.array([0.01, -0.27]) * BPX
back = J['waist'] + np.array([-0.04, -0.16]) * BPX
for p, col in ((hat, (190, 140, 255, 255)), (back, (190, 140, 255, 255))):
    x, y = P(p); d.rectangle([x - 7, y - 7, x + 7, y + 7], outline=col, width=3)
# the ground and B
g = T['ground']
d.line([P((300, g)), P((740, g))], fill=(200, 200, 200, 160), width=1)
top = g - BPX
d.line([P((290, top)), P((290, g))], fill=(200, 200, 200, 200), width=2)
d.line([P((282, top)), P((298, top))], fill=(200, 200, 200, 200), width=2)
d.line([P((282, g)), P((298, g))], fill=(200, 200, 200, 200), width=2)
img = img.convert('RGBA'); img.alpha_composite(over)
img.convert('RGB').save(OUT)
print(img.size)
