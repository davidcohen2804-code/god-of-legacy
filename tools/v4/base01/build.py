# BASE-01 builder. One locked master drawing (the base body) and the template measured on it (template.json: joints,
# cuts, limbs) give the part map: every pixel of the canvas belongs to one part (head, torso, pelvis, the arms, hands,
# legs, feet). The base body is cut by that map into the rig's pieces: rigid pieces about their joints, arms and legs
# straightened into strips along their bones (rows tied to the joints, so they bend at the elbow and the knee).
#
# An item is ONE picture from the art director: the same base body wearing just that item. It never comes back pixel-
# identical, so it is first lined up with the master (an affine fit of the two silhouettes, using only the body outside
# the item's own region), checked (the body outside the item's region must match the master, else the picture is
# rejected), and then its item pixels are found inside the item's region (they differ from the master, or lie outside
# its silhouette). Those pixels are cut by the SAME part map into the SAME pieces as the body under them, so the item
# bends exactly with the body. No hand work per item: the item list says only its picture, its slot and its name.
#
# Usage: build.py <out dir>     (reads template.json, items.json and the pictures next to this file)
import json, math, os, sys
import numpy as np
import cv2
from PIL import Image
from scipy import ndimage

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
sys.path.insert(0, os.path.join(HERE, '../studio'))
import template_lib as tl  # noqa: E402
from keying import key  # noqa: E402

OUT = sys.argv[1]
os.makedirs(OUT, exist_ok=True)
T = json.load(open(os.path.join(HERE, 'template.json')))
J = {n: np.array(p, np.float64) for n, p in T['joints'].items()}
BPX = float(T['ground'] - T['top'])            # drawing px per B (sole to the top of the hair)
ABPX = T['atlas_bpx']
K = ABPX / BPX                                  # atlas px per drawing px
ROOT = np.array([(J['ankle_B'][0] + J['ankle_F'][0]) / 2, T['ground']])
SH = tuple(T['size'][::-1])
YY, XX = np.mgrid[0:SH[0], 0:SH[1]].astype(np.float32)


def B(v): return float(v) / BPX


def unit(a, b): d = np.asarray(b, float) - np.asarray(a, float); return d / np.linalg.norm(d)


def beyond(p, d):
    """Signed distance of every pixel past the line through p square to direction d (positive = further along d)."""
    return (XX - p[0]) * d[0] + (YY - p[1]) * d[1]


def left_of(a, b):
    """Positive on the left of the directed line a→b (image coordinates, y down: 'left' = counter-clockwise side)."""
    return (b[0] - a[0]) * (YY - a[1]) - (b[1] - a[1]) * (XX - a[0])


def under_poly(pts):
    """True below a polyline y(x) (x increasing), clamped at its ends."""
    xs, ys = zip(*pts)
    return YY > np.interp(XX, xs, ys)


def disk(c, r): return (XX - c[0]) ** 2 + (YY - c[1]) ** 2 <= r * r


def component(mask, seed):
    lab, _ = ndimage.label(mask)
    v = lab[int(seed[1]), int(seed[0])]
    return lab == v if v else np.zeros_like(mask)


# ------------------------------------------------------------------ the part map, measured on the master
C = T['cuts']
PARTS = ['head', 'torso', 'pelvis', 'arm_B', 'arm_F', 'hand_B', 'hand_F', 'leg_B', 'leg_F', 'foot_B', 'foot_F']


