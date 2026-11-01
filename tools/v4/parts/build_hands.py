# B's hand standard from the hands sheet: five states (relaxed, fist, one-hand grip, second hand of a two-hand grip,
# open palm), bare and in the Golden Warrior gauntlet, hanging from the wrist. Each hand is cut at the wrist (the bare
# hands lose the leather bracer the forearm already wears), scaled to the hand size of the approved parts (the fist's
# width), and written at the atlas resolution (B = 512 px) with the wrist as the pivot. Grips also get the grip point
# (the centre of the cyan handle stub) and two layers: the hand with a hole where the handle passes (drawn over the
# weapon) and the inside of the hand filling that hole (drawn under the weapon), so the handle shows between the
# fingers. A further gloves sheet (the same sheet with its bottom row redrawn, e.g. the Ember Duelist's fingerless
# gloves) adds that row: its scale comes from that sheet's own bare fist (top row), its grip from the bare hand's, and
# its wrist cuff goes (the forearm part ends with the same strap).
# Usage: build_hands.py <hands sheet> <work dir> [<look>=<gloves sheet> ...]
import json, sys
import numpy as np
from PIL import Image
from scipy import ndimage

SHEET, W = sys.argv[1:3]
EXTRA = [a.split('=', 1) for a in sys.argv[3:]]
BPX = 512
STATES = ['relaxed', 'fist', 'grip', 'grip2', 'open']
OLD_FIST_W = {'basic': 0.057, 'gold': 0.059}  # the approved fists' widths, B
BOX_W, BOX_H, X0, GAP = 280, 440, 12, 28
ROW_TOP = {'top': 24, 'bottom': 560}


def load(path):
    src = np.array(Image.open(path).convert('RGB')).astype(np.float32)
    r, g, b = src[..., 0], src[..., 1], src[..., 2]
    cyan = (g > 170) & (b > 170) & (r < 140)
    cyan = ndimage.binary_dilation(cyan, iterations=2) & (((b - r) > 35) & ((g - r) > 25) | cyan)  # the stub and its blended edge
    mag = np.clip(1.0 - ((np.minimum(r, b) - g) - 70.0) / 80.0, 0.0, 1.0)
    alpha = np.where(cyan, 1.0, mag)
    fg = np.clip(np.where(alpha[..., None] > 0.02, (src - (1 - alpha[..., None]) * np.array([255.0, 0, 255.0])) / np.maximum(alpha[..., None], 0.02), 0), 0, 255)
    lab, n = ndimage.label(ndimage.binary_closing(alpha > 0.5, iterations=2))
    coms = ndimage.center_of_mass(np.ones_like(alpha), lab, range(1, n + 1)); sizes = ndimage.sum(np.ones_like(alpha), lab, range(1, n + 1))
    return dict(alpha=alpha, fg=fg, cyan=cyan, lab=lab, coms=coms, sizes=sizes)


def cut_row(sh, top, rule):
    """The five hands of one row: crop, alpha, handle stub, wrist row (`cut`) and the hand's width below it."""
    res = {}
    for i, state in enumerate(STATES):
        cx, cy = X0 + i * (BOX_W + GAP) + BOX_W / 2, top + BOX_H / 2
        m = np.zeros_like(sh['alpha'], bool)
        for j, (sz, (yy, xx)) in enumerate(zip(sh['sizes'], sh['coms']), start=1):
            if sz > 60 and abs(xx - cx) < BOX_W * 0.62 and abs(yy - cy) < BOX_H * 0.6: m |= sh['lab'] == j
        m = ndimage.binary_dilation(m, iterations=2) & (sh['alpha'] > 0.02)
        ys, xs = np.where(m)
        y0, y1, x0, x1 = ys.min(), ys.max() + 1, xs.min(), xs.max() + 1
        rgb = sh['fg'][y0:y1, x0:x1]; a = (sh['alpha'] * m)[y0:y1, x0:x1]; cy_ = sh['cyan'][y0:y1, x0:x1] & (a > 0.5)
        R_, G_, B_ = rgb[..., 0], rgb[..., 1], rgb[..., 2]
        h = a.shape[0]
        rows = np.arange(h)
        if rule == 'bracer':  # the leather bracer: brown, darker than skin, in the top half
            brown = (a > 0.5) & (R_ > G_) & (G_ > B_) & ((R_ - B_) > 45) & ((R_ + G_ + B_) / 3 < 150) & (rows[:, None] < h * 0.55)
            cut = int(np.percentile(np.where(brown)[0], 97)) + 1
        elif rule == 'cuff':  # a glove's wrist cuff: tan leather and a gold buckle (warm, yellowish) over the darker glove
            lum = 0.299 * R_ + 0.587 * G_ + 0.114 * B_
            tan = (a > 0.5) & (R_ > G_) & ((G_ - B_) > 22) & ((R_ - B_) > 60) & (lum > 70) & (rows[:, None] < h * 0.45)
            cut = int(np.percentile(np.where(tan)[0], 98)) + 1
        else:  # the gauntlet's cuff: keep it (it tucks over the vambrace); the wrist is the lower gold band's bottom
            gold = (a > 0.5) & (R_ > 170) & (G_ > 130) & (B_ < 100) & (rows[:, None] < h * 0.5)
            cut = int(np.percentile(np.where(gold)[0], 98)) + 1
        hand = (a > 0.5) & (rows[:, None] >= cut) & ~cy_
        hx = np.where(hand)[1]
        res[state] = dict(rgb=rgb, a=a, cy=cy_, cut=cut, width=hx.max() - hx.min() + 1)
    return res


