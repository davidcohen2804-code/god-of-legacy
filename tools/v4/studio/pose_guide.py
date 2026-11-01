# A pose guide for the art: the approved B illustration's own pixels (cut by segment_base.py, limbs as bendable strips,
# as in demo_strips.py) re-posed into a pose given in world angles, without the sword, hands relaxed, on flat magenta.
# It shows a painter the exact pose, size and proportions to draw; it is not art itself (the strips distort a little).
# Usage: pose_guide.py <anims.json> <labels.png> <pose.json> <out.png> [--marks out_marks.png]
#   pose.json: {"canvas": [w, h], "bpx": px per B, "root": [x, y], "world": {bone: degrees}}
import json, math, os, sys
import numpy as np
import cv2
from PIL import Image

ANIMS, LABELS, POSE, OUT = sys.argv[1:5]
MARKS = sys.argv[sys.argv.index('--marks') + 1] if '--marks' in sys.argv else None
sys.argv = [sys.argv[0], ANIMS, LABELS, os.path.dirname(os.path.abspath(OUT))]
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import demo_strips as ds  # noqa: E402  (builds the illustration's parts and strips on import)
from rigb import BONES, fk, tip  # noqa: E402

P = json.load(open(POSE))
CW, CH = P['canvas']; S = P['bpx']; RX, RY = P['root']
WA = P['world']
STANCE_W = fk()


def local_pose(world):
    """World angles (degrees) → the rig's local deltas; the hips placed so the ankles sit as high as in the stance."""
    pose = {'hip': world.get('hip', 0.0)}
    ang = {}
    for b, (p, _o, r, _l) in BONES.items():
        if p is None: ang[b] = r + pose['hip']; continue
        ang[b] = world.get(b, ang[p] + r)  # a bone not given keeps its rest angle against its parent
        pose[b] = ang[b] - ang[p] - r
    pose['dx'] = 0.0; pose['dy'] = 0.0
    w = fk(pose)
    a_now = (tip(w, 'shin_B')[1] + tip(w, 'shin_F')[1]) / 2
    a_st = (tip(STANCE_W, 'shin_B')[1] + tip(STANCE_W, 'shin_F')[1]) / 2
    pose['dy'] = a_st - a_now
    w = fk(pose)
    pose['dx'] = -(tip(w, 'shin_B')[0] + tip(w, 'shin_F')[0]) / 2  # the ankles' midpoint over the root
    return pose


def render(pose, S2):
    w = fk(pose)
    O = lambda q: np.array([RX * S2 / S + q[0] * S2, RY * S2 / S + q[1] * S2])
    W2, H2 = int(CW * S2 / S), int(CH * S2 / S)
    can = np.zeros((H2, W2, 4), np.float32)
    def over(lay):
        nonlocal can
        can = lay + can * (1 - lay[..., 3:4])
    def rigid(name):
        img, bone = ds.RIGID[name]
        (bx, by), br = STANCE_W[bone]; (cx, cy), cr = w[bone]
        k = S2 / ds.IPX; th = math.radians(cr - br); c, s = math.cos(th), math.sin(th)
        bp = ds.I((bx, by)); cp = O((cx, cy))
        M = np.float32([[k * c, -k * s, cp[0] - k * (c * bp[0] - s * bp[1])], [k * s, k * c, cp[1] - k * (s * bp[0] + c * bp[1])]])
        over(cv2.warpAffine(img, M, (W2, H2), flags=cv2.INTER_AREA if k < 1 else cv2.INTER_LINEAR, borderValue=(0, 0, 0, 0)))
    def strip(limb_tex, ub, lb, far=False):
        st = ds.STRIPS[limb_tex]; k = S2 / ds.IPX
        J0, J1, J2 = O(w[ub][0]), O(w[lb][0]), O(tip(w, lb))
        pts, _ = ds.path_points(J0, J1, J2, st['et'] * k, st['eb'] * k, st['rc'] * k, st['n'])
        rows = np.linspace(0, st['total'], st['n'])
        lay = np.zeros((H2, W2, 4), np.float32)
        tex = st['tex'] * (np.array([0.9, 0.9, 0.9, 1.0], np.float32) if far else 1.0)
        for td, ts in ds.tris(pts, st['W'] * k / 2, rows, st['W']): ds.warp_tri(tex, lay, ts, td)
        over(lay)
    def hand(side):
        img, piv = ds.hand_img('relaxed', side == 'F')
        k = S2 / 512 * ds.HAND_K; (hx, hy), hr = w[f'hand_{side}']; at = O((hx, hy))
        th = math.radians(hr - 90); c, s = math.cos(th), math.sin(th); p0 = piv[0]
        M = np.float32([[k * c, -k * s, at[0] - k * (c * p0[0] - s * p0[1])], [k * s, k * c, at[1] - k * (s * p0[0] + c * p0[1])]])
        over(cv2.warpAffine(img, M, (W2, H2), flags=cv2.INTER_AREA, borderValue=(0, 0, 0, 0)))
    strip('arm', 'uparm_F', 'forearm_F', far=True); hand('F')
    rigid('foot_F'); strip('leg_F', 'thigh_F', 'shin_F')
    rigid('foot_B'); strip('leg_B', 'thigh_B', 'shin_B')
    rigid('hips'); rigid('torso'); rigid('belt')
    strip('arm', 'uparm_B', 'forearm_B'); hand('B')
    rigid('head')
    return can, w


pose = local_pose(WA)
big, w = render(pose, 2 * S)
can = cv2.resize(big, (CW, CH), interpolation=cv2.INTER_AREA)
a = can[..., 3:4]
rgb = can[..., :3] + (1 - a) * np.array([1.0, 0.0, 1.0], np.float32)
Image.fromarray((np.clip(rgb, 0, 1) * 255).astype(np.uint8)).save(OUT)
joints = {}
for b in ('hip', 'chest', 'head', 'uparm_B', 'forearm_B', 'hand_B', 'uparm_F', 'forearm_F', 'hand_F', 'thigh_B', 'shin_B', 'foot_B', 'thigh_F', 'shin_F', 'foot_F'):
    joints[b] = [round(RX + w[b][0][0] * S, 1), round(RY + w[b][0][1] * S, 1)]
print(json.dumps({'pose': {k: round(v, 3) for k, v in pose.items()}, 'joints': joints}))
if MARKS:
    im = (np.clip(rgb, 0, 1) * 255).astype(np.uint8).copy()
    for b, (x, y) in joints.items(): cv2.circle(im, (int(x), int(y)), 6, (0, 255, 255), 2)
    Image.fromarray(im).save(MARKS)
