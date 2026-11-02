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
from weapon_grip import find_grip  # noqa: E402

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
# the waistband's hidden underlap under a top (the art director's starting value: 8 to 12 master px)
UNDERLAP = 10
PIVOT = {'head': 'head', 'torso': 'waist', 'pelvis': 'pelvis', 'hand_B': 'wrist_B', 'hand_F': 'wrist_F', 'foot_B': 'ankle_B', 'foot_F': 'ankle_F'}
LIMBS = T['limbs']

# ------------------------------------------------------------------ pieces
FRAMES = {}


def put_rigid(name, layer, pivot):
    crop, (x0, y0) = tl.crop_alpha(tl.resize_premul(layer, K))
    if crop.shape[0] < 2: return False
    FRAMES[name] = dict(img=crop, pivot=[round(pivot[0] * K - x0, 2), round(pivot[1] * K - y0, 2)])
    return True


def strip(limb, layer, width=None):
    lm = LIMBS[limb]
    j0, j1, j2 = (J[n] for n in lm['joints'])
    top, bottom, bend, width0 = (lm[k] * BPX for k in ('top', 'bottom', 'bend', 'width'))
    width = max(width0, width or 0)
    k2 = 0.5 / K  # sample at twice the atlas resolution, then reduce
    tex, rows = tl.straighten(layer, j0, j1, j2, top, bottom, bend, width, k2)
    tex = tl.round_end(tex, rows['top'], width / k2 * 0.36, up=True)
    return tl.resize_premul(tex, 0.5), {k: v * 0.5 for k, v in rows.items()}


def limb_reach(limb, mask):
    """How wide a strip an item's limb piece needs (drawing px): twice its farthest pixel from the limb's line (a flared
    cuff, a wide trouser leg), so nothing of it is cut; the body's own strips keep the template's width."""
    lm = LIMBS[limb]
    j0, j1, j2 = (J[n] for n in lm['joints'])
    ys, xs = np.where(mask)
    if not len(xs): return 0.0
    P = np.stack([xs, ys], 1).astype(np.float64)
    def segd(a, b):
        ab = b - a; t = np.clip(((P - a) @ ab) / (ab @ ab), 0, 1)
        return np.linalg.norm(P - (a + t[:, None] * ab), axis=1)
    d = np.minimum(segd(j0, j1), segd(j1, j2 + (j2 - j1) * 0.35))
    return 2.0 * float(np.percentile(d, 99.5)) + 6.0


def put_strip(name, limb, layer, width=None):
    tex, rows = strip(limb, layer, width)
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


def elbow_side(s):
    """Signed distance past the elbow, square to the bend's bisector (negative: the upper arm's side)."""
    a1 = unit(J[f'shoulder_{s}'], J[f'elbow_{s}']); a2 = unit(J[f'elbow_{s}'], J[f'wrist_{s}'])
    nb = (a1 + a2) / np.linalg.norm(a1 + a2)
    return beyond(J[f'elbow_{s}'], nb)


def pauldrons(alpha, fg, L):
    """A rigid top's shoulder plates, each one whole piece: the plates of the picture are the regions its dark outlines
    enclose; a shoulder plate is one that reaches the shoulder joint and lies a quarter or more on the upper arm (the
    chest plate and the collar lie on the chest). Each plate takes the outline round it (the outline pixels nearest
    to it). Rule-based, so every rigid top gets the same treatment."""
    item = alpha > 0.5
    lum = (fg[..., :3] * 255.0) @ np.array([0.299, 0.587, 0.114])
    outline = item & (lum < 75)
    inter = item & ~outline
    lab, n = ndimage.label(inter)
    out = {s: np.zeros(SH, bool) for s in 'BF'}
    if not n: return out
    idx = np.arange(1, n + 1)
    total = ndimage.sum(inter, lab, idx)
    dist, (iy, ix) = ndimage.distance_transform_edt(~inter, return_indices=True)
    near = lab[iy, ix]
    for s in 'BF':
        zone = disk(J[f'shoulder_{s}'], 0.06 * BPX)
        upper = L[f'arm_{s}'] & (elbow_side(s) < 0)
        in_zone = ndimage.sum(inter & zone, lab, idx)
        in_arm = ndimage.sum(inter & upper, lab, idx)
        keep = idx[(total >= 30) & (in_zone > 0) & (in_arm >= 0.25 * total)]
        if not len(keep) or total[keep - 1].sum() < 2000: continue   # a plate, not a strap's end or a few stray px
        m = np.isin(lab, keep)
        m |= outline & np.isin(near, keep) & (dist <= 5)
        out[s] = ndimage.binary_fill_holes(m) & item
    both = out['B'] & out['F']
    if both.any():  # a plate claimed by both sides goes to the nearer shoulder
        dB = np.hypot(XX - J['shoulder_B'][0], YY - J['shoulder_B'][1]); dF = np.hypot(XX - J['shoulder_F'][0], YY - J['shoulder_F'][1])
        out['B'] &= ~(both & (dF < dB)); out['F'] &= ~(both & (dB <= dF))
    return out