def part_map(m):
    """Labels for the master's figure pixels `m`: one boolean mask per part."""
    L = {}
    below_head = under_poly(C['head'])
    L['head'] = m & ~below_head
    R = m & below_head
    for s in 'BF':
        # the arm and its hand: the part of the figure hanging free of the body below the armpit, joined to the arm's
        # top above it (cut from the shoulder by the line from the armpit up through the shoulder joint)
        a, b = np.array(C[f'armpit_{s}'], float), J[f'shoulder_{s}']
        top_end = b + (b - a) * 0.9
        outer = left_of(a, top_end) < 0 if s == 'B' else left_of(a, top_end) > 0
        free = component(R & (YY >= a[1]), J[f'elbow_{s}'] * 0.5 + J[f'wrist_{s}'] * 0.5)
        upper = R & (YY < a[1]) & outer
        arm = free | upper
        d = unit(J[f'elbow_{s}'], J[f'wrist_{s}'])
        L[f'hand_{s}'] = arm & (beyond(J[f'wrist_{s}'], d) > 0)
        L[f'arm_{s}'] = arm & ~L[f'hand_{s}']
    arms = L['arm_B'] | L['arm_F'] | L['hand_B'] | L['hand_F']
    body = R & ~arms
    below_v = under_poly(C['hips'])
    legs = body & below_v
    split = left_of(np.array(C['crotch'][0], float), np.array(C['crotch'][1], float)) > 0  # the near leg's side
    for s in 'BF':
        leg = legs & (split if s == 'B' else ~split)
        d = unit(J[f'knee_{s}'], J[f'ankle_{s}'])
        L[f'foot_{s}'] = leg & (beyond(J[f'ankle_{s}'], d) > 0)
        L[f'leg_{s}'] = leg & ~L[f'foot_{s}']
    trunk = body & ~below_v
    L['pelvis'] = trunk & under_poly(C['waist'])
    L['torso'] = trunk & ~L['pelvis']
    return L


def label_field(L, allowed=None):
    """Every canvas pixel → the part of the nearest master figure pixel (only `allowed` parts): where an item reaches
    past the body (a loose sleeve, a wide trouser leg) it belongs to the part it hangs from."""
    names = [n for n in PARTS if allowed is None or n in allowed]
    lab = np.zeros(SH, np.int32)
    for i, n in enumerate(names, 1): lab[L[n]] = i
    _, (iy, ix) = ndimage.distance_transform_edt(lab == 0, return_indices=True)
    full = lab[iy, ix]
    return {n: full == i for i, n in enumerate(names, 1)}


# ------------------------------------------------------------------ the skeleton (as the lab's rigs read it)
def ang(a, b): d = J[b] - J[a]; return math.degrees(math.atan2(d[1], d[0]))


BONE_JOINTS = {
    'uparm_B': ('shoulder_B', 'elbow_B'), 'forearm_B': ('elbow_B', 'wrist_B'),
    'uparm_F': ('shoulder_F', 'elbow_F'), 'forearm_F': ('elbow_F', 'wrist_F'),
    'thigh_B': ('hip_B', 'knee_B'), 'shin_B': ('knee_B', 'ankle_B'),
    'thigh_F': ('hip_F', 'knee_F'), 'shin_F': ('knee_F', 'ankle_F'),
}
WORLD = {'hip': 0.0, 'chest': 0.0, 'head': 0.0, 'foot_B': 0.0, 'foot_F': 0.0}
for bone, (a, b) in BONE_JOINTS.items(): WORLD[bone] = ang(a, b)
WORLD['hand_B'] = WORLD['forearm_B']; WORLD['hand_F'] = WORLD['forearm_F']
LEN = {bone: B(np.linalg.norm(J[b] - J[a])) for bone, (a, b) in BONE_JOINTS.items()}


def rel(child, parent):
    d = J[child] - J[parent]
    return [round(B(d[0]), 5), round(B(d[1]), 5)]


GEO = {
    'hip': [round(B(J['pelvis'][0] - ROOT[0]), 5), round(B(J['pelvis'][1] - ROOT[1]), 5)],
    'chest': rel('waist', 'pelvis'), 'head': rel('head', 'waist'),
    'uparm_B': rel('shoulder_B', 'waist'), 'uparm_F': rel('shoulder_F', 'waist'),
    'thigh_B': rel('hip_B', 'pelvis'), 'thigh_F': rel('hip_F', 'pelvis'),
}
PIVOT = {'head': 'head', 'torso': 'waist', 'pelvis': 'pelvis', 'hand_B': 'wrist_B', 'hand_F': 'wrist_F', 'foot_B': 'ankle_B', 'foot_F': 'ankle_F'}
LIMBS = T['limbs']

