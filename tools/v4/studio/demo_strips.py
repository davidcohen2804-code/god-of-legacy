# Limited demonstration (offline, does not touch the lab): B built from the approved illustration itself, with each arm
# and leg as one bendable strip (no doll joints), and the sword moved to the near hand. Rigid parts (head, torso, hips,
# belt, feet) are the illustration's own pixels, bound at the combat stance; the hands and the sword are the lab's
# hand standard and sword. Poses come from the lab's own animations (export_anims.mjs), with the two arms' motions
# swapped so the near arm carries the sword.
# Usage: demo_strips.py <anims.json> <labels.png> <out dir> [--keep-arms]
import json, math, os, sys
import numpy as np
import cv2
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
from rigb import BONES, fk, tip  # noqa: E402

ANIMS, LABELS, OUT = sys.argv[1:4]
KEEP_ARMS = '--keep-arms' in sys.argv
os.makedirs(OUT, exist_ok=True)
SEEDS = json.load(open(os.path.join(HERE, 'base_seeds.json')))
ROOT, IPX = tuple(SEEDS['root']), SEEDS['bpx']           # illustration: root (soles' centre) and px per B
WORK = '/tmp/claude-0/-home-claude/3e5fb49a-8e0a-5558-8b49-0394b00826f4/scratchpad/p3c/mk'  # the lab's cut parts
HAND_K = 0.068 / 0.057                                     # the illustration's fist is this much bigger than the hand standard's

# ---------------------------------------------------------------- the illustration, keyed, and its parts
src = np.array(Image.open(os.path.join(HERE, '../../../', SEEDS['illustration'])).convert('RGB')).astype(np.float32)
r_, g_, b_ = src[..., 0], src[..., 1], src[..., 2]
ALPHA = np.clip(1.0 - ((np.minimum(r_, b_) - g_) - 70.0) / 80.0, 0.0, 1.0)
FG = np.clip(np.where(ALPHA[..., None] > 0.02, (src - (1 - ALPHA[..., None]) * np.array([255.0, 0, 255.0])) / np.maximum(ALPHA[..., None], 0.02), 0), 0, 255)
LAB = np.array(Image.open(LABELS)); LN = json.load(open(LABELS.rsplit('.', 1)[0] + '.json'))['labels']
H0, W0 = LAB.shape
STANCE = fk()
I = lambda q: np.array([ROOT[0] + q[0] * IPX, ROOT[1] + q[1] * IPX])      # B → illustration px


def layer(mask):
    """Premultiplied RGBA (float, 0..1) of the illustration under a mask."""
    a = ALPHA * mask
    return np.dstack([FG / 255.0 * a[..., None], a])


def inpaint_into(rgba, known, region, radius=6):
    """Fill `region` from the colours of `known` only (premultiplied RGBA in, out)."""
    a = rgba[..., 3]
    col = np.where(a[..., None] > 1e-3, rgba[..., :3] / np.maximum(a[..., None], 1e-3), 0)
    img8 = (np.clip(col, 0, 1) * 255).astype(np.uint8)
    fillm = ((~known) & (region | known | True)).astype(np.uint8)  # everything not known is filled from the known pixels
    out = cv2.inpaint(img8, fillm, radius, cv2.INPAINT_TELEA).astype(np.float32) / 255.0
    res = rgba.copy()
    res[region & ~known, :3] = out[region & ~known]; res[region & ~known, 3] = 1.0
    return res


def lab_mask(name): return LAB == LN[name]


# ---------------------------------------------------------------- completion: every part continues under the parts in
# front of it (colours carried in from its own pixels) and gets an outline on those new edges, which stay hidden at
# rest and show only when the part moves away
ILL_ORDER = ['arm_F', 'foot_F', 'leg_F', 'foot_B', 'leg_B', 'hips', 'torso', 'belt', 'arm_B', 'hand_B', 'head', 'sword', 'hand_F']
INK = np.array([0.13, 0.09, 0.12], np.float32)
GROW = 9


def completed(name, base=None, grow=GROW):
    m = lab_mask(name) if base is None else base
    rgba = layer(m)
    front = np.zeros_like(m)
    for n in ILL_ORDER[ILL_ORDER.index(name) + 1:]: front |= lab_mask(n)
    reach = cv2.dilate(m.astype(np.uint8), cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (2 * grow + 1, 2 * grow + 1))) > 0
    add = reach & front & ~m
    if not add.any(): return clean(rgba)
    out = inpaint_into(rgba, m & (ALPHA > 0.9), add)
    return clean(outline_new_edges(out, m, add))


