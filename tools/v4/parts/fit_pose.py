# Fit B's combat idle to the approved illustration: find the bone angles (and the hips' offset) whose assembled parts
# best cover the lineup figure, by coordinate descent on a silhouette + colour loss. Writes the stance (deltas from the
# rig's rest pose, degrees clockwise and B units, the rig's own conventions) and a side-by-side check image.
# Usage: fit_pose.py <work dir with parts_basic*> <lineup.png> <box x0,y0,x1,y1> <B px in the lineup> <sole y> <out.json> <check.png>
import json, math, sys
import numpy as np
from PIL import Image, ImageDraw

W, look, lineup, box, canon_b, sole_y, out_json, out_png = sys.argv[1], 'basic', sys.argv[2], [int(v) for v in sys.argv[3].split(',')], float(sys.argv[4]), float(sys.argv[5]), sys.argv[6], sys.argv[7]
meta = json.load(open(f'{W}/parts_{look}.json'))
P, BPX = meta['parts'], meta['bpx']
S = 420  # check-image resolution: px per B
HIP = 0.40  # as pack.py
CW, CH, OX, OY = int(S * 1.7), int(S * 1.35), int(S * 0.8), int(S * 1.25)  # canvas, ground centre at (OX, OY)


def part(name, far=False):
    im = Image.open(f'{W}/parts_{look}/{name}{"_far" if far else ""}.png').convert('RGBA')
    k = S / BPX
    return im.resize((max(1, round(im.width * k)), max(1, round(im.height * k))), Image.LANCZOS), [(x * k, y * k) for x, y in P[name]['pivots']]


IM = {(n, f): part(n, f) for n in P for f in (False, True) if not (f and n in ('head', 'torso', 'hips', 'sword'))}
pv = lambda n, i: (P[n]['pivots'][i][0] / BPX, P[n]['pivots'][i][1] / BPX)  # B units, part space
d = lambda n, i, j=0: (pv(n, i)[0] - pv(n, j)[0], pv(n, i)[1] - pv(n, j)[1])
# the rig (B units): bone -> (parent, local offset in the parent's rest frame, rest rotation relative to the parent)
L = {k: d(k, 1)[1] for k in ('uparm', 'forearm', 'thigh', 'shin')}
L['hand'] = math.hypot(*d('fist', 1))
BONES = {
    'hip': (None, (0, -HIP), 0), 'chest': ('hip', d('hips', 1), 0), 'head': ('chest', d('torso', 1), 0),
    'uparm_F': ('chest', d('torso', 2), 90), 'forearm_F': ('uparm_F', (L['uparm'], 0), 0), 'hand_F': ('forearm_F', (L['forearm'], 0), 0), 'weapon': ('hand_F', (L['hand'], 0), -90),
    'uparm_B': ('chest', d('torso', 3), 90), 'forearm_B': ('uparm_B', (L['uparm'], 0), 0), 'hand_B': ('forearm_B', (L['forearm'], 0), 0),
    'thigh_F': ('hip', d('hips', 2), 90), 'shin_F': ('thigh_F', (L['thigh'], 0), 0), 'foot_F': ('shin_F', (L['shin'], 0), -90),
    'thigh_B': ('hip', d('hips', 3), 90), 'shin_B': ('thigh_B', (L['thigh'], 0), 0), 'foot_B': ('shin_B', (L['shin'], 0), -90),
}
REST = {}
for b, (p, _, r) in BONES.items(): REST[b] = (REST[p] if p else 0) + r
# draw order (B's rig): far arm, far leg, near leg, torso, hips, head, near arm with the sword under the fist
ORDER = [('uparm', 'uparm_B', True), ('forearm', 'forearm_B', True), ('fist', 'hand_B', True),
         ('foot', 'foot_B', True), ('thigh', 'thigh_B', True), ('shin_under', 'shin_B', True), ('shin', 'shin_B', True),
         ('foot', 'foot_F', False), ('thigh', 'thigh_F', False), ('shin_under', 'shin_F', False), ('shin', 'shin_F', False),
         ('torso', 'chest', False), ('hips', 'hip', False), ('head', 'head', False),
         ('uparm', 'uparm_F', False), ('forearm', 'forearm_F', False), ('sword', 'weapon', False), ('fist', 'hand_F', False)]
