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


HOLE_OFF_FIGURE = 0.05  # a large enclosed area that lies this much outside the master's figure is the item
HOLE_ON_LIMB = 0.6      # ... and one lying this much over the arms and legs is the sleeve's or the trouser leg's cloth
ARM_PLATE_WRAP = 0.25   # a rigid plate on the arm covers at least this share of the bare arm where it lies
PLATE_WRAP = {}


def solid_plate(m, alpha, min_px=400):
    """The solid plates of a rigid item's arm pixels `m`: each piece that keeps 400 px or more once opened by a 7 px
    disk, grown back by 3 px within `m` (its outline); thin strokes and specks on their own are dropped."""
    core = ndimage.binary_opening(m & (alpha > 0.5), structure=disk((3, 3), 3)[:7, :7])
    lab, n = ndimage.label(core)
    if not n: return np.zeros_like(m)
    sizes = ndimage.sum(core, lab, range(1, n + 1))
    keep = np.isin(lab, 1 + np.where(np.asarray(sizes) >= min_px)[0])
    return m & ndimage.binary_dilation(keep, iterations=3) if keep.any() else np.zeros_like(m)


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
    # a skirt (the skirt garment profile): one piece hanging from its waistband; the trouser legs under it carried on up
    skirted = L.get('skirt') is not None and L['skirt'].any()
    if skirted and put_skirt(f'{prefix}/skirt', lay(L['skirt']), SKIRT_LINES[prefix]): made.append(('skirt', f'{prefix}/skirt'))
    for s in 'BF':
        if rigid and (L[f'arm_{s}'].any() or P[s].any()):
            # rigid plates: the shoulder plate about the shoulder; the rest of the arm's plates cut at the elbow (square
            # to the bend's bisector), a little overlap each way: the upper one turns about the shoulder, the lower one
            # about the elbow
            side = elbow_side(s)
            up_, lo_ = L[f'arm_{s}'] & ~P[s] & (side < 4), L[f'arm_{s}'] & ~P[s] & (side > -4)
            # an arm plate is a plate: its solid pieces (400 px or more once thin strokes are opened away), with their
            # outlines; a few edge pixels or loose strokes left over by the shoulder plate are not drawn on the arm
            up_, lo_ = solid_plate(up_, alpha), solid_plate(lo_, alpha)
            # and it is on the arm: it covers a quarter or more of the bare arm where it lies (a bracer, an arm plate).
            # A narrow piece is the shoulder plate's edge: joined to the shoulder plate it rides with it; loose, it is
            # a stray stroke and is not drawn
            sp = P[s].copy()
            for part_, m_ in (('upper', up_), ('lower', lo_)):
                if not m_.any(): continue
                bare = L0[f'arm_{s}'] & ((side < 4) if part_ == 'upper' else (side > -4))
                wrap = float((m_ & bare).sum()) / max(1, bare.sum())
                PLATE_WRAP.setdefault(prefix, {})[f'{part_}_{s}'] = round(wrap, 2)
                if wrap < ARM_PLATE_WRAP:
                    if (m_ & ndimage.binary_dilation(sp, iterations=3)).any(): sp |= m_
                    m_[:] = False
            if sp.any() and put_rigid(f'{prefix}/pauldron_{s}', lay(sp), J[f'shoulder_{s}']): made.append((f'pauldron_{s}', f'{prefix}/pauldron_{s}'))
            if up_.any() and put_rigid(f'{prefix}/uparm_{s}', lay(up_), J[f'shoulder_{s}']): made.append((f'uparm_{s}', f'{prefix}/uparm_{s}'))
            if lo_.any() and put_rigid(f'{prefix}/forearm_{s}', lay(lo_), J[f'elbow_{s}']): made.append((f'forearm_{s}', f'{prefix}/forearm_{s}'))
        elif L[f'arm_{s}'].any() and put_strip(f'{prefix}/arm_{s}', f'arm_{s}', limb_layer(f'arm_{s}', L[f'arm_{s}'], {'top': L['torso'], 'end': L[f'hand_{s}']}, alpha, fg), None if base else limb_reach(f'arm_{s}', L[f'arm_{s}'] & (alpha > 0.5))):
            made.append((f'arm_{s}', f'{prefix}/arm_{s}'))
        if skirted and L[f'leg_{s}'].any():
            # under a skirt the trouser leg takes nothing of the waistband at its top (the skirt and the waistband lie
            # over it there), and is carried on up to the hips in its own cloth
            if put_strip_under(f'{prefix}/leg_{s}', f'leg_{s}', limb_layer(f'leg_{s}', L[f'leg_{s}'], {'top': np.zeros(SH, bool), 'end': L[f'foot_{s}']}, alpha, fg), limb_reach(f'leg_{s}', L[f'leg_{s}'] & (alpha > 0.5)), BASE_LEG[s]):
                made.append((f'leg_{s}', f'{prefix}/leg_{s}'))
        elif L[f'leg_{s}'].any() and put_strip(f'{prefix}/leg_{s}', f'leg_{s}', limb_layer(f'leg_{s}', L[f'leg_{s}'], {'top': L['pelvis'], 'end': L[f'foot_{s}']}, alpha, fg), None if base else limb_reach(f'leg_{s}', L[f'leg_{s}'] & (alpha > 0.5))):
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
# the bare legs as the base cuts them: a trouser leg under a skirt is carried on up along their shape
BASE_LEG = {s: limb_layer(f'leg_{s}', L0[f'leg_{s}'], {'top': L0['pelvis'], 'end': L0[f'foot_{s}']}, alpha0, fg0n) for s in 'BF'}
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
LIMB_JOINTS = {'arm_B': ('shoulder_B', 'elbow_B', 'wrist_B'), 'arm_F': ('shoulder_F', 'elbow_F', 'wrist_F'),
               'leg_B': ('hip_B', 'knee_B', 'ankle_B'), 'leg_F': ('hip_F', 'knee_F', 'ankle_F')}
