# Build body template t1's parts from its drawings: the base body and every item drawn on that same body (template.json
# "drawings" and "items"). Each drawing is split into labelled regions (seeded watershed on the drawn outlines, then the
# template's joint cuts); each item takes its pieces from its labels and cuts them to the template's parts: rigid pieces
# (torso, pelvis, feet) keep their drawn pixels about their joint, limb pieces (arms, legs, sleeves, trouser legs) are
# straightened into strips with rows tied to the joints. Where a drawing hides a piece (behind a part in front of it,
# under a hand or a foot) the piece is carried on from its own pixels. Writes the parts at the atlas scale with their
# pivots, the rig measured on the drawing, and label check sheets.
# Usage: template_build.py <template dir> <out dir>
import json, math, os, sys
import numpy as np
import cv2
from PIL import Image
from scipy import ndimage

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import template_lib as tl  # noqa: E402

TDIR, OUT = sys.argv[1], sys.argv[2]
os.makedirs(OUT, exist_ok=True)
T = json.load(open(os.path.join(TDIR, 'template.json')))
BPX, ABPX = T['bpx'], T['atlas_bpx']
K = ABPX / BPX                                   # atlas px per drawing px
J = {n: np.array(p, np.float64) for n, p in T['joints'].items()}
ROOT = np.array([(J['ankle_B'][0] + J['ankle_F'][0]) / 2, T['ground']])


def B(v): return float(v) / BPX                  # drawing px → B


# ------------------------------------------------------------------ the skeleton, measured on the drawing
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
    'chest': rel('waist', 'pelvis'), 'head': rel('neck', 'waist'),
    'uparm_B': rel('shoulder_B', 'waist'), 'uparm_F': rel('shoulder_F', 'waist'),
    'thigh_B': rel('hip_B', 'pelvis'), 'thigh_F': rel('hip_F', 'pelvis'),
}
PART_PIVOT = {'torso': 'waist', 'pelvis': 'pelvis', 'foot_B': 'ankle_B', 'foot_F': 'ankle_F'}

# ------------------------------------------------------------------ drawings → labelled regions
DRAW = {}  # file → dict(alpha, fg, L, order)


def segment(fname):
    if fname in DRAW: return DRAW[fname]
    spec = T['drawings'][fname]
    alpha, fg = tl.key(os.path.join(TDIR, fname))
    SH = alpha.shape
    L = tl.watershed(alpha, fg, spec['seeds'], spec['front_to_back'])
    cuts = spec.get('cuts', {})
    for s in 'BF':
        if 'wrist' in cuts:  # past the line through the wrist joint, square to the forearm, is hand
            arm, hand = (f'{n}_{s}' for n in cuts['wrist'])
            d = tl.unit(J[f'elbow_{s}'], J[f'wrist_{s}'])
            both = L[arm] | L[hand]; past = tl.side_of(SH, J[f'wrist_{s}'], d) > 0
            L[hand] = both & past; L[arm] = both & ~past
        if 'ankle' in cuts:  # past the line through the ankle joint, square to the shin, is foot
            leg, foot = (f'{n}_{s}' for n in cuts['ankle'])
            d = tl.unit(J[f'knee_{s}'], J[f'ankle_{s}'])
            both = L[leg] | L[foot]; past = tl.side_of(SH, J[f'ankle_{s}'], d) > 0
            L[foot] = both & past; L[leg] = both & ~past
    if 'pelvis' in cuts:
        # the hips: what lies above the line just under the hip joints is the pelvis piece; below it, the legs (cloth
        # there turns with the thighs)
        pel, lb, lf = cuts['pelvis']
        # a shallow V: under the hip joints at the sides, down to the crotch in the middle (the seat stays whole when
        # the legs part)
        xs_ = np.arange(SH[1])[None, :]
        cut_y = J['pelvis'][1] + 5 + 25 * np.clip(1 - np.abs(xs_ - J['pelvis'][0]) / 40.0, 0, 1)
        low = np.arange(SH[0])[:, None] > cut_y
        legs = L[lb] | L[lf]
        pl = L[pel] & low
        if pl.any():
            _, (iy, ix) = ndimage.distance_transform_edt(~legs, return_indices=True)
            nb = L[lb][iy, ix]
            L[lb] = L[lb] | (pl & nb); L[lf] = L[lf] | (pl & ~nb)
        L[pel] = (L[pel] & ~low) | (legs & ~low)
        L[lb] = L[lb] & low; L[lf] = L[lf] & low
    DRAW[fname] = dict(alpha=alpha, fg=fg, L=L, order=spec['front_to_back'], SH=SH)
    return DRAW[fname]


