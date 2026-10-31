# B's hand standard from the hands sheet: five states (relaxed, fist, one-hand grip, second hand of a two-hand grip,
# open palm), bare and in the Golden Warrior gauntlet, hanging from the wrist. Each hand is cut at the wrist (the bare
# hands lose the leather bracer the forearm already wears), scaled to the hand size of the approved parts (the fist's
# width), and written at the atlas resolution (B = 512 px) with the wrist as the pivot. Grips also get the grip point
# (the centre of the cyan handle stub) and two layers: the hand with a hole where the handle passes (drawn over the
# weapon) and the inside of the hand filling that hole (drawn under the weapon), so the handle shows between the
# fingers. Usage: build_hands.py <hands sheet> <work dir>
import json, sys
import numpy as np
from PIL import Image
from scipy import ndimage

SHEET, W = sys.argv[1:3]
R = sys.argv[0].rsplit('/', 1)[0]
BPX = 512
STATES = ['relaxed', 'fist', 'grip', 'grip2', 'open']
OLD_FIST_W = {'basic': 0.057, 'gold': 0.059}  # the approved fists' widths, B

src = np.array(Image.open(SHEET).convert('RGB')).astype(np.float32)
r, g, b = src[..., 0], src[..., 1], src[..., 2]
cyan = (g > 170) & (b > 170) & (r < 140)
cyan = ndimage.binary_dilation(cyan, iterations=2) & (((b - r) > 35) & ((g - r) > 25) | cyan)  # the stub and its blended edge
mag = np.clip(1.0 - ((np.minimum(r, b) - g) - 70.0) / 80.0, 0.0, 1.0)
alpha = np.where(cyan, 1.0, mag)
fg = np.clip(np.where(alpha[..., None] > 0.02, (src - (1 - alpha[..., None]) * np.array([255.0, 0, 255.0])) / np.maximum(alpha[..., None], 0.02), 0), 0, 255)
lab, n = ndimage.label(ndimage.binary_closing(alpha > 0.5, iterations=2))
coms = ndimage.center_of_mass(np.ones_like(alpha), lab, range(1, n + 1)); sizes = ndimage.sum(np.ones_like(alpha), lab, range(1, n + 1))
BOX_W, BOX_H, X0, GAP = 280, 440, 12, 28
out = {}
for row, (look, top) in enumerate((('basic', 24), ('gold', 560))):
    for i, state in enumerate(STATES):
        cx, cy = X0 + i * (BOX_W + GAP) + BOX_W / 2, top + BOX_H / 2
        m = np.zeros_like(alpha, bool)
        for j, (sz, (yy, xx)) in enumerate(zip(sizes, coms), start=1):
            if sz > 60 and abs(xx - cx) < BOX_W * 0.62 and abs(yy - cy) < BOX_H * 0.6: m |= lab == j
        m = ndimage.binary_dilation(m, iterations=2) & (alpha > 0.02)
        ys, xs = np.where(m)
        y0, y1, x0, x1 = ys.min(), ys.max() + 1, xs.min(), xs.max() + 1
        rgb = fg[y0:y1, x0:x1]; a = (alpha * m)[y0:y1, x0:x1]; cy_ = cyan[y0:y1, x0:x1] & (a > 0.5)
        R_, G_, B_ = rgb[..., 0], rgb[..., 1], rgb[..., 2]
        h = a.shape[0]
        rows = np.arange(h)
        if look == 'basic':  # the leather bracer: brown, darker than skin, in the top half
            brown = (a > 0.5) & (R_ > G_) & (G_ > B_) & ((R_ - B_) > 45) & ((R_ + G_ + B_) / 3 < 150) & (rows[:, None] < h * 0.55)
            cut = int(np.percentile(np.where(brown)[0], 97)) + 1
        else:  # the gauntlet's cuff: keep it (it tucks over the vambrace); the wrist is the lower gold band's bottom
            gold = (a > 0.5) & (R_ > 170) & (G_ > 130) & (B_ < 100) & (rows[:, None] < h * 0.5)
            cut = int(np.percentile(np.where(gold)[0], 98)) + 1
        hand = (a > 0.5) & (rows[:, None] >= cut) & ~cy_
        hx = np.where(hand)[1]
        width = hx.max() - hx.min() + 1  # the hand below the wrist, without the handle
        k = OLD_FIST_W[look] * BPX / width if state == 'fist' else None
        out[(look, state)] = dict(rgb=rgb, a=a, cy=cy_, cut=cut, width=width, k=k)
    # one scale per row, from the fist
    kf = out[(look, 'fist')]['k']
    for state in STATES: out[(look, state)]['k'] = kf

meta = {}
wrist_shift = {}
for look in ('basic', 'gold'):  # the gauntlet's cuff hides its wrist: put it where the bare hand's is, above the grip
    d = out[(look, 'grip')]; ys = np.where(d['cy'])[0]
    wrist_shift[look] = ys.mean() - d['cut']
hand_len_px = wrist_shift['basic']
for (look, state), d in out.items():
    rgb, a, cy_, cut, k = d['rgb'], d['a'], d['cy'], d['cut'], d['k']
    h, w = a.shape
    keep = np.ones_like(a, bool)
    if look == 'basic': keep[:max(0, cut - 3)] = False  # drop the bracer, keep 3 px of overlap above the wrist
    hand_a = a * keep * ~ndimage.binary_dilation(cy_, iterations=4)  # the stub and its outline go
    hx = np.where(hand_a[cut:] > 0.5)[1]
    wrist = ((hx.min() + hx.max()) / 2, float(cut) + wrist_shift[look] - hand_len_px)
    layers = {'': hand_a}
    piv = [wrist]
    if cy_.any():
        ys, xs = np.where(cy_)
        inside = (xs > np.percentile(np.where(hand_a > 0.5)[1], 5)) & (xs < np.percentile(np.where(hand_a > 0.5)[1], 95))
        gy = ys[inside].mean() if inside.any() else ys.mean()
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