# ------------------------------------------------------------------ pieces
FRAMES = {}


def put_rigid(name, layer, pivot):
    crop, (x0, y0) = tl.crop_alpha(tl.resize_premul(layer, K))
    if crop.shape[0] < 2: return False
    FRAMES[name] = dict(img=crop, pivot=[round(pivot[0] * K - x0, 2), round(pivot[1] * K - y0, 2)])
    return True


def strip(limb, layer):
    lm = LIMBS[limb]
    j0, j1, j2 = (J[n] for n in lm['joints'])
    top, bottom, bend, width = (lm[k] * BPX for k in ('top', 'bottom', 'bend', 'width'))
    k2 = 0.5 / K  # sample at twice the atlas resolution, then reduce
    tex, rows = tl.straighten(layer, j0, j1, j2, top, bottom, bend, width, k2)
    tex = tl.round_end(tex, rows['top'], width / k2 * 0.36, up=True)
    return tl.resize_premul(tex, 0.5), {k: v * 0.5 for k, v in rows.items()}


def put_strip(name, limb, layer):
    tex, rows = strip(limb, layer)
    if (tex[..., 3] > 0.05).sum() < 20: return False
    FRAMES[name] = dict(img=tex, pivot=[round(tex.shape[1] / 2, 2), round(rows['top'], 2)], rows={k: round(v, 2) for k, v in rows.items()})
    return True


def limb_layer(limb, own, around, alpha, fg):
    """A limb piece's pixels: its own part, plus (inside the round cap at its top joint) the pixels of the part it
    hangs from (the cap lies over / under that part), plus the next part's pixels just past its end joint (hidden under
    the hand or the foot)."""
    lm = LIMBS[limb]
    j0, j1, j2 = (J[n] for n in lm['joints'])
    cap = disk(j0, lm['top'] * BPX) & around['top']
    d = unit(j1, j2)
    end = around['end'] & (beyond(j2, d) < lm['bottom'] * BPX) & disk(j2, lm['width'] * BPX * 0.6)
    w = (own | cap | end).astype(np.float32)
    return tl.premul(alpha, fg, w)


def fill_under(layer, region, known):
    """Carry a piece on where something in front hides it (inpainted from its own visible pixels)."""
    return tl.inpaint_rgba(layer, known, region, radius=6)


