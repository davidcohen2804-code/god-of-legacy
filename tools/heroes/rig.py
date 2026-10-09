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
    'gambler': (0.67, 0.457, 0.56),
}
WALK_N, RUN_N = 16, 12
# heroes whose arm sheet has joint balls in a colour apart from the limbs (removed; a shaded joint is drawn instead) —
# the others' balls are armour-coloured and stay as the joint
DROP_BALLS = {'archer', 'book_mage'}
# sleeves that hide the joint themselves (the mage's bells): the ball's socket is only cut away, not painted over
NO_SOCKET_FILL = {'book_mage'}
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


def _drop_ball(part, c, bw, side, ring=False, fill=True):
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
        if ring:  # its outline too: the half of the ball beyond its centre (past the limb's end)
            m |= ((xx - c[0]) ** 2 + (yy - c[1]) ** 2 <= (1.0 * bw) ** 2) & ((yy - c[1]) * side < 0.1 * bw)
        part[..., 3] = np.where(m, 0, part[..., 3])
        if ring and fill:  # the socket the ball sat in (a dark rim, a hollow): the limb painted on across it, ending flat at the joint
            import cv2
            ref = int(round(c[1] + side * 0.78 * bw))
            if 0 <= ref < H and (part[ref, :, 3] > 100).any():
                lab_, _ = ndimage.label(part[ref, :, 3] > 100)  # the limb's own run on that row (not a weapon beside it)
                k_ = lab_[int(np.clip(c[0], 0, W - 1))] or max(set(lab_[lab_ > 0]), key=lambda q: -abs(np.where(lab_ == q)[0].mean() - c[0]))
                xs_ = np.where(lab_ == k_)[0]; x0_, x1_ = xs_[0], xs_[-1]
                sil = np.zeros((H, W), bool)
                for y in range(min(ref, int(c[1])), max(ref, int(c[1])) + 1):
                    if 0 <= y < H:
                        sil[y, x0_:x1_ + 1] = True
                hole = sil & (((xx - c[0]) ** 2 + (yy - c[1]) ** 2 <= (0.72 * bw) ** 2) | (part[..., 3] < 100))
                solid = (part[..., 3] > 100) & ~hole
                _, (iy, ix) = ndimage.distance_transform_edt(~solid, return_indices=True)
                bgr = np.ascontiguousarray(part[iy, ix, :3][..., ::-1])  # no stray colours of the empty pixels round it
                fixed = cv2.inpaint(bgr, hole.astype(np.uint8) * 255, 7, cv2.INPAINT_TELEA)
                part[..., :3] = np.where(hole[..., None], fixed[..., ::-1], part[..., :3])
                part[..., 3] = np.where(sil, 255, part[..., 3])
    return col, 0.0


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
    knee = None  # the knee balls' colour (from the shins' tops) when they are removed
    for name, (img, sl) in [('shin_n', shins[0]), ('shin_f', shins[1]), ('thigh_n', thighs[0]), ('thigh_f', thighs[1])]:
        img = img.copy(); H = img.shape[0]
        thigh = name.startswith('thigh')
        b = _balls(img, top=True, bottom=thigh)
        t0, tn, top_pivot, tbw = b['top']
        a0 = img[..., 3] > 100
        cx0 = lambda y: float(np.where(a0[int(y)])[0].mean())
        top_c = np.array([cx0(top_pivot), top_pivot])
        if cls in DROP_BALLS and not thigh:  # the ball found by its colour (the top pixels are the ball)
            tb_ = _top_ball(img)
            bl = _ball_blobs(img, tb_[0], tb_[1]) if tb_ else []
            if bl:
                top_c = np.array(bl[0][:2]); tbw = bl[0][2]; top_pivot = top_c[1]
                knee = knee or tb_
            _drop_ball(img, top_c, tbw, +1, ring=True, fill=cls not in NO_SOCKET_FILL)
        else:
            _recolor_cap(img, t0, tn, range(int(top_pivot + 0.9 * tbw), int(top_pivot + 0.9 * tbw) + 16), top_pivot, tbw)
        a = img[..., 3] > 100
        if thigh:
            bn, b1, bot_pivot, bbw = b['bottom']
            bot_c = np.array([float(np.where(a[int(bot_pivot)])[0].mean()), bot_pivot])
            if cls in DROP_BALLS:  # the knee ball removed; a shaded knee is drawn under the thigh and the shin instead
                bl = _ball_blobs(img, knee[0], knee[1]) if knee else []
                if bl:
                    bot_c = np.array(bl[-1][:2]); bbw = bl[-1][2]; bot_pivot = bot_c[1]
                parts[name + '_knee'] = _drop_ball(img, bot_c, bbw, -1, ring=True, fill=cls not in NO_SOCKET_FILL)
            else:
                _recolor_cap(img, bn, b1, range(int(bot_pivot - 0.9 * bbw) - 16, int(bot_pivot - 0.9 * bbw)), bot_pivot, bbw)
            p0 = top_c; p1 = bot_c
        else:
            a = img[..., 3] > 100
            ys = np.where(a.any(1))[0]; sole = ys[-1]
            ank = sole - 0.13 * (sole - top_pivot)
            leg_row = int(sole - 0.3 * (sole - top_pivot))
            cxs = np.where(a[leg_row])[0]
            p0 = top_c
            p1 = np.array([float(cxs.mean()), ank])
            parts[name + '_sole'] = float(sole)
        parts[name] = (img, p0, p1)
        if thigh:  # its lower part alone: drawn again over the shin (the cuff over the knee; the shin's top tucks under)
            low = img.copy(); low[: int(p0[1] + 0.6 * (p1[1] - p0[1])), :, 3] = 0
            parts[name + '_low'] = low
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
        bow_png = path.replace('.png', '_bow.png')
        if cls == 'archer' and os.path.exists(bow_png):  # the bow drawn on its own + the forearm with an empty fist
            bc = _components(alpha_from_white(np.array(Image.open(bow_png).convert('RGB'))))
            bc.sort(key=lambda c: -c[0].shape[0])
            bow, farm = bc[0][0], bc[1][0]
            # GPT drew a ball, a cloth flap and bare skin above her bracer: the forearm starts at the bracer
            al_ = farm[..., 3] > 100; lum_ = farm[..., :3].astype(float).mean(2); Hf = farm.shape[0]
            y_br = next(y for y in range(int(0.3 * Hf), Hf) if al_[y].sum() > 10 and (lum_[y][al_[y]] < 95).mean() > 0.5)
            farm = farm[y_br:].copy()
            sc = 0.9 * fore_f.shape[0] / farm.shape[0]  # as long as the far forearm below its ball
            parts['bow_arm'] = True
            rz = lambda im: np.array(Image.fromarray(im).resize((max(1, round(im.shape[1] * sc)), max(1, round(im.shape[0] * sc))), Image.LANCZOS))
            fore_n, bow = rz(farm), rz(bow)
            bow = np.array(Image.fromarray(bow).resize((round(bow.shape[1] * 0.95), round(bow.shape[0] * 0.95)), Image.LANCZOS))  # as long as in her drawings
            al = fore_n[..., 3] > 100; yb = int(np.where(al.any(1))[0][-1])
            yh = int(yb - 0.075 * fore_n.shape[0]); hg = np.array([float(np.where(al[yh])[0].mean()), float(yh)])  # the fist
            ab = bow[..., 3] > 100; ys_b = np.where(ab.any(1))[0]; ym = int((ys_b[0] + ys_b[-1]) / 2)
            lab_, _ = ndimage.label(ab[ym]); runs = [np.where(lab_ == q)[0] for q in range(1, lab_.max() + 1)]
            gb = np.array([float(max(runs, key=len).mean()), float(ym)])  # the bow's grip: the middle of its stave
            parts['weapon'] = (bow, gb, 180.0, hg)  # drawn upright: grip → top tip points up
        if cls in WEAPON:  # the weapon apart from the fist: it turns at the wrist
            wd = WEAPON[cls]
            from matplotlib.path import Path
            Hh, Ww = fore_n.shape[:2]; yy_, xx_ = np.mgrid[0:Hh, 0:Ww]
            inside = Path([(x * kt, y * kt) for x, y in wd['fist']]).contains_points(np.c_[xx_.ravel(), yy_.ravel()]).reshape(Hh, Ww)
            wimg = fore_n.copy(); wimg[..., 3] = np.where(inside, 0, fore_n[..., 3])
            fist = fore_n.copy(); fist[..., 3] = np.where(inside, fore_n[..., 3], 0)
            (h0, h1) = [np.array(q, float) * kt for q in wd['handle']]
            hv = wimg[..., 3] > 100
            near_h = hv & ((xx_ - h0[0]) ** 2 + (yy_ - h0[1]) ** 2 < (30 * kt) ** 2)
            col = np.median(wimg[..., :3][near_h], 0) if near_h.any() else np.array([40, 30, 30])
            gi = Image.fromarray(wimg); from PIL import ImageDraw as _D
            _D.Draw(gi).line([tuple(h0), tuple(h1)], fill=tuple(int(v) for v in col) + (255,), width=max(3, int(16 * kt)))
            wimg = np.array(gi)
            g = np.array(wd['grip'], float) * kt; tip = np.array(wd['tip'], float) * kt
            parts['weapon'] = (wimg, g, _axis_deg(g, tip), g)
            fore_n = fist
        tb = _top_ball(uppers[0]) if cls in DROP_BALLS else None  # the sheet's ball colour, when the balls stand apart from the limbs (skin / grey)
        for name, im, both in (('uarm_n', uppers[0], True), ('uarm_f', uppers[1], True), ('farm_n', fore_n, False), ('farm_f', fore_f, False)):
            im = im.copy()
            al = im[..., 3] > 100
            cxr = lambda y: float(np.where(al[int(min(im.shape[0] - 1, max(0, y)))])[0].mean())
            if name == 'farm_n' and parts.get('bow_arm'):  # no ball: the elbow at the bracer's top
                ys_ = np.where(al.any(1))[0]; p0 = np.array([cxr(ys_[0] + 6), float(ys_[0] + 6)])
                parts[name] = (im, p0, p0 + np.array([0.0, 100.0])); parts[name + '_joint'] = ((0, 0, 0), 0.0)
                fist_ = im.copy(); fist_[: int(ys_[-1] - 0.2 * (ys_[-1] - ys_[0])), :, 3] = 0; parts['farm_n_fist'] = fist_
                yb_ = int(ys_[-1]); parts[name + '_len'] = float(yb_ - 0.08 * im.shape[0] - p0[1])
                continue
            blobs = _ball_blobs(im, tb[0], tb[1]) if tb else []
            own = _top_ball(im) if both else None  # the far arm is drawn darker: its balls too
            if both and len(blobs) < 2 and own and tb:
                blobs = _ball_blobs(im, own[0], own[1])
            if blobs and (not both or len(blobs) >= 2):
                tp_, bt_ = blobs[0], blobs[-1]
                p0 = np.array([tp_[0], tp_[1]]); tbw = tp_[2]
                fill = _drop_ball(im, p0, tbw, +1, ring=True, fill=cls not in NO_SOCKET_FILL)
                if both:
                    p1 = np.array([bt_[0], bt_[1]]); _drop_ball(im, p1, bt_[2], -1, ring=True, fill=cls not in NO_SOCKET_FILL)
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
            if name == 'farm_n':  # the fist alone (drawn again over the weapon's grip)
                fist_ = im.copy(); ysf = np.where((im[..., 3] > 100).any(1))[0]
                fist_[: int(ysf[-1] - 0.2 * (ysf[-1] - ysf[0])), :, 3] = 0
                parts['farm_n_fist'] = fist_
            if not both:  # the fist: the forearm's length for reaching a point
                al2 = im[..., 3] > 100; yb = int(np.where(al2.any(1))[0][-1])
                parts[name + '_len'] = float(yb - 0.08 * im.shape[0] - p0[1])
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
    import cv2
    th = math.radians(ang_deg - src_axis_deg)
    c, s_ = math.cos(th), math.sin(th)
    R = np.array([[c, s_], [-s_, c]])
    t = np.asarray(dst, float) - R @ np.asarray(src_pivot, float)
    h, w = img.shape[:2]
    corners = (R @ np.array([[0, w, 0, w], [0, 0, h, h]], float)).T + t
    x0, y0 = np.floor(corners.min(0)).astype(int) - 1; x1, y1 = np.ceil(corners.max(0)).astype(int) + 1
    x0c, y0c = max(0, x0), max(0, y0); x1c, y1c = min(canvas.width, x1), min(canvas.height, y1)
    if x1c <= x0c or y1c <= y0c:
        return
    M = np.hstack([R, (t - [x0c, y0c])[:, None]])
    pm = _premul(img)
    out = cv2.warpAffine(pm, M, (x1c - x0c, y1c - y0c), flags=cv2.INTER_LINEAR, borderMode=cv2.BORDER_CONSTANT, borderValue=0)
    canvas.alpha_composite(Image.fromarray(_unpremul(out)), (int(x0c), int(y0c)))


