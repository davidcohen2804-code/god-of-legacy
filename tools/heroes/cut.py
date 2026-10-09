"""Start Hero bodies: cut the GPT hero sprite sheets (tools/heroes/src/<cls>_<A|B>.png, white background, one action per
row, every frame facing right) into one packed atlas per class + frame table.

Out: public/assets/final/heroes/<cls>/body.png and src/data/hero-atlas.json
  {cls: {"h": idle height px, "actions": {action: [[x, y, w, h, ax, ay], ...]}}}  (ax, ay = feet anchor inside the frame)

Run: python3 tools/heroes/cut.py
"""
import json
import os
import sys

import numpy as np
from PIL import Image
from scipy import ndimage

# rows the game lifts itself (jumps, leaps): anchored on their own feet
OWN_FEET = {'jump', 'leap_crash', 'judgment_blade', 'finisher', 'spin_cut', 'falcon_dive', 'retreat_kick', 'skyhunters_step', 'rain_of_arrows', 'air_shot'}
# frames left out of a cut row (drawn upright inside a leaning run: the body would jump)
DROP = {}
HEADY = {}  # cls -> run frames (index, figure height, in the air)
STRIDES = {}  # (cls, act) -> feet spread per frame (atlas px)
SCALE = 0.6  # frame size kept in the atlas (source px x SCALE)
ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
SRC = os.path.join(ROOT, 'tools', 'heroes', 'src')

# sheet -> its rows in order: (action, frames)
SPEC = {
    'warrior': [('A', [('idle', 6), ('walk_old', 6), ('run_old', 6)]), ('W', [('walk', 4), ('run', 4)]), ('B', [('jump', 3), ('stance', 4), ('attack', 6)]),
                ('S1', [('dash_slash', 6), ('rising_slash', 6), ('lance_thrust', 6)]),
                ('S2', [('ground_breaker', 6), ('leap_crash', 6), ('titans_verdict', 6)]),
                ('S3', [('whirlwind', 6), ('blade_storm', 6), ('wave_slash', 6)]),
                ('S4', [('oath', 6), ('radiant_blade', 6), ('banner', 6)]),
                ('S5', [('war_cry', 6), ('judgment_blade', 6), ('finisher', 6)])],
    'book_mage': [('A', [('idle', 6), ('walk_old', 6), ('attack', 6)]), ('W', [('walk', 4), ('run', 4)]), ('B', [('run_old', 6), ('jump', 3), ('stance', 4)])],
    'samurai': [('A', [('idle', 6), ('walk_old', 6), ('attack', 6)]), ('W', [('walk', 4), ('run', 4)]), ('B', [('run_old', 6), ('jump', 3), ('stance', 4)]),
                ('S1', [('shadow_step', 6), ('swallow_cut', 6), ('spin_cut', 6)]),
                ('S2', [('iai_strike', 6), ('sword_wave', 6), ('mirage', 6)]),
                ('S3', [('blossom_storm', 6), ('hundred_cuts', 6), ('tornado_blade', 6)]),
                ('S4', [('falcon_dive', 6), ('dragon_ascension', 6), ('dragon_eclipse', 6)]),
                ('S5', [('kagemusha', 6), ('sakura_bind', 6), ('rising_sun', 6)]),
                ('S6', [('phantom_blades', 6), ('god_of_blades', 6), ('finisher', 6)])],
    'archer': [('A', [('idle', 6), ('walk_old', 6), ('attack', 6)]), ('W', [('walk', 4), ('run', 4)]), ('B', [('run_old', 6), ('jump', 3), ('stance', 4)]),
               ('S1', [('rising_arrow', 6), ('multi_shot', 6), ('explosive_arrow', 6)]),
               ('S2', [('retreat_kick', 6), ('vine_trap', 6), ('skyhunters_step', 6)]),
               ('S3', [('rain_of_arrows', 6), ('piercing_arrow', 6), ('hunters_roar', 6)]),
               ('S4', [('leaping_arrow', 6), ('spirit_hawk', 6), ('sky_rain', 6)]),
               ('S5', [('tree_of_life', 6), ('hunters_spirit', 6), ('arrow_storm', 6)]),
               ('S6', [('eagle_arrow', 6), ('double_shot', 6), ('air_shot', 6)])],
}