def cut_body(prefix, alpha, fg, L, base=True, item_slot=None, rigid=False):
    """The pieces of one figure (the base body, or an item's own pixels) cut by the part map L."""
    made = []
    lay = lambda m: tl.premul(alpha, fg, m.astype(np.float32))
    if L['head'].any() and put_rigid(f'{prefix}/head', lay(L['head']), J['head']): made.append(('head', f'{prefix}/head'))
    # the torso carries on a little under the head (the neck) and under the hips' piece (the belly): a tilted head or
    # a bent waist never opens a gap
    tl_ = lay(L['torso'])
    if base:
        neck = (YY > J['head'][1] - 0.035 * BPX) & (YY < J['neck'][1] + 4) & (np.abs(XX - J['neck'][0]) < 0.034 * BPX)
        belly_x = np.where(L['torso'][int(J['waist'][1])])[0]
        belly = (YY >= J['waist'][1]) & (YY < J['pelvis'][1] + 0.01 * BPX) & (XX > belly_x.min() + 6) & (XX < belly_x.max() - 6)
        known = L['torso'] & (alpha > 0.9) & (fg.max(2) > 140)
        tl_ = fill_under(tl_, (neck & ~L['torso']) | (belly & ~L['torso']), known)
    if L['torso'].any() and put_rigid(f'{prefix}/torso', tl_, J['waist']): made.append(('torso', f'{prefix}/torso'))
    pl = lay(L['pelvis'])
    if not base and L['pelvis'].any() and item_slot == 'bottom':
        # the trousers' waist carries on a little up under the top (hidden art): a top's hem riding the chest never
        # opens a gap onto the belly when the hips and the chest turn apart
        rows = np.where(L['pelvis'].any(1))[0]; ty = rows.min()
        cols = np.where(L['pelvis'][ty + 6])[0]
        band = L['pelvis'] & (YY < ty + 0.02 * BPX) & (alpha > 0.9)
        px_ = fg[band]
        if len(px_):
            col = np.median(px_, axis=0)
            up = (YY >= ty - 0.03 * BPX) & (YY < ty + 3) & (XX > cols.min() + 3) & (XX < cols.max() - 3) & ~L['pelvis']
            pl[up, :3] = col; pl[up, 3] = 1.0
    if L['pelvis'].any() and put_rigid(f'{prefix}/pelvis', pl, J['pelvis']): made.append(('pelvis', f'{prefix}/pelvis'))
    for s in 'BF':
        if rigid and L[f'arm_{s}'].any():
            # rigid plates: cut at the elbow (square to the bend's bisector), a little overlap each way; the upper plate
            # turns about the shoulder, the lower about the elbow
            a1 = unit(J[f'shoulder_{s}'], J[f'elbow_{s}']); a2 = unit(J[f'elbow_{s}'], J[f'wrist_{s}'])
            nb = (a1 + a2) / np.linalg.norm(a1 + a2)
            side = beyond(J[f'elbow_{s}'], nb)
            # the upper plate also carries the shoulder plate's part over the chest (a copy: the chest keeps its own)
            cap = disk(J[f'shoulder_{s}'], LIMBS[f'arm_{s}']['top'] * BPX * 1.25) & L['torso']
            up_, lo_ = (L[f'arm_{s}'] | cap) & (side < 4), L[f'arm_{s}'] & (side > -4)
            if up_.any() and put_rigid(f'{prefix}/uparm_{s}', lay(up_), J[f'shoulder_{s}']): made.append((f'uparm_{s}', f'{prefix}/uparm_{s}'))
            if lo_.any() and put_rigid(f'{prefix}/forearm_{s}', lay(lo_), J[f'elbow_{s}']): made.append((f'forearm_{s}', f'{prefix}/forearm_{s}'))
        elif L[f'arm_{s}'].any() and put_strip(f'{prefix}/arm_{s}', f'arm_{s}', limb_layer(f'arm_{s}', L[f'arm_{s}'], {'top': L['torso'], 'end': L[f'hand_{s}']}, alpha, fg)):
            made.append((f'arm_{s}', f'{prefix}/arm_{s}'))
        if L[f'leg_{s}'].any() and put_strip(f'{prefix}/leg_{s}', f'leg_{s}', limb_layer(f'leg_{s}', L[f'leg_{s}'], {'top': L['pelvis'], 'end': L[f'foot_{s}']}, alpha, fg)):
            made.append((f'leg_{s}', f'{prefix}/leg_{s}'))
        for p in (f'hand_{s}', f'foot_{s}'):
            if L[p].any() and put_rigid(f'{prefix}/{p}', lay(L[p]), J[PIVOT[p]]): made.append((p, f'{prefix}/{p}'))
    return made


# ------------------------------------------------------------------ the base body
alpha0, fg0 = key(os.path.join(HERE, T['master']))
fg0n = fg0 / 255.0
M0 = alpha0 > 0.5
L0 = part_map(M0)
ITEMS = []
base_parts = cut_body('base', alpha0, fg0n, L0)
# the grip hands, from the hands picture: each fist cut below its wrist, scaled to the master, turned so its forearm
# lines up with the master's forearm, and seated on the master's wrist; the grip (where a handle passes through the
# fist) is carried along for the weapon's socket
HANDS = T['hands']
alpha_h, fg_h = key(os.path.join(HERE, HANDS['picture']))
GRIP = {}
for s in 'BF':
    h = HANDS[s]
    w0, ax, gp = np.array(h['wrist'], float), np.array(h['axis'], float), np.array(h['grip'], float)
    ax = ax / np.linalg.norm(ax)
    zone = (beyond(w0, ax) > -2) & disk(w0, 0.14 * BPX)
    own = component(zone & (alpha_h > 0.5), gp)          # the fist alone (not the shorts beside it)
    sel = ndimage.binary_dilation(own, iterations=2) & zone & (alpha_h > 0.02)
    lay = tl.premul(alpha_h, fg_h / 255.0, sel.astype(np.float32) * np.clip((beyond(w0, ax) + 2) / 4, 0, 1))
    k = BPX / HANDS['height']
    a_pic = math.degrees(math.atan2(ax[1], ax[0])); a_m = WORLD[f'forearm_{s}']
    M = cv2.getRotationMatrix2D((float(w0[0]), float(w0[1])), -(a_m - a_pic), k)  # (cv2: positive = counter-clockwise)
    M[:, 2] += J[f'wrist_{s}'] - w0
    lay = cv2.warpAffine(lay, M, (SH[1], SH[0]), flags=cv2.INTER_LINEAR, borderValue=(0, 0, 0, 0))
    g = M @ np.array([gp[0], gp[1], 1.0])
    GRIP[s] = g
    put_rigid(f'base/hand_{s}_grip', lay, J[f'wrist_{s}'])