def front_of(D, labels):
    """What the drawing has in front of these labels (it hides them)."""
    order = D['order']; i = min(order.index(n) for n in labels)
    return np.any([D['L'][n] for n in order[:i]], axis=0) if i else np.zeros(D['SH'], bool)


# ------------------------------------------------------------------ pieces
def limb_strip(limb, layer, hidden):
    """Straighten a limb piece: drawn pixels as they are; where the drawing hides the limb, the limb carried on from its
    own pixels inside its band (a round limb's hidden side mirrors its drawn side about the joint line), and past the
    end joint (under the hand / the foot); fills end in round caps."""
    lm = T['limbs'][limb]
    j0, j1, j2 = (J[n] for n in lm['joints'])
    top, bottom, bend, width = (lm[k] * BPX for k in ('top', 'bottom', 'bend', 'width'))
    k2 = 0.5 / K  # sample at twice the atlas resolution, then reduce
    tex, rows = tl.straighten(layer, j0, j1, j2, top, bottom, bend, width, k2)
    hid, _ = tl.straighten(np.dstack([hidden.astype(np.float32)] * 4), j0, j1, j2, top, bottom, bend, width, k2)
    hid = hid[..., 3] > 0.5
    a = tex[..., 3]; cov = a > 0.5
    H, W = a.shape
    lo = np.full(H, -1.0); hi = np.full(H, -1.0); c = (W - 1) / 2
    for y in range(H):
        xs = np.where(cov[y])[0]
        if not len(xs): continue
        if (hid[y] & ~cov[y]).any():
            d = max(c - xs.min(), xs.max() - c); lo[y], hi[y] = c - d, c + d
        else: lo[y], hi[y] = xs.min(), xs.max()
    good = np.where(lo >= 0)[0]
    if len(good):
        for y in range(H):
            if lo[y] < 0: g = good[np.argmin(np.abs(good - y))]; lo[y], hi[y] = lo[g], hi[g]
        lo = np.clip(lo, 0, W - 1); hi = np.clip(hi, 0, W - 1)
        band = np.zeros((H, W), bool)
        for y in range(H): band[y, int(lo[y]):int(hi[y]) + 1] = True
        rr = np.arange(H)[:, None]
        last = np.where(cov.any(1))[0].max()  # hidden parts are filled only within the piece's own length...
        fill = band & ~cov & hid & (rr <= last)
        re0 = int(min(H - 1, rows['end']))
        if cov[max(0, re0 - 6):re0 + 1].any():  # the piece reaches its end joint: it carries on under the hand / foot
            fill |= band & ~cov & (rr > rows['end'])
        if fill.any():
            done = tl.inpaint_rgba(tex, cov, fill, radius=4)
            rt = int(min(H - 1, rows['top'])); re_ = int(min(H - 1, rows['end']))
            cap_t = tl.round_end(np.ones((H, W, 4), np.float32), rows['top'], max(4.0, (hi[rt] - lo[rt]) / 2 + 1), up=True)[..., 3]
            cap_e = tl.round_end(np.ones((H, W, 4), np.float32), rows['end'], max(4.0, (hi[re_] - lo[re_]) / 2 + 1), up=False)[..., 3]
            lim = np.minimum(cap_t, cap_e)
            # near the top joint the fill is a disc about the joint (a ball joint: it turns into itself, its corners
            # never swing out past the piece over it)
            r_t = max(4.0, (hi[rt] - lo[rt]) / 2 + 1)
            yy2, xx2 = np.mgrid[0:H, 0:W].astype(np.float32)
            near_j = (yy2 > rows['top']) & (yy2 < rows['top'] + r_t)
            in_disc = np.clip((r_t - np.sqrt((xx2 - c) ** 2 + (yy2 - rows['top']) ** 2)) / 1.5 + 0.5, 0, 1)
            lim = np.where(near_j, np.minimum(lim, in_disc), lim)
            add = fill & (lim > 0)
            tex[add] = done[add] * lim[add][:, None]
    return tl.resize_premul(tex, 0.5), {k: v * 0.5 for k, v in rows.items()}