def _unpremul(out):
    a = out[..., 3:4]
    rgb = np.where(a > 0, out[..., :3] * 255.0 / np.maximum(a, 1e-3), 0)
    return np.concatenate([np.clip(rgb, 0, 255), np.clip(a, 0, 255)], -1).astype(np.uint8)


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


# The weapon held apart from the fist (it turns at the wrist): the fist's outline in the weapon forearm's crop (the rest
# of the crop is the weapon), the grip (where the handle runs through the fist), the handle's two ends to paint the grip
# hidden under the fingers back in, and its colour. The blade's own direction in the drawing follows from grip → tip.
WEAPON = {
    'warrior': {'fist': [(0, 0), (128, 0), (128, 330), (112, 352), (70, 368), (40, 358), (36, 305), (50, 298), (52, 252), (0, 236)],
                'grip': (72, 318), 'handle': ((28, 284), (112, 352)), 'tip': (425, 750)},
    'samurai': {'fist': [(55, 0), (212, 0), (212, 232), (190, 262), (152, 300), (140, 330), (120, 336), (96, 300), (92, 240), (60, 215)],
                'grip': (135, 291), 'handle': ((60, 238), (165, 314)), 'tip': (590, 595)},
}


def arm_pose(cls, kind, ph, i):
    """The arms for one moment: {'n': (shoulder, elbow) of the near (weapon) arm, 'f': the far arm's or 'grip2' (its fist on
    the handle beside the near one), 'D': the blade's direction or None (as drawn)}. Angles in degrees against the body
    (0 = hanging along it, + = forward; the elbow only bends forward); D against the world (0 = down, + = forward).
    The arms swing against the legs (the near arm back when the near leg is forward); the weapon arm swings less."""
    c = math.cos(2 * math.pi * ph)
    blade = cls in WEAPON
    if kind == 'walk':
        n = -11 * c; f = 22 * c
        return {'n': (n, 8 + 0.4 * max(0, n)), 'f': (f, 10 + 0.5 * max(0, f)), 'D': 162 + 4 * c if cls == 'archer' else None}
    if kind == 'run':  # sprinting arms: the free arm pumps (elbow near square, the fist up to the chest), the blade trails
        f = (10 + (34 if c > 0 else 24) * c, 87 - 9 * c)  # the backswing kept short: the shoulder plate rides on the arm
        if cls == 'warrior':
            return {'n': (-15 - 14 * c, 30 + 6 * c), 'f': f, 'D': -70 + 8 * c}
        if cls == 'samurai':
            return {'n': (-18 - 12 * c, 28), 'f': f, 'D': -78 + 6 * c}
        if cls == 'archer':  # the bow carried low in front, upright, its top leaning into the run
            return {'n': (18 - 10 * c, 30), 'f': f, 'D': 158 - 4 * c}
        return {'n': (8 - 10 * c, 85 + 5 * c), 'f': f, 'D': None}  # the book against the chest
    if kind == 'jump':  # take-off crouch (arms swung back) → rising → falling (arms lift for balance)
        J = {
            'warrior': [((-20, 20), (-30, 25), -55), ((-30, 25), (40, 45), -68), ((-22, 20), (30, 40), -62)],
            'samurai': [((-15, 20), (-25, 30), -55), ((-30, 25), (15, 95), -72), ((-22, 20), (15, 85), -66)],
            'archer': [((10, 10), (-35, 20), 170), ((40, 8), (-50, 35), 158), ((32, 10), (-30, 45), 165)],
            'book_mage': [((10, 70), (15, 60), None), ((15, 90), (25, 85), None), ((15, 88), (30, 70), None)],
        }.get(cls, [((5, 25), (-30, 30), None), ((25, 30), (-40, 40), None), ((15, 25), (-25, 45), None)])[i]
        return {'n': J[0], 'f': J[1], 'D': J[2]}
    if kind == 'djump':
        J = {
            'warrior': [((-25, 25), (60, 50), -80), ((-30, 20), (50, 30), -92)],
            'samurai': [((-38, 20), (20, 95), -88), ((-42, 18), (20, 95), -92)],
            'archer': [((40, 40), (50, 50), 140), ((44, 44), (54, 54), 135)],
            'book_mage': [((30, 40), (-30, 30), None), ((34, 44), (-26, 34), None)],
        }.get(cls, [((30, 40), (-30, 30), None), ((34, 44), (-26, 34), None)])[i]
        return {'n': J[0], 'f': J[1], 'D': J[2]}
    if kind == 'stance':
        if cls == 'warrior':
            return {'n': (30, 50), 'f': (20, 75), 'D': 125}  # the sword raised forward, the free fist guarding
        if cls == 'samurai':
            return {'n': (25, 55), 'f': 'grip2', 'D': 135}  # the katana up in both hands
        if cls == 'book_mage':
            return {'n': (5, 20), 'f': (45, 30), 'D': None}  # the book at his side, the free hand raised to cast
        if cls == 'archer':
            return {'n': (80, 4), 'f': (-60, 140), 'D': 178}  # the bow raised upright in front, the free hand drawing the string to the cheek
        return {'n': (24, 34), 'f': (12, 30), 'D': None}
    return {'n': (3, 6), 'f': (-3, 8), 'D': 165 if cls == 'archer' else None}  # standing