def cut_body(prefix, alpha, fg, L, base=True, item_slot=None, rigid=False):
    """The pieces of one figure (the base body, or an item's own pixels) cut by the part map L."""
    made = []
    lay = lambda m: tl.premul(alpha, fg, m.astype(np.float32))
    if L['head'].any() and put_rigid(f'{prefix}/head', lay(L['head']), J['head']): made.append(('head', f'{prefix}/head'))
    # rigid tops: each shoulder plate is its own piece (drawn once, turning part way with the arm); the chest plate is
    # carried on under it (inpainted from the chest's own pixels), so a raised arm never shows a second plate nor a hole
    P = pauldrons(alpha, fg, L) if rigid else {s: np.zeros(SH, bool) for s in 'BF'}
    PA = P['B'] | P['F']
    if rigid:
        # what a rigid top has on an upper arm besides its shoulder plate is an upper-arm plate only when it reaches
        # down the arm; a strap's end or a plate's edge at the armpit rides the chest
        L = dict(L)
        for s in 'BF':
            m_ = L[f'arm_{s}'] & ~P[s] & (elbow_side(s) < 4) & (alpha > 0.5)
            if not m_.any(): continue
            d_ = unit(J[f'shoulder_{s}'], J[f'elbow_{s}'])
            reach = float(np.percentile(beyond(J[f'shoulder_{s}'], d_)[m_], 95)) / np.linalg.norm(J[f'elbow_{s}'] - J[f'shoulder_{s}'])
            if reach < 0.35:
                L['torso'] = L['torso'] | (L[f'arm_{s}'] & ~P[s] & (elbow_side(s) < 4))
                L[f'arm_{s}'] = L[f'arm_{s}'] & ~(elbow_side(s) < 4)
    # the torso carries on a little under the head (the neck) and under the hips' piece (the belly): a tilted head or
    # a bent waist never opens a gap
    tl_ = lay(L['torso'] & ~PA)
    if rigid and PA.any():
        known = L['torso'] & ~PA & (alpha > 0.9)
        under = PA & (L0['torso'] | L['torso'])
        # what is under a shoulder plate: where the plate's chest-side border is mostly the item (a chest plate), the
        # chest plate carries on under all of it; where it is mostly bare body (a harness), only next to the item's own
        # pixels, and the body shows under the rest
        ring = ndimage.binary_dilation(PA, iterations=6) & ~PA & L0['torso'] & M0
        if ring.any() and (ring & known).sum() < 0.5 * ring.sum():
            under &= ndimage.binary_dilation(known, iterations=int(0.012 * BPX))   # the strap carries on a little
        tl_ = fill_under(tl_, under, known)
    if base:
        neck = (YY > J['head'][1] - 0.035 * BPX) & (YY < J['neck'][1] + 4) & (np.abs(XX - J['neck'][0]) < 0.034 * BPX)
        belly_x = np.where(L['torso'][int(J['waist'][1])])[0]
        belly = (YY >= J['waist'][1]) & (YY < J['pelvis'][1] + 0.01 * BPX) & (XX > belly_x.min() + 6) & (XX < belly_x.max() - 6)
        known = L['torso'] & (alpha > 0.9) & (fg.max(2) > 140 / 255.0)   # skin, not its outline (fg is 0..1)
        tl_ = fill_under(tl_, (neck & ~L['torso']) | (belly & ~L['torso']), known)
    if L['torso'].any() and put_rigid(f'{prefix}/torso', tl_, J['waist']): made.append(('torso', f'{prefix}/torso'))
    pl = lay(L['pelvis'])
    if not base and L['pelvis'].any() and item_slot == 'bottom':
        # the hidden underlap (its own piece, drawn only under a worn top): the trousers' waist carried on up under the
        # top by UNDERLAP px in the waistband's own fabric colour, so a top's hem riding the chest never opens a gap onto
        # the belly when the hips and the chest turn apart (with no top it is not drawn: the bare belly shows)
        rows = np.where(L['pelvis'].any(1))[0]; ty = rows.min()
        cols = np.where(L['pelvis'][ty + 6])[0]
        band = L['pelvis'] & (YY < ty + 0.02 * BPX) & (alpha > 0.9)
        px_ = fg[band]
        if len(px_):
            lum_ = px_ @ np.array([0.299, 0.587, 0.114])
            col = np.median(px_[lum_ >= np.percentile(lum_, 40)], axis=0)   # the fabric, not its outline
            up = (YY >= ty - UNDERLAP) & (YY < ty + 2) & (XX > cols.min() + 3) & (XX < cols.max() - 3)
            under = np.zeros(SH + (4,), np.float32); under[up, :3] = col; under[up, 3] = 1.0
            if put_rigid(f'{prefix}/pelvis_under', under, J['pelvis']): made.append(('pelvis_under', f'{prefix}/pelvis_under'))
    if L['pelvis'].any() and put_rigid(f'{prefix}/pelvis', pl, J['pelvis']): made.append(('pelvis', f'{prefix}/pelvis'))
    if L.get('tails') is not None and L['tails'].any():
        # a split coat: the panel on each side of the crotch is its own piece, hanging from that side's hip joint
        cx = float(C['crotch'][0][0])
        for s, side in (('B', XX < cx), ('F', XX >= cx)):
            m_ = L['tails'] & side
            if m_.sum() > 1500 and put_rigid(f'{prefix}/tail_{s}', lay(m_), J[f'hip_{s}']): made.append((f'tail_{s}', f'{prefix}/tail_{s}'))
    for s in 'BF':
        if rigid and (L[f'arm_{s}'].any() or P[s].any()):
            # rigid plates: the shoulder plate about the shoulder; the rest of the arm's plates cut at the elbow (square
            # to the bend's bisector), a little overlap each way: the upper one turns about the shoulder, the lower one
            # about the elbow
            side = elbow_side(s)
            if P[s].any() and put_rigid(f'{prefix}/pauldron_{s}', lay(P[s]), J[f'shoulder_{s}']): made.append((f'pauldron_{s}', f'{prefix}/pauldron_{s}'))
            up_, lo_ = L[f'arm_{s}'] & ~P[s] & (side < 4), L[f'arm_{s}'] & ~P[s] & (side > -4)
            # an upper-arm plate under the shoulder plate only when there is one (not a few edge pixels left over)
            solid = ndimage.binary_opening(up_ & (alpha > 0.5), structure=disk((3, 3), 3)[:7, :7]).sum()
            if solid > 400 and put_rigid(f'{prefix}/uparm_{s}', lay(up_), J[f'shoulder_{s}']): made.append((f'uparm_{s}', f'{prefix}/uparm_{s}'))
            if lo_.any() and put_rigid(f'{prefix}/forearm_{s}', lay(lo_), J[f'elbow_{s}']): made.append((f'forearm_{s}', f'{prefix}/forearm_{s}'))
        elif L[f'arm_{s}'].any() and put_strip(f'{prefix}/arm_{s}', f'arm_{s}', limb_layer(f'arm_{s}', L[f'arm_{s}'], {'top': L['torso'], 'end': L[f'hand_{s}']}, alpha, fg), None if base else limb_reach(f'arm_{s}', L[f'arm_{s}'] & (alpha > 0.5))):
            made.append((f'arm_{s}', f'{prefix}/arm_{s}'))
        if L[f'leg_{s}'].any() and put_strip(f'{prefix}/leg_{s}', f'leg_{s}', limb_layer(f'leg_{s}', L[f'leg_{s}'], {'top': L['pelvis'], 'end': L[f'foot_{s}']}, alpha, fg), None if base else limb_reach(f'leg_{s}', L[f'leg_{s}'] & (alpha > 0.5))):
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