HAND_LEN = {s: B(np.linalg.norm(GRIP[s] - J[f'wrist_{s}'])) for s in 'BF'}
ITEMS.append({'id': 'base01_body', 'slot': 'body', 'name': 'BASE-01 body', 'parts': [{'part': p, 'frame': f} for p, f in base_parts]})

# ------------------------------------------------------------------ items
SLOT_PARTS = {
    'top': ['torso', 'pelvis', 'arm_B', 'arm_F'],
    'bottom': ['pelvis', 'leg_B', 'leg_F'],
    'shoes': ['foot_B', 'foot_F', 'leg_B', 'leg_F'],
    'hat': ['head'],
    'gloves': ['hand_B', 'hand_F', 'arm_B', 'arm_F'],
}
# what a slot's pixels in a part become: a top's hem below the waist rides the chest with the rest of the top
SLOT_REMAP = {'top': {'pelvis': 'torso'}}
REPORT = []


def align(alpha_i, region):
    """Affine fit (master → item) of the two silhouettes outside the item's own region."""
    s = 0.5
    a = cv2.GaussianBlur(cv2.resize(alpha0.astype(np.float32), None, fx=s, fy=s, interpolation=cv2.INTER_AREA), (0, 0), 2.5)
    b = cv2.GaussianBlur(cv2.resize(alpha_i.astype(np.float32), None, fx=s, fy=s, interpolation=cv2.INTER_AREA), (0, 0), 2.5)
    keep = cv2.resize((~ndimage.binary_dilation(region, iterations=25)).astype(np.uint8), None, fx=s, fy=s, interpolation=cv2.INTER_NEAREST)
    # start from the two figures' boxes (same height from the soles to the top of the hair, same feet): a picture
    # drawn bigger or lower still converges
    def box(al):
        ys, xs = np.where(al > 0.5); return xs.min(), xs.max(), ys.min(), ys.max()
    x0a, x1a, y0a, y1a = box(alpha0); x0b, x1b, y0b, y1b = box(alpha_i)
    k0 = (y1b - y0b) / (y1a - y0a)
    c0 = np.array([(x0a + x1a) / 2, y1a]); c1 = np.array([(x0b + x1b) / 2, y1b])
    warp = np.array([[k0, 0, (c1[0] - k0 * c0[0]) * s], [0, k0, (c1[1] - k0 * c0[1]) * s]], np.float32)
    crit = (cv2.TERM_CRITERIA_EPS | cv2.TERM_CRITERIA_COUNT, 400, 1e-7)
    cc, warp = cv2.findTransformECC(a, b, warp, cv2.MOTION_AFFINE, crit, keep, 5)
    warp[:, 2] /= s
    return cc, warp




def edges(rgb):
    g = cv2.cvtColor(rgb, cv2.COLOR_RGB2GRAY).astype(np.float32)
    gx = cv2.Sobel(g, cv2.CV_32F, 1, 0, ksize=3); gy = cv2.Sobel(g, cv2.CV_32F, 0, 1, ksize=3)
    return cv2.GaussianBlur(np.sqrt(gx * gx + gy * gy), (0, 0), 1.5)