# The second jump, one per hero's air move: (near foot, far foot) from the floor under the hips (fractions of the leg),
# hip height, lean, (near shoulder, elbow), (far shoulder, elbow) — two frames each.
#   warrior  War Leap: the knee drives up, then the body stretches forward over the burst
#   samurai  Shinsoku: the dash — laid forward, legs trailing, the blade swept back
#   archer   Wind Leap: tucked into the somersault (the game turns her round)
#   mage     Levitate: floating upright, toes down, arms spread to hold the air
DJUMP = {
    'warrior': [((0.30, -0.52), (-0.28, -0.16), 0.97, 16.0, (-25, 30), (40, 55)),
                ((0.40, -0.26), (-0.46, -0.08), 0.97, 24.0, (-45, 20), (25, 45))],
    'samurai': [((0.22, -0.46), (-0.48, -0.16), 0.97, 32.0, (-60, 10), (22, 40)),
                ((0.18, -0.42), (-0.52, -0.12), 0.97, 36.0, (-70, 8), (18, 45))],
    'archer': [((0.28, -0.60), (0.16, -0.52), 0.97, 10.0, (28, 62), (40, 62)),
               ((0.30, -0.64), (0.20, -0.58), 0.97, 14.0, (32, 66), (44, 66))],
    'book_mage': [((0.04, -0.12), (-0.07, -0.09), 0.97, -2.0, (20, 20), (-25, 20)),
                  ((0.06, -0.15), (-0.05, -0.12), 0.97, -1.0, (24, 24), (-21, 24))],
}


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



