"""Ready heroes' legs, animated in code: GPT draws each hero once as cut-out parts (tools/heroes/parts/<cls>.png: the upper
body cut at the hips, a thigh and a shin with its boot, twice — the far pair darker). The walk and the run are computed:
real gait cycles (each foot planted on the floor while the body passes over it, the other swinging through), two-bone
IK for the knees, the hips bobbing from the leg geometry, the body leaning into the run. The frames are baked into the
hero's atlas (cut.py calls `bake`), so the game plays them like any drawn frame — and the legs keep pace with the floor
exactly (the cycle distance is the distance a planted foot travels).
"""
import math

import numpy as np
from PIL import Image
from scipy import ndimage

# Per hero: where the hips sit on the upper body (fractions of its crop: x from the left, y from the top), and the
# column (fraction) behind which the cloth below the hips hangs behind the legs.
HIPS = {
    'samurai': (0.52, 0.66, 0.40),
    'book_mage': (0.47, 0.70, 0.30),
    'warrior': (0.57, 0.66, 0.42),
    'archer': (0.60, 0.66, 0.45),
}
WALK_N, RUN_N = 16, 12
# heroes whose arm sheet has joint balls in a colour apart from the limbs (removed; a shaded joint is drawn instead) —
# the others' balls are armour-coloured and stay as the joint
DROP_BALLS = {'archer', 'book_mage'}
# The armless torso (tools/heroes/parts/<cls>_arms.png): hips x, y, the cloth-behind column, the near shoulder x, y (fractions)
TORSO = {
    'warrior': (0.62, 0.60, 0.45, 0.55, 0.24),
    'samurai': (0.56, 0.68, 0.42, 0.50, 0.36),
    'archer': (0.60, 0.64, 0.45, 0.64, 0.36),
    'book_mage': (0.60, 0.60, 0.42, 0.49, 0.30),
}


def _components(rgba):
    a = rgba[..., 3] > 40
    lab, k = ndimage.label(a, structure=np.ones((3, 3)))
    sz = ndimage.sum(a, lab, range(1, k + 1)); objs = ndimage.find_objects(lab)
    big = sorted([i for i in range(k) if sz[i] > 2000], key=lambda i: -sz[i])
    out = []
    for i in big:
        sl = objs[i]
        m = lab[sl] == i + 1
        crop = rgba[sl].copy(); crop[..., 3] = np.where(m, crop[..., 3], 0)
        out.append((crop, sl))
    return out


def _balls(part, top=True, bottom=False):
    """The round joint caps GPT drew at the ends: from an end, the rows until the limb grows wider than the cap.
    Returns {'top': (first row, last cap row, pivot y), 'bottom': (...)}."""
    a = part[..., 3] > 100
    w = ndimage.uniform_filter1d(a.sum(1).astype(float), 5); H = len(w)
    ys = np.where(w > 2)[0]
    res = {}
    def cap(rows):
        rows = list(rows)
        bw = max(w[y] for y in rows[:int(0.11 * H)])
        end = rows[-1]
        for y in rows[int(0.03 * H):int(0.3 * H)]:
            if w[y] > 1.3 * bw:
                end = y; break
        return bw, end
    if top:
        bw, end = cap(range(ys[0], ys[-1]))
        res['top'] = (int(ys[0]), int(end), ys[0] + 0.5 * bw, bw)
    if bottom:
        bw, end = cap(range(ys[-1], ys[0], -1))
        res['bottom'] = (int(end), int(ys[-1]), ys[-1] - 0.5 * bw, bw)
    return res


def _recolor_cap(part, y0, y1, ref_rows, cy=None, bw=None):
    """Paint a joint cap in the limb's own colours (GPT drew grey / skin balls): its pixels take the colours of the rows
    beside it, keeping its shading."""
    a = part[..., 3] > 30
    ry = [y for y in ref_rows if 0 <= y < part.shape[0]]
    ref = part[ry][a[ry]][:, :3].astype(float)
    if not len(ref):
        return
    col = np.median(ref, 0)
    col = np.percentile(ref, 35, axis=0)  # the limb's darker tone (a knee in shadow)
    H, W = part.shape[:2]
    yy, xx = np.mgrid[0:H, 0:W]
    m = np.zeros((H, W), bool) if cy is not None else (yy >= y0) & (yy <= y1)
    if cy is not None:  # the whole ball: a circle round its centre (a little larger than it)
        cx = float(np.where(a[int(min(H - 1, max(0, cy)))])[0].mean()) if a[int(min(H - 1, max(0, cy)))].any() else W / 2
        m = m | ((xx - cx) ** 2 + (yy - cy) ** 2 <= (0.7 * bw) ** 2)
    m &= a
    lum = part[..., :3].astype(float).mean(2)
    med = max(1.0, float(np.median(lum[m]))) if m.any() else 1.0
    shade = np.clip(lum / med, 0.6, 1.2)[..., None]
    part[..., :3] = np.where(m[..., None], np.clip(col * shade, 0, 255), part[..., :3]).astype(np.uint8)