def outline_new_edges(out, m, add):
    """A drawn-style outline on the edges a completion added: a 2 px rim, only where the added cloth is at least 4 px
    deep (a thin sliver along the part keeps its own colours)."""
    full = m | add
    rim = full & ~(cv2.erode(full.astype(np.uint8), np.ones((5, 5), np.uint8)) > 0)
    deep = cv2.distanceTransform((~m).astype(np.uint8), cv2.DIST_L2, 3) >= 4
    ink = rim & add & deep
    out[ink, :3] = INK; out[ink, 3] = 1.0
    return out


def clean(rgba):
    a = rgba[..., 3]; rgba[a < 0.12] = 0
    return rgba


# rigid parts: (label set, bone)
def rigid_torso():
    m = lab_mask('torso')
    hull = cv2.morphologyEx(m.astype(np.uint8), cv2.MORPH_CLOSE, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (41, 41))) > 0
    front = lab_mask('belt') | lab_mask('arm_B') | lab_mask('arm_F') | lab_mask('hand_F') | lab_mask('head') | lab_mask('hand_B')
    # the vest continues under the belt and the arms that lie on it, outlined where it ends under them
    add = (hull & front & ~m) | ((cv2.dilate(m.astype(np.uint8), cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (19, 19))) > 0) & front & ~m)
    out = inpaint_into(layer(m), m & (ALPHA > 0.9), add)
    return clean(outline_new_edges(out, m, add))


def rigid_hips():
    legs = lab_mask('leg_B') | lab_mask('leg_F') | lab_mask('hips')
    ys = np.arange(H0)[:, None]
    m = legs & (ys < 640)
    # up to the belt, under the vest's tails: the trousers' seat
    x0, x1 = np.where(m.any(0))[0][[0, -1]]
    seat = np.zeros_like(m); seat[545:640, x0:x1 + 1] = True
    seat &= cv2.dilate(m.astype(np.uint8), np.ones((1, 9), np.uint8)).astype(bool) | (ys < 610)
    region = seat & (cv2.morphologyEx(m.astype(np.uint8), cv2.MORPH_CLOSE, np.ones((60, 25), np.uint8)) > 0) | (seat & (ys >= 545) & (ys < 612))
    region &= (np.arange(W0)[None, :] >= x0 + 6) & (np.arange(W0)[None, :] <= x1 - 6) | m
    return inpaint_into(layer(m), m & (ALPHA > 0.9), region & ~m)


def rigid_foot(side):
    m = lab_mask(f'foot_{side}')
    # the boot shaft's last 0.04 B above the foot goes with the foot (under the leg strip), so a bent ankle shows leather
    leg = lab_mask(f'leg_{side}')
    band = cv2.dilate(m.astype(np.uint8), cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (1, int(0.08 * IPX) | 1)), anchor=None) > 0
    return completed(f'foot_{side}', m | (leg & band))


RIGID = {  # name: (premultiplied RGBA over the whole illustration, bone)
    'head': (completed('head'), 'head'),
    'torso': (rigid_torso(), 'chest'),
    'hips': (rigid_hips(), 'hip'),
    'belt': (completed('belt'), 'hip'),
    'foot_B': (rigid_foot('B'), 'foot_B'),
    'foot_F': (rigid_foot('F'), 'foot_F'),
}

# ---------------------------------------------------------------- strips
STRIP = {  # limb: (label, upper bone, lower bone, extension above the top joint, below the end joint, corner radius, width) in B
    'arm': ('arm_B', 'uparm_B', 'forearm_B', 0.05, 0.035, 0.035, 0.17),
    'leg_B': ('leg_B', 'thigh_B', 'shin_B', 0.07, 0.05, 0.04, 0.22),
    'leg_F': ('leg_F', 'thigh_F', 'shin_F', 0.07, 0.05, 0.04, 0.22),
}
STEP = 3.0  # px between strip points at the illustration's scale