def alpha_from_white(rgb):
    """Background = near-white pixels connected to the image border; their fringe is un-mixed from white."""
    d = 255 - rgb.min(axis=2)  # 0 on pure white
    near = d < 34
    lab, _ = ndimage.label(near)
    border = set(np.unique(np.concatenate([lab[0], lab[-1], lab[:, 0], lab[:, -1]]))) - {0}
    bg = np.isin(lab, list(border))
    # enclosed holes (between an arm and the head…): pure-white pockets, not the painted white cloth (always shaded)
    pure = d < 18
    hl, hn = ndimage.label(pure & ~bg)
    if hn:
        sz = ndimage.sum(np.ones_like(d), hl, range(1, hn + 1))
        mean_d = ndimage.mean(d, hl, range(1, hn + 1))
        holes = [i + 1 for i in range(hn) if sz[i] >= 25 and mean_d[i] < 7]
        bg |= ndimage.binary_dilation(np.isin(hl, holes), iterations=1) & near
    rgbf = rgb.astype(np.float32)
    lum = rgbf.mean(axis=2)
    # small white / light grey specks left between dark strands near the outline (hair): white ground (mixed into the
    # strands), filled with the paint around them. Only shut in by dark paint (a glint on steel, an arrowhead in the air
    # or a white feather stays): white ones up to 400 px, grey ones (never pure white) up to 60 px.
    gap = ndimage.distance_transform_edt(~bg)
    grey = (lum > 150) & (rgbf.max(axis=2) - rgbf.min(axis=2) < 45)
    spk = (near & (gap <= 14) | grey & (gap <= 24)) & ~bg
    sl, sn = ndimage.label(spk)
    if sn:
        idx = range(1, sn + 1)
        sz = ndimage.sum(np.ones_like(d), sl, idx)
        ring = ndimage.binary_dilation(spk, iterations=2) & ~spk
        rl = ndimage.grey_dilation(sl, size=5) * ring
        ring_lum = ndimage.mean(lum, rl * ~bg, idx)
        ring_bg = ndimage.mean(bg.astype(np.float32), rl, idx)
        white = ndimage.maximum(near.astype(np.float32), sl, idx)
        top = ndimage.maximum(lum, sl, idx)
        specks = np.isin(sl, [i + 1 for i in range(sn) if ring_bg[i] < 0.25 and (
            (white[i] > 0 and sz[i] <= 400 and ring_lum[i] < 95) or (sz[i] <= 60 and ring_lum[i] < 75 and top[i] < 230))])
        if specks.any():
            _, (iy, ix) = ndimage.distance_transform_edt(specks | bg, return_indices=True)
            rgbf = np.where(specks[..., None], rgbf[iy, ix], rgbf)
            d = np.where(specks, 255 - rgbf.min(axis=2), d)
    a = np.where(bg, 0, 255).astype(np.float32)
    # the fringe (next to the ground): its paint is the strongest colour around it (the hair, the steel — never the white
    # it was mixed with), its alpha how much of that paint it holds; a dark edge no longer stays half white and opaque
    edge = ndimage.binary_dilation(bg, iterations=2) & ~bg
    dfg = np.where(bg, -1.0, d.astype(np.float32))
    dmax = ndimage.grey_dilation(dfg, size=5)
    hit = (dfg == dmax) & ~bg
    _, (iy, ix) = ndimage.distance_transform_edt(~hit, return_indices=True)
    paint, dp = rgbf[iy, ix], np.maximum(dmax, 1.0)
    a[edge] = np.clip(d[edge] / dp[edge], 0, 1) * 255
    rgbf = np.where(edge[..., None], paint, rgbf)
    return np.dstack([np.clip(rgbf, 0, 255), a]).astype(np.uint8)


def bands(mask, gap=8):
    ys = np.where(mask.any(1))[0]
    out, s, p = [], ys[0], ys[0]
    for y in ys[1:]:
        if y - p > gap:
            out.append((s, p + 1)); s = y
        p = y
    out.append((s, p + 1))
    return out