ANG = ['hip', 'chest', 'head', 'uparm_F', 'forearm_F', 'hand_F', 'weapon', 'uparm_B', 'forearm_B', 'hand_B', 'thigh_F', 'shin_F', 'foot_F', 'thigh_B', 'shin_B', 'foot_B']


def fk(pose):
    """World position (B) and rotation (deg) of every bone."""
    out = {}
    for b, (p, (lx, ly), r) in BONES.items():
        if p is None:
            out[b] = ((lx + pose['dx'], ly + pose['dy']), r + pose['hip'])
            continue
        (px, py), pr = out[p]
        c, s = math.cos(math.radians(pr)), math.sin(math.radians(pr))
        out[b] = ((px + c * lx - s * ly, py + s * lx + c * ly), pr + r + pose.get(b, 0))
    return out


def render(pose, scale_canvas=1.0):
    w = fk(pose)
    can = Image.new('RGBA', (CW, CH), (0, 0, 0, 0))
    for name, bone, far in ORDER:
        im, pvs = IM[(name, far)]
        (x, y), rot = w[bone]
        a = rot - REST[bone]
        if abs(a) > 0.01:
            w0, h0 = im.size
            im2 = im.rotate(-a, resample=Image.BICUBIC, expand=True)  # PIL turns counter-clockwise; the rig turns clockwise
            t = math.radians(-a)
            dx, dy = pvs[0][0] - w0 / 2, pvs[0][1] - h0 / 2
            qx, qy = im2.width / 2 + math.cos(t) * dx + math.sin(t) * dy, im2.height / 2 - math.sin(t) * dx + math.cos(t) * dy
            im = im2
        else:
            qx, qy = pvs[0]
        can.alpha_composite(im, (round(OX + x * S - qx), round(OY + y * S - qy)))
    return can


# the target: the lineup figure keyed off its magenta background, scaled to the same B, soles on the ground line
src = np.array(Image.open(lineup).convert('RGB').crop(box)).astype(np.float32)
r_, g_, b_ = src[..., 0], src[..., 1], src[..., 2]
alpha = np.clip(1.0 - ((np.minimum(r_, b_) - g_) - 70.0) / 80.0, 0.0, 1.0)
fg = np.clip(np.where(alpha[..., None] > 0.02, (src - (1 - alpha[..., None]) * np.array([255.0, 0, 255.0])) / np.maximum(alpha[..., None], 0.02), 0), 0, 255)
tgt = Image.fromarray(np.dstack([fg, alpha * 255]).astype(np.uint8))
k = S / canon_b
tgt = tgt.convert('RGBa').resize((round(tgt.width * k), round(tgt.height * k)), Image.LANCZOS).convert('RGBA')
T = Image.new('RGBA', (CW, CH), (0, 0, 0, 0))
GX = 736.0  # the pelvis centre in the lineup (the root's x)
T.alpha_composite(tgt, (round(OX - (GX - box[0]) * k), round(OY - (sole_y - box[1]) * k)))
Ta = np.array(T).astype(np.float32) / 255.0


def loss(pose):
    R = np.array(render(pose)).astype(np.float32) / 255.0
    ar, at = R[..., 3], Ta[..., 3]
    both = ar * at
    col = np.abs(R[..., :3] - Ta[..., :3]).sum(axis=2) * both
    return float(np.abs(ar - at).mean() + 0.35 * col.mean())