# ---------------------------------------------------------------- mesh skinning (limbs bend smoothly, like Spine meshes)
# Each limb is put together straight once (its rest pose) and covered with a fine triangle mesh. Every mesh point is
# carried by its bones (thigh / shin / foot, upper arm / forearm) with weights that blend across the joint, so a knee or
# an elbow bends as one continuous drawing instead of two rigid pieces meeting at a seam.

def _rot(a_deg, v):
    """Turn vectors v (…, 2) so that 'down' (0, 1) points at a (deg, 0 = down, + = toward +x)."""
    a = math.radians(a_deg); c, s_ = math.cos(a), math.sin(a)
    return np.stack([v[..., 0] * c + v[..., 1] * s_, -v[..., 0] * s_ + v[..., 1] * c], -1)


def _mesh(alpha, g=7):
    ys, xs = np.where(alpha > 8)
    x0, x1, y0, y1 = xs.min() - 3, xs.max() + 4, ys.min() - 3, ys.max() + 4
    gx = np.arange(x0, x1 + g, g, dtype=float); gy = np.arange(y0, y1 + g, g, dtype=float)
    X, Y = np.meshgrid(gx, gy); V = np.stack([X.ravel(), Y.ravel()], 1)
    nx, ny = len(gx), len(gy)
    idx = np.arange(nx * ny).reshape(ny, nx)
    a, b, c, d = idx[:-1, :-1].ravel(), idx[:-1, 1:].ravel(), idx[1:, :-1].ravel(), idx[1:, 1:].ravel()
    tris = np.concatenate([np.stack([a, b, d], 1), np.stack([a, d, c], 1)])
    tris = tris[np.argsort(V[tris].mean(1)[:, 1], kind='stable')]  # top to bottom: the lower bone's skin wins a fold
    return V, tris