def frames_in_row(rgba, y0, y1, n, cls, act, scale=None):
    SCALE_ = SCALE if scale is None else scale
    a = rgba[y0:y1, :, 3] > 40
    lab, k = ndimage.label(a, structure=np.ones((3, 3)))
    for it in range(1, 6):  # figures touching (a sword tip on the next one): erode until they part, then give every pixel back to the nearest part
        sizes0 = ndimage.sum(a, lab, range(1, k + 1))
        big = sorted(sizes0, reverse=True)
        if len(big) >= n and big[n - 1] >= 0.25 * big[0]:
            break
        er = ndimage.binary_erosion(a, iterations=it)
        el, ek = ndimage.label(er, structure=np.ones((3, 3)))
        _, (iy, ix) = ndimage.distance_transform_edt(el == 0, return_indices=True)
        lab = np.where(a, el[iy, ix], 0)
        k = int(lab.max())
    objs = ndimage.find_objects(lab)
    sizes = ndimage.sum(a, lab, range(1, k + 1))
    comps = [(i + 1, objs[i], sizes[i]) for i in range(k)]
    comps.sort(key=lambda c: -c[2])
    bodies = sorted(comps[:n], key=lambda c: c[1][1].start)
    if len(bodies) < n or bodies[-1][2] < 0.25 * bodies[0][2]:
        sys.exit(f'{cls} {act}: expected {n} figures, found {len([c for c in comps if c[2] > 0.25 * comps[0][2]])}')
    owner = {b[0]: i for i, b in enumerate(bodies)}
    for lid, sl, sz in comps[n:]:
        if sz < 30:
            continue
        h, w = sl[0].stop - sl[0].start, sl[1].stop - sl[1].start
        if cls == 'archer' and act == 'attack' and h < 24 and w > 50:
            continue  # a loose flying arrow: the game draws its own
        cx = (sl[1].start + sl[1].stop) / 2
        best = min(range(n), key=lambda i: 0 if bodies[i][1][1].start <= cx <= bodies[i][1][1].stop else min(abs(cx - bodies[i][1][1].start), abs(cx - bodies[i][1][1].stop)))
        bs = bodies[best][1]
        gx = max(0, bs[1].start - sl[1].stop, sl[1].start - bs[1].stop)
        gy = max(0, bs[0].start - sl[0].stop, sl[0].start - bs[0].stop)
        if (gx * gx + gy * gy) ** 0.5 > 10 and sz < 0.03 * bodies[best][2]:
            continue  # a loose sliver (a neighbour's sword tip cut off where they touched)
        owner[lid] = best
    out = []
    ground = max(int(np.where(np.isin(lab, [l for l, o in owner.items() if o == i]))[0].max()) + 1 for i in range(n))  # the row's floor line
    for i in range(n):
        ids = [l for l, o in owner.items() if o == i]
        m = np.isin(lab, ids)
        ys, xs = np.where(m)
        x0, x1, yy0, yy1 = xs.min(), xs.max() + 1, ys.min(), ys.max() + 1
        crop = rgba[y0 + yy0:y0 + yy1, x0:x1].copy()
        crop[..., 3] = np.where(m[yy0:yy1, x0:x1], crop[..., 3], 0)
        # feet anchor: x = torso centre (pixels 25-55 % down the figure), y = the lowest pixel
        bm = m[yy0:yy1, x0:x1] & (crop[..., 3] > 128)
        hh = bm.shape[0]
        ay = float(hh if act in OWN_FEET else ground - yy0)
        if act == 'walk':  # a walking foot is always on the floor: each frame on its own lowest pixel (GPT's feet sit at uneven heights)
            ay = float(hh)
        elif act == 'run':  # placed by the head (a run reads by its head): one steady height, lifted evenly in the flight frames
            HEADY.setdefault(cls, []).append((len(HEADY.get(cls, [])), float(hh), ground - yy1 > 0.04 * hh))
            ay = float(hh)  # jumps: own feet (the game lifts them); the rest: the row's floor (drawn airborne frames stay up)
        band = bm[int(hh * 0.25):int(hh * 0.55)]
        ax = float(np.where(band)[1].mean()) if band.any() else bm.shape[1] / 2
        stride = None
        head_x = None
        if act in ('walk', 'run'):  # cycles: the stride from the boots (the lowest 11% of the figure); the anchor from the head (steady through a cycle)
            fb = bm[int(hh * 0.89):]
            cols = np.where(fb.any(0))[0]
            if len(cols):
                stride = float(cols.max() - cols.min())
            hb = bm[:int(hh * 0.16)]
            if hb.any():
                head_x = float(np.where(hb)[1].mean())
                tb = bm[int(hh * 0.2):int(hh * 0.45)]
                if act == 'run' and tb.any(): head_x = 0.5 * head_x + 0.5 * float(np.where(tb)[1].mean())  # a run: head and chest together (the lean swings the chest)
                ax = ((cols.min() + cols.max()) / 2.0) if len(cols) else ax
        if SCALE_ != 1:  # the game shows a hero ~150 px tall: keep a little more than that
            im = Image.fromarray(crop).resize((max(1, round(crop.shape[1] * SCALE_)), max(1, round(crop.shape[0] * SCALE_))), Image.LANCZOS)
            crop, ax, ay = np.array(im), ax * SCALE_, ay * SCALE_
            stride = stride * SCALE_ if stride else None
        STRIDES.setdefault((cls, act), []).append(stride or 0)
        out.append((crop, ax, ay, head_x * (SCALE_ if SCALE_ != 1 else 1) if head_x is not None else None))
    if all(o[3] is not None for o in out):  # one steady head line: every frame's anchor = its head + the row's typical head-to-hips offset
        off = float(np.median([o[1] - o[3] for o in out]))
        if act == 'run':  # leaning forward, the feet trail behind: stand him on the point under his hips (just behind the chest line)
            off = -0.05 * float(np.median([o[0].shape[0] for o in out]))
        out = [(c, h + off, ay, h) for c, _, ay, h in out]
    return [(c, ax, ay) for c, ax, ay, _ in out]