REFINE = {}


def refine_limbs(al, field):
    e0 = edges(MASTER_RGB); e1 = edges(al)
    out = al.copy()
    REFINE.clear()
    for limb, parts in LIMB_PARTS.items():
        own = np.any([L0[p] for p in parts], axis=0)
        msk = ndimage.binary_dilation(own, iterations=14)
        w = np.eye(2, 3, dtype=np.float32)
        try:
            cc, w = cv2.findTransformECC(e0, e1, w, cv2.MOTION_EUCLIDEAN, (cv2.TERM_CRITERIA_EPS | cv2.TERM_CRITERIA_COUNT, 200, 1e-6), msk.astype(np.uint8), 3)
        except cv2.error:
            continue
        shift = float(np.hypot(w[0, 2], w[1, 2])); rot = float(np.degrees(np.arctan2(w[1, 0], w[0, 0])))
        # how far the fit moves the limb's joints (the master's joint p is drawn at w(p) in the picture)
        moved_px = max(float(np.hypot(*(w[:, :2].astype(np.float64) @ J[j] + w[:, 2] - J[j]))) for j in LIMB_JOINTS[limb])
        REFINE[limb] = (round(shift, 1), round(rot, 2), round(moved_px, 1))
        if shift > 30 or abs(rot) > 12: continue  # not a small correction: leave it to the check
        moved = cv2.warpAffine(al, w, (SH[1], SH[0]), flags=cv2.INTER_LINEAR | cv2.WARP_INVERSE_MAP, borderValue=(255, 0, 255))
        sel = np.any([field[p] for p in parts], axis=0)
        out[sel] = moved[sel]
    return out


SEG = {}
# the body check (exporter 1.6): outside the item, the picture's body must be the master's, in proportions and in pose.
# Calibrated on every accepted source (an exact edit of the master sits within 1.6 px and 0.2 deg) and on the art
# director's made defects (X01: torso 4% shorter, legs longer; X02: an arm turned 6 deg).
GEO_SEGS = ('head', 'torso', 'pelvis', 'thigh_B', 'thigh_F', 'shin_B', 'shin_F')   # the trunk and the legs' landmarks
GEO_MAX_PX = 3.0       # a trunk or leg part may sit at most this far (master px) from the master's after the body fit
POSE_MAX_DEG = 3.0     # a limb outside the item may be turned at most this much from the master's pose
COVER_MAX = 0.2        # a part more covered by the item than this (its inside) is the item's, not checked
# the face under headwear (exporter 1.6, with the finer body fit): its drawn lines must match the master's at 0.7 (a
# valid hat 0.87; the changed-face fixture 0.57) and be nearly as strong (0.8 of the master's; a valid hat 0.97, the
# blurred face of the fixture 0.70)
FACE_LINES_MIN = 0.7
FACE_SHARP_MIN = 0.8
LIMB_SEGS = {'arm_B': ('uparm_B', 'forearm_B', 'hand_B'), 'arm_F': ('uparm_F', 'forearm_F', 'hand_F'),
             'leg_B': ('thigh_B', 'shin_B', 'foot_B'), 'leg_F': ('thigh_F', 'shin_F', 'foot_F')}
NAMES = {'head': 'the head', 'torso': 'the chest', 'pelvis': 'the hips', 'thigh_B': 'the near thigh', 'thigh_F': 'the far thigh',
         'shin_B': 'the near shin', 'shin_F': 'the far shin', 'arm_B': 'the near arm', 'arm_F': 'the far arm',
         'leg_B': 'the near leg', 'leg_F': 'the far leg'}


def body_check(shifts, refine, allowed):
    """(geometry problems, pose problems, measures): the trunk and leg parts outside the item that sit off the master's
    (proportions or landmarks changed), and the limbs outside the item turned from the master's pose."""
    geo, pose, meas = [], [], {'geometry_px': {}, 'pose_deg': {}}
    for sname in GEO_SEGS:
        if sname in shifts and shifts[sname][2] < COVER_MAX:
            d = float(np.hypot(shifts[sname][0], shifts[sname][1])); meas['geometry_px'][sname] = round(d, 1)
            if d > GEO_MAX_PX: geo.append(f'{NAMES[sname]} {d:.1f} px off')
    for limb, parts in LIMB_PARTS.items():
        if any(p in allowed for p in parts) or limb not in refine: continue
        if any(shifts.get(sg, (0, 0, 0))[2] >= COVER_MAX for sg in LIMB_SEGS[limb]): continue
        turn = abs(float(refine[limb][1])); meas['pose_deg'][limb] = round(turn, 2)
        if turn > POSE_MAX_DEG: pose.append(f'{NAMES[limb]} turned {turn:.1f} deg')
    return geo, pose, meas