def _smooth(t):
    t = np.clip(t, 0, 1)
    return t * t * (3 - 2 * t)


def _skin(rest_pm, V, tris, W, bones, shape):
    """Draw a rest-pose limb (premultiplied RGBA) deformed by its bones [(rest pivot, world pivot, angle)] with the
    per-point weights W (n, bones) into a canvas of `shape` (h, w). Returns straight RGBA uint8."""
    Vd = np.zeros_like(V)
    for b, (pr, pw, ang) in enumerate(bones):
        Vd += W[:, b:b + 1] * (np.asarray(pw)[None] + _rot(ang, V - np.asarray(pr)[None]))
    off = np.floor(Vd.min(0)).astype(int) - 2
    off = np.maximum(off, 0)
    Hh = int(min(shape[0], np.ceil(Vd[:, 1].max()) + 2) - off[1]); Ww = int(min(shape[1], np.ceil(Vd[:, 0].max()) + 2) - off[0])
    Vd = Vd - off
    mx = np.full((Hh, Ww), -10.0, np.float32); my = np.full((Hh, Ww), -10.0, np.float32)
    D_all = Vd[tris]; S_all = V[tris]
    ext = (np.ceil(D_all.max(1)) - np.floor(D_all.min(1))).max(1)
    for sel in (ext <= 12, (ext > 12) & (ext <= 24), ext > 24):  # triangles batched by size (small arrays)
        if not sel.any():
            continue
        D = D_all[sel]; Sr = S_all[sel]
        lo = np.floor(D.min(1)).astype(int)
        B = int(min(64, ext[sel].max() + 1))
        oy, ox = np.mgrid[0:B, 0:B]
        px = lo[:, 0, None, None] + ox[None]; py = lo[:, 1, None, None] + oy[None]
        v0 = D[:, 1] - D[:, 0]; v1 = D[:, 2] - D[:, 0]
        den = v0[:, 0] * v1[:, 1] - v1[:, 0] * v0[:, 1]
        ok = np.abs(den) > 1e-6
        den = np.where(ok, den, 1.0)
        dx = px + 0.5 - D[:, 0, 0, None, None]; dy = py + 0.5 - D[:, 0, 1, None, None]
        l1 = (dx * v1[:, 1, None, None] - v1[:, 0, None, None] * dy) / den[:, None, None]
        l2 = (v0[:, 0, None, None] * dy - dx * v0[:, 1, None, None]) / den[:, None, None]
        l0 = 1 - l1 - l2
        e = -1e-4
        inside = (l0 >= e) & (l1 >= e) & (l2 >= e) & ok[:, None, None] & (px >= 0) & (px < Ww) & (py >= 0) & (py < Hh)
        sx = l0 * Sr[:, 0, 0, None, None] + l1 * Sr[:, 1, 0, None, None] + l2 * Sr[:, 2, 0, None, None]
        sy = l0 * Sr[:, 0, 1, None, None] + l1 * Sr[:, 1, 1, None, None] + l2 * Sr[:, 2, 1, None, None]
        mx[py[inside], px[inside]] = sx[inside]; my[py[inside], px[inside]] = sy[inside]
    import cv2
    out = cv2.remap(rest_pm, mx, my, cv2.INTER_LINEAR, borderMode=cv2.BORDER_CONSTANT, borderValue=0).astype(np.float32)
    return Image.fromarray(_unpremul(out)), (int(off[0]), int(off[1]))


def _premul(rgba):
    f = rgba.astype(np.float32)
    return np.concatenate([f[..., :3] * f[..., 3:4] / 255.0, f[..., 3:4]], -1)