def blade_line(crop, ax, ay):
    """The sword's line in a frame: the longest thin streak of bright, colourless steel → [hiltX, hiltY, tipX, tipY]
    relative to the feet (frame px); the hilt is the end nearer the body's centre. None when no blade shows."""
    rgb = crop[..., :3].astype(np.float32); a = crop[..., 3] > 160
    mx, mn = rgb.max(2), rgb.min(2)
    steel = a & (mn > 120) & (mx - mn < 38)
    lab, k = ndimage.label(ndimage.binary_closing(steel, iterations=2), structure=np.ones((3, 3)))
    best, bl = None, 0.0
    for i in range(1, k + 1):
        ys, xs = np.where(lab == i)
        if len(xs) < 25:
            continue
        pts = np.stack([xs, ys], 1).astype(np.float32); c = pts.mean(0)
        u, sv, vt = np.linalg.svd(pts - c, full_matrices=False)
        d = vt[0]; t = (pts - c) @ d; L = t.max() - t.min()
        thick = sv[1] / np.sqrt(len(pts)) if len(sv) > 1 else 0
        if L < 34 or thick > 0.06 * L + 3:
            continue
        if L > bl:
            bl, best = L, (c + d * t.min(), c + d * t.max())
    if best is None:
        return None
    body = np.array([ax, crop.shape[0] * 0.45])
    p0, p1 = best
    hilt, tip = (p0, p1) if np.linalg.norm(p0 - body) < np.linalg.norm(p1 - body) else (p1, p0)
    return [round(float(hilt[0] - ax), 1), round(float(hilt[1] - ay), 1), round(float(tip[0] - ax), 1), round(float(tip[1] - ay), 1)]


def face_size(f):
    """Size of the face (sqrt of its skin area, in the top third of the figure): one measure of how big a sheet drew him."""
    import cv2
    a = f[..., 3] > 150
    if not a.any():
        return None
    hsv = cv2.cvtColor(np.ascontiguousarray(f[..., :3]), cv2.COLOR_RGB2HSV).astype(int)
    h, s, v = hsv[..., 0], hsv[..., 1], hsv[..., 2]
    skin = a & (h >= 3) & (h <= 22) & (s > 45) & (s < 170) & (v > 140)
    ys = np.where(a.any(1))[0]; top = ys[0]; H = a.shape[0]
    skin[int(top + 0.35 * (H - top)):] = False
    lab, k = ndimage.label(ndimage.binary_opening(skin, iterations=1))
    if k == 0:
        return None
    sz = ndimage.sum(skin, lab, range(1, k + 1)); i = int(np.argmax(sz)) + 1
    return float(np.sqrt(sz[i - 1])) if sz[i - 1] >= 30 else None


def pack(frames, width=4096, pad=2):
    x = y = rowh = 0
    pos = []
    for im in frames:
        h, w = im.shape[:2]
        if x + w + pad > width:
            x = 0; y += rowh + pad; rowh = 0
        pos.append((x, y)); x += w + pad; rowh = max(rowh, h)
    sheet = np.zeros((y + rowh, width, 4), np.uint8)
    for (px, py), im in zip(pos, frames):
        sheet[py:py + im.shape[0], px:px + im.shape[1]] = im
    return sheet, pos


