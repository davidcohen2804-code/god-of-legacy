# Assemble the cut parts in the rig's rest pose (arms down, legs straight) beside the canonical figure, same B.
# Usage: assemble_rest.py <work dir> <look> <canonical_png> <canon_box x0,y0,x1,y1> <canon_B_px> <out.png> [hip_B=0.37]
import json, sys
from PIL import Image, ImageDraw

D = sys.argv[1]
look, canon, box, canon_b, out = sys.argv[2], sys.argv[3], [int(v) for v in sys.argv[4].split(',')], float(sys.argv[5]), sys.argv[6]
HIP = float(sys.argv[7]) if len(sys.argv) > 7 else 0.37
meta = json.load(open(f'{D}/parts_{look}.json'))
P = meta['parts']; BPX = meta['bpx']
img = lambda n, far=False: Image.open(f'{D}/parts_{look}/{n}{"_far" if far else ""}.png').convert('RGBA')
piv = lambda n, i=0: P[n]['pivots'][i]


def skeleton():
    """Rest-pose joint positions in px (origin: ground centre, y down)."""
    j = {}
    j['hip'] = (0.0, -HIP * BPX)
    h0, h1 = piv('hips', 0), piv('hips', 1)
    j['waist'] = (j['hip'][0] + h1[0] - h0[0], j['hip'][1] + h1[1] - h0[1])
    for side, k in (('F', 2), ('B', 3)):
        hj = piv('hips', k)
        j[f'hipj{side}'] = (j['hip'][0] + hj[0] - h0[0], j['hip'][1] + hj[1] - h0[1])
        j[f'knee{side}'] = (j[f'hipj{side}'][0], j[f'hipj{side}'][1] + piv('thigh', 1)[1] - piv('thigh', 0)[1])
        j[f'ankle{side}'] = (j[f'knee{side}'][0], j[f'knee{side}'][1] + piv('shin', 1)[1] - piv('shin', 0)[1])
    t0 = piv('torso', 0)
    for name, k in (('neck', 1), ('shF', 2), ('shB', 3)):
        q = piv('torso', k); j[name] = (j['waist'][0] + q[0] - t0[0], j['waist'][1] + q[1] - t0[1])
    for side in 'FB':
        s = j[f'sh{side}']
        j[f'elbow{side}'] = (s[0], s[1] + piv('uparm', 1)[1] - piv('uparm', 0)[1])
        j[f'wrist{side}'] = (s[0], j[f'elbow{side}'][1] + piv('forearm', 1)[1] - piv('forearm', 0)[1])
        f0, f1 = piv('fist', 0), piv('fist', 1)
        j[f'grip{side}'] = (j[f'wrist{side}'][0] + f1[0] - f0[0], j[f'wrist{side}'][1] + f1[1] - f0[1])
    return j


def compose(order, j, W=420, H=660, ox=210, oy=620):
    can = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    for (name, joint, far) in order:
        if name not in P: continue
        im = img(name, far); px, py = piv(name, 0)
        x, y = j[joint]
        can.alpha_composite(im, (round(ox + x - px), round(oy + y - py)))
    return can


j = skeleton()
ORDER = [
    ('uparm', 'shB', True), ('forearm', 'elbowB', True), ('fist', 'wristB', True),
    ('foot', 'ankleB', True), ('thigh', 'hipjB', True), ('shin', 'kneeB', True),
    ('foot', 'ankleF', False), ('thigh', 'hipjF', False), ('shin', 'kneeF', False),
    ('torso', 'waist', False), ('hips', 'hip', False), ('head', 'neck', False),
    ('uparm', 'shF', False), ('shoulderF', 'waist', False), ('forearm', 'elbowF', False),
    ('sword', 'gripF', False), ('fist', 'wristF', False),
]
fig = compose(ORDER, j)
# the canonical figure at the same B
c = Image.open(canon).convert('RGBA').crop(box)
k = BPX / canon_b
c = c.resize((round(c.width * k), round(c.height * k)), Image.LANCZOS)
W = fig.width + c.width + 60
sheet = Image.new('RGBA', (W, 700), (24, 28, 38, 255))
sheet.alpha_composite(fig, (10, 10))
sheet.alpha_composite(c, (fig.width + 40, 10 + 620 - c.height))
d = ImageDraw.Draw(sheet)
for yb in (0.0, 0.25, 0.37, 0.486, 0.65, 0.70, 1.0):
    y = 10 + 620 - yb * BPX
    d.line((0, y, W, y), fill=(0, 200, 200, 120), width=1)
    d.text((2, y - 12), f'{yb:.3f}', fill=(0, 230, 230, 255))
sheet.convert('RGB').save(out)
print({k: (round(v[0] / BPX, 3), round(-v[1] / BPX, 3)) for k, v in j.items()})