def path_points(J0, J1, J2, et, eb, rc, n):
    """Points along a limb (px), evenly in texture rows: straight to the corner, a quadratic blend of radius rc around the
    middle joint, straight on; extensions before the first and after the last joint. Rows are tied to the joints, so the
    hand and the foot stay at the ends whatever the bend."""
    J0, J1, J2 = map(np.asarray, (J0, J1, J2))
    d1 = (J1 - J0) / np.linalg.norm(J1 - J0); d2 = (J2 - J1) / np.linalg.norm(J2 - J1)
    L1, L2 = np.linalg.norm(J1 - J0), np.linalg.norm(J2 - J1)
    P0, C, P2 = J1 - d1 * rc, J1, J1 + d2 * rc
    bez = lambda t: (1 - t) ** 2 * P0 + 2 * (1 - t) * t * C + t ** 2 * P2
    total = et + L1 + L2 + eb
    out = []
    for v in np.linspace(0, total, n):
        if v < et: p = J0 - d1 * (et - v)
        elif v < et + L1 - rc: p = J0 + d1 * (v - et)
        elif v < et + L1: p = bez(0.5 * (v - (et + L1 - rc)) / rc)
        elif v < et + L1 + rc: p = bez(0.5 + 0.5 * (v - (et + L1)) / rc)
        elif v < et + L1 + L2: p = J1 + d2 * (v - et - L1)
        else: p = J2 + d2 * (v - et - L1 - L2)
        out.append(p)
    return np.array(out), total


def perps(pts):
    """Phaser's Rope: each point's normal from its neighbours (next − previous)."""
    n = len(pts); out = np.zeros_like(pts)
    for i in range(n):
        a = pts[i - 1] if i > 0 else pts[0]; b = pts[i + 1] if i < n - 1 else pts[i]
        d = b - a; p = np.array([d[1], -d[0]]); out[i] = p / max(1e-9, np.linalg.norm(p))
    return out


def tris(pts, hw, rows, W):
    """The strip's triangles: (on the limb) and (in the texture)."""
    pp = perps(pts); A = pts + pp * hw; Bv = pts - pp * hw
    for i in range(len(pts) - 1):
        v0, v1 = rows[i], rows[i + 1]
        yield (Bv[i], A[i], A[i + 1]), ((0, v0), (W, v0), (W, v1))
        yield (Bv[i], A[i + 1], Bv[i + 1]), ((0, v0), (W, v1), (0, v1))


def warp_tri(src, dst, ts, td):
    """Affine-map triangle ts of src onto td of dst (premultiplied RGBA, overwrite inside the triangle, 1 px grown)."""
    td = np.float32(td); x, y, w, h = cv2.boundingRect(td)
    x0, y0 = max(0, x - 2), max(0, y - 2); x1, y1 = min(dst.shape[1], x + w + 2), min(dst.shape[0], y + h + 2)
    if x1 <= x0 or y1 <= y0: return
    M = cv2.getAffineTransform(np.float32(ts), td - np.float32([x0, y0]))
    patch = cv2.warpAffine(src, M, (x1 - x0, y1 - y0), flags=cv2.INTER_LINEAR, borderMode=cv2.BORDER_CONSTANT, borderValue=(0, 0, 0, 0))
    m = np.zeros((y1 - y0, x1 - x0), np.uint8); cv2.fillConvexPoly(m, np.int32(np.round((td - np.float32([x0, y0])) * 16)), 1, shift=4)
    ring = (cv2.dilate(m, np.ones((3, 3), np.uint8)) > 0) & (m == 0)
    m = m.astype(bool)
    reg = dst[y0:y1, x0:x1]
    reg[m] = patch[m]                                   # the triangle itself
    gap = ring & (reg[..., 3] <= 0.0)                   # its rim only where nothing is drawn yet (no hairline gaps)
    reg[gap] = patch[gap]


def build_strip(limb):
    lab, ub, lb, et, eb, rc, wd = STRIP[limb]
    w = STANCE
    J0, J1, J2 = I(w[ub][0]), I(w[lb][0]), I(tip(w, lb))
    et, eb, rc, W = et * IPX, eb * IPX, rc * IPX, wd * IPX
    n = int(np.ceil((et + np.linalg.norm(J1 - J0) + np.linalg.norm(J2 - J1) + eb) / STEP)) + 1
    pts, total = path_points(J0, J1, J2, et, eb, rc, n)
    rows = np.linspace(0, total, n)
    tex = np.zeros((int(np.ceil(total)) + 1, int(np.ceil(W)) + 1, 4), np.float32)
    srcl = completed(lab)
    for ts, td in tris(pts, W / 2, rows, W):  # straighten: limb → texture
        warp_tri(srcl, tex, ts, td)
    # the top rows the illustration hides (a thigh under the hips and belt): carry the first full row up
    a = tex[..., 3]; cov = (a > 0.5).sum(1); top = int(et) + 1
    ref = next((y for y in range(int(et), min(len(cov), int(et + 0.06 * IPX))) if cov[y] >= 0.85 * np.median(cov[int(et):int(et + 0.15 * IPX)])), None)
    if ref is not None and limb.startswith('leg'):
        tex[:ref] = tex[ref]
    return dict(tex=tex, et=et, eb=eb, rc=rc, W=W, total=total, n=n, bones=(ub, lb))