def main():
    table_path = os.path.join(ROOT, 'src', 'data', 'hero-atlas.json')
    table = json.load(open(table_path)) if os.path.exists(table_path) else {}
    for cls, sheets in SPEC.items():
        acts, ims, tags = [], [], []
        for tag, rows in sheets:
            f = os.path.join(SRC, f'{cls}_{tag}.png')
            if not os.path.exists(f):
                continue
            rgba = alpha_from_white(np.array(Image.open(f).convert('RGB')))
            bs = bands(rgba[..., 3] > 40, gap=6)
            masks = None
            if len(bs) != len(rows):  # rows touch (a raised sword, a cape): cut along the emptiest winding seam near each third
                fg = (rgba[..., 3] > 40).astype(np.float64)
                H, W, n = fg.shape[0], fg.shape[1], len(rows)
                seams = []
                for k in range(1, n):
                    lo, hi = int(H * k / n - H / 6), int(H * k / n + H / 6)
                    cost = fg[lo:hi] * 1000 + 1
                    acc = cost[:, 0].copy(); back = np.zeros((hi - lo, W), np.int8)
                    for x in range(1, W):
                        up = np.r_[np.inf, acc[:-1]]; dn = np.r_[acc[1:], np.inf]
                        best = np.minimum(np.minimum(up, acc), dn)
                        back[:, x] = np.where(best == up, -1, np.where(best == dn, 1, 0))
                        acc = best + cost[:, x]
                    y = int(np.argmin(acc)); path = np.zeros(W, np.int64)
                    for x in range(W - 1, -1, -1):
                        path[x] = lo + y; y += int(back[y, x]) if x else 0
                    seams.append(path)
                yy = np.arange(H)[:, None]
                masks = []
                for k in range(n):
                    top = seams[k - 1][None, :] if k else np.zeros((1, W), int)
                    bot = seams[k][None, :] if k < n - 1 else np.full((1, W), H)
                    masks.append((yy >= top) & (yy < bot))
                bs = [(0, H)] * n
            for r, ((y0, y1), (act, n)) in enumerate(zip(bs, rows)):
                src = rgba
                if masks is not None:
                    src = rgba.copy(); src[..., 3] = np.where(masks[r], src[..., 3], 0)
                    ys = np.where((src[..., 3] > 40).any(1))[0]; y0, y1 = int(ys[0]), int(ys[-1]) + 1
                for fi, (crop, ax, ay) in enumerate(frames_in_row(src, y0, y1, n, cls, act)):
                    if fi in DROP.get((cls, act), ()):
                        continue
                    acts.append((act, ax, ay)); ims.append(crop); tags.append(tag)
        if not ims:
            continue
        # Run: every frame's head at one height above the floor (the median of the frames on the floor), the flight frames
        # 5% higher — a run reads by its head; GPT's frames hop up and down at random
        runs = [i for i, (ac, _, _) in enumerate(acts) if ac == 'run']
        if runs:
            fl = [f for (_, _, f) in HEADY.get(cls, [])][-len(runs):]
            hs = [float(ims[i].shape[0]) for i in runs]  # the head is the top of the figure: its height above the feet = crop height
            ht = float(np.median([h for h, f in zip(hs, fl) if not f] or hs))
            for i, f in zip(runs, fl):
                ac, ax, _ = acts[i]
                acts[i] = (ac, ax, ht * (1.03 if f else 1.0))
        # One size on every sheet: GPT draws each sheet at its own scale. The walk is made as tall as the idle (an upright
        # step stands ~2% lower); every other sheet is matched to the walk by the size of the face (all side views).
        face_of = {}
        for t, im in zip(tags, ims):
            v = face_size(im)
            if v: face_of.setdefault(t, []).append(v)
        hgt = lambda a: float(np.median([im.shape[0] - (im.shape[0] - ay) for (ac, ax, ay), im in zip(acts, ims) if ac == a]))
        idle_h0, walk_h0 = hgt('idle'), hgt('walk')
        idle_tag = next(t for (ac, _, _), t in zip(acts, tags) if ac == 'idle')
        walk_tag = next(t for (ac, _, _), t in zip(acts, tags) if ac == 'walk')
        sk = {idle_tag: 1.0, walk_tag: 0.98 * idle_h0 / walk_h0}
        F = float(np.median(face_of[walk_tag])) * sk[walk_tag]
        for t, L in face_of.items():
            if t not in sk:
                sk[t] = F / float(np.median(L))
        print(cls, 'sheet scales', {t: round(v, 3) for t, v in sk.items()})
        for i, t in enumerate(tags):
            k = sk.get(t, 1.0)
            if abs(k - 1) < 0.01:
                continue
            im = ims[i]; (ac, ax, ay) = acts[i]
            r = Image.fromarray(im).resize((max(1, round(im.shape[1] * k)), max(1, round(im.shape[0] * k))), Image.LANCZOS)
            ims[i] = np.array(r); acts[i] = (ac, ax * k, ay * k)
        for a in ('walk', 'run'):
            t = next((t for (ac, _, _), t in zip(acts, tags) if ac == a), None)
            if t and (cls, a) in STRIDES:
                STRIDES[(cls, a)] = [v * sk.get(t, 1.0) for v in STRIDES[(cls, a)]]
        sheet, pos = pack(ims)
        out_dir = os.path.join(ROOT, 'public', 'assets', 'final', 'heroes', cls)
        os.makedirs(out_dir, exist_ok=True)
        Image.fromarray(sheet).save(os.path.join(out_dir, 'body.png'), optimize=True)
        A = {}
        for (act, ax, ay), (px, py), im in zip(acts, pos, ims):
            fr = [px, py, im.shape[1], im.shape[0], round(ax, 1), round(ay, 1)]
            if cls == 'warrior':  # the sword's line (Radiant Blade's light blade grows along it)
                bl = blade_line(im, ax, ay)
                if bl: fr.append(bl)
            A.setdefault(act, []).append(fr)
        if cls == 'warrior':  # a frame whose blade could not be traced borrows the nearest traced frame's of its row
            for act, fs in A.items():
                for i, fr in enumerate(fs):
                    if len(fr) == 6:
                        near = sorted((abs(j - i), j) for j, g in enumerate(fs) if len(g) > 6)
                        if near: fr.append(list(fs[near[0][1]][6]))
        A.pop('walk_old', None); A.pop('run_old', None)
        idle_h = float(np.median([f[3] for f in A['idle']]))
        # the distance one leg cycle carries the body: two steps of the widest stride (the game matches the legs to the speed)
        # a cycle of n frames: 8 = two steps, 4 = one step (half cycle, repeated). A run carries the body farther than the
        # feet's spread (the flight), about half as far again.
        cyc = {}
        for a in ('walk', 'run'):
            n = len(A.get(a, [])); sp = STRIDES.get((cls, a), [0])
            if a == 'walk':
                cyc[a] = round((2 if n >= 8 else 1) * max(sp), 1)
            else:  # a run: brisk legs (~2.8 steps a second at full speed), measured on the typical stride (not the flight's split)
                cyc[a] = round((2 if n >= 8 else 1) * max(sp), 1)
        table[cls] = {'h': idle_h, 'actions': A, 'cycle': cyc}
        print(cls, {k: len(v) for k, v in A.items()}, 'idle h', idle_h, 'sheet', sheet.shape[:2])
    json.dump(table, open(table_path, 'w'), separators=(',', ':'))
    # START HERO cards: the front view of each approved model sheet
    for cls in SPEC:
        f = os.path.join(ROOT, 'tools', 'heroes', 'models', f'{cls}.png')
        if not os.path.exists(f):
            continue
        rgba = alpha_from_white(np.array(Image.open(f).convert('RGB')))
        (y0, y1), = [max(bands(rgba[..., 3] > 40, gap=40), key=lambda b: b[1] - b[0])]
        crop = frames_in_row(rgba, y0, y1, 3, cls, 'model', scale=1)[0][0]
        Image.fromarray(crop).save(os.path.join(ROOT, 'public', 'assets', 'final', 'heroes', cls, 'card.png'), optimize=True)
        # the face for portraits: a square round the head (top of the figure, central columns)
        h, w = crop.shape[:2]
        al = crop[..., 3] > 128
        ys = np.where(al[:, int(w * 0.3):int(w * 0.7)].any(1))[0]
        top = int(ys[0])
        size = int(h * 0.17)
        cols = np.where(al[top:top + size, int(w * 0.3):int(w * 0.7)])[1]
        cx = int(w * 0.3 + cols.mean())
        table[cls]['card'] = [w, h, max(0, cx - size // 2), max(0, top - size // 10), size]
        print(cls, 'card', crop.shape[:2], table[cls]['card'])
    json.dump(table, open(table_path, 'w'), separators=(',', ':'))


if __name__ == '__main__':
    main()
