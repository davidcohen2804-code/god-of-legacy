# Check a look's cut parts on B's rig in the combat stance against its concept illustration: the parts are placed by the
# rig's own geometry (assets/b.json) and stance (assets/b_stance.json), the concept is keyed off its magenta background
# and scaled to the same B, the root (pelvis centre over the ground) on the same point.
# Usage: fit_check.py <work dir> <look> <concept.png> <root_x,ground_y> <concept B px> <out.png> [parts look for the
#        body's head (default: head)] — writes concept | parts | overlay | difference, and prints a silhouette IoU.
import json, math, sys
import numpy as np
from PIL import Image, ImageDraw, ImageFont

W, look, concept, root, cb, out = sys.argv[1:7]
RX, GY = [float(v) for v in root.split(',')]; CB = float(cb)
R = '/home/claude/v4lab/src/v4/real/assets/'
geo = json.load(open(R + 'b.json'))
G, L = geo['geometry'], geo['lengths']
S = 420  # px per B
CW, CH, OX, OY = int(S * 1.7), int(S * 1.35), int(S * 0.8), int(S * 1.25)
meta = json.load(open(f'{W}/parts_{look}.json')); P, BPX = meta['parts'], meta['bpx']
HEAD = json.load(open(f'{W}/parts_head.json')) if len(sys.argv) <= 7 else None


def part(name, far=False, folder=None, info=None):
    folder = folder or f'{W}/parts_{look}'; info = info or P
    im = Image.open(f'{folder}/{name}{"_far" if far else ""}.png').convert('RGBA')
    k = S / BPX
    return im.resize((max(1, round(im.width * k)), max(1, round(im.height * k))), Image.LANCZOS), [(x * k, y * k) for x, y in info[name]['pivots']]


pose = json.load(open(R + 'b_stance.json'))['pose']
BONES = {
    'hip': (None, (0, -0.40), 0), 'chest': ('hip', tuple(G['chest']), 0), 'head': ('chest', tuple(G['head']), 0),
    'uparm_F': ('chest', tuple(G['uparm_F']), 90), 'forearm_F': ('uparm_F', (L['uparm'], 0), 0), 'hand_F': ('forearm_F', (L['forearm'], 0), 0),
    'uparm_B': ('chest', tuple(G['uparm_B']), 90), 'forearm_B': ('uparm_B', (L['uparm'], 0), 0), 'hand_B': ('forearm_B', (L['forearm'], 0), 0),
    'thigh_F': ('hip', tuple(G['thigh_F']), 90), 'shin_F': ('thigh_F', (L['thigh'], 0), 0), 'foot_F': ('shin_F', (L['shin'], 0), -90),
    'thigh_B': ('hip', tuple(G['thigh_B']), 90), 'shin_B': ('thigh_B', (L['thigh'], 0), 0), 'foot_B': ('shin_B', (L['shin'], 0), -90),
}
REST = {}
for b, (p, _, r) in BONES.items(): REST[b] = (REST[p] if p else 0) + r


def fk():
    out = {}
    for b, (p, (lx, ly), r) in BONES.items():
        if p is None: out[b] = ((lx + pose['dx'], ly + pose['dy']), r + pose['hip']); continue
        (px, py), pr = out[p]
        c, s = math.cos(math.radians(pr)), math.sin(math.radians(pr))
        out[b] = ((px + c * lx - s * ly, py + s * lx + c * ly), pr + r + pose.get(b, 0))
    return out


ORDER = [('uparm', 'uparm_F', True), ('foot', 'foot_F', True), ('thigh', 'thigh_F', True), ('shin', 'shin_F', True),
         ('foot', 'foot_B', False), ('thigh', 'thigh_B', False), ('shin', 'shin_B', False),
         ('torso', 'chest', False), ('hips', 'hip', False), ('HEAD', 'head', False),
         ('uparm', 'uparm_B', False), ('forearm', 'forearm_B', False), ('forearm', 'forearm_F', True)]
w = fk()
can = Image.new('RGBA', (CW, CH), (0, 0, 0, 0))
for name, bone, far in ORDER:
    if name == 'HEAD':
        if not HEAD: continue
        layers = [part(n, False, f'{W}/head', HEAD['parts']) for n in ('head_face', 'hair')]
    else:
        if name not in P: continue
        layers = [part(name, far and name not in ('torso', 'hips'))]
    for im, pvs in layers:
        (x, y), rot = w[bone]
        a = rot - REST[bone]
        if abs(a) > 0.01:
            w0, h0 = im.size
            im2 = im.rotate(-a, resample=Image.BICUBIC, expand=True)
            t = math.radians(-a)
            dx, dy = pvs[0][0] - w0 / 2, pvs[0][1] - h0 / 2
            qx, qy = im2.width / 2 + math.cos(t) * dx + math.sin(t) * dy, im2.height / 2 - math.sin(t) * dx + math.cos(t) * dy
            im = im2
        else:
            qx, qy = pvs[0]
        can.alpha_composite(im, (round(OX + x * S - qx), round(OY + y * S - qy)))

src = np.array(Image.open(concept).convert('RGB')).astype(np.float32)
r_, g_, b_ = src[..., 0], src[..., 1], src[..., 2]
al = np.clip(1.0 - ((np.minimum(r_, b_) - g_) - 70.0) / 80.0, 0.0, 1.0)
fg = np.clip(np.where(al[..., None] > 0.02, (src - (1 - al[..., None]) * np.array([255.0, 0, 255.0])) / np.maximum(al[..., None], 0.02), 0), 0, 255)
tgt = Image.fromarray(np.dstack([fg, al * 255]).astype(np.uint8))
k = S / CB
tgt = tgt.convert('RGBa').resize((round(tgt.width * k), round(tgt.height * k)), Image.LANCZOS).convert('RGBA')
T = Image.new('RGBA', (CW, CH), (0, 0, 0, 0)); T.alpha_composite(tgt, (round(OX - RX * k), round(OY - GY * k)))
A, B_ = np.array(T)[..., 3] > 127, np.array(can)[..., 3] > 127
print('silhouette IoU (parts vs concept, both with whatever the parts cover):', round(float((A & B_).sum() / max(1, (A | B_).sum())), 3))
BG = (24, 30, 42, 255)
def on_bg(im): b = Image.new('RGBA', im.size, BG); b.alpha_composite(im); return b
ov = Image.blend(on_bg(T), on_bg(can), 0.5)
diff = np.zeros((CH, CW, 3), np.uint8) + np.array([24, 30, 42], np.uint8); diff[A & ~B_] = [214, 112, 40]; diff[B_ & ~A] = [40, 92, 180]; diff[A & B_] = [120, 124, 132]
sheet = Image.new('RGBA', (CW * 4 + 30, CH + 30), BG); d = ImageDraw.Draw(sheet)
f = ImageFont.truetype('/usr/share/fonts/opentype/inter/Inter-Regular.otf', 15)
for i, (im, lab) in enumerate(((on_bg(T), 'concept'), (on_bg(can), 'cut parts on the rig, stance'), (ov, 'overlay 50/50'), (Image.fromarray(diff).convert('RGBA'), 'orange: only concept · blue: only parts'))):
    sheet.alpha_composite(im, (i * (CW + 10), 30)); d.text((i * (CW + 10) + 6, 6), lab, font=f, fill=(230, 230, 230))
for yb in (0.40, 0.48, 0.26, 0.70):  # hip joint, belt, knees, neck: guide lines (B above the soles)
    y = 30 + OY - yb * S
    d.line((0, y, sheet.width, y), fill=(226, 180, 92, 120), width=1)
sheet.convert('RGB').save(out)