def part_shifts(al, item_zone):
    """How far each body part of the lined-up picture sits from the master's, outside the item's zone: a translation
    fit of the part's drawn lines (px). Head, torso, pelvis, upper arms, forearms, hands, thighs, shins, feet."""
    if not SEG:
        SEG['_e0'] = edges(MASTER_RGB)
        for p in ('head', 'torso', 'pelvis', 'hand_B', 'hand_F', 'foot_B', 'foot_F'): SEG[p] = L0[p]
        for s in 'BF':
            up = beyond(J[f'elbow_{s}'], unit(J[f'shoulder_{s}'], J[f'elbow_{s}'])) < 0
            SEG[f'uparm_{s}'] = L0[f'arm_{s}'] & up; SEG[f'forearm_{s}'] = L0[f'arm_{s}'] & ~up
            th = beyond(J[f'knee_{s}'], unit(J[f'hip_{s}'], J[f'knee_{s}'])) < 0
            SEG[f'thigh_{s}'] = L0[f'leg_{s}'] & th; SEG[f'shin_{s}'] = L0[f'leg_{s}'] & ~th
    e1 = edges(al); out = {}
    alpha_al, _ = key(Image.fromarray(al))
    dE = np.sqrt(((cv2.cvtColor(al, cv2.COLOR_RGB2LAB).astype(np.float32) - LAB0) ** 2).sum(2))
    item_like = (alpha_al > 0.5) & (dE > 30)    # opaque and far from the master's colour there: the item over the body
    for name, m in SEG.items():
        if name == '_e0': continue
        m_ = m & ~item_zone
        if m_.sum() < 800: continue
        inner = ndimage.binary_erosion(m_, iterations=6)
        covered = float(item_like[inner].mean()) if inner.any() else 0.0
        msk = ndimage.binary_dilation(m_, iterations=5) & ~item_zone
        w = np.eye(2, 3, dtype=np.float32)
        try:
            _, w = cv2.findTransformECC(SEG['_e0'], e1, w, cv2.MOTION_TRANSLATION, (cv2.TERM_CRITERIA_EPS | cv2.TERM_CRITERIA_COUNT, 200, 1e-6), msk.astype(np.uint8), 3)
        except cv2.error:
            continue
        out[name] = [round(float(w[0, 2]), 1), round(float(w[1, 2]), 1), round(covered, 2)]
    return out


EXPORTER_VERSION = '1.7'
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
            REPORT.append({'id': r.get('id', '?'), 'accepted': False, 'check': 'catalog row', 'reason': bad}); print('REJECTED', r.get('id'), bad); continue
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
# the bare body's colours where they are (skin, hair, the grey shorts), as local colour fields: a pixel is like the
# body when its colour is near the colour of a body material that lies near it (grey near the shorts is the body,
# grey on the shoulders is not)
def _field(mask, sigma=25):
    w = ndimage.gaussian_filter(mask.astype(np.float32), sigma)
    return w, np.dstack([ndimage.gaussian_filter(LAB0[..., c] * mask, sigma) for c in range(3)]) / np.maximum(w, 1e-6)[..., None]


BODY_FIELDS = [_field(SKIN0), _field(L0['head'] & (alpha0 > 0.95) & ~FACE0 & (LAB0[..., 0] > 50)),
               _field(L0['pelvis'] & (alpha0 > 0.95) & ~SKIN0 & (LAB0[..., 0] > 50))]


def background_problem(img):
    """A source stands on the flat magenta background (the keying depends on it): the picture's border, 12 px all
    round, must be magenta. Otherwise the reason says what is there instead (white, another flat colour, a gradient,
    a scene)."""
    b = np.zeros(img.shape[:2], bool); b[:12] = b[-12:] = True; b[:, :12] = b[:, -12:] = True
    px = img[b].astype(np.float32)
    mag = float((np.abs(px - np.array([255, 0, 255], np.float32)).max(1) < 60).mean())
    if mag >= 0.95: return None
    mean = px.mean(0); spread = float(np.abs(px - mean).max(1).mean())
    if spread < 12:
        kind = 'white' if mean.min() > 225 else f'a flat colour (RGB {int(mean[0])}, {int(mean[1])}, {int(mean[2])})'
    else:
        # along the left and top edges: a gradient changes smoothly (small steps, a large range), a scene does not
        col = img[:, :12].astype(np.float32).mean(1); row = img[:12].astype(np.float32).mean(0)
        steps = float(np.mean([np.abs(np.diff(col, axis=0)).max(1).mean(), np.abs(np.diff(row, axis=0)).max(1).mean()]))
        kind = 'a gradient' if steps < 3 else 'a scene or a texture'
    return f'the background is {kind}, not the flat magenta ({mag * 100:.0f}% of the border is magenta): ask for the item again on the flat magenta background of the attached master'


def mirrored(img, cc, exclude):
    """(is the picture mirrored, the fit of the flipped picture): a mirrored source (the character facing the other way)
    lines up with the master clearly better once flipped back."""
    try:
        alpha_f, _ = key(Image.fromarray(np.ascontiguousarray(img[:, ::-1])))
        ccf, _ = align(alpha_f, exclude)
    except cv2.error:
        return False, None
    return bool(ccf > (cc if cc is not None else 0.0) + 0.02), round(float(ccf), 4)


def item_reach(al, alpha_a, zone):
    """The item reaching past the body beyond its zone (big shoulder plates, wide sleeves, a long hem): opaque pixels
    off the master's figure, in pieces joined to the item's zone and mostly coloured unlike the body there (skin, hair
    or shorts nearby). That is the item, not a body that differs from the master."""
    off = (alpha_a > 0.5) & ~M0
    lab, n = ndimage.label(off)
    ids = np.unique(lab[off & zone]); ids = ids[ids > 0]
    if not n or not len(ids): return np.zeros(SH, bool)
    la = cv2.cvtColor(al, cv2.COLOR_RGB2LAB).astype(np.float32)
    like = np.zeros(SH, bool)
    for w, col in BODY_FIELDS:
        like |= (w > 0.02) & (np.sqrt(((la - col) ** 2).sum(2)) <= 30)
    unlike = (~like).astype(np.float32)
    share = np.asarray(ndimage.mean(unlike, lab, ids))
    return np.isin(lab, ids[share >= 0.6])