def _rest_leg(P, side, L):
    """A leg put together straight (thigh over the shin's top, the thigh's cuff over the knee), its mesh and weights."""
    t, t0, t1 = P['thigh_' + side]; sh, s0, s1 = P['shin_' + side]
    T = float(np.hypot(*(t1 - t0))); S = float(np.hypot(*(s1 - s0)))
    Wc = int(2 * max(t.shape[1], sh.shape[1]) + 200); Hc = int(T + S + t.shape[0] + sh.shape[0] + 200)
    hip = np.array([Wc / 2.0, 60.0 + max(t0[1], 0)]); knee = hip + [0, T]; ankle = knee + [0, S]
    cv = Image.new('RGBA', (Wc, Hc))
    _place(cv, sh, s0, _axis_deg(s0, s1), knee, 0.0)
    _place(cv, t, t0, _axis_deg(t0, t1), hip, 0.0)
    _place(cv, P['thigh_%s_low' % side], t0, _axis_deg(t0, t1), hip, 0.0)
    img = np.array(cv); al = img[..., 3]
    foot = al[int(ankle[1]):] > 100
    fy, fx = np.where(foot)
    sole = ankle[1] + fy.max(); toe = float(fx.max()); heel = float(fx.min())
    V, tris = _mesh(al)
    zk, zf = 0.07 * L, 0.03 * L
    ws = _smooth((V[:, 1] - (knee[1] - zk)) / (2 * zk))
    wf = _smooth((V[:, 1] - (ankle[1] - zf)) / (2 * zf))
    Wt = np.stack([1 - ws, ws * (1 - wf), ws * wf], 1)
    return {'pm': _premul(img), 'V': V, 'tris': tris, 'W': Wt, 'hip': hip, 'knee': knee, 'ankle': ankle,
            'toe': np.array([toe - ankle[0], sole - ankle[1]]), 'heel': np.array([heel - ankle[0], sole - ankle[1]])}


def _rest_arm(P, side):
    """An arm put together hanging straight (the upper arm over the forearm's top), its mesh and weights."""
    u, u0, u1 = P['uarm_' + side]; f, f0, f1 = P['farm_' + side]
    Lu = float(np.hypot(*(u1 - u0)))
    Wc = int(2 * max(u.shape[1], f.shape[1]) + 200); Hc = int(Lu + u.shape[0] + f.shape[0] + 200)
    sh = np.array([Wc / 2.0, 60.0 + max(u0[1], 0)]); el = sh + [0, Lu]
    cv = Image.new('RGBA', (Wc, Hc))
    _place(cv, f, f0, 0.0, el, 0.0)
    _place(cv, u, u0, _axis_deg(u0, u1), sh, 0.0)
    img = np.array(cv)
    V, tris = _mesh(img[..., 3])
    ze = 0.16 * Lu
    we = _smooth((V[:, 1] - (el[1] - ze)) / (2 * ze))
    return {'pm': _premul(img), 'V': V, 'tris': tris, 'W': np.stack([1 - we, we], 1), 'sh': sh, 'el': el}


def foot_roll(kind, p, duty):
    """The foot's angle (deg, + = toes up) and the point it turns on ('heel' / 'toe' / None in the air), at moment p of
    its own cycle (0 = it touches down). Walk: heel strike → flat → heel rise onto the ball → toe-off → the swing
    (toes drop, then lift for the next heel strike). Run: lands on the forefoot, pushes off hard, the heel kicks up."""
    if kind == 'walk':
        if p < 0.1:
            return 16 * (1 - _ease(p / 0.1)), 'heel'
        if p < 0.4:
            return 0.0, None
        if p < duty:
            return -34 * _ease((p - 0.4) / (duty - 0.4)), 'toe'
        t = (p - duty) / (1 - duty)
        return (-34 + 22 * _ease(t / 0.35)) if t < 0.35 else (-12 + 28 * _ease((t - 0.35) / 0.65)), None
    if p < 0.08:
        return -8 * (1 - _ease(p / 0.08)), 'toe'
    if p < 0.18:
        return 0.0, None
    if p < duty:
        return -42 * _ease((p - 0.18) / (duty - 0.18)), 'toe'
    t = (p - duty) / (1 - duty)
    return (-42 - 18 * math.sin(math.pi * min(1, t / 0.5))) if t < 0.5 else (-42 + 34 * _ease((t - 0.5) / 0.5)), None