FRAMES = {}  # frame name → dict(img (premultiplied RGBA, atlas px), pivot (atlas px), rows?)


def put_rigid(name, layer, pivot):
    crop, (x0, y0) = tl.crop_alpha(tl.resize_premul(layer, K))
    FRAMES[name] = dict(img=crop, pivot=[round(pivot[0] * K - x0, 2), round(pivot[1] * K - y0, 2)])


def put_strip(name, limb, layer, hidden):
    tex, rows = limb_strip(limb, layer, hidden)
    FRAMES[name] = dict(img=tex, pivot=[round(tex.shape[1] / 2, 2), round(rows['top'], 2)], rows={k: round(v, 2) for k, v in rows.items()})


ITEMS = []
for it in T['items']:
    D = segment(it['drawing'])
    alpha, fg, L, SH = D['alpha'], D['fg'], D['L'], D['SH']
    yy = np.arange(SH[0])[:, None] * np.ones((1, SH[1]))
    parts = []
    for pc in it['pieces']:
        part, labels = pc['part'], pc['labels']
        m = np.any([L[n] for n in labels], axis=0)
        name = f"{it['id']}/{part}"
        if part in T['limbs']:
            s = part[-1]
            put_strip(name, part, tl.premul(alpha, fg, m.astype(np.float32)), front_of(D, labels))
        else:
            mm = m.copy()
            if pc.get('caps'):  # a still copy of each shoulder's cap (the arm piece above its shoulder joint) stays here
                for cl in pc['caps']:
                    s = cl[-1]
                    d = tl.unit(J[f'shoulder_{s}'], J[f'elbow_{s}'])
                    above = tl.side_of(SH, J[f'shoulder_{s}'], d) < 0
                    mm |= L[cl] & above & tl.disk(SH, J[f'shoulder_{s}'], T['limbs'][f'arm_{s}']['top'] * BPX * 1.4)
            lay = tl.premul(alpha, fg, mm.astype(np.float32))
            if pc.get('neck'):  # the neck carries on up under the chin (the head turns over it)
                band = tl.disk(SH, J['neck'], 0.05 * BPX) & L['head'] & (yy > J['neck'][1] - 0.03 * BPX)
                # carried on from the neck's own skin (its shade under the chin included), outlines left out
                known = m & (alpha > 0.9) & (fg.max(2) > 0.55)
                lay = tl.inpaint_rgba(lay, known, band, radius=5)
            if pc.get('under'):  # carried on a little under the piece in front of its top edge (a hem over it)
                xs = np.where(m.any(0))[0]; top_y = np.where(m.any(1))[0].min()
                under = np.zeros(SH, bool)
                under[int(top_y - 0.015 * BPX):int(top_y + 4), xs.min() + 4:xs.max() - 3] = True
                under &= L[pc['under']]
                if part.startswith('foot'):  # a boot's collar under the trouser cuff: carry it on up
                    under = np.zeros(SH, bool); bt = np.where(m.any(1))[0].min()
                    cols = np.where(m[bt + 6])[0]
                    under[int(bt - 0.03 * BPX):bt + 6, cols.min():cols.max() + 1] = True
                    under &= L[pc['under']]
                if part.startswith('foot'):
                    lay = tl.inpaint_rgba(lay, m & (alpha > 0.9), under, radius=4)
                else:
                    # under a hem the drawing shades the cloth; the hidden band takes the cloth's own (lit) colour
                    band = m & (yy < np.where(m.any(1))[0].min() + 0.02 * BPX) & (alpha > 0.9)
                    px = fg[band]; lum = px.mean(1)
                    col = np.median(px[lum >= np.percentile(lum, 40)], axis=0)
                    sel = under & ~m
                    lay[sel, :3] = col; lay[sel, 3] = 1.0
            if pc.get('ankle_band'):  # a soft band of ankle above the cut (it lies over the shin's end)
                s = part[-1]
                d = tl.unit(J[f'knee_{s}'], J[f'ankle_{s}'])
                sd = tl.side_of(SH, J[f'ankle_{s}'], d)
                band = (L[f'leg_{s}'] | L[f'foot_{s}']) & (sd > -0.03 * BPX) & tl.disk(SH, J[f'ankle_{s}'], 0.06 * BPX)
                soft = np.clip((sd + 0.03 * BPX) / (0.03 * BPX), 0, 1)
                w = np.maximum(m.astype(np.float32), band * np.where(sd > 0, 1.0, soft))
                lay = tl.premul(alpha, fg, w)
            if part == 'pelvis':
                # the cut across the hips is soft (the legs turn under it), and the crotch gets a filler piece behind
                # the legs: the drawn cloth between the hip joints, shown when the legs part
                xs_ = np.arange(SH[1])[None, :]
                cut = J['pelvis'][1] + 5 + 25 * np.clip(1 - np.abs(xs_ - J['pelvis'][0]) / 40.0, 0, 1)
                F = 0.012 * BPX
                fade = np.clip((cut - yy) / F, 0, 1)
                lay = lay * fade[..., None]
                if pc.get('crotch'):
                    legs_l = [n for n in D['L'] if n in pc['crotch']]
                    cl = np.any([L[n] for n in legs_l + labels], axis=0)
                    box = np.zeros(SH, bool)
                    x0, x1 = int(J['hip_B'][0] - 0.01 * BPX), int(J['hip_F'][0] + 0.01 * BPX)
                    box[int(J['pelvis'][1] - 0.01 * BPX):int(J['pelvis'][1] + 0.09 * BPX), x0:x1] = True
                    reg = box & cl
                    dist = ndimage.distance_transform_edt(reg)
                    w = np.clip(dist / (0.008 * BPX), 0, 1)
                    # one shaded tone of the cloth (the inside of the crotch is in shadow), soft at its edges
                    px = fg[reg & (alpha > 0.9)]; lum = px.mean(1)
                    tone = np.median(px[lum <= np.percentile(lum, 35)], axis=0)
                    fl = np.zeros((SH[0], SH[1], 4), np.float32)
                    fl[..., :3] = tone * w[..., None] * reg[..., None]; fl[..., 3] = w * reg
                    put_rigid(f"{it['id']}/crotch", fl, J['pelvis'])
                    parts.append({'part': 'crotch', 'frame': f"{it['id']}/crotch"})
            put_rigid(name, lay, J[PART_PIVOT[part]])
        parts.append({'part': part, 'frame': name})
    ITEMS.append({'id': it['id'], 'slot': it['slot'], 'name': it['name'], 'parts': parts, **({'hides': it['hides']} if it.get('hides') else {})})