# ------------------------------------------------------------------ the skirt garment profile (the art director's r9)
# A bottom whose cloth closes the gap between the thighs down to a hem above the knees, where the gap opens at once onto
# other cloth (trousers) or the bare legs, is a skirt over them. The skirt is cut on its own: it hangs from its waistband
# and answers both thighs at runtime (SlotDef.skirt); the trousers keep their legs, carried on up under the skirt; the
# waistband stays the hips' piece. Side panels (they leave the gap between the legs open) and wide trouser legs (their gap
# opens gradually, in the same cloth) are not skirts: they stay on the legs, each panel with its own leg.
SKIRT_OPEN = 0.015      # B: at the hem the gap between the thighs' axes opens by at least this much (kilt 0.037; trousers
SKIRT_ROWS = 0.006      # at most 0.006, the fitted legs of the asymmetric skirt trousers 0.020) within this many rows (B)
SKIRT_CLOTH_DE = 12     # and the cloth above the opening is not the cloth below it (median Lab distance, both ways: kilt
                        # 16 and more, trousers at most 5)
SKIRT_WRAP = 0.7        # and its cloth covers the thighs from side to side just above the hem (a front apron does not)
SKIRT_N = 25            # the fan's columns at runtime: the hang line and the hem are given at this many, evenly spaced
SKIRT_OVER = 3          # drawing px of the waistband the skirt carries on up under it (hidden; no seam at the waist)
SKIRT_LINES = {}        # per item: the hang line and the hem across the canvas (drawing px), for its frame