# The illustration's joints, read off the lineup figure (lineup px). The forearm is foreshortened in the art, so the
# elbow counts little: the rig's fixed-length forearm reaches the same wrist with a deeper bend.
GROUND = (GX, sole_y)   # the root: the pelvis centre over the ground line
KEY = [  # (bone, point in the bone's space in B, target in lineup px, weight)
    ('head', (0, 0), (736, 441), 1.0),
    ('uparm_F', (0, 0), (758.5, 466), 1.0), ('forearm_F', (0, 0), (778.5, 538.5), 0.3), ('hand_F', (0, 0), (806, 558.5), 1.0),
    ('weapon', (0, 0), (828.5, 566), 2.0), ('weapon', (0.452, 0), (968.5, 316), 1.0),
    ('uparm_B', (0, 0), (666, 471), 0.5), ('forearm_B', (0, 0), (641, 561), 0.5), ('hand_B', (0, 0), (636, 616), 1.0),
    # the knees where the trousers bend: the boot cuff's top 0.033 B below the knee (basic) and the knee guard's centre
    # 0.015 B below it (Golden) land on the illustrations' cuffs and knee guards, split between the two outfits. The
    # ankles weigh most, so both soles stay on the ground (the near leg is drawn longer than the rig's in the 3/4 view)
    ('shin_F', (0, 0), (766, 735), 1.0), ('foot_F', (0, 0), (776, 817), 8.0),
    ('shin_B', (0, 0), (668, 722), 1.0), ('foot_B', (0, 0), (626, 817), 8.0),
]


def point(w, bone, q):
    (x, y), r = w[bone]
    c, s = math.cos(math.radians(r)), math.sin(math.radians(r))
    return x + c * q[0] - s * q[1], y + s * q[0] + c * q[1]


NAMES = ['dx', 'dy'] + ANG
def kp_loss(v):
    pose = dict(zip(NAMES, v))
    w = fk(pose)
    e = 0.0
    for bone, q, (tx, ty), wt in KEY:
        x, y = point(w, bone, q)
        e += wt * ((x - (tx - GROUND[0]) / canon_b) ** 2 + (y - (ty - GROUND[1]) / canon_b) ** 2)
    # keep the trunk and the feet near their drawn angles
    e += 2e-6 * (pose['hip'] ** 2 + pose['chest'] ** 2 + pose['head'] ** 2) + 1e-6 * (pose['foot_F'] ** 2 + pose['foot_B'] ** 2 + pose['hand_B'] ** 2)
    return e


from scipy.optimize import minimize
x0 = [0.0, 0.0] + [0.0] * len(ANG)
x0[NAMES.index('uparm_F')], x0[NAMES.index('forearm_F')], x0[NAMES.index('weapon')] = -14, -62, 24
res = minimize(kp_loss, x0, method='Powell', options={'maxiter': 40000, 'xtol': 1e-4, 'ftol': 1e-10})
pose = dict(zip(NAMES, res.x))
# the sole of each foot back on the ground: the feet turn so the boot's sole stays flat
w = fk(pose)
for side in ('F', 'B'):
    pose[f'foot_{side}'] = pose[f'foot_{side}'] - (w[f'foot_{side}'][1] - 0.0)
best, start = loss(pose), loss(dict(zip(NAMES, x0)))
err = math.sqrt(kp_loss(res.x) / sum(k[3] for k in KEY)) * canon_b
print(f'keypoint rms error {err:.1f} lineup px; silhouette loss {start:.5f} -> {best:.5f}', flush=True)

json.dump({'loss_start': start, 'loss': best, 'pose': {k2: round(v, 2) if k2 not in ('dx', 'dy') else round(v, 4) for k2, v in pose.items()}}, open(out_json, 'w'), indent=1)
# check image: illustration | fitted rig | overlay (rig at 50 % over the illustration)
R = render(pose)
sheet = Image.new('RGBA', (CW * 3 + 40, CH + 20), (24, 28, 38, 255))
sheet.alpha_composite(T, (10, 10)); sheet.alpha_composite(R, (CW + 20, 10))
ov = T.copy(); half = R.copy(); half.putalpha(half.getchannel('A').point(lambda a: a // 2)); ov.alpha_composite(half)
sheet.alpha_composite(ov, (2 * CW + 30, 10))
dr = ImageDraw.Draw(sheet)
for i in range(3): dr.line((10 + i * (CW + 10), 10 + OY, 10 + i * (CW + 10) + CW, 10 + OY), fill=(0, 200, 200, 255))
sheet.convert('RGB').save(out_png)
print(json.dumps(pose))