EXPORTER_VERSION = '1.5'
# a weapon's profile is its motion kit, the art director's motion families (how the body holds and swings it)
WEAPON_KITS = ('sword_1h', 'dagger_1h', 'staff_2h')


def load_catalog():
    """The item catalog: one row per item in catalog.csv (id, slot, profile, body, name, picture; profile = cloth,
    rigid, or a weapon's motion kit), with exceptional items' extra data in overrides.json (by id). items.json is the older form."""
    path = os.environ.get('B01_CATALOG') or os.path.join(HERE, 'catalog.csv')   # another catalog for a trial build
    if not os.path.exists(path):
        return json.load(open(os.path.join(HERE, 'items.json')))
    import csv
    over = json.load(open(os.path.join(HERE, 'overrides.json'))) if os.path.exists(os.path.join(HERE, 'overrides.json')) else {}
    rows = []
    for r in csv.DictReader(l for l in open(path) if l.strip() and not l.lstrip().startswith('#')):
        r = {k.strip(): (v or '').strip() for k, v in r.items()}
        if r.get('body', 'base01') != T['id']: continue
        bad = None
        if r.get('slot') not in list(SLOT_PARTS) + ['weapon']: bad = f"unknown slot '{r.get('slot')}' (top, bottom, shoes, hat, weapon)"
        elif r.get('profile') not in ('cloth', 'rigid') + WEAPON_KITS: bad = f"unknown profile '{r.get('profile')}' (cloth, rigid; a weapon: {', '.join(WEAPON_KITS)})"
        elif (r['profile'] in WEAPON_KITS) != (r['slot'] == 'weapon'): bad = f"profile '{r['profile']}' does not fit slot '{r['slot']}' (a weapon row has its motion kit as profile: {', '.join(WEAPON_KITS)})"
        if bad:
            REPORT.append({'id': r.get('id', '?'), 'accepted': False, 'reason': bad}); print('REJECTED', r.get('id'), bad); continue
        pic = r['picture'] if os.path.isabs(r['picture']) else os.path.join(HERE, r['picture'])
        it = {'id': r['id'], 'slot': r['slot'], 'name': r['name'], 'picture': pic, 'profile': r['profile']}
        if r['profile'] == 'rigid': it['rigid'] = True
        it.update(over.get(r['id'], {}))
        rows.append(it)
    return rows