def _ball_blobs(im, col, area_ref):
    """Round blobs of the joint balls' colour in a part: [(cx, cy, width)] from the top down (GPT's balls share a colour
    within a sheet; used when it differs from the limb so the blobs stand alone)."""
    a = im[..., 3] > 100
    m = a & (np.sqrt(((im[..., :3].astype(float) - col) ** 2).sum(2)) < 42)
    m = ndimage.binary_opening(m, iterations=2)
    lab, k = ndimage.label(m)
    out = []
    for i, sl in enumerate(ndimage.find_objects(lab)):
        ar = int((lab[sl] == i + 1).sum()); hh, ww = sl[0].stop - sl[0].start, sl[1].stop - sl[1].start
        if 0.4 * area_ref < ar < 2.2 * area_ref and 0.6 < hh / ww < 1.7:
            cy, cx = ndimage.center_of_mass(lab == i + 1)
            out.append((float(cx), float(cy), float(ww)))
    return sorted(out, key=lambda b: b[1])


def _top_ball(im):
    """The ball at the top of a plain limb (its top pixels are the ball): (colour, area) or None."""
    a = im[..., 3] > 100
    ys = np.where(a.any(1))[0]; y0 = ys[0]
    rows = slice(y0 + 3, y0 + 10)
    col = np.median(im[rows][a[rows]][:, :3].astype(float), 0)
    m = a & (np.sqrt(((im[..., :3].astype(float) - col) ** 2).sum(2)) < 42)
    lab, _ = ndimage.label(m)
    xs = np.where(m[y0 + 5])[0]
    if not len(xs):
        return None
    k = lab[y0 + 5, xs[len(xs) // 2]]
    ar = int((lab == k).sum())
    return (col, ar) if 0 < ar < 0.12 * a.sum() else None


def _drop_ball(part, c, bw, side):
    """GPT's joint ball at an arm's end (skin / grey spheres): its pixels (the ball's colour, within the ball) are
    removed — the game draws a round joint in the limb's own colour under the end instead. Returns (colour, radius)."""
    H, W = part.shape[:2]
    yy, xx = np.mgrid[0:H, 0:W]
    a = part[..., 3] > 60
    rgb = part[..., :3].astype(float)
    core = a & ((xx - c[0]) ** 2 + (yy - c[1]) ** 2 <= (0.3 * bw) ** 2)
    ball = np.median(rgb[core], 0) if core.any() else None
    ref_y = int(c[1] + side * 1.1 * bw)
    ry = [y for y in range(ref_y, ref_y + side * 20, side) if 0 <= y < H]
    ref = rgb[ry][a[ry]] if ry else np.zeros((0, 3))
    col = np.percentile(ref, 25, axis=0) if len(ref) else np.array([60.0, 60, 60])  # the joint sits in shadow
    rr = float(np.mean([a[y].sum() for y in ry])) / 2 if ry else 0.5 * bw
    if ball is not None:
        near = np.sqrt(((rgb - ball) ** 2).sum(2)) < 48
        m = a & near & ((xx - c[0]) ** 2 + (yy - c[1]) ** 2 <= (0.62 * bw) ** 2)
        m = ndimage.binary_dilation(m, iterations=2) & ((xx - c[0]) ** 2 + (yy - c[1]) ** 2 <= (0.66 * bw) ** 2)
        part[..., 3] = np.where(m, 0, part[..., 3])
    return col, 0.34 * min(max(rr, 0.8 * bw), 1.2 * bw)


def _disc(canvas, c, col, r):
    """A round joint, softly shaded (lit from above-front)."""
    if r <= 0:
        return
    n = int(2 * r + 4)
    yy, xx = np.mgrid[0:n, 0:n] - n / 2.0
    d = np.sqrt(xx ** 2 + yy ** 2) / max(1.0, r)
    sh = np.clip(1.08 - 0.35 * np.sqrt(((xx - 0.3 * r) / r) ** 2 + ((yy + 0.3 * r) / r) ** 2), 0.6, 1.1)
    out = np.zeros((n, n, 4), np.uint8)
    out[..., :3] = np.clip(np.array(col)[None, None] * sh[..., None], 0, 255)
    out[..., 3] = np.clip((1 - d) * r * 1.5, 0, 1) * 255
    canvas.alpha_composite(Image.fromarray(out), (int(round(c[0] - n / 2)), int(round(c[1] - n / 2))))


def load_parts(path, cls):
    from cut import alpha_from_white
    rgba = alpha_from_white(np.array(Image.open(path).convert('RGB')))
    comps = _components(rgba)
    upper, limbs = comps[0], comps[1:5]
    lum = lambda c: float(c[0][..., :3][c[0][..., 3] > 100].mean())
    bottom = lambda c: c[1][0].stop
    limbs.sort(key=bottom)
    thighs, shins = limbs[:2], limbs[2:]
    thighs.sort(key=lum, reverse=True); shins.sort(key=lum, reverse=True)  # brighter = near
    parts = {}
    for name, (img, sl) in [('thigh_n', thighs[0]), ('thigh_f', thighs[1]), ('shin_n', shins[0]), ('shin_f', shins[1])]:
        img = img.copy(); H = img.shape[0]
        thigh = name.startswith('thigh')
        b = _balls(img, top=True, bottom=thigh)
        t0, tn, top_pivot, tbw = b['top']
        _recolor_cap(img, t0, tn, range(int(top_pivot + 0.9 * tbw), int(top_pivot + 0.9 * tbw) + 16), top_pivot, tbw)
        a = img[..., 3] > 100
        if thigh:
            bn, b1, bot_pivot, bbw = b['bottom']
            _recolor_cap(img, bn, b1, range(int(bot_pivot - 0.9 * bbw) - 16, int(bot_pivot - 0.9 * bbw)), bot_pivot, bbw)
            cx = lambda y: float(np.where(a[int(y)])[0].mean())
            p0 = np.array([cx(top_pivot), top_pivot]); p1 = np.array([cx(bot_pivot), bot_pivot])
        else:
            ys = np.where(a.any(1))[0]; sole = ys[-1]
            ank = sole - 0.13 * (sole - top_pivot)
            leg_row = int(sole - 0.3 * (sole - top_pivot))
            cxs = np.where(a[leg_row])[0]
            p0 = np.array([float(np.where(a[int(top_pivot)])[0].mean()), top_pivot])
            p1 = np.array([float(cxs.mean()), ank])
            parts[name + '_sole'] = float(sole)
        parts[name] = (img, p0, p1)
    img, sl = upper
    hx, hy, back = HIPS[cls]
    arms_png = path.replace('.png', '_arms.png')
    import os
    if os.path.exists(arms_png) and cls in TORSO:  # the body without its arms + the arms as parts (they swing in code)
        from cut import face_size
        a_rgba = alpha_from_white(np.array(Image.open(arms_png).convert('RGB')))
        ac = _components(a_rgba)
        torso = ac[0][0]
        kt = (face_size(img) or 1) / (face_size(torso) or 1)  # to the legs' scale: the same face as the parts' upper body
        rs = lambda im: np.array(Image.fromarray(im).resize((max(1, round(im.shape[1] * kt)), max(1, round(im.shape[0] * kt))), Image.LANCZOS))
        limbs = [rs(c[0]) for c in ac[1:5]]
        area = lambda im: int((im[..., 3] > 100).sum())
        fore_n = max(limbs, key=area); rest = [x for x in limbs if x is not fore_n]
        pairs = [(0, 1), (0, 2), (1, 2)]
        i, j = min(pairs, key=lambda q: abs(rest[q[0]].shape[0] - rest[q[1]].shape[0]) + abs(rest[q[0]].shape[1] - rest[q[1]].shape[1]))
        tops = [_top_ball(x) for x in rest]
        nb = [len(_ball_blobs(x, t[0], t[1])) if t else 0 for x, t in zip(rest, tops)]
        two = [q for q in range(3) if nb[q] >= 2]
        if len(two) == 2 and cls in DROP_BALLS:  # the upper arms have a ball at both ends, the forearm one
            i, j = two
        uppers = sorted([rest[i], rest[j]], key=lambda im: -float(im[..., :3][im[..., 3] > 100].mean()))
        fore_f = rest[3 - i - j]
        tb = _top_ball(uppers[0]) if cls in DROP_BALLS else None  # the sheet's ball colour, when the balls stand apart from the limbs (skin / grey)
        for name, im, both in (('uarm_n', uppers[0], True), ('uarm_f', uppers[1], True), ('farm_n', fore_n, False), ('farm_f', fore_f, False)):
            im = im.copy()
            al = im[..., 3] > 100
            cxr = lambda y: float(np.where(al[int(min(im.shape[0] - 1, max(0, y)))])[0].mean())
            blobs = _ball_blobs(im, tb[0], tb[1]) if tb else []
            own = _top_ball(im) if both else None  # the far arm is drawn darker: its balls too
            if both and len(blobs) < 2 and own and tb:
                blobs = _ball_blobs(im, own[0], own[1])
            if blobs and (not both or len(blobs) >= 2):
                tp_, bt_ = blobs[0], blobs[-1]
                p0 = np.array([tp_[0], tp_[1]]); tbw = tp_[2]
                fill = _drop_ball(im, p0, tbw, +1)
                if both:
                    p1 = np.array([bt_[0], bt_[1]]); _drop_ball(im, p1, bt_[2], -1)
                else:
                    p1 = p0 + np.array([0.0, 100.0])
            else:
                b = _balls(im, top=True, bottom=both)
                t0, tn, tp, tbw = b['top']
                p0 = np.array([cxr(tp), tp])
                _recolor_cap(im, t0, tn, range(int(tp + 0.9 * tbw), int(tp + 0.9 * tbw) + 16), tp, tbw)
                fill = ((0, 0, 0), 0.0)  # the armour ball itself is the joint
                if both:
                    bn, b1, bp, bbw = b['bottom']
                    p1 = np.array([cxr(bp), bp])
                    _recolor_cap(im, bn, b1, range(int(bp - 0.9 * bbw) - 16, int(bp - 0.9 * bbw)), bp, bbw)
                else:
                    p1 = p0 + np.array([0.0, 100.0])  # drawn hanging straight down
            parts[name] = (im, p0, p1)
            parts[name + '_joint'] = fill  # (colour, radius): the round joint drawn under the limb's end
        img = rs(torso)
        if tb:  # the shoulder stump GPT drew on the torso (a ball of the same colour): painted in the torso's own colour
            sp = np.array([TORSO[cls][3] * img.shape[1], TORSO[cls][4] * img.shape[0]])
            ta = img[..., 3] > 100
            m = ta & (np.sqrt(((img[..., :3].astype(float) - tb[0]) ** 2).sum(2)) < 50)
            lab, _ = ndimage.label(ndimage.binary_closing(m, iterations=2))
            yy, xx = np.mgrid[0:img.shape[0], 0:img.shape[1]]
            near = (xx - sp[0]) ** 2 + (yy - sp[1]) ** 2 <= (0.12 * img.shape[1]) ** 2
            ks = [k for k in np.unique(lab[near & (lab > 0)]) if (lab == k).sum() < 3 * tb[1]]
            if ks:
                st = np.isin(lab, ks) & ta
                st = ndimage.binary_dilation(st, iterations=3) & ta
                ring = ndimage.binary_dilation(st, iterations=10) & ~st & ta
                col = np.percentile(img[..., :3][ring].astype(float), 30, axis=0)
                lum = img[..., :3].astype(float).mean(2); med = max(1.0, float(np.median(lum[st])))
                shade = np.clip(lum / med, 0.75, 1.15)[..., None]
                img[..., :3] = np.where(st[..., None], np.clip(col * shade, 0, 255), img[..., :3]).astype(np.uint8)
        hx, hy, back = TORSO[cls][:3]
        parts['shoulder'] = np.array([TORSO[cls][3] * img.shape[1], TORSO[cls][4] * img.shape[0]])
    h, w = img.shape[:2]
    hip = np.array([hx * w, hy * h])
    # cloth below the hips behind the body hangs behind the legs: split it into its own layer
    yy, xx = np.mgrid[0:h, 0:w]
    behind = (yy > hy * h - 0.02 * h) & (xx < back * w)
    back_l = img.copy(); back_l[..., 3] = np.where(behind, img[..., 3], 0)
    front_l = img.copy(); front_l[..., 3] = np.where(behind, 0, img[..., 3])
    parts['upper'] = (front_l, back_l, hip)
    parts['cape_root'] = np.array([back * w, hy * h - 0.02 * h])  # where the cloth behind leaves the body
    return parts


def _place(canvas, img, src_pivot, src_axis_deg, dst, ang_deg):
    """Draw img onto canvas rotated so its axis points at ang (deg, 0 = straight down, + = toward +x), src_pivot at dst."""
    rot = ang_deg - src_axis_deg  # rotate the drawing by this (counter-clockwise positive in PIL is the other way)
    im = Image.fromarray(img)
    pad = int(math.hypot(*img.shape[:2])) + 4
    big = Image.new('RGBA', (img.shape[1] + 2 * pad, img.shape[0] + 2 * pad))
    big.paste(im, (pad, pad))
    cx, cy = src_pivot[0] + pad, src_pivot[1] + pad
    r = big.rotate(rot, resample=Image.BICUBIC, center=(cx, cy))  # PIL rotates counter-clockwise for +deg
    canvas.alpha_composite(r, (int(round(dst[0] - cx)), int(round(dst[1] - cy))))


def _axis_deg(p0, p1):
    v = p1 - p0
    return math.degrees(math.atan2(v[0], v[1]))  # 0 = straight down, + toward +x


def _ik(hip, foot, T, S):
    """Knee for a two-bone leg, bending forward (+x)."""
    d = foot - hip; L = float(np.hypot(*d))
    L = min(L, T + S - 1e-3); L = max(L, abs(T - S) + 1e-3)
    a = math.atan2(d[1], d[0])
    c = math.acos(max(-1, min(1, (T * T + L * L - S * S) / (2 * T * L))))
    k1 = hip + T * np.array([math.cos(a - c), math.sin(a - c)])
    k2 = hip + T * np.array([math.cos(a + c), math.sin(a + c)])
    return k1 if k1[0] > k2[0] else k2


def arm_pose(kind, ph, i):
    """((near shoulder, near elbow), (far shoulder, far elbow)) in degrees: 0 = hanging, + = forward. The arms swing
    against the legs (the near arm back when the near leg is forward); the weapon arm (near) swings less."""
    c = math.cos(2 * math.pi * ph)
    if kind == 'walk':
        n = -11 * c; f = 22 * c
        return (n, 8 + 0.4 * max(0, n)), (f, 10 + 0.5 * max(0, f))
    if kind == 'run':
        n = -24 * c; f = 46 * c
        return (n + 6, 38 + 0.5 * max(0, n)), (f + 4, 78 + 0.3 * max(0, f))
    if kind == 'jump':
        return [((-14, 12), (-30, 18)), ((34, 32), (68, 46)), ((14, 18), (30, 24))][i]
    if kind == 'stance':
        return (24, 34), (12, 30)
    return (2, 4), (-3, 6)


def _ease(t):
    return t * t * (3 - 2 * t)


def gait(kind, phase, L):
    """Foot targets (ankles) relative to the hips (+x forward, +y down) and the hips' height / the body's lean, for one
    moment of the cycle. Returns ((near_foot, far_foot), hip_height, lean_deg, D) — D = the distance one cycle carries the body."""
    if kind == 'walk':
        D, duty, lift, lean = 1.62 * L, 0.6, 0.16 * L, 3.0
    else:
        D, duty, lift, lean = 2.5 * L, 0.36, 0.42 * L, 19.0
    S = duty * D  # how far a planted foot travels relative to the hips
    feet, planted = [], []
    for off in (0.0, 0.5):
        p = (phase + off) % 1.0
        if p < duty:  # planted: slides back under the body at the ground speed
            x = S / 2 - S * (p / duty); y = 0.0; planted.append(x)
        else:  # swinging through
            t = (p - duty) / (1 - duty)
            x = -S / 2 + S * _ease(t)
            if kind == 'run':  # heel kicks up behind, then the knee drives the foot forward
                x -= 0.18 * L * math.sin(math.pi * t) * (1 - t)
                y = -lift * math.sin(math.pi * min(1, t * 1.15)) ** 0.8
            else:
                y = -lift * math.sin(math.pi * t)
            planted.append(None)
        feet.append(np.array([x, y]))
    reach = 0.975 * L if kind == 'walk' else 0.88 * L  # a running leg stays bent: the body low, driving forward
    if kind == 'walk':
        xs = [f[0] for f, p in zip(feet, planted) if p is not None]
        hh = min(math.sqrt(max(0, reach * reach - x * x)) for x in xs) if xs else reach
    else:
        xs = [f[0] for f, p in zip(feet, planted) if p is not None]
        if xs:
            hh = math.sqrt(max(0, reach * reach - xs[0] ** 2)) - 0.03 * L * math.cos(math.pi * (xs[0] / (S / 2)) / 2) ** 2
        else:  # in the air: a little higher than at the push-off
            fl = [((phase + off) % 1.0 - duty) / (1 - duty) for off in (0.0, 0.5)]
            fl = min(f for f in fl if f >= 0)
            base = math.sqrt(max(0, reach * reach - (S / 2) ** 2))
            hh = base + 0.05 * L * math.sin(math.pi * min(1, fl / ((0.5 - duty) / (1 - duty))))
        # airborne feet are measured from the floor: lift them with the hips
    return feet, hh, lean, D, planted


def bake(path, cls, idle_h, size=1.0):
    """The hero's walk / run frames: [(act, rgba crop, ax, ay)], and the cycle distances {act: px}, at the idle's scale."""
    P = load_parts(path, cls)
    front, back, hip_u = P['upper']
    tn, tn0, tn1 = P['thigh_n']; tf, tf0, tf1 = P['thigh_f']
    sn, sn0, sn1 = P['shin_n']; sf, sf0, sf1 = P['shin_f']
    T = float(np.hypot(*(tn1 - tn0))); S = float(np.hypot(*(sn1 - sn0))); L = T + S
    ankle_h = (P['shin_n_sole'] - sn1[1])  # ankle above the sole
    stand_h = hip_u[1] + 0.975 * L + ankle_h  # head top to sole when standing (upper crop starts at the head)
    k = 0.985 * idle_h / stand_h * size
    out = []
    JUMP = [  # (near foot, far foot) from the floor under the hips, hip height, lean — take-off crouch, tucked in the air, reaching down
        ((0.12, 0.0), (-0.14, 0.0), 0.8, 8.0),
        ((0.24, -0.42), (-0.06, -0.3), 0.97, 4.0),
        ((0.14, -0.1), (-0.12, -0.02), 0.97, 0.0)]
    for kind, n in (('idle', 1), ('stance', 1), ('jump', 3), ('walk', WALK_N), ('run', RUN_N)):
        for i in range(n):
            ph = i / n
            if kind == 'jump':
                (a1, b1), (a2, b2), hk, lean = JUMP[i]
                feet = [np.array([a1 * L, b1 * L]), np.array([a2 * L, b2 * L])]; hh = hk * L
            elif kind in ('idle', 'stance'):  # standing (feet a little apart) / the combat stance (wider, knees bent, leaning in)
                sp = 0.16 * L if kind == 'idle' else 0.34 * L
                feet = [np.array([sp / 2, 0.0]), np.array([-sp / 2, 0.0])]
                hh = math.sqrt((0.985 * L) ** 2 - (sp / 2) ** 2) if kind == 'idle' else 0.9 * L
                lean = 0.0 if kind == 'idle' else 6.0
            else:
                feet, hh, lean, D, planted = gait(kind, ph, L)
            W = int(front.shape[1] + 2.4 * L) + 40; Hc = int(front.shape[0] + L + 80)
            cv = Image.new('RGBA', (W, Hc))
            ground = Hc - 20 - ankle_h
            hip = np.array([W / 2.0, ground - hh])
            # the upper body: hips at `hip`, leaning forward around them, a small sway with the steps
            sway = 0.0 if kind in ('idle', 'stance', 'jump') else (1.2 if kind == 'walk' else 2.0) * math.sin(4 * math.pi * ph)
            ang_u = lean + sway * 0.3
            # the arms: (shoulder angle, elbow bend) — 0 = hanging, + = forward; near = the weapon arm, swinging less
            arm_ang = arm_pose(kind, ph, i)
            if 'shoulder' in P:
                th_ = math.radians(-ang_u); d_ = P['shoulder'] - hip_u
                sh_w = hip + np.array([d_[0] * math.cos(th_) - d_[1] * math.sin(th_), d_[0] * math.sin(th_) + d_[1] * math.cos(th_)])
            def arm(U, F, a_sh, a_el):
                (ui, u0, u1), (fi, f0, f1) = U, F
                Lu = float(np.hypot(*(u1 - u0)))
                tot = a_sh - ang_u  # the arm turns with the body's lean (the hanging axis tips back as the body tips forward)
                elbow = sh_w + Lu * np.array([math.sin(math.radians(tot)), math.cos(math.radians(tot))])
                for nm in ('uarm_n', 'uarm_f'):
                    if P[nm] is U:
                        uj = P[nm + '_joint']; fj = P['f' + nm[1:] + '_joint']
                _disc(cv, sh_w, *uj)                                        # the shoulder joint, under the arm's top
                _disc(cv, elbow, *fj)                                       # the elbow, under both (fills the bend's notch)
                _place(cv, ui, u0, _axis_deg(u0, u1), sh_w, tot)
                _place(cv, fi, f0, 0.0, elbow, tot + a_el)
            def upper(layer):
                _place(cv, layer, hip_u, 0.0, hip, -ang_u)  # the drawing turned clockwise (forward) by the lean
            fn = np.array([hip[0] + feet[0][0], ground + feet[0][1]]); ff = np.array([hip[0] + feet[1][0], ground + feet[1][1]])
            kn, kf = _ik(hip, fn, T, S), _ik(hip, ff, T, S)
            # the cloth behind the hips streams back with the speed (lifted, fluttering): a run reads by its cape
            lift_c = {'walk': 5.0, 'run': 24.0}.get(kind, 0.0) + {'walk': 1.5, 'run': 4.0}.get(kind, 0.0) * math.sin(2 * math.pi * ph * 2 + 1.0)
            if lift_c:
                root = P['cape_root']
                # the root, carried with the body's lean, stays put; the cloth turns up round it (clockwise = up behind)
                th = math.radians(-ang_u); d = root - hip_u
                root_w = hip + np.array([d[0] * math.cos(th) - d[1] * math.sin(th), d[0] * math.sin(th) + d[1] * math.cos(th)])
                _place(cv, back, root, 0.0, root_w, -ang_u - lift_c)
            else:
                upper(back)                                                 # the cloth hanging behind the legs
            if 'uarm_f' in P:                                               # the far arm behind everything
                arm(P['uarm_f'], P['farm_f'], *arm_ang[1])
            _place(cv, tf, tf0, _axis_deg(tf0, tf1), hip, _axis_deg(hip, kf))   # the far leg
            _place(cv, sf, sf0, _axis_deg(sf0, sf1), kf, _axis_deg(kf, ff))
            _place(cv, tn, tn0, _axis_deg(tn0, tn1), hip, _axis_deg(hip, kn))   # the near thigh (its top under the tunic)
            upper(front)                                                    # the body
            _place(cv, sn, sn0, _axis_deg(sn0, sn1), kn, _axis_deg(kn, fn))   # the near shin
            if 'uarm_n' in P:                                               # the near arm over all (the weapon in front)
                arm(P['uarm_n'], P['farm_n'], *arm_ang[0])
            # the skirt / tunic over the near thigh: the body's front layer once more, only its lower part
            a = np.array(cv)
            ys = np.where(a[..., 3].any(1))[0]; xs = np.where(a[..., 3].any(0))[0]
            crop = a[ys[0]:ys[-1] + 1, xs[0]:xs[-1] + 1]
            ax, ay = hip[0] - xs[0], (ground + ankle_h) - ys[0]
            if kind == 'jump' and i > 0:  # in the air: placed on its own lowest point (the game lifts it by the jump's height)
                ay = float(ys[-1] - ys[0] + 1)
            im = Image.fromarray(crop)
            im = im.resize((max(1, round(im.width * k)), max(1, round(im.height * k))), Image.LANCZOS)
            out.append((kind, np.array(im), ax * k, ay * k))
    cyc = {kind: gait(kind, 0, L)[3] * k for kind in ('walk', 'run')}
    return out, cyc