def bake(path, cls, idle_h, size=1.0, kinds=None):
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
    RL = {sd: _rest_leg(P, sd, L) for sd in ('n', 'f')}
    RA = {sd: _rest_arm(P, sd) for sd in ('n', 'f')} if 'uarm_n' in P else {}
    JUMP = [  # (near foot, far foot) from the floor under the hips, hip height, lean — take-off crouch, tucked in the air, reaching down
        ((0.12, 0.0), (-0.14, 0.0), 0.8, 8.0),
        ((0.24, -0.42), (-0.06, -0.3), 0.97, 4.0),
        ((0.14, -0.1), (-0.12, -0.02), 0.97, 0.0)]
    for kind, n in (('idle', 1), ('stance', 1), ('jump', 3), ('djump', 2 if cls in DJUMP else 0), ('walk', WALK_N), ('run', RUN_N)):
        if kinds and kind not in kinds:
            continue
        for i in range(n):
            ph = i / n
            if kind == 'djump':
                (a1, b1), (a2, b2), hk, lean, _an, _af = DJUMP[cls][i]
                feet = [np.array([a1 * L, b1 * L]), np.array([a2 * L, b2 * L])]; hh = hk * L
            elif kind == 'jump':
                (a1, b1), (a2, b2), hk, lean = JUMP[i]
                feet = [np.array([a1 * L, b1 * L]), np.array([a2 * L, b2 * L])]; hh = hk * L
            elif kind in ('idle', 'stance'):  # standing (feet a little apart) / the combat stance (wider, knees bent, leaning in)
                sp = 0.16 * L if kind == 'idle' else 0.34 * L
                feet = [np.array([sp / 2, 0.0]), np.array([-sp / 2, 0.0])]
                hh = math.sqrt((0.985 * L) ** 2 - (sp / 2) ** 2) if kind == 'idle' else 0.9 * L
                lean = 0.0 if kind == 'idle' else 6.0
            else:
                feet, hh, lean, D, planted = gait(kind, ph, L)
            # the feet: their angle (+ = toes up) and, while one stands on its heel / ball, the ankle lifted round it
            if kind in ('walk', 'run'):
                duty = 0.6 if kind == 'walk' else 0.36
                phi, pivs = zip(*[foot_roll(kind, (ph + off) % 1.0, duty) for off in (0.0, 0.5)])
            elif kind == 'jump':
                phi, pivs = ((0.0, 0.0), (-28.0, -22.0), (-16.0, -12.0))[i], (None, None)
            elif kind == 'djump':
                phi, pivs = (-30.0, -24.0), (None, None)
            else:
                phi, pivs = (0.0, 0.0), (None, None)
            for j, sd in enumerate(('n', 'f')):
                if pivs[j] and feet[j][1] >= -1e-6:
                    r = RL[sd][pivs[j]]
                    feet[j] = feet[j] + r - _rot(phi[j], r)
            W = int(front.shape[1] + 3.2 * L) + 40; Hc = int(front.shape[0] + L + 80 + 0.6 * L)
            cv = Image.new('RGBA', (W, Hc))
            ground = Hc - 20 - ankle_h
            hip = np.array([W / 2.0, ground - hh])
            # the upper body: hips at `hip`, leaning forward around them, a small sway with the steps
            sway = 0.0 if kind in ('idle', 'stance', 'jump', 'djump') else (1.2 if kind == 'walk' else 2.0) * math.sin(4 * math.pi * ph)
            ang_u = lean + sway * 0.3
            # the arms: (shoulder angle, elbow bend) — 0 = hanging, + = forward; near = the weapon arm, swinging less
            AP = arm_pose(cls, kind, ph, i)
            if 'shoulder' in P:
                th_ = math.radians(-ang_u); d_ = P['shoulder'] - hip_u
                sh_w = hip + np.array([d_[0] * math.cos(th_) - d_[1] * math.sin(th_), d_[0] * math.sin(th_) + d_[1] * math.cos(th_)])
            def solve(U, a_sh, a_el):  # shoulder/elbow angles against the body → world angles and the elbow
                (ui, u0, u1) = U
                Lu = float(np.hypot(*(u1 - u0)))
                tot = a_sh - ang_u  # the arm turns with the body's lean (the hanging axis tips back as the body tips forward)
                elbow = sh_w + Lu * np.array([math.sin(math.radians(tot)), math.cos(math.radians(tot))])
                return tot, elbow, tot + a_el
            def reach(U, Lf, target):  # the shoulder/elbow that put the fist on `target` (the elbow bending forward)
                (ui, u0, u1) = U
                Lu = float(np.hypot(*(u1 - u0)))
                d = target - sh_w; dist = min(float(np.hypot(*d)), Lu + Lf - 1e-3); dist = max(dist, abs(Lu - Lf) + 1e-3)
                phi = math.degrees(math.atan2(d[0], d[1]))
                al = math.degrees(math.acos(max(-1, min(1, (Lu * Lu + dist * dist - Lf * Lf) / (2 * Lu * dist)))))
                be = math.degrees(math.acos(max(-1, min(1, (Lu * Lu + Lf * Lf - dist * dist) / (2 * Lu * Lf)))))
                return (phi - al) + ang_u, 180 - be
            def arm(U, F, a_sh, a_el, nm, D=None):
                (ui, u0, u1), (fi, f0, f1) = U, F
                tot, elbow, fa = solve(U, a_sh, a_el)
                uj = P[nm + '_joint']; fj = P['f' + nm[1:] + '_joint']
                if nm == 'uarm_n': _disc(cv, sh_w, *uj)                    # the shoulder joint, under the arm's top (the far one is behind the body)
                _disc(cv, elbow, *fj)                                       # the elbow, under both (fills the bend's notch)
                if nm == 'uarm_n' and 'weapon' in P:                        # the weapon behind the fist, turned at the wrist
                    wi, wg, wnat, hg = P['weapon']
                    r = math.radians(fa); v = hg - f0
                    gw = elbow + np.array([v[0] * math.cos(r) + v[1] * math.sin(r), -v[0] * math.sin(r) + v[1] * math.cos(r)])
                    wdir = D if D is not None else fa + wnat
                ra = RA[nm[-1]]                                             # the arm as one mesh, bending at the elbow
                cv.alpha_composite(*_skin(ra['pm'], ra['V'], ra['tris'], ra['W'],
                                   [(ra['sh'], sh_w, tot), (ra['el'], elbow, fa)], (cv.height, cv.width)))
                if nm == 'uarm_n' and 'weapon' in P:  # the weapon on the outside of the arm, the fingers closed over its grip
                    _place(cv, wi, wg, wnat, gw, wdir)
                    _place(cv, P['farm_n_fist'], f0, 0.0, elbow, fa)
            def upper(layer):
                _place(cv, layer, hip_u, 0.0, hip, -ang_u)  # the drawing turned clockwise (forward) by the lean
            fn = np.array([hip[0] + feet[0][0], ground + feet[0][1]]); ff = np.array([hip[0] + feet[1][0], ground + feet[1][1]])
            kn, kf = _ik(hip, fn, T, S), _ik(hip, ff, T, S)
            # the cloth behind the hips streams back with the speed (lifted, fluttering): a run reads by its cape
            lift_c = {'walk': 5.0, 'run': 24.0, 'djump': {'warrior': 20.0, 'samurai': 26.0, 'archer': 10.0}.get(cls, 6.0)}.get(kind, 0.0) + {'walk': 1.5, 'run': 4.0}.get(kind, 0.0) * math.sin(2 * math.pi * ph * 2 + 1.0)
            if lift_c:
                root = P['cape_root']
                # the root, carried with the body's lean, stays put; the cloth turns up round it (clockwise = up behind)
                th = math.radians(-ang_u); d = root - hip_u
                root_w = hip + np.array([d[0] * math.cos(th) - d[1] * math.sin(th), d[0] * math.sin(th) + d[1] * math.cos(th)])
                _place(cv, back, root, 0.0, root_w, -ang_u - lift_c)
            else:
                upper(back)                                                 # the cloth hanging behind the legs
            if 'uarm_f' in P:                                               # the far arm behind everything
                fa_ = AP['f']
                if fa_ == 'grip2':  # both hands on the handle: the far fist just below the near one, along the handle
                    t_n, el_n, f_n = solve(P['uarm_n'], *AP['n'])
                    wi, wg, wnat, hg = P['weapon']; f0n = P['farm_n'][1]
                    r = math.radians(f_n); v = hg - f0n
                    gw = el_n + np.array([v[0] * math.cos(r) + v[1] * math.sin(r), -v[0] * math.sin(r) + v[1] * math.cos(r)])
                    hd_ = math.radians(AP['D'] + 180)
                    fa_ = reach(P['uarm_f'], P['farm_f_len'], gw + 0.55 * P['farm_f_len'] * 0.45 * np.array([math.sin(hd_), math.cos(hd_)]))
                arm(P['uarm_f'], P['farm_f'], fa_[0], fa_[1], 'uarm_f')
            for sd, kk, aa, fph in (('f', kf, ff, phi[1]), ('n', kn, fn, phi[0])):  # the legs as meshes: knee and ankle bend smoothly
                rl = RL[sd]
                cv.alpha_composite(*_skin(rl['pm'], rl['V'], rl['tris'], rl['W'],
                                   [(rl['hip'], hip, _axis_deg(hip, kk)), (rl['knee'], kk, _axis_deg(kk, aa)), (rl['ankle'], aa, fph)],
                                   (cv.height, cv.width)))
            upper(front)                                                    # the body (its hem over the legs)
            if 'uarm_n' in P:                                               # the near arm over all (the weapon in front)
                arm(P['uarm_n'], P['farm_n'], AP['n'][0], AP['n'][1], 'uarm_n', AP['D'])
            # the skirt / tunic over the near thigh: the body's front layer once more, only its lower part
            a = np.array(cv)
            ys = np.where(a[..., 3].any(1))[0]; xs = np.where(a[..., 3].any(0))[0]
            crop = a[ys[0]:ys[-1] + 1, xs[0]:xs[-1] + 1]
            ax, ay = hip[0] - xs[0], (ground + ankle_h) - ys[0]
            if (kind == 'jump' and i > 0) or kind == 'djump':  # in the air: placed on its own lowest point (the game lifts it by the jump's height)
                ay = float(ys[-1] - ys[0] + 1)
            im = Image.fromarray(crop)
            im = im.resize((max(1, round(im.width * k)), max(1, round(im.height * k))), Image.LANCZOS)
            out.append((kind, np.array(im), ax * k, ay * k))
    cyc = {kind: gait(kind, 0, L)[3] * k for kind in ('walk', 'run')}
    return out, cyc