def sha1(path):
    import hashlib
    return hashlib.sha1(open(path, 'rb').read()).hexdigest()[:12]


MASTER_RGB = np.asarray(Image.open(os.path.join(HERE, T['master'])).convert('RGB'))
# the master's skin, as a local colour field (OpenCV Lab: L 0..255, a and b offset by 128): the bare body's opaque,
# reddish pixels outside the head (not the shorts, not the hair), blurred so every place near skin knows the skin
# tone around it
LAB0 = cv2.cvtColor(MASTER_RGB, cv2.COLOR_RGB2LAB).astype(np.float32)
SKIN0 = M0 & ~L0['head'] & (alpha0 > 0.95) & (LAB0[..., 0] > 100) & (LAB0[..., 1] > 138)
SKIN0_W = ndimage.gaussian_filter(SKIN0.astype(np.float32), 6)
SKIN0_LAB = np.dstack([ndimage.gaussian_filter(LAB0[..., c] * SKIN0, 6) for c in range(3)]) / np.maximum(SKIN0_W, 1e-3)[..., None]
# the master's face: the head's skin (reddish, opaque, not the hair)
FACE0 = L0['head'] & (alpha0 > 0.95) & (LAB0[..., 0] > 100) & (LAB0[..., 1] > 138) & (LAB0[..., 2] < 175)
ITEMS_REJECTED = []
items_spec = load_catalog()
SOURCES = {}
for it in items_spec:
    path = os.path.join(HERE, it['picture'])
    if not os.path.exists(path):
        REPORT.append({'id': it['id'], 'accepted': False, 'reason': f"no picture at {it['picture']}"}); continue
    SOURCES[it['id']] = sha1(path)
    if it['slot'] == 'weapon':
        # a weapon is drawn on its own, lying flat, blade to the right: keyed, scaled so its grip fits the fist (the
        # grip's drawn thickness → the fist's handle size), its pivot at the middle of the grip. The grip is found
        # from the drawing (the narrow run left of a guard, or a third of the way up a pole) unless the row gives it.
        aw, fw = key(path)
        auto, thick, kind, axis = find_grip(aw)
        grip = it.get('grip', auto); thick = it.get('grip_thickness', thick)
        if abs(axis[1]) > 0.12:
            REPORT.append({'id': it['id'], 'accepted': False, 'reason': f'the weapon is not drawn level (its axis turns {math.degrees(math.atan2(axis[1], axis[0])):.1f} deg): redraw it flat, blade to the right'}); continue
        own = component(aw > 0.5, grip)
        lay = tl.premul(aw, fw / 255.0, (ndimage.binary_dilation(own, iterations=2) & (aw > 0.02)).astype(np.float32))
        kw = it.get('handle', 30.0) / thick
        small = tl.resize_premul(lay, K * kw)
        crop, (x0, y0) = tl.crop_alpha(small)
        name = f"{it['id']}/weapon"
        FRAMES[name] = dict(img=crop, pivot=[round(grip[0] * K * kw - x0, 2), round(grip[1] * K * kw - y0, 2)])
        ITEMS.append({'id': it['id'], 'slot': 'weapon', 'name': it['name'], 'parts': [{'part': 'weapon', 'frame': name}], 'motion': it.get('profile') if it.get('profile') in WEAPON_KITS else 'sword_1h'})
        REPORT.append({'id': it['id'], 'grip': grip, 'grip_found': auto, 'handle_px': thick, 'kind': kind, 'scale': round(kw, 3), 'length_B': round(float(crop.shape[1]) / ABPX, 3), 'accepted': True})
        continue
    img = np.asarray(Image.open(path).convert('RGB'))
    alpha_i, _ = key(Image.fromarray(img))
    allowed = SLOT_PARTS[it['slot']]
    field = label_field(L0, None)
    region = np.any([field[p] for p in allowed], axis=0)
    if it['slot'] == 'shoes':  # a boot (or a greave) reaches up the shin to just below the knee at most
        for s_ in 'BF':
            d_ = unit(J[f'knee_{s_}'], J[f'ankle_{s_}']); L_ = np.linalg.norm(J[f'ankle_{s_}'] - J[f'knee_{s_}'])
            region &= ~(field[f'leg_{s_}'] & (beyond(J[f'knee_{s_}'], d_) < L_ * it.get('shaft_from', 0.06)))
    try:
        cc, warp = align(alpha_i, np.any([L0[p] for p in allowed], axis=0))
    except cv2.error:
        REPORT.append({'id': it['id'], 'accepted': False, 'reason': 'the picture cannot be lined up with the master: it must be an edit of the master (same stance, size and place) on a flat magenta background'})
        print('REJECTED', it['id'], REPORT[-1]); continue
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
        why = []
        if err >= it.get('max_err', 40): why.append(f'the body outside the item is not the master (median colour error {err:.0f}, the limit is {it.get("max_err", 40)})')
        if sil >= 0.02: why.append(f'the figure outside the item has another shape than the master ({sil * 100:.1f}% of it differs, the limit is 2%)')
        REPORT[-1]['reason'] = '; '.join(why) + ': ask for the item again as an edit of the attached master'
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
    try:
        cv2.grabCut(np.ascontiguousarray(al[y0_:y1_, x0_:x1_]), sub, None, bgd, fgd, 6, cv2.GC_INIT_WITH_MASK)
    except cv2.error:   # nothing in the picture differs from the master (or nothing is the body): no item to cut
        REPORT[-1].update({'accepted': False, 'reason': 'no item found: the picture is the master itself, or the item is too small to cut'})
        print('REJECTED', it['id'], REPORT[-1]); continue
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
    # small holes in the cut are filled; a large enclosed area (the bare chest inside a harness, the skin between two
    # straps) stays body
    holes = ndimage.binary_fill_holes(item) & ~item
    hl, hn = ndimage.label(holes)
    if hn:
        hs = ndimage.sum(holes, hl, range(1, hn + 1))
        item |= np.isin(hl, 1 + np.where(hs < it.get('hole_px', 600))[0])
    item &= region
    # the skin halo: a boot collar or a waistband drawn over the bare body leaves a few skin-coloured pixels along the
    # item's edge; near its edge, a pixel whose colour matches the master's skin around it is body, not item
    edge_band = item & ~ndimage.binary_erosion(item, iterations=6)
    halo = edge_band & (SKIN0_W > 0.05) & (np.sqrt(((lab_a - SKIN0_LAB) ** 2).sum(2)) < it.get('skin_halo', 16))
    item &= ~halo
    item &= ndimage.binary_opening(item, iterations=1) | ~edge_band
    if item.sum() < it.get('min_item_px', 800):
        REPORT[-1].update({'accepted': False, 'reason': 'no item found: the picture is the master itself, or the item is too small to cut'})
        print('REJECTED', it['id'], REPORT[-1]); continue
    if it['slot'] == 'hat':
        # headwear replaces the whole head piece as drawn (the hair under a crown is pressed down, a helmet hides it):
        # the item is everything opaque in the head's part of the picture, and the bare head under it is hidden. The
        # face must still be the master's where the headwear leaves it visible.
        face = FACE0 & (alpha_a > 0.5)
        dEf = np.sqrt(((lab_a - LAB0) ** 2).sum(2))
        covered = float((face & (dEf > 25)).sum()) / max(1, face.sum())
        face_err = float(np.median(dEf[face & (dEf <= 25)])) if (face & (dEf <= 25)).any() else 0.0
        # the face's features (its drawn lines) must be the master's where the face shows: edge correlation
        vis = face & (dEf <= 25)
        ncc = 1.0
        if covered < 0.6 and vis.sum() > 500:
            e0 = edges(MASTER_RGB)[vis]; e1 = edges(al)[vis]
            e0 = e0 - e0.mean(); e1 = e1 - e1.mean()
            ncc = float((e0 * e1).sum() / max(1e-6, np.sqrt((e0 * e0).sum() * (e1 * e1).sum())))
        REPORT[-1].update({'face_covered': round(covered, 3), 'face_err': round(face_err, 1), 'face_lines': round(ncc, 3)})
        if covered < 0.6 and ncc < it.get('face_lines_min', 0.5):
            REPORT[-1].update({'accepted': False, 'reason': f'the face is not drawn as the master\'s (its lines match {ncc:.2f}, at least 0.5 needed): ask for the headwear again, keeping the face exactly'})
            print('REJECTED', it['id'], REPORT[-1]); continue
        if covered < 0.6 and float(np.median(dEf[face])) > it.get('face_max', 18):
            REPORT[-1].update({'accepted': False, 'reason': f'the face is not the master\'s (median colour error {np.median(dEf[face]):.0f} over the visible face): ask for the headwear again, keeping the face exactly'})
            ITEMS_REJECTED.append(it['id']); print('REJECTED', it['id'], REPORT[-1]); continue
        item = (alpha_a > 0.5) & field['head'] & region
        if covered >= 0.6:
            # a full helmet keeps the head's established size: drawn smaller than the master's head (the hair's volume
            # gone), it is enlarged about the neck by up to 8% (never the head or the skeleton)
            def wid(m):
                xs_ = np.where(m.any(0))[0]; return float(xs_.max() - xs_.min() + 1) if len(xs_) else 0.0
            k_h = float(np.clip(0.85 * wid(L0['head'] & M0) / max(1.0, wid(item)), 1.0, it.get('helmet_max_scale', 1.08)))
            REPORT[-1]['helmet_scale'] = round(k_h, 3)
            if k_h > 1.001:
                Mh = cv2.getRotationMatrix2D((float(J['neck'][0]), float(J['neck'][1])), 0, k_h)
                warp_ = lambda a: cv2.warpAffine(a, Mh, (SH[1], SH[0]), flags=cv2.INTER_LINEAR, borderValue=0)
                alpha_a = warp_(alpha_a.astype(np.float32)); fg_a = np.dstack([warp_(fg_a[..., c].astype(np.float32)) for c in range(3)])
                item = warp_(item.astype(np.float32)) > 0.5
    fg_i = fg_a.astype(np.float32)
    # a light garment gets a firmer warm outline and deeper folds (it stays apart from pale floors at gameplay size):
    # its edge band, inside its silhouette, is taken toward a warm dark brown, and its shadow tones are deepened
    Lm = float(np.median(lab_a[..., 0][item])) if item.any() else 0.0
    if it['slot'] in ('top', 'bottom') and not it.get('rigid') and Lm > it.get('light_from', 0.72 * 255):
        bw = it.get('outline_px', 7.0)
        din = ndimage.distance_transform_edt(ndimage.gaussian_filter(item.astype(np.float32), 2.0) > 0.5)  # a smooth contour
        t_ = np.clip((bw - din) / 2.0 + 0.5, 0, 1) * item          # a crisp band bw px wide, its inner edge 2 px soft
        dark = np.array([88, 54, 36], np.float32)
        fg_i = fg_i * (1 - 0.85 * t_[..., None]) + dark * (0.85 * t_[..., None])
        # the folds: each shadow tone a little deeper, in proportion to how dark it already is (no new shapes)
        deep = np.clip((Lm - lab_a[..., 0]) / (0.3 * Lm), 0, 1) * (item & (din > bw))
        fg_i *= (1 - 0.16 * deep)[..., None]
    wgt = np.minimum(alpha_a, ndimage.gaussian_filter(item.astype(np.float32), 0.7) * 1.0)
    Li = {}
    remap = SLOT_REMAP.get(it['slot'], {})
    for p in PARTS:
        Li[p] = np.zeros(SH, bool)
    for p in allowed:
        Li[remap.get(p, p)] = Li[remap.get(p, p)] | (item & field[p])
    if it['slot'] == 'top':
        # a top's tails (a long coat's skirts over the thighs, above the knees): clearly not the master there and
        # joined to the top; one rigid piece hanging from the hips
        knee_y = min(J['knee_B'][1], J['knee_F'][1])
        cand = (field['leg_B'] | field['leg_F']) & (YY < knee_y) & (alpha_a > 0.5) & (dE > 35)
        lab_t, n_t = ndimage.label(cand | item)
        ids = np.unique(lab_t[item & (lab_t > 0)])
        tails = cand & np.isin(lab_t, ids)
        # cloth panels, not lines: an outline drawn a few px off (a hem, the shorts' edge) is opened away
        tails = ndimage.binary_opening(tails, structure=disk((5, 5), 5)[:11, :11])
        if tails.sum() > it.get('tails_px', 6000):
            tails = ndimage.binary_dilation(tails, structure=disk((5, 5), 5)[:11, :11]) & cand
            tails = ndimage.binary_closing(tails, iterations=2) & (alpha_a > 0.5)
            th_, tn_ = ndimage.label(ndimage.binary_fill_holes(tails) & ~tails)
            if tn_: tails |= np.isin(th_, 1 + np.where(ndimage.sum(th_ > 0, th_, range(1, tn_ + 1)) < 600)[0])
            Li['tails'] = tails
            wgt = np.maximum(wgt, np.minimum(alpha_a, ndimage.gaussian_filter(tails.astype(np.float32), 0.7)))
            REPORT[-1]['tails_px'] = int(tails.sum())
    if it['slot'] == 'top' and not it.get('rigid'):
        # a sleeve is a sleeve only when it reaches down the arm and wraps it: what a sleeveless top has in an arm's
        # part (its edge at the armhole, a side panel beside a hanging arm) rides the chest with the rest of it; a
        # sleeve covers at least half of the arm's own pixels just below the shoulder; a few stray pixels go
        for s_ in 'BF':
            m_ = Li[f'arm_{s_}']
            if not m_.any(): continue
            d_ = unit(J[f'shoulder_{s_}'], J[f'elbow_{s_}'])
            up_ = np.linalg.norm(J[f'elbow_{s_}'] - J[f'shoulder_{s_}'])
            along_ = beyond(J[f'shoulder_{s_}'], d_)
            reach = float(np.percentile(along_[m_], 95)) / up_
            band_ = L0[f'arm_{s_}'] & M0 & (along_ >= 0) & (along_ <= 0.35 * up_)
            wrap_ = float((m_ & band_).sum() / max(1, band_.sum()))
            REPORT[-1].setdefault('sleeve_reach', {})[s_] = round(reach, 2)
            REPORT[-1].setdefault('sleeve_wrap', {})[s_] = round(wrap_, 2)
            if reach < it.get('sleeve_from', 0.35) or wrap_ < it.get('sleeve_wrap', 0.5) or m_.sum() < 150:
                Li['torso'] |= m_ & (m_.sum() >= 150); Li[f'arm_{s_}'] = np.zeros(SH, bool)
    made = cut_body(it['id'], wgt, fg_i / 255.0, Li, base=False, item_slot=it['slot'], rigid=it.get('rigid', False))
    # coverage (the item's coverage metadata): how much of each of the body's parts the item covers in the master's
    # pose; a part it covers almost whole is hidden under it (its bare piece would only peek out at the edges, like the
    # shorts' waistband above a pair of trousers)
    cov = {p: float((item & L0[p] & M0).sum() / max(1, (L0[p] & M0).sum())) for p in PARTS}
    covers = [p for p, c in cov.items() if c >= it.get('cover_from', 0.85)]
    if it['slot'] == 'hat' and 'head' not in covers: covers.append('head')   # headwear is the whole head as drawn
    entry = {'id': it['id'], 'slot': it['slot'], 'name': it['name'], 'parts': [{'part': p, 'frame': f} for p, f in made], 'covers': covers}
    if it['slot'] == 'bottom':
        # loose legs (a hakama, wide trousers: wider than the template's leg by 15% or more) go over the shoes
        wide = max(limb_reach(f'leg_{s_}', Li[f'leg_{s_}'] & (wgt > 0.5)) for s_ in 'BF') / (LIMBS['leg_B']['width'] * BPX)
        REPORT[-1]['leg_width'] = round(wide, 2)
        if it.get('loose', wide >= 1.15): entry['loose'] = True
    ITEMS.append(entry)
    REPORT[-1].update({'coverage': {p: round(c, 3) for p, c in cov.items() if c > 0.3}, 'skin_halo_px': int(halo.sum()), 'light_outline': bool(Lm > it.get('light_from', 0.72 * 255)) and it['slot'] in ('top', 'bottom') and not it.get('rigid')})
    Image.fromarray(np.dstack([fg_i, wgt * 255]).clip(0, 255).astype(np.uint8), 'RGBA').save(os.path.join(OUT, f"item_{it['id']}.png"))

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
json.dump({'bpx': ABPX, 'frames': meta, 'items': ITEMS, 'rig': rig, 'report': REPORT,
           'versions': {'template': T.get('version', T['id']), 'exporter': EXPORTER_VERSION, 'master': sha1(os.path.join(HERE, T['master'])), 'sources': SOURCES}},
          open(os.path.join(OUT, 'parts.json'), 'w'), indent=1)
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
