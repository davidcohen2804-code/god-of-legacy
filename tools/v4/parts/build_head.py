# B's head standard from the expressions sheet (four copies of the approved head, only the eyes, brows and mouth
# changed) and the first head sheet (the test helmet): a face layer (the neutral face, with skin filled in under the
# hair for helmets), a hair layer, one eyes-and-mouth patch per expression, and the helmet, all registered onto the
# approved head of parts sheet 1 and written at the atlas resolution (B = 512 px) with the neck as the pivot.
# Usage: build_head.py <expressions sheet> <head sheet> <work dir>
import json, os, sys
import numpy as np
from PIL import Image, ImageFilter
from scipy import ndimage

EXPR, HEADS, W = sys.argv[1:4]
R = sys.argv[0].rsplit('/', 1)[0]
BPX = 512
HELMET_SCALE, HELMET_DX, HELMET_DY = 1.0, 0.0, 0.0  # nudges for the test helmet's fit (sheet px)
cfg = json.load(open(f'{R}/cfg_basic.json'))['parts']['head']
# The head on parts sheet 1 is drawn a little small for the approved lineup figure. Fitted on the lineup's head (rest
# pose, head region, sword masked; IoU 0.73 -> 0.94): 1.121 x larger and drawn 0.033 B further back, 0.012 B lower
# on the neck. Every head layer (face, hair, expressions, helmet) gets the same scale and shift.
HEAD_FIT_SCALE, HEAD_FIT_SHIFT = 1.121, (-0.0331, 0.0123)
SHEET_B = cfg['scale'] * HEAD_FIT_SCALE         # B per sheet px of the approved head
NECK = cfg['pivots'][0]                         # its neck, sheet px


def key(rgb):
    a_ = rgb.astype(np.float32); r, g, b = a_[..., 0], a_[..., 1], a_[..., 2]
    al = np.clip(1.0 - ((np.minimum(r, b) - g) - 70.0) / 80.0, 0.0, 1.0)
    fg = np.clip(np.where(al[..., None] > 0.02, (a_ - (1 - al[..., None]) * np.array([255.0, 0, 255.0])) / np.maximum(al[..., None], 0.02), 0), 0, 255)
    return fg, al


def pieces(path, centres):
    """Cut a sheet into the connected parts nearest to each centre (sheet px)."""
    fg, al = key(np.array(Image.open(path).convert('RGB')))
    lab, n = ndimage.label(ndimage.binary_closing(al > 0.5, iterations=2))
    sizes = ndimage.sum(np.ones_like(al), lab, range(1, n + 1)); coms = ndimage.center_of_mass(np.ones_like(al), lab, range(1, n + 1))
    masks = {k: np.zeros_like(al, bool) for k in centres}
    for j, (sz, (cy, cx)) in enumerate(zip(sizes, coms), start=1):
        if sz < 40: continue
        k = min(centres, key=lambda k: (centres[k][0] - cx) ** 2 + (centres[k][1] - cy) ** 2)
        masks[k] |= ndimage.binary_dilation(lab == j, iterations=2)
    out = {}
    for k, m in masks.items():
        ys, xs = np.where(m); y0, y1, x0, x1 = ys.min(), ys.max() + 1, xs.min(), xs.max() + 1
        out[k] = (np.dstack([fg, al * 255 * m])[y0:y1, x0:x1].astype(np.float32), (x0, y0))
    return out


def component(path, seed):
    """The one connected part of a sheet that contains `seed` (sheet px), and its top-left."""
    fg, al = key(np.array(Image.open(path).convert('RGB')))
    lab, _ = ndimage.label(ndimage.binary_closing(al > 0.5, iterations=2))
    m = ndimage.binary_dilation(lab == lab[seed[1], seed[0]], iterations=2)
    ys, xs = np.where(m); y0, y1, x0, x1 = ys.min(), ys.max() + 1, xs.min(), xs.max() + 1
    return np.dstack([fg, al * 255 * m])[y0:y1, x0:x1].astype(np.float32), (x0, y0)


# the approved head (sheet px)
O, o_off = component(f'{R}/sheets/b_parts_basic.png', cfg['seed'])
O_neck = (NECK[0] - o_off[0], NECK[1] - o_off[1])
E = pieces(EXPR, {'neutral': (384, 256), 'blink': (1152, 256), 'angry': (384, 768), 'hurt': (1152, 768)})