MASTER_RGB = None
LIMB_PARTS = {'arm_B': ['arm_B', 'hand_B'], 'arm_F': ['arm_F', 'hand_F'], 'leg_B': ['leg_B', 'foot_B'], 'leg_F': ['leg_F', 'foot_F']}
REFINE = {}


def refine_limbs(al, field):
    e0 = edges(MASTER_RGB); e1 = edges(al)
    out = al.copy()
    for limb, parts in LIMB_PARTS.items():
        own = np.any([L0[p] for p in parts], axis=0)
        msk = ndimage.binary_dilation(own, iterations=14)
        w = np.eye(2, 3, dtype=np.float32)
        try:
            cc, w = cv2.findTransformECC(e0, e1, w, cv2.MOTION_EUCLIDEAN, (cv2.TERM_CRITERIA_EPS | cv2.TERM_CRITERIA_COUNT, 200, 1e-6), msk.astype(np.uint8), 3)
        except cv2.error:
            continue
        shift = float(np.hypot(w[0, 2], w[1, 2])); rot = float(np.degrees(np.arctan2(w[1, 0], w[0, 0])))
        REFINE[limb] = (round(shift, 1), round(rot, 2))
        if shift > 30 or abs(rot) > 12: continue  # not a small correction: leave it to the check
        moved = cv2.warpAffine(al, w, (SH[1], SH[0]), flags=cv2.INTER_LINEAR | cv2.WARP_INVERSE_MAP, borderValue=(255, 0, 255))
        sel = np.any([field[p] for p in parts], axis=0)
        out[sel] = moved[sel]
    return out