def grip_shift(d):
    """Rows from the wrist cut down to the grip point (the stub's centre), on the sheet."""
    return np.where(d['cy'])[0].mean() - d['cut']


def hand_alpha(d):
    """The hand's alpha: the bracer or cuff dropped (3 px of overlap kept above the wrist), the stub and its outline gone."""
    keep = np.ones_like(d['a'], bool)
    if d['drop_cuff']: keep[:max(0, d['cut'] - 3)] = False
    return d['a'] * keep * ~ndimage.binary_dilation(d['cy'], iterations=4)


def grip_point_y(d):
    """The grip pivot's row: the stub's centre where it passes through the hand (between the hand's sides)."""
    a = hand_alpha(d)
    cols = np.where(a > 0.5)[1]; ys, xs = np.where(d['cy'])
    inside = (xs > np.percentile(cols, 5)) & (xs < np.percentile(cols, 95))
    return ys[inside].mean() if inside.any() else ys.mean()


main = load(SHEET)
out = {}
rows = {'basic': cut_row(main, ROW_TOP['top'], 'bracer'), 'gold': cut_row(main, ROW_TOP['bottom'], 'gauntlet')}
# a cuff hides its wrist: each row puts it where the bare hand has it, above the grip (sheet px)
shift = {}  # per row: the wrist's offset below the cut (sheet px)
for look in ('basic', 'gold'):  # one scale per row, from the fist
    kf = OLD_FIST_W[look] * BPX / rows[look]['fist']['width']
    for state in STATES: out[(look, state)] = dict(rows[look][state], k=kf, drop_cuff=look == 'basic')
    shift[look] = grip_shift(rows[look]['grip']) - grip_shift(rows['basic']['grip'])
for look, path in EXTRA:
    sh = load(path)
    ref = cut_row(sh, ROW_TOP['top'], 'bracer')  # that sheet's bare hands: its drawing scale
    kf = OLD_FIST_W['basic'] * BPX / ref['fist']['width']
    row = cut_row(sh, ROW_TOP['bottom'], 'cuff')
    for state in STATES: out[(look, state)] = dict(row[state], k=kf, drop_cuff=True)
    # its grip point lands on the weapon socket exactly: the bare hand's wrist-to-grip distance, in atlas px
    b = out[('basic', 'grip')]
    hand_len_atlas = (grip_point_y(b) - b['cut']) * b['k']
    shift[look] = grip_point_y(out[(look, 'grip')]) - row['grip']['cut'] - hand_len_atlas / kf

meta = {}
for (look, state), d in out.items():
    rgb, a, cy_, cut, k = d['rgb'], d['a'], d['cy'], d['cut'], d['k']
    h, w = a.shape
    hand_a = hand_alpha(d)
    hx = np.where(hand_a[cut:] > 0.5)[1]
    wrist = ((hx.min() + hx.max()) / 2, float(cut) + shift[look])
    layers = {'': hand_a}
    piv = [wrist]
    if cy_.any():
        gy = grip_point_y(d)
        gx = (hx.min() + hx.max()) / 2
        piv.append((gx, gy))
        # the inside of the hand behind the handle: the stub's area inside the hand's outline, in the hand's shadow
        cols = np.where(hand_a > 0.5)[1]
        within = (np.arange(w)[None, :] > np.percentile(cols, 4)) & (np.arange(w)[None, :] < np.percentile(cols, 96))
        back = cy_ & within
        shade = np.median(rgb[(hand_a > 0.5)], axis=0) * 0.55
        layers['_back'] = back.astype(np.float32)
        rgb_back = np.broadcast_to(shade, rgb.shape)
    for suffix, la in layers.items():
        img = np.dstack([rgb_back if suffix == '_back' else rgb, la * 255]).clip(0, 255).astype(np.uint8)
        im = Image.fromarray(img).convert('RGBa').resize((max(1, round(w * k)), max(1, round(h * k))), Image.LANCZOS).convert('RGBA')
        bb = im.getbbox()
        name = f'{look}_{state}{suffix}'
        if bb is None: print('empty layer', name); continue
        im = im.crop(bb)
        im.save(f'{W}/{name}.png')
        meta[name] = {'w': im.width, 'h': im.height, 'pivots': [[round(x * k - bb[0], 2), round(y * k - bb[1], 2)] for x, y in piv]}
        # the far hand: slightly darker, as the other far limbs
        far = np.array(im).astype(np.float32); far[..., :3] *= 0.9
        Image.fromarray(far.clip(0, 255).astype(np.uint8)).save(f'{W}/{name}_far.png')
grip = meta['basic_grip']['pivots']
geo = {'hand_len': round(((grip[1][1] - grip[0][1]) ** 2 + (grip[1][0] - grip[0][0]) ** 2) ** 0.5 / BPX, 4),
       'grip_side': round((grip[1][0] - grip[0][0]) / BPX, 4), 'grip_down': round((grip[1][1] - grip[0][1]) / BPX, 4)}
json.dump({'bpx': BPX, 'parts': meta, 'geometry': geo}, open(f'{W}/parts_hands.json', 'w'), indent=1)
print(json.dumps(geo), {k: (v['w'], v['h'], v['pivots']) for k, v in meta.items() if not k.endswith('_back')})