# ------------------------------------------------------------------ write
meta = {}
for name, f in FRAMES.items():
    path = os.path.join(OUT, name + '.png'); os.makedirs(os.path.dirname(path), exist_ok=True)
    tl.to_png(f['img']).save(path)
    meta[name] = {'w': f['img'].shape[1], 'h': f['img'].shape[0], 'pivot': f['pivot'], **({'rows': f['rows']} if 'rows' in f else {})}
rig = {
    'bpx_drawing': BPX, 'root': [round(float(v), 1) for v in ROOT],
    'world': {k: round(v, 3) for k, v in WORLD.items()}, 'lengths': {k: round(v, 5) for k, v in LEN.items()},
    'offsets': GEO, 'limbs': {n: {k: lm[k] for k in ('top', 'bottom', 'bend')} for n, lm in T['limbs'].items()},
}
json.dump({'bpx': ABPX, 'frames': meta, 'items': ITEMS, 'rig': rig}, open(os.path.join(OUT, 'parts.json'), 'w'), indent=1)
for fname, D in DRAW.items():
    names = list(D['L'].keys())
    pal = np.random.default_rng(5).integers(60, 255, (len(names) + 1, 3))
    lab = np.zeros(D['SH'], np.int32)
    for i, n in enumerate(names, 1): lab[D['L'][n]] = i
    over = (0.45 * D['fg'] * 255 + 0.55 * pal[lab]).astype(np.uint8); over[lab == 0] = 30
    over[(ndimage.morphological_gradient(lab, size=3) > 0) & (lab > 0)] = 255
    for n, p in J.items(): cv2.circle(over, (int(p[0]), int(p[1])), 4, (255, 255, 0), -1)
    Image.fromarray(over).save(os.path.join(OUT, 'labels_' + fname))
print('world', {k: round(v, 1) for k, v in WORLD.items()})
print('frames', {k: (v['w'], v['h']) for k, v in meta.items()})