MASTER_RGB = np.asarray(Image.open(os.path.join(HERE, T['master'])).convert('RGB'))
items_spec = json.load(open(os.path.join(HERE, 'items.json')))
for it in items_spec:
    path = os.path.join(HERE, it['picture'])
    if not os.path.exists(path): continue
    if it['slot'] == 'weapon':
        # a weapon is drawn on its own, lying flat, blade to the right: keyed, scaled so its grip fits the fist (the
        # grip's drawn thickness → the fist's handle size), its pivot at the middle of the grip
        aw, fw = key(path)
        own = component(aw > 0.5, it['grip'])
        lay = tl.premul(aw, fw / 255.0, (ndimage.binary_dilation(own, iterations=2) & (aw > 0.02)).astype(np.float32))
        kw = it.get('handle', 30.0) / it['grip_thickness']
        small = tl.resize_premul(lay, K * kw)
        crop, (x0, y0) = tl.crop_alpha(small)
        name = f"{it['id']}/weapon"
        FRAMES[name] = dict(img=crop, pivot=[round(it['grip'][0] * K * kw - x0, 2), round(it['grip'][1] * K * kw - y0, 2)])
        ITEMS.append({'id': it['id'], 'slot': 'weapon', 'name': it['name'], 'parts': [{'part': 'weapon', 'frame': name}]})
        REPORT.append({'id': it['id'], 'scale': round(kw, 3), 'accepted': True})
        continue
    img = np.asarray(Image.open(path).convert('RGB'))
    alpha_i, _ = key(Image.fromarray(img))
    allowed = SLOT_PARTS[it['slot']]
    field = label_field(L0, None)
    region = np.any([field[p] for p in allowed], axis=0)
    if it['slot'] == 'shoes':  # a boot reaches up the shin at most two thirds of the way to the knee
        for s_ in 'BF':
            d_ = unit(J[f'knee_{s_}'], J[f'ankle_{s_}']); L_ = np.linalg.norm(J[f'ankle_{s_}'] - J[f'knee_{s_}'])
            region &= ~(field[f'leg_{s_}'] & (beyond(J[f'knee_{s_}'], d_) < L_ * it.get('shaft_from', 0.35)))
    cc, warp = align(alpha_i, np.any([L0[p] for p in allowed], axis=0))
    al = cv2.warpAffine(img, warp, (SH[1], SH[0]), flags=cv2.INTER_LINEAR | cv2.WARP_INVERSE_MAP, borderValue=(255, 0, 255))
    # each limb is then lined up on its own (a picture's arm or leg can sit a few px off even when the body fits): a
    # rigid fit of the limb's edges, its hand or foot included, piecewise over the limb's part of the canvas
    al = refine_limbs(al, field)
    alpha_a, fg_a = key(Image.fromarray(al))
    # check: outside the item's own region the picture must still be the master
    outside = M0 & ~ndimage.binary_dilation(np.any([L0[p] for p in allowed], axis=0), iterations=30)
    diff = np.abs(fg_a.astype(np.float32) - fg0.astype(np.float32)).mean(2)
    err = float(np.median(diff[outside])) if outside.any() else 0.0
    sil = float(np.mean(np.abs((alpha_a > 0.5) ^ M0)[outside | (~M0 & ~ndimage.binary_dilation(np.any([L0[p] for p in allowed], axis=0), iterations=30))]))
    ok = err < it.get('max_err', 40) and sil < 0.02
    REPORT.append({'id': it['id'], 'ecc': round(float(cc), 4), 'median_colour_err_outside': round(err, 1), 'silhouette_mismatch_outside': round(sil, 4), 'accepted': ok})
    if not ok:
        print('REJECTED', it['id'], REPORT[-1]); continue
    # the item's own pixels: inside its region, opaque in the picture, and either off the master's silhouette or
    # clearly different from the master there
    dl = cv2.GaussianBlur(diff, (0, 0), 1.2)
    lab_a = cv2.cvtColor(al, cv2.COLOR_RGB2LAB).astype(np.float32); lab_0 = cv2.cvtColor(np.asarray(Image.open(os.path.join(HERE, T['master'])).convert('RGB')), cv2.COLOR_RGB2LAB).astype(np.float32)
    # which pixels are the item: a colour model of the item against the body (GrabCut). Sure item: inside the item's
    # region and far from the master's colour there, or off the master's silhouette; sure body: everything outside the
    # region (skin, hair, shorts, the ground); in between, the graph cut decides with the two colour models and
    # smoothness, so a re-rendered skin tone or a limb drawn a few px off never becomes part of the item
    dE = cv2.GaussianBlur(np.sqrt(((lab_a - lab_0) ** 2).sum(2)), (0, 0), 1.5)
    core = ndimage.binary_erosion(region, iterations=6)
    gc = np.full(SH, cv2.GC_BGD, np.uint8)
    inreg = region & (alpha_a > 0.5)
    gc[inreg] = cv2.GC_PR_BGD
    gc[inreg & (dE > it.get('threshold', 22))] = cv2.GC_PR_FGD
    gc[core & (alpha_a > 0.5) & M0 & (dE > it.get('sure', 45))] = cv2.GC_FGD
    gc[inreg & ~M0] = cv2.GC_PR_FGD  # off the master's silhouette: the item reaching past the body, or a limb drawn a little off
    ys_, xs_ = np.where(ndimage.binary_dilation(region, iterations=20))
    y0_, y1_, x0_, x1_ = ys_.min(), ys_.max() + 1, xs_.min(), xs_.max() + 1
    sub = gc[y0_:y1_, x0_:x1_].copy()
    # some sure body inside the crop too: the master's own colours where the picture matches them closely
    sub[(sub == cv2.GC_PR_BGD) & (dE[y0_:y1_, x0_:x1_] < 6)] = cv2.GC_BGD
    bgd = np.zeros((1, 65), np.float64); fgd = np.zeros((1, 65), np.float64)
    cv2.grabCut(np.ascontiguousarray(al[y0_:y1_, x0_:x1_]), sub, None, bgd, fgd, 6, cv2.GC_INIT_WITH_MASK)
    item = np.zeros(SH, bool)
    item[y0_:y1_, x0_:x1_] = (sub == cv2.GC_FGD) | (sub == cv2.GC_PR_FGD)
    item &= region & (alpha_a > 0.5)
    # slivers (a limb's outline drawn a few px off) are thin: an opening with a disc cuts them off the item, only the
    # item's real pieces are kept, and their own edge is given back
    op = it.get('sliver', 4)
    disc_ = disk((op, op), op)[:2 * op + 1, :2 * op + 1]
    body_ = ndimage.binary_opening(item, structure=disc_)
    lab_, n_ = ndimage.label(body_)
    if n_:
        sizes = ndimage.sum(body_, lab_, range(1, n_ + 1))
        body_ = np.isin(lab_, 1 + np.where(sizes > max(400, 0.04 * sizes.max()))[0])
    item = item & ndimage.binary_dilation(body_, structure=disc_, iterations=1)
    item = ndimage.binary_closing(item, iterations=2)
    item = ndimage.binary_fill_holes(item) & region
    wgt = np.minimum(alpha_a, ndimage.gaussian_filter(item.astype(np.float32), 0.7) * 1.0)
    Li = {}
    remap = SLOT_REMAP.get(it['slot'], {})
    for p in PARTS:
        Li[p] = np.zeros(SH, bool)
    for p in allowed:
        Li[remap.get(p, p)] = Li[remap.get(p, p)] | (item & field[p])
    made = cut_body(it['id'], wgt, fg_a / 255.0, Li, base=False, item_slot=it['slot'], rigid=it.get('rigid', False))
    ITEMS.append({'id': it['id'], 'slot': it['slot'], 'name': it['name'], 'parts': [{'part': p, 'frame': f} for p, f in made]})
    Image.fromarray(np.dstack([fg_a, wgt * 255]).clip(0, 255).astype(np.uint8), 'RGBA').save(os.path.join(OUT, f"item_{it['id']}.png"))