def kcentres(px, k):
    """k colour centres (k-means, fixed seed) of N×3 Lab pixels."""
    px = np.ascontiguousarray(np.asarray(px, np.float32).reshape(-1, 3))
    k = max(1, min(k, len(px) // 20))
    cv2.setRNGSeed(12345)
    _, _, cen = cv2.kmeans(px, k, None, (cv2.TERM_CRITERIA_EPS | cv2.TERM_CRITERIA_MAX_ITER, 30, 0.5), 3, cv2.KMEANS_PP_CENTERS)
    return cen


def near(lab, cen):
    """Each pixel's Lab distance to the nearest of the centres."""
    f = np.asarray(lab, np.float32).reshape(-1, 3)
    d = np.full(len(f), np.inf, np.float32)
    for c in cen: d = np.minimum(d, np.sqrt(((f - c) ** 2).sum(1)))
    return d.reshape(np.asarray(lab).shape[:-1])


def axis_x(s, y):
    """Where the thigh's axis (hip joint to knee) crosses row y."""
    h, k = J[f'hip_{s}'], J[f'knee_{s}']
    return h[0] + (np.asarray(y, np.float64) - h[1]) / (k[1] - h[1]) * (k[0] - h[0])


def dp_line(gain, step=2):
    """The line y(x) through gain[y, x] (the score of the line at row y of column x) of the most total score, each
    column at most `step` rows from the one before (dynamic programming over the columns)."""
    H_, W_ = gain.shape
    idx = np.arange(H_)
    best = gain[:, 0].astype(np.float64).copy(); back = np.zeros((H_, W_), np.int32)
    for x in range(1, W_):
        cand = np.full((2 * step + 1, H_), -np.inf)
        for k_, dy in enumerate(range(-step, step + 1)):
            src = idx + dy; ok = (src >= 0) & (src < H_)
            cand[k_, ok] = best[src[ok]]
        kk = np.argmax(cand, 0)
        back[:, x] = idx + kk - step
        best = cand[kk, idx] + gain[:, x]
    y = np.zeros(W_, np.int32); y[-1] = int(np.argmax(best))
    for x in range(W_ - 1, 0, -1): y[x - 1] = back[y[x], x]
    return y


def find_skirt(item, alpha_a, lab_a, al_skirt):
    """A bottom's skirt: (its mask, its hang line and hem across the canvas, the measures), or (None, None, the
    measures and why not)."""
    m = {}
    cy = float(C['crotch'][0][1]); ky = min(J['knee_B'][1], J['knee_F'][1])
    ys = np.arange(int(cy), int(ky))
    xb, xf = np.round(axis_x('B', ys)).astype(int), np.round(axis_x('F', ys)).astype(int)
    # the gap between the thighs' axes, row by row, in the picture's own figure (the item and the body)
    g = np.array([(alpha_a[y, a:b] < 0.5).sum() for y, a, b in zip(ys, xb, xf)])
    n = max(2, int(round(SKIRT_ROWS * BPX)))
    d = g[n:] - g[:-n]
    i = int(np.argmax(d))
    m['opening_B'] = round(float(d[i]) / BPX, 4)
    if d[i] < SKIRT_OPEN * BPX: m['why'] = 'the gap between the legs never opens at once (no hem crosses it)'; return None, None, m
    yo = int(ys[i] + n // 2); m['opening_y'] = yo
    # (the hem's own curve opens it over a few rows: closed down to 0.015 B above the opening)
    if (g[:max(0, i - int(0.015 * BPX))] > 0.004 * BPX).any(): m['why'] = 'the gap between the legs is open above the opening'; return None, None, m
    xbr, xfr = axis_x('B', YY), axis_x('F', YY)
    above = item & (XX >= xbr) & (XX <= xfr) & (YY >= yo - 0.03 * BPX) & (YY < yo - 0.006 * BPX)
    near_axes = (np.abs(XX - xbr) < 0.035 * BPX) | (np.abs(XX - xfr) < 0.035 * BPX)
    below = (alpha_a > 0.5) & near_axes & (YY >= yo + 0.008 * BPX) & (YY < yo + 0.034 * BPX)
    if above.sum() < 100 or below.sum() < 100: m['why'] = 'too little cloth around the opening'; return None, None, m
    ca, cb = kcentres(lab_a[above], 6), kcentres(lab_a[below], 6)
    de = max(float(np.median(near(lab_a[below], ca))), float(np.median(near(lab_a[above], cb))))
    m['cloth_dE'] = round(de, 1)
    if de < SKIRT_CLOTH_DE: m['why'] = 'the same cloth goes on below the opening (trouser legs)'; return None, None, m
    dA, dB = near(lab_a, ca), near(lab_a, cb)
    like = item & (dA <= dB)                                   # the skirt's cloth (nearer its colours than the legs')
    band = (L0['leg_B'] | L0['leg_F']) & M0 & (YY >= yo - 0.03 * BPX) & (YY < yo - 0.006 * BPX)
    own = item & (dA < 1.5 * SKIRT_CLOTH_DE)                   # (in its own colours, whatever lies below the hem)
    m['wrap'] = round(float((own & band).sum() / max(1, band.sum())), 3)
    if m['wrap'] < SKIRT_WRAP: m['why'] = 'its cloth does not cover the thighs from side to side above the opening'; return None, None, m
    # the skirt's columns: its cloth around the hem's height (specks opened away)
    core = ndimage.binary_opening(like & (YY >= yo - 0.06 * BPX) & (YY < yo + 0.03 * BPX), iterations=2)
    cols = np.where(core.any(0))[0]
    xl, xr = int(cols.min()), int(cols.max())
    # the hem: below the skirt's cloth, above everything else (the trousers, the legs, the background)
    y0h, y1h = int(yo - 0.08 * BPX), int(min(SH[0] - 1, yo + 0.08 * BPX))
    s_ = np.where(like[y0h:y1h, xl:xr + 1], 1.0, -1.0)
    gain = np.vstack([np.zeros((1, s_.shape[1])), np.cumsum(s_, 0)])
    hem = dp_line(gain) + y0h
    # its outline: the dark line just under the cloth goes with the skirt
    L_ = lab_a[..., 0]
    for k_, x in enumerate(range(xl, xr + 1)):
        y = hem[k_]
        while y < hem[k_] + 0.005 * BPX and y < SH[0] - 1 and item[y, x] and L_[y, x] < 70: y += 1
        hem[k_] = y
    # the waistband: the item's top band. A two-colour-model graph cut (GrabCut) between the waistband (seeded by the
    # item's top rows) and the skirt's cloth (seeded below the crotch) finds its lower edge, the line the skirt hangs from
    top = int(np.where((item & L0['pelvis']).any(1))[0].min()) if (item & L0['pelvis']).any() else int(J['waist'][1])
    y1g = int(yo - 0.01 * BPX)
    sub_it = item[top:y1g, xl:xr + 1]
    wb = sub_it & (np.arange(y1g - top)[:, None] < 0.012 * BPX)
    m['waistband_dE'] = round(float(np.median(near(lab_a[top:y1g, xl:xr + 1][wb], ca))), 1) if wb.sum() >= 100 else 0.0
    hang = None
    if wb.sum() >= 100 and m['waistband_dE'] >= SKIRT_CLOTH_DE:
        img_ = np.ascontiguousarray(np.where(sub_it[..., None], al_skirt[top:y1g, xl:xr + 1], np.array([0, 0, 255], np.uint8)))
        gc_ = np.where(sub_it, cv2.GC_PR_BGD, cv2.GC_BGD).astype(np.uint8)
        gc_[wb] = cv2.GC_FGD
        gc_[sub_it & (np.arange(top, y1g)[:, None] >= cy)] = cv2.GC_BGD
        gc_[sub_it & (np.arange(top, y1g)[:, None] < cy) & (np.arange(top, y1g)[:, None] >= top + 0.012 * BPX)] = cv2.GC_PR_BGD
        try:
            cv2.setRNGSeed(12345)
            cv2.grabCut(img_, gc_, None, np.zeros((1, 65), np.float64), np.zeros((1, 65), np.float64), 5, cv2.GC_INIT_WITH_MASK)
            belt = sub_it & ((gc_ == cv2.GC_FGD) | (gc_ == cv2.GC_PR_FGD))
            # the waistband is what of it hangs together from the top rows down
            lab_w, _ = ndimage.label(belt)
            belt = np.isin(lab_w, np.unique(lab_w[wb & belt])) & (lab_w > 0)
            t_ = np.where(~sub_it, 0.0, np.where(belt, 1.0, -1.0))
            gain = np.vstack([np.zeros((1, t_.shape[1])), np.cumsum(t_, 0)])
            hang = dp_line(gain, step=1) + top
            # beyond the waistband's own columns the line holds its last height
            wcols = np.where(belt.any(0))[0]
            if len(wcols):
                hang[:wcols.min()] = hang[wcols.min()]; hang[wcols.max() + 1:] = hang[wcols.max()]
            m['waistband'] = 'cut'
        except cv2.error:
            hang = None
    if hang is None:
        # no waistband of its own: the skirt hangs from just below the item's top edge
        tops = np.array([np.argmax(item[:, x]) if item[:, x].any() else top for x in range(xl, xr + 1)])
        hang = np.maximum(tops, top) + int(0.012 * BPX)
        m['waistband'] = 'none (its top edge)'
    hang = np.minimum(hang, hem - int(0.03 * BPX))
    xs_ = np.arange(SH[1])
    hang_f = np.interp(xs_, np.arange(xl, xr + 1), hang); hem_f = np.interp(xs_, np.arange(xl, xr + 1), hem)
    mask = item & (XX >= xl) & (XX <= xr) & (YY >= hang_f[None, :] - SKIRT_OVER) & (YY < hem_f[None, :])
    m.update({'columns': [xl, xr], 'hang_y': [int(hang.min()), int(hang.max())], 'hem_y': [int(hem.min()), int(hem.max())], 'px': int(mask.sum())})
    return mask, (hang_f, hem_f), m


def carry_up(tex, base):
    """A trouser leg carried on up under a skirt (strip space): every row above its visible cloth takes the trousers'
    own cloth across: one profile from side to side (outline, folds and all: the median of a band of rows just under the
    hem, each row taken across its own width), laid across the bare leg's width at that row (the trousers' own margins
    scaled with it, smoothed along the leg), so a thigh swung out from under the skirt shows trousers, never the bare
    body. The visible cloth stays as drawn, over it."""
    a, ab = tex[..., 3], base[..., 3]
    H_, W_ = a.shape
    def ext(row):
        c = np.where(row > 0.5)[0]
        return (float(c.min()), float(c.max())) if len(c) >= 3 else None
    # the first row where the trousers cover the bare leg from side to side, then a little lower (past the hem's shadow)
    r0 = next((r for r in range(H_) if ext(ab[r]) and (a[r] > 0.5).sum() >= 0.9 * (ab[r] > 0.5).sum()), None)
    if r0 is None: return tex
    ref = min(H_ - 2, r0 + int(round(0.012 * ABPX)))
    band = max(3, int(round(0.012 * ABPX)))
    Q = 64
    q = (np.arange(Q) + 0.5) / Q
    prof, marg = [], []
    for r in range(ref, min(H_, ref + band)):
        et, es = ext(a[r]), ext(ab[r])
        if not et or not es: continue
        xs_ = et[0] + q * (et[1] - et[0])
        x0_ = np.floor(xs_).astype(int); x1_ = np.minimum(W_ - 1, x0_ + 1); fx = (xs_ - x0_)[:, None]
        prof.append(tex[r, x0_] * (1 - fx) + tex[r, x1_] * fx)
        marg.append(((et[0] - es[0]) / max(1.0, es[1] - es[0]), (et[1] - es[1]) / max(1.0, es[1] - es[0])))
    if not prof: return tex
    prof = np.median(np.stack(prof), 0)                 # Q × 4, premultiplied
    ml, mr = np.median(np.array(marg), 0)              # the trousers' margins beyond the bare leg, per unit of its width
    rows_ = [(r, ext(ab[r])) for r in range(ref)]
    rr = np.array([r for r, e in rows_ if e]); L_ = np.array([e[0] for _, e in rows_ if e]); R_ = np.array([e[1] for _, e in rows_ if e])
    if not len(rr): return tex
    k_ = max(1, int(round(0.004 * ABPX)))
    sm = lambda v: ndimage.uniform_filter1d(v, 2 * k_ + 1, mode='nearest')
    L_, R_ = sm(L_), sm(R_)
    fill = np.zeros_like(tex)
    xs_ = np.arange(W_, dtype=np.float32)
    for r, l_, r_ in zip(rr, L_, R_):
        w_ = r_ - l_
        lt, rt = l_ + ml * w_, r_ + mr * w_
        if rt - lt < 2: continue
        qq = (xs_ + 0.5 - lt) / (rt - lt) * Q - 0.5
        ok = (qq >= -0.5) & (qq <= Q - 0.5)
        qi = np.clip(qq, 0, Q - 1); q0 = np.floor(qi).astype(int); q1 = np.minimum(Q - 1, q0 + 1); fq = (qi - q0)[:, None]
        row = prof[q0] * (1 - fq) + prof[q1] * fq
        fill[r, ok] = row[ok]
    return tex + (1 - a)[..., None] * fill


def put_strip_under(name, limb, layer, width, base_layer):
    """A trouser leg under a skirt: its strip, carried on up to the hips (carry_up) along the bare leg's own strip."""
    tex, rows = strip(limb, layer, width)
    base, _ = strip(limb, base_layer, width)
    if (tex[..., 3] > 0.05).sum() < 20: return False
    tex = carry_up(tex, base)
    FRAMES[name] = dict(img=tex, pivot=[round(tex.shape[1] / 2, 2), round(rows['top'], 2)], rows={k: round(v, 2) for k, v in rows.items()})
    return True


def put_skirt(name, layer, lines):
    """The skirt's frame: rigid about the pelvis joint (as the hips' piece), with its hang line and hem at SKIRT_N evenly
    spaced columns across the frame (frame px): the runtime turns each column about its own point on the hang line."""
    crop, (x0, y0) = tl.crop_alpha(tl.resize_premul(layer, K))
    if crop.shape[0] < 2: return False
    xs_ = (x0 + np.linspace(0, crop.shape[1], SKIRT_N)) / K
    hang, hem = (np.interp(xs_, np.arange(SH[1]), l_) * K - y0 for l_ in lines)
    FRAMES[name] = dict(img=crop, pivot=[round(J['pelvis'][0] * K - x0, 2), round(J['pelvis'][1] * K - y0, 2)],
                        skirt={'hang': [round(float(v), 2) for v in hang], 'hem': [round(float(v), 2) for v in hem]})
    return True


ITEMS_REJECTED = []
items_spec = load_catalog()
SOURCES = {}
for it in items_spec:
    path = os.path.join(HERE, it['picture'])
    if not os.path.exists(path):
        REPORT.append({'id': it['id'], 'accepted': False, 'check': 'source missing', 'reason': f"no picture at {it['picture']}"}); continue
    SOURCES[it['id']] = sha1(path)
    bg = background_problem(np.asarray(Image.open(path).convert('RGB')))
    if bg:
        REPORT.append({'id': it['id'], 'accepted': False, 'check': 'background', 'reason': bg}); print('REJECTED', it['id'], REPORT[-1]); continue
    if it['slot'] == 'weapon':
        # a weapon is drawn on its own, lying flat, blade to the right: keyed, scaled so its grip fits the fist (the
        # grip's drawn thickness → the fist's handle size), its pivot at the middle of the grip. The grip is found
        # from the drawing (the narrow run left of a guard, or a third of the way up a pole) unless the row gives it.
        aw, fw = key(path)
        auto, thick, kind, axis = find_grip(aw)
        grip = it.get('grip', auto); thick = it.get('grip_thickness', thick)
        if abs(axis[1]) > 0.12:
            REPORT.append({'id': it['id'], 'accepted': False, 'check': 'weapon orientation', 'reason': f'the weapon is not drawn level (its axis turns {math.degrees(math.atan2(axis[1], axis[0])):.1f} deg): redraw it flat, blade to the right'}); continue
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
        # lined up on the body outside the item's whole region (its parts and the space around them, where a big item
        # reaches: shoulder plates, a wide hat, heavy boots), so the item's own outline never pulls the fit
        cc, warp = align(alpha_i, np.any([L0[p] for p in allowed], axis=0) | region)
    except cv2.error:
        flip, ccf = mirrored(img, None, np.any([L0[p] for p in allowed], axis=0) | region)
        if flip:
            REPORT.append({'id': it['id'], 'accepted': False, 'check': 'orientation', 'ecc_mirrored': ccf, 'reason': 'the picture is mirrored: the character faces the other way (it lines up with the master only when flipped back): ask for the item again as an edit of the attached master, not flipped'})
        else:
            REPORT.append({'id': it['id'], 'accepted': False, 'check': 'alignment', 'reason': 'the picture cannot be lined up with the master: it must be an edit of the master (same stance, size and place) on a flat magenta background'})
        print('REJECTED', it['id'], REPORT[-1]); continue
    al = cv2.warpAffine(img, warp, (SH[1], SH[0]), flags=cv2.INTER_LINEAR | cv2.WARP_INVERSE_MAP, borderValue=(255, 0, 255))
    if os.environ.get('B01_SAVE_ALIGNED'):   # for review: the picture lined up on the master, before the limb fits
        os.makedirs(os.path.join(OUT, 'aligned'), exist_ok=True); Image.fromarray(al).save(os.path.join(OUT, 'aligned', f"{it['id']}.png"))
    # each limb is then lined up on its own (a picture's arm or leg can sit a few px off even when the body fits): a
    # rigid fit of the limb's edges, its hand or foot included, piecewise over the limb's part of the canvas
    shifts = part_shifts(al, ndimage.binary_dilation(np.any([L0[p] for p in allowed], axis=0), iterations=30))
    al = refine_limbs(al, field)
    alpha_a, fg_a = key(Image.fromarray(al))
    # check: outside the item's own region the picture must still be the master
    outside = M0 & ~ndimage.binary_dilation(np.any([L0[p] for p in allowed], axis=0), iterations=30)
    diff = np.abs(fg_a.astype(np.float32) - fg0.astype(np.float32)).mean(2)
    err = float(np.median(diff[outside])) if outside.any() else 0.0
    zone_ = ndimage.binary_dilation(np.any([L0[p] for p in allowed], axis=0), iterations=30)
    reach = item_reach(al, alpha_a, zone_)
    sil = float(np.mean((((alpha_a > 0.5) ^ M0) & ~reach)[~zone_]))
    # check: outside the item the body keeps the master's proportions and pose (a subtle redraw of the body is caught
    # here, not lined up and passed)
    geo, pose, meas = body_check(shifts, REFINE, allowed)
    ok = err < it.get('max_err', 40) and sil < 0.02 and not geo and not pose
    REPORT.append({'id': it['id'], 'ecc': round(float(cc), 4), 'median_colour_err_outside': round(err, 1), 'silhouette_mismatch_outside': round(sil, 4), 'accepted': ok,
                   'reach_px': int((reach & ~zone_).sum()), **meas, 'limb_fit': dict(REFINE), 'part_shift': shifts})
    if not ok:
        flip, ccf = mirrored(img, cc, np.any([L0[p] for p in allowed], axis=0) | region)
        REPORT[-1]['ecc_mirrored'] = ccf
        if flip:
            REPORT[-1].update({'check': 'orientation', 'reason': f'the picture is mirrored: the character faces the other way (flipped back it lines up at {ccf:.3f}, as drawn at {cc:.3f}): ask for the item again as an edit of the attached master, not flipped'})
            print('REJECTED', it['id'], REPORT[-1]); continue
        REPORT[-1]['check'] = 'pose' if pose else 'proportions' if geo else 'body colour' if err >= it.get('max_err', 40) else 'figure'
        why = []
        if pose: why.append('the picture is not in the master\'s pose: ' + ', '.join(pose) + f' (the limit is {POSE_MAX_DEG:.0f} deg)')
        if geo: why.append('the body outside the item does not keep the master\'s proportions: ' + ', '.join(geo) + f' (the limit is {GEO_MAX_PX:.0f} px)')
        if err >= it.get('max_err', 40): why.append(f'the body outside the item is not the master (median colour error {err:.0f}, the limit is {it.get("max_err", 40)})')
        if sil >= 0.02: why.append(f'the figure outside the item has another shape than the master ({sil * 100:.1f}% of it differs, the limit is 2%)')
        REPORT[-1]['reason'] = '; '.join(why) + ': ask for the item again as an edit of the attached master, without changing the body'
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
        # the colour models start from a fixed seed: an item's cut depends on its own picture only, never on which
        # items were cut before it (adding, removing or rejecting a source changes no other item)
        cv2.setRNGSeed(12345)
        cv2.grabCut(np.ascontiguousarray(al[y0_:y1_, x0_:x1_]), sub, None, bgd, fgd, 6, cv2.GC_INIT_WITH_MASK)
    except cv2.error:   # nothing in the picture differs from the master (or nothing is the body): no item to cut
        REPORT[-1].update({'accepted': False, 'check': 'no item', 'reason': 'no item found: the picture is the master itself, or the item is too small to cut'})
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
        hs = np.asarray(ndimage.sum(holes, hl, range(1, hn + 1)))
        fill = hs < it.get('hole_px', 600)
        # a large enclosed area is body on the trunk (the bare chest inside a harness, an open vest), but inside a
        # top's sleeve or a bottom's trouser leg it is the garment itself, coloured like skin (pale cloth over the legs): a limb
        # cannot show through an enclosed opening of its own sleeve or trouser leg, and the filled area rides the same
        # limb strip anyway. Off the master's figure it is the item too (the body is not there).
        hole_log = []
        # (a top's sleeves are over the arms, a bottom's trouser legs over the legs; footwear and headwear keep their
        # openings: the skin between a sandal's straps is the foot)
        sleeve_parts = {'top': ('arm_B', 'arm_F'), 'bottom': ('leg_B', 'leg_F')}.get(it['slot'], ())
        limbs_ = np.any([field[p] for p in sleeve_parts], axis=0) if sleeve_parts else np.zeros(SH, bool)
        for k in np.where(~fill)[0]:
            m_ = hl == k + 1
            off = float((m_ & ~M0).mean())          # share of it outside the master's figure
            on_limb = float(limbs_[m_].mean())     # share of it over the master's arms and legs
            err = float(np.median(dE[m_]))          # colour difference to the master inside it (for the record)
            if off > HOLE_OFF_FIGURE or on_limb >= HOLE_ON_LIMB: fill[k] = True
            hole_log.append({'px': int(hs[k]), 'off_figure': round(off, 3), 'on_limb': round(on_limb, 2), 'colour_err': round(err, 1), 'filled': bool(fill[k])})
        if hole_log: REPORT[-1]['large_holes'] = hole_log
        item |= np.isin(hl, 1 + np.where(fill)[0])
    item &= region
    # the skin halo: a boot collar or a waistband drawn over the bare body leaves a few skin-coloured pixels along the
    # item's edge; near its edge, a pixel whose colour matches the master's skin around it is body, not item
    edge_band = item & ~ndimage.binary_erosion(item, iterations=6)
    halo = edge_band & (SKIN0_W > 0.05) & (np.sqrt(((lab_a - SKIN0_LAB) ** 2).sum(2)) < it.get('skin_halo', 16))
    item &= ~halo
    item &= ndimage.binary_opening(item, iterations=1) | ~edge_band
    if item.sum() < it.get('min_item_px', 800):
        REPORT[-1].update({'accepted': False, 'check': 'no item', 'reason': 'no item found: the picture is the master itself, or the item is too small to cut'})
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
        # and as sharp as the master's (a blurred or smudged face still lines up, but its lines are weak)
        vis = face & (dEf <= 25)
        ncc, sharp = 1.0, 1.0
        if covered < 0.6 and vis.sum() > 500:
            e0 = edges(MASTER_RGB)[vis]; e1 = edges(al)[vis]
            sharp = float(np.sqrt((e1 * e1).sum() / max(1e-6, (e0 * e0).sum())))
            e0 = e0 - e0.mean(); e1 = e1 - e1.mean()
            ncc = float((e0 * e1).sum() / max(1e-6, np.sqrt((e0 * e0).sum() * (e1 * e1).sum())))
        REPORT[-1].update({'face_covered': round(covered, 3), 'face_err': round(face_err, 1), 'face_lines': round(ncc, 3), 'face_sharpness': round(sharp, 3)})
        lines_min = it.get('face_lines_min', FACE_LINES_MIN)
        if covered < 0.6 and (ncc < lines_min or sharp < FACE_SHARP_MIN):
            REPORT[-1].update({'accepted': False, 'check': 'face', 'reason': f'the face is not drawn as the master\'s (its lines match {ncc:.2f}, at least {lines_min} needed; their strength {sharp:.2f} of the master\'s, at least {FACE_SHARP_MIN}): ask for the headwear again, keeping the face exactly'})
            print('REJECTED', it['id'], REPORT[-1]); continue
        if covered < 0.6 and float(np.median(dEf[face])) > it.get('face_max', 18):
            REPORT[-1].update({'accepted': False, 'check': 'face', 'reason': f'the face is not the master\'s (median colour error {np.median(dEf[face]):.0f} over the visible face): ask for the headwear again, keeping the face exactly'})
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
    sk_mask = None
    if it['slot'] == 'bottom' and not it.get('rigid'):
        # the skirt garment profile: a continuous skirt is cut on its own; the waistband stays the hips' piece and the
        # trouser legs keep what is below the hem
        sk_mask, sk_lines, sk_m = find_skirt(item, alpha_a, lab_a, al)
        sk_m['skirt'] = sk_mask is not None
        REPORT[-1]['skirt'] = sk_m
        if sk_mask is not None:
            Li['skirt'] = sk_mask
            SKIRT_LINES[it['id']] = sk_lines
            for p in ('pelvis', 'leg_B', 'leg_F'): Li[p] = Li[p] & ~sk_mask
            wgt = np.maximum(wgt, np.minimum(alpha_a, ndimage.gaussian_filter(sk_mask.astype(np.float32), 0.7)))
    made = cut_body(it['id'], wgt, fg_i / 255.0, Li, base=False, item_slot=it['slot'], rigid=it.get('rigid', False))
    # coverage (the item's coverage metadata): how much of each of the body's parts the item covers in the master's
    # pose; a part it covers almost whole is hidden under it (its bare piece would only peek out at the edges, like the
    # shorts' waistband above a pair of trousers)
    cov = {p: float((item & L0[p] & M0).sum() / max(1, (L0[p] & M0).sum())) for p in PARTS}
    if sk_mask is not None:
        # under a skirt a leg is covered by its trousers alone (the skirt swings off it): what they cover below the hem
        # (above it they are carried on up to the hips)
        for s_ in 'BF':
            low = L0[f'leg_{s_}'] & M0 & (YY >= SKIRT_LINES[it['id']][1][None, :])
            cov[f'leg_{s_}'] = float((Li[f'leg_{s_}'] & low).sum() / max(1, low.sum()))
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
    meta[name] = {'w': f['img'].shape[1], 'h': f['img'].shape[0], 'pivot': f['pivot'], **{k: f[k] for k in ('rows', 'skirt') if k in f}}
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
print('arm plates (share of the bare arm covered)', PLATE_WRAP)
print('frames', len(meta), {k: (v['w'], v['h']) for k, v in list(meta.items())[:40]})
