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
OWN_FEET = {'jump', 'leap_crash', 'judgment_blade', 'finisher', 'spin_cut', 'falcon_dive'}
SCALE = 0.6  # frame size kept in the atlas (source px x SCALE)
ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
SRC = os.path.join(ROOT, 'tools', 'heroes', 'src')

# sheet -> its rows in order: (action, frames)
SPEC = {
    'warrior': [('A', [('idle', 6), ('walk', 6), ('run', 6)]), ('B', [('jump', 3), ('stance', 4), ('attack', 6)]),
                ('S1', [('dash_slash', 6), ('rising_slash', 6), ('lance_thrust', 6)]),
                ('S2', [('ground_breaker', 6), ('leap_crash', 6), ('titans_verdict', 6)]),
                ('S3', [('whirlwind', 6), ('blade_storm', 6), ('wave_slash', 6)]),
                ('S4', [('oath', 6), ('radiant_blade', 6), ('banner', 6)]),
                ('S5', [('war_cry', 6), ('judgment_blade', 6), ('finisher', 6)])],
    'book_mage': [('A', [('idle', 6), ('walk', 6), ('attack', 6)]), ('B', [('run', 6), ('jump', 3), ('stance', 4)])],
    'samurai': [('A', [('idle', 6), ('walk', 6), ('attack', 6)]), ('B', [('run', 6), ('jump', 3), ('stance', 4)]),
                ('S1', [('shadow_step', 6), ('swallow_cut', 6), ('spin_cut', 6)]),
                ('S2', [('iai_strike', 6), ('sword_wave', 6), ('mirage', 6)]),
                ('S3', [('blossom_storm', 6), ('hundred_cuts', 6), ('tornado_blade', 6)]),
                ('S4', [('falcon_dive', 6), ('dragon_ascension', 6), ('dragon_eclipse', 6)]),
                ('S5', [('kagemusha', 6), ('sakura_bind', 6), ('rising_sun', 6)]),
                ('S6', [('phantom_blades', 6), ('god_of_blades', 6), ('finisher', 6)])],
    'archer': [('A', [('idle', 6), ('walk', 6), ('attack', 6)]), ('B', [('run', 6), ('jump', 3), ('stance', 4)])],
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
    a = np.where(bg, 0, 255).astype(np.float32)
    # soft fringe: background-adjacent pixels get alpha from their distance to white
    edge = ndimage.binary_dilation(bg, iterations=2) & ~bg
    soft = np.clip(d.astype(np.float32) / 90.0, 0, 1) * 255
    a[edge] = np.minimum(255, soft[edge] * 1.15)
    rgbf = rgb.astype(np.float32)
    al = np.maximum(a[..., None] / 255.0, 1e-3)
    un = np.clip((rgbf - 255 * (1 - al)) / al, 0, 255)  # remove the white mixed into the fringe
    rgb_out = np.where(edge[..., None], un, rgbf)
    return np.dstack([rgb_out, a]).astype(np.uint8)


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
        ay = float(hh if act in OWN_FEET else ground - yy0)  # jumps: own feet (the game lifts them); the rest: the row's floor (drawn airborne frames stay up)
        band = bm[int(hh * 0.25):int(hh * 0.55)]
        ax = float(np.where(band)[1].mean()) if band.any() else bm.shape[1] / 2
        if SCALE_ != 1:  # the game shows a hero ~150 px tall: keep a little more than that
            im = Image.fromarray(crop).resize((max(1, round(crop.shape[1] * SCALE_)), max(1, round(crop.shape[0] * SCALE_))), Image.LANCZOS)
            crop, ax, ay = np.array(im), ax * SCALE_, ay * SCALE_
        out.append((crop, ax, ay))
    return out


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
        acts, ims = [], []
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
                for crop, ax, ay in frames_in_row(src, y0, y1, n, cls, act):
                    acts.append((act, ax, ay)); ims.append(crop)
        if not ims:
            continue
        sheet, pos = pack(ims)
        out_dir = os.path.join(ROOT, 'public', 'assets', 'final', 'heroes', cls)
        os.makedirs(out_dir, exist_ok=True)
        Image.fromarray(sheet).save(os.path.join(out_dir, 'body.png'), optimize=True)
        A = {}
        for (act, ax, ay), (px, py), im in zip(acts, pos, ims):
            A.setdefault(act, []).append([px, py, im.shape[1], im.shape[0], round(ax, 1), round(ay, 1)])
        idle_h = float(np.median([f[3] for f in A['idle']]))
        table[cls] = {'h': idle_h, 'actions': A}
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