STRIPS = {k: build_strip(k) for k in STRIP}

# ---------------------------------------------------------------- hands and sword (the lab's art, 512 px per B)
def load_png(path):
    im = np.array(Image.open(path).convert('RGBA')).astype(np.float32) / 255.0
    im[..., :3] *= im[..., 3:]
    return im


HM = json.load(open(f'{WORK}/parts_hands.json'))['parts']
BM = json.load(open(f'{WORK}/parts_basic.json'))['parts']
def hand_img(state, far, back=False):
    n = f'basic_{state}{"_back" if back else ""}'
    if n not in HM: return None
    return load_png(f'{WORK}/hands/{n}{"_far" if far else ""}.png'), HM[n]['pivots']
SWORD = (load_png(f'{WORK}/parts_basic/sword.png'), BM['sword']['pivots'][0])

# ---------------------------------------------------------------- poses
D = json.load(open(ANIMS)); NAMES = [b['name'] for b in D['bones']]; RB = D['B']
def world_of(frame, b):
    i = NAMES.index(b); a, bb, c, dd, tx, ty = frame['world'][i * 6:i * 6 + 6]
    return (tx / RB, ty / RB), math.degrees(math.atan2(bb, a))


def pose_of(frame, swap):
    """Local deltas (the rig's convention) from the lab's world transforms; the arms' motions swapped if asked."""
    W_ = {b: world_of(frame, b) for b in BONES}
    root = world_of(frame, 'root')[0]
    pose = {}
    for b, (p, (lx, ly), r, _l) in BONES.items():
        if p is None:
            pose['dx'] = W_[b][0][0] - root[0] - lx; pose['dy'] = W_[b][0][1] - root[1] - ly; pose['hip'] = W_[b][1]
        else:
            d = W_[b][1] - W_[p][1] - r; pose[b] = (d + 180) % 360 - 180
    if swap:
        for a, c in (('uparm_F', 'uparm_B'), ('forearm_F', 'forearm_B'), ('hand_F', 'hand_B')): pose[a], pose[c] = pose[c], pose[a]
    sw = dict(frame['swaps'])
    if swap: sw['handF'], sw['handB'] = frame['swaps'].get('handB'), frame['swaps'].get('handF')
    return pose, root, sw, frame['order']


def fk_full(pose):
    w = fk(pose)
    # the near hand's socket (the lab's `offhand`): like the sword socket, square to the fist
    (hx, hy), hr = w['hand_B']; L = BONES['hand_B'][3]
    w['offhand'] = ((hx + math.cos(math.radians(hr)) * L, hy + math.sin(math.radians(hr)) * L), hr - 90 + pose.get('weapon', 0))
    return w