# ------------------------------------------------------------------ write
meta = {}
for name, f in FRAMES.items():
    path = os.path.join(OUT, name + '.png'); os.makedirs(os.path.dirname(path), exist_ok=True)
    tl.to_png(f['img']).save(path)
    meta[name] = {'w': f['img'].shape[1], 'h': f['img'].shape[0], 'pivot': f['pivot'], **({'rows': f['rows']} if 'rows' in f else {})}
rig = {
    'bpx_drawing': BPX, 'root': [round(float(v), 1) for v in ROOT],
    'world': {k: round(v, 3) for k, v in WORLD.items()}, 'lengths': {k: round(v, 5) for k, v in LEN.items()},
    'hand_len': round(HAND_LEN['B'], 5), 'hand_len_F': round(HAND_LEN['F'], 5),
    # the handle through each fist, relative to the hand bone (the grip picture's forearm against its level handle)
    'grip_axis': {s: round(math.degrees(math.atan2(T['hands'][s]['axis'][1], T['hands'][s]['axis'][0])), 3) for s in 'BF'},
    'offsets': GEO, 'limbs': {n: {k: lm[k] for k in ('top', 'bottom', 'bend')} for n, lm in LIMBS.items()},
}
json.dump({'bpx': ABPX, 'frames': meta, 'items': ITEMS, 'rig': rig, 'report': REPORT}, open(os.path.join(OUT, 'parts.json'), 'w'), indent=1)
# a check sheet of the part map
pal = np.array([[0, 0, 0], [200, 120, 230], [230, 120, 100], [240, 200, 90], [90, 210, 230], [110, 150, 250], [255, 110, 180], [160, 140, 255], [250, 210, 90], [100, 210, 140], [255, 160, 80], [150, 230, 120]])
lab = np.zeros(SH, np.int32)
for i, n in enumerate(PARTS, 1): lab[L0[n]] = i
over = (0.5 * fg0 + 0.5 * pal[lab]).astype(np.uint8); over[lab == 0] = 30
over[(ndimage.morphological_gradient(lab, size=3) > 0)] = 255
for n, p in J.items(): cv2.circle(over, (int(p[0]), int(p[1])), 5, (255, 255, 0), -1)
Image.fromarray(over).save(os.path.join(OUT, 'labels_base.png'))
print('report', REPORT)
print('limb fits', REFINE)
print('frames', len(meta), {k: (v['w'], v['h']) for k, v in list(meta.items())[:40]})