def warp(img, s, dx, dy, shape):
    """RGBA float image scaled by s, placed with its top-left at (dx, dy) on a canvas of `shape`."""
    im = Image.fromarray(img.clip(0, 255).astype(np.uint8)).convert('RGBa')
    im = im.resize((max(1, round(im.width * s)), max(1, round(im.height * s))), Image.LANCZOS).convert('RGBA')
    can = Image.new('RGBA', (shape[1], shape[0]), (0, 0, 0, 0)); can.alpha_composite(im, (int(round(dx)), int(round(dy))))
    return np.array(can).astype(np.float32)


def fit(img, ref, s_list, c0, span=24):
    """Best scale and offset of `img` onto `ref` (alpha overlap + colour agreement): a coarse search at half size,
    then a refinement at full size."""
    half = lambda x: np.array(Image.fromarray(x.clip(0, 255).astype(np.uint8)).resize((x.shape[1] // 2, x.shape[0] // 2), Image.BILINEAR)).astype(np.float32)
    img2, ref2 = half(img), half(ref)
    ra2 = ref2[..., 3] / 255.0
    best2 = (-1e18, None)
    for s in s_list:
        for dy in range(-span // 2, span // 2 + 1, 2):
            for dx in range(-span // 2, span // 2 + 1, 2):
                w = warp(img2, s, c0[0] / 2 + dx, c0[1] / 2 + dy, ref2.shape)
                wa = w[..., 3] / 255.0; both = wa * ra2
                v = float(both.sum() - 0.5 * np.abs(wa - ra2).sum() - 0.004 * (np.abs(w[..., :3] - ref2[..., :3]).sum(axis=2) * both).sum())
                if v > best2[0]: best2 = (v, (s, (c0[0] / 2 + dx) * 2, (c0[1] / 2 + dy) * 2))
    s_list, c0 = [best2[1][0]], best2[1][1:]
    best = (-1e18, None)
    ra = ref[..., 3] / 255.0
    for s in s_list:
        cx, cy = c0
        for step, sp in ((1, 3),):
            loc = (-1e18, None)
            for dy in range(-sp, sp + 1, step):
                for dx in range(-sp, sp + 1, step):
                    w = warp(img, s, cx + dx, cy + dy, ref.shape)
                    wa = w[..., 3] / 255.0
                    both = wa * ra
                    v = float(both.sum() - 0.5 * np.abs(wa - ra).sum() - 0.004 * (np.abs(w[..., :3] - ref[..., :3]).sum(axis=2) * both).sum())
                    if v > loc[0]: loc = (v, (s, cx + dx, cy + dy))
            cx, cy = loc[1][1:]
        if loc[0] > best[0]: best = loc
    return best[1]


# 1. the neutral head onto the approved head (scale near 1 / 1.3: the reference was sent 1.3x)
n_img, _ = E['neutral']
s0 = O.shape[1] / n_img.shape[1]
c0 = ((O.shape[1] - n_img.shape[1] * s0) / 2, (O.shape[0] - n_img.shape[0] * s0) / 2)
reg = {'neutral': fit(n_img, O, [s0 * f for f in (0.97, 0.985, 1.0, 1.015, 1.03)], c0)}
print('neutral', reg['neutral'], flush=True)
N = warp(n_img, *reg['neutral'], O.shape)
# 2. the other expressions onto the placed neutral head (their hair is identical)
for k in ('blink', 'angry', 'hurt'):
    img, _ = E[k]; s = reg['neutral'][0]
    reg[k] = fit(img, N, [s * f for f in (0.99, 1.0, 1.01)], reg['neutral'][1:], span=12)
    print(k, reg[k], flush=True)
L = {k: (N if k == 'neutral' else warp(E[k][0], *reg[k], O.shape)) for k in reg}

# 3. the bald head base of the head sheet (box 1) under the face: it fills the skull where the hair was
Bimg, _ = component(HEADS, (180, 300))
na = N[..., 3] / 255.0
rgb, a = N[..., :3], na
R_, G_, B_ = rgb[..., 0], rgb[..., 1], rgb[..., 2]
skin = (a > 0.5) & (R_ > 175) & (G_ > 125) & (R_ > G_) & (G_ > B_) & ((R_ - B_) > 35) & (B_ > 80)


def score_base(w):
    wa = w[..., 3] / 255.0
    return float((wa * skin).sum() - 2.0 * (wa * (1 - (na > 0.5))).sum())


best = (-1e18, None)
sb = reg['neutral'][0] * 1.3  # the head sheets were drawn at about the reference's scale
for s_ in (sb * 0.9, sb * 0.95, sb, sb * 1.05, sb * 1.1):
    cx, cy = (O.shape[1] - Bimg.shape[1] * s_) / 2, O.shape[0] - Bimg.shape[0] * s_
    for step, sp in ((6, 48), (2, 6), (1, 2)):
        loc = (-1e18, None)
        for dy in range(-sp, sp + 1, step):
            for dx in range(-sp, sp + 1, step):
                v = score_base(warp(Bimg, s_, cx + dx, cy + dy, O.shape))
                if v > loc[0]: loc = (v, (s_, cx + dx, cy + dy))
        cx, cy = loc[1][1:]
    if loc[0] > best[0]: best = loc
reg['base'] = best[1]
print('base', reg['base'], flush=True)
BASE = warp(Bimg, *reg['base'], O.shape)

# 4. the face: inside the bald skull's outline, the skin plus what an expression changes (eyes, brows, mouth) below the
# top of the face's skin; everything else (the fringe over the forehead, the spikes, the side locks) is hair
ba = BASE[..., 3] / 255.0
inside = ndimage.binary_erosion(ba > 0.5, iterations=2)
change = np.zeros(a.shape, bool)
for k in ('blink', 'angry', 'hurt'):
    change |= (np.abs(L[k][..., :3] - N[..., :3]).max(axis=2) > 45) & (a > 0.5)
change = ndimage.binary_opening(change, iterations=1)
lab, n = ndimage.label(skin & inside)
sizes = ndimage.sum(skin, lab, range(1, n + 1))
# the face's skin: the skin-coloured regions that reach down to the eyes (light hair highlights on the crown are skin-
# coloured too, but sit wholly above the eyes)
cl, cn = ndimage.label(change & inside)
csz = ndimage.sum(change & inside, cl, range(1, cn + 1))
big = sorted(range(cn), key=lambda i: -csz[i])[:3]  # the three largest changes: the two eyes with their brows, the mouth
brow = min(np.where(cl == i + 1)[0].min() for i in big)  # the top of the eyes and brows
low = ndimage.maximum(np.arange(a.shape[0])[:, None] * np.ones_like(skin, dtype=int), lab, range(1, n + 1))
# (the forehead is at most a tenth of the head's height above the brows; the crown's highlights can touch it through gaps
# in the fringe, so the band is cut there)
core = np.isin(lab, [i + 1 for i, v in enumerate(sizes) if v > 60 and low[i] > brow]) & (np.arange(a.shape[0])[:, None] >= brow - 0.1 * a.shape[0])
ys = np.where(core)[0]
top = np.percentile(ys, 8)  # the forehead line: features never sit above it
feat = change & inside & (np.arange(a.shape[0])[:, None] > top)


def face_of(feat):
    f = ndimage.binary_fill_holes(ndimage.binary_closing(core | ndimage.binary_dilation(feat, iterations=2), iterations=3)) & inside & (a > 0.05)
    return f | ((a > 0.05) & ~inside & skin & (np.arange(a.shape[0])[:, None] > top + 0.35 * (a.shape[0] - top)))  # the ear and the neck edge


face0, feat0 = face_of(feat), feat  # the face as approved in Phase 3B (what the face layer showed with the hair on)
# only the expressions' real features (eyes with brows, mouth): specks where the four drawings' hair differs slightly
# are not features, and kept stray hair marks in the face
fl, fn = ndimage.label(feat)
fsz = ndimage.sum(feat, fl, range(1, fn + 1))
brow_line = min(np.where(fl == i + 1)[0].min() for i, v in enumerate(fsz) if v >= 25)  # the top of the brows
ftop = ndimage.minimum(np.arange(a.shape[0])[:, None] * np.ones_like(fl), fl, range(1, fn + 1))
feat = np.isin(fl, [i + 1 for i, v in enumerate(fsz) if v >= 25 or ftop[i] > brow_line + 20])  # specks up to the eyes only
face = face_of(feat)
# the forehead above the brows belongs to the hair layer (the fringe's strands lie on it): with the hair on, the hair
# layer draws it exactly as approved; under a helmet the face layer shows the bald base's clean skin there
face &= ~((np.arange(a.shape[0])[:, None] < brow_line) & ~ndimage.binary_dilation(feat, iterations=2))
hair = (a > 0.05) & ~face
# where the hair layer took over from the face layer, it also overlaps the face layer by a few px (both draw the
# approved pixels there), so the layers' resampled edges leave no seam in the approved look
moved = face0 & ~face
# pixels the four expressions draw alike: only there may the one hair layer draw over the face and its expressions
same = np.ones(a.shape, bool)
for k in ('blink', 'angry', 'hurt'): same &= np.abs(L[k][..., :3] - rgb).max(axis=2) < 40
# the fringe's strand pieces lying across the brows: light orange-brown strokes (neither skin nor ink) and their small
# outline specks. Each expression drawing has its own; they belong to the hair: the hair item draws them on its fringe
# layer, one frame per expression (the slot follows the face channel), and the face and the expression patches get the
# skin around them instead, so a helmet (which hides the hair) shows clean skin beside the brows
rows_ = np.arange(a.shape[0])[:, None]
eye_top = int(np.where((rgb[..., 0] > 215) & (rgb[..., 1] > 215) & (rgb[..., 2] > 200) & feat)[0].min())  # the eye whites
zone = face & (rows_ >= brow_line - 10) & (rows_ <= eye_top + 22)


def skin_t(X):
    R, G, B = X[..., 0], X[..., 1], X[..., 2]
    return (R > 200) & (G / np.maximum(R, 1) > 0.76) & (B / np.maximum(R, 1) > 0.58)


def strands(X):
    R, G, B = X[..., 0], X[..., 1], X[..., 2]
    ink = np.maximum(np.maximum(R, G), B) < 110
    st = zone & ~ink & ~skin_t(X) & (R > 120) & (G / np.maximum(R, 1) < 0.80)
    il, inn = ndimage.label(ink & zone)
    isz = ndimage.sum(ink & zone, il, range(1, inn + 1))
    small = np.isin(il, [i + 1 for i, v in enumerate(isz) if v < 25])
    big = np.isin(il, [i + 1 for i, v in enumerate(isz) if v >= 60])  # brows, lids
    # outline specks: touching a strand, or lying loose on the skin away from the brows and lids
    return st | (small & (ndimage.binary_dilation(st, iterations=2) | ~ndimage.binary_dilation(big, iterations=3)))


def brows(X):
    """An expression's brows (and lids): the large dark shapes in the brows' band."""
    ink = (np.maximum(np.maximum(X[..., 0], X[..., 1]), X[..., 2]) < 110) & zone
    il, inn = ndimage.label(ink)
    isz = ndimage.sum(ink, il, range(1, inn + 1))
    return np.isin(il, [i + 1 for i, v in enumerate(isz) if v >= 60])


Sk, clean = {}, {}
for k, X in L.items():
    x = X[..., :3]
    s_ = strands(x) & ~ndimage.binary_dilation(brows(x), iterations=1)
    sk_ = skin_t(x) & face & ~s_
    w_ = ndimage.gaussian_filter(sk_.astype(np.float32), 3)
    f_ = np.dstack([ndimage.gaussian_filter(x[..., c] * sk_, 3) for c in range(3)]) / np.maximum(w_, 1e-3)[..., None]
    f_ = np.where((w_ > 0.05)[..., None], f_, BASE[..., :3])
    Sk[k], clean[k] = s_, np.where(s_[..., None], f_, x)
print('strand pieces at the brows', {k: int(v.sum()) for k, v in Sk.items()}, flush=True)
hair_draw = hair | (ndimage.binary_dilation(moved, iterations=8) & face & same)
# the overlap fades out over its last px (a hard alpha edge inside the skin rings when the layer is scaled down)
dist = ndimage.distance_transform_edt(~(hair | moved))
hair_alpha = np.where(hair | moved, 1.0, np.where(hair_draw, np.clip((8.0 - dist) / 5.0, 0, 1), 0.0))
if os.environ.get('HEAD_DBG'): np.savez_compressed(os.environ['HEAD_DBG'], rgb=rgb, a=a, face=face, hair=hair, feat=feat, change=change, skin=skin, BASE=BASE, brow_line=brow_line, **{f'L_{k}': L[k] for k in L})
print('moved to the hair layer', int(moved.sum()), 'px, rows', np.where(moved)[0].min() if moved.any() else -1, '-', np.where(moved)[0].max() if moved.any() else -1, flush=True)
change = feat
Image.fromarray((np.dstack([face, hair, change]) * 255).astype(np.uint8)).save(f'{W}/head_masks.png')

# 5. per-expression patches: the changed area (eyes and brows, mouth) grown a little, with feathered edges
region = ndimage.binary_dilation(ndimage.binary_closing(change, iterations=4), iterations=5) & face
soft = np.clip(ndimage.gaussian_filter(region.astype(np.float32), 2.5) * 1.8, 0, 1) * face

out = {}
def emit(name, rgba):
    """Crop, scale to the atlas (B = 512 px) and record the neck pivot."""
    im = Image.fromarray(rgba.clip(0, 255).astype(np.uint8))
    bb = im.getbbox(); im = im.crop(bb)
    k = SHEET_B * BPX
    im = im.convert('RGBa').resize((max(1, round(im.width * k)), max(1, round(im.height * k))), Image.LANCZOS).convert('RGBA')
    im.save(f'{W}/{name}.png')
    px, py = (O_neck[0] - bb[0]) * k - HEAD_FIT_SHIFT[0] * BPX, (O_neck[1] - bb[1]) * k - HEAD_FIT_SHIFT[1] * BPX
    out[name] = {'w': im.width, 'h': im.height, 'pivots': [[round(px, 2), round(py, 2)]]}

# the face layer: the neutral face, and the bald base's skin under the hair (seen only when a helmet hides the hair)
ba = BASE[..., 3] / 255.0
# above the brows only the skin itself is kept: the fringe's strands and their outlines become the bald base's forehead,
# so a helmet that leaves the forehead bare shows clean skin
brow_f = brow - 1
rows_ = np.arange(a.shape[0])[:, None]
keep = face & (skin | ndimage.binary_dilation(feat, iterations=2) | (rows_ >= brow_f + 12))
face_rgb = np.where(keep[..., None], rgb, BASE[..., :3])
face_rgb = np.where(Sk['neutral'][..., None], clean['neutral'], face_rgb)
keep0 = face0 & (skin | ndimage.binary_dilation(feat0, iterations=2) | (rows_ >= brow_f + 12))
hair_rgb = np.where((hair_draw & face0 & ~keep0)[..., None], BASE[..., :3], rgb)  # as the Phase 3B face layer drew it
face_a = np.where(face, a, ba * (1 - face))
emit('head_face', np.dstack([face_rgb, face_a * 255]))
emit('hair', np.dstack([hair_rgb, hair_alpha * a * 255]))
if os.environ.get('HEAD_REF'): emit('ref_head', np.dstack([rgb, a * 255]))  # the whole approved head, for comparisons
for k in ('blink', 'angry', 'hurt'):
    emit(f'face_{k}', np.dstack([clean[k], soft * (L[k][..., 3] / 255.0) * 255]))
# the fringe frames: each expression's strand pieces in its own colours, fading out over a few px of the identical
# pixels around them (no hard edge to ring when scaled)
for k in L:
    dk = ndimage.distance_transform_edt(~Sk[k])
    fa_ = np.where(Sk[k], 1.0, np.clip((4.0 - dk) / 3.0, 0, 1)) * face
    emit(f'fringe_{k}', np.dstack([L[k][..., :3], fa_ * (L[k][..., 3] / 255.0) * 255]))

# 6. the test helmet (head sheet box 4), drawn for the bald base at the same scale: centred on the skull, its dome
# just above the skull's top (the steel's thickness), so it covers the scalp and the hair line
Himg, _ = component(HEADS, (1300, 160))
sk = ba > 0.5
ys_, xs_ = np.where(sk)
s_h = reg['base'][0] * HELMET_SCALE
ha_ = Himg[..., 3] > 128
hys, hxs = np.where(ha_)
x0 = (xs_.min() + xs_.max()) / 2 - (hxs.min() + hxs.max()) / 2 * s_h + HELMET_DX
y0 = ys_.min() - 0.045 * (ys_.max() - ys_.min()) - hys.min() * s_h + HELMET_DY
pad = 80; shape = (O.shape[0] + 2 * pad, O.shape[1] + 2 * pad)
Hp = warp(Himg, s_h, x0 + pad, y0 + pad, shape)[pad:-pad, pad:-pad]
best = (0, (s_h, x0, y0))
print('helmet', best[1], flush=True)
emit('helmet', Hp)
if os.environ.get('HEAD_DBG'): np.savez_compressed(os.environ['HEAD_DBG'].replace('.npz', '_helm.npz'), Hp=Hp, face_rgb=face_rgb, face_a=face_a)
json.dump({'bpx': BPX, 'parts': out, 'register': {k: [float(x) for x in v] for k, v in reg.items()}, 'helmet': [float(x) for x in best[1]]}, open(f'{W}/parts_head.json', 'w'), indent=1)
print(json.dumps({k: (v['w'], v['h'], v['pivots']) for k, v in out.items()}))