# ---------------------------------------------------------------- rendering
def render(pose, root, swaps, order, S, swap=True):
    """One frame at S px per B, feet centre at (CW/2, GY)."""
    CW, CH = int(1.9 * S), int(1.75 * S); OX, GY = CW / 2, int(1.42 * S)
    w = fk_full(pose)
    O = lambda q: np.array([OX + (q[0] + root[0]) * S, GY + (q[1] + root[1]) * S])
    can = np.zeros((CH, CW, 4), np.float32)
    def over(lay):
        nonlocal can
        can = lay + can * (1 - lay[..., 3:4])
    def rigid(name):
        img, bone = RIGID[name]
        (bx, by), br = STANCE[bone]; (cx, cy), cr = w[bone]
        k = S / IPX; th = math.radians(cr - br); c, s = math.cos(th), math.sin(th)
        bp = I((bx, by)); cp = O((cx, cy))
        # illustration px → output px: about the bone's stance position, turned by the bone's turn since the stance
        M = np.float32([[k * c, -k * s, cp[0] - k * (c * bp[0] - s * bp[1])], [k * s, k * c, cp[1] - k * (s * bp[0] + c * bp[1])]])
        over(cv2.warpAffine(img, M, (CW, CH), flags=cv2.INTER_AREA if k < 1 else cv2.INTER_LINEAR, borderValue=(0, 0, 0, 0)))
    def strip(limb_tex, ub, lb, far=False):
        st = STRIPS[limb_tex]; k = S / IPX
        J0, J1, J2 = O(w[ub][0]), O(w[lb][0]), O(tip(w, lb))
        pts, total = path_points(J0, J1, J2, st['et'] * k, st['eb'] * k, st['rc'] * k, st['n'])
        rows = np.linspace(0, st['total'], st['n'])
        lay = np.zeros((CH, CW, 4), np.float32)
        tex = st['tex'] * (np.array([0.9, 0.9, 0.9, 1.0], np.float32) if far else 1.0)
        for td, ts in tris(pts, st['W'] * k / 2, rows, st['W']):
            warp_tri(tex, lay, ts, td)
        over(lay)
    def sprite(img, piv, at, rot_deg, scale):
        """A lab sprite (512 px per B) with its pivot at `at` (output px), turned rot_deg."""
        k = S / 512 * scale; th = math.radians(rot_deg); c, s = math.cos(th), math.sin(th)
        M = np.float32([[k * c, -k * s, at[0] - k * (c * piv[0] - s * piv[1])], [k * s, k * c, at[1] - k * (s * piv[0] + c * piv[1])]])
        over(cv2.warpAffine(img, M, (CW, CH), flags=cv2.INTER_AREA, borderValue=(0, 0, 0, 0)))
    def hand(side, layer_='front'):
        far = side == 'F'; state = swaps.get('hand' + side) or ('relaxed' if not far else 'grip')
        if not swap and side == 'F' and state not in ('grip', 'grip2'): pass
        h = hand_img(state, far, back=(layer_ == 'back'))
        if h is None: return
        img, piv = h; wp = O(w[f'hand_{side}'][0])
        sprite(img, piv[0], wp, w[f'hand_{side}'][1] - 90, HAND_K)
    def sword(side):
        bone = 'offhand' if side == 'B' else 'weapon'
        if bone == 'weapon':
            (hx, hy), hr = w['hand_F']; L = BONES['hand_F'][3]
            w['weapon'] = ((hx + math.cos(math.radians(hr)) * L, hy + math.sin(math.radians(hr)) * L), hr - 90 + pose.get('weapon', 0))
        # the grip point sits in the (scaled) fist: the hand's own grip pivot, not the rig's socket length
        st = swaps.get('hand' + side) or 'grip'
        h = hand_img(st if st in ('grip', 'grip2') else 'grip', side == 'F')
        (hx, hy), hr = w[f'hand_{side}']; wrist = O((hx, hy))
        gp = np.array(h[1][1]) - np.array(h[1][0]); th = math.radians(hr - 90); c, s = math.cos(th), math.sin(th)
        at = wrist + (S / 512) * HAND_K * np.array([c * gp[0] - s * gp[1], s * gp[0] + c * gp[1]])
        sprite(SWORD[0], SWORD[1], at, w[bone][1], 1.0)
    held = 'B' if swap else 'F'; free = 'F' if swap else 'B'
    sword_behind_head = bool(order)  # the lab's attack moves the grip behind the head while the blade is over it
    grip = lambda: (hand(held, 'back'), sword(held), hand(held, 'front'))
    # back to front
    strip('arm', 'uparm_F', 'forearm_F', far=True)
    if swap: hand('F')
    rigid('foot_F'); strip('leg_F', 'thigh_F', 'shin_F')
    rigid('foot_B'); strip('leg_B', 'thigh_B', 'shin_B')
    rigid('hips'); rigid('torso'); rigid('belt')
    strip('arm', 'uparm_B', 'forearm_B')
    if not swap: hand('B')
    if sword_behind_head: grip()
    rigid('head')
    if not sword_behind_head: grip()
    return can


def to_img(can, bg=(24, 30, 42)):
    a = can[..., 3:4]; rgb = can[..., :3] + (1 - a) * (np.array(bg, np.float32) / 255.0)
    return Image.fromarray((np.clip(rgb, 0, 1) * 255).astype(np.uint8))


if __name__ == '__main__':
    import itertools
    sel = {'idle': [0], 'run': [0, 3, 6, 10], 'jump': [3, 6, 10, 15], 'attack': [2, 5, 8, 10, 13, 17]}
    swap = not KEEP_ARMS
    for an, idxs in itertools.chain(sel.items(), [('all', None)]):
        if an == 'all': break
        for i in idxs:
            fr = D['anims'][an]['frames'][i]
            pose, root, sw, order = pose_of(fr, swap)
            for S in (370, 150):
                big = render(pose, root, sw, order, 2 * S, swap)  # drawn at twice the size, then reduced (smooth edges)
                can = cv2.resize(big, (int(1.9 * S), int(1.75 * S)), interpolation=cv2.INTER_AREA)
                to_img(can).save(f'{OUT}/{an}_{i:02d}_{S}.png')
    print('done', OUT)
