# Cut one rig parts sheet (magenta background) into rig parts, put each in its rest orientation at its own scale, and
# write into the work dir: parts_<look>/<name>.png (RGBA at B = 512 px; far limbs also as <name>_far.png, darkened)
# and parts_<look>.json (pivots in px, size, rotation). The config gives, per part: a seed pixel (or `from`), its joint
# pivots on the sheet, the sheet scale (B per sheet px), and optional clears, recolours, rotation and far shade.
# Usage: build_parts.py <sheet.png> <look> <config.json> [work dir = the config's folder]
import json, math, os, sys
import numpy as np
from PIL import Image, ImageDraw
from scipy import ndimage

sheet_path, look, cfg_path = sys.argv[1:4]
OUT = sys.argv[4] if len(sys.argv) > 4 else os.path.dirname(os.path.abspath(cfg_path))
cfg = json.load(open(cfg_path))
BPX = 512  # atlas resolution: px per B

SHEETS = {}


def load_sheet(path):
    """A parts sheet keyed off its magenta background: (RGBA image, component labels). A part may name its own sheet
    (`sheet`, relative to the config's folder), for pieces redrawn later on a separate sheet."""
    if path not in SHEETS:
        src = np.array(Image.open(path).convert('RGB')).astype(np.float32)
        r, g, b = src[..., 0], src[..., 1], src[..., 2]
        m = np.minimum(r, b) - g
        alpha = np.clip(1.0 - (m - 70.0) / 80.0, 0.0, 1.0)
        a3 = alpha[..., None]
        fgc = np.clip(np.where(a3 > 0.02, (src - (1 - a3) * np.array([255.0, 0, 255.0])) / np.maximum(a3, 0.02), 0), 0, 255)
        lab_, _ = ndimage.label(ndimage.binary_closing(alpha > 0.5, iterations=2))
        SHEETS[path] = (np.dstack([fgc, alpha * 255]).astype(np.uint8), lab_)
    return SHEETS[path]


rgba, lab = load_sheet(sheet_path)


def component_at(x, y):
    """Mask of the part whose pixels include (x, y) (sheet px)."""
    k = lab[int(y), int(x)]
    if k == 0: raise SystemExit(f'no part at {x},{y}')
    return ndimage.binary_dilation(lab == k, iterations=2)


parts = {}
whole = {}  # each part before trims: caps are cut from these
os.makedirs(f'{OUT}/parts_{look}', exist_ok=True)
for name, p in cfg['parts'].items():
    rgba, lab = load_sheet(os.path.join(os.path.dirname(os.path.abspath(cfg_path)), p['sheet']) if p.get('sheet') else sheet_path)
    if p.get('from'):  # cut out of another part's region (e.g. the shoulder cap from the torso)
        mask = component_at(*p['from'])
    else:
        mask = component_at(*p['seed'])
    keep = mask.copy()
    for (x0, y0, x1, y1) in p.get('clear', []):  # remove rectangles (sheet px)
        keep[y0:y1, x0:x1] = False
    if 'only' in p:  # keep only this rectangle
        x0, y0, x1, y1 = p['only']; box = np.zeros_like(keep); box[y0:y1, x0:x1] = True; keep &= box
    if p.get('keep_warm_above') or p.get('drop_warm'):
        # split a piece drawn in one (trousers tucked into a boot's cuff) by colour: the leather is warm, the cloth is not
        f0 = rgba[..., :3].astype(np.float32)
        warm = ((f0[..., 0] - f0[..., 2]) > 35) & (f0[..., 0] > 70)
        dark = f0.max(axis=2) < 75
        if p.get('keep_warm_above'):  # above this row only the leather and the outline along it (the cuff's rim)
            y_, d_ = p['keep_warm_above']
            band = np.zeros_like(keep); band[:int(y_)] = True
            keep &= ~band | warm | (dark & ndimage.binary_dilation(warm, iterations=int(d_)))
        if p.get('drop_warm'):  # the cloth alone: no leather, and no outline that borders only leather
            cool = ~warm & ~dark
            orphan = dark & ndimage.binary_dilation(warm, iterations=3) & ~ndimage.binary_dilation(cool, iterations=3)
            keep &= ~warm & ~orphan
    ys, xs = np.where(keep)
    x0, y0, x1, y1 = xs.min(), ys.min(), xs.max() + 1, ys.max() + 1
    img = rgba[y0:y1, x0:x1].copy()
    img[..., 3] = (img[..., 3] * keep[y0:y1, x0:x1]).astype(np.uint8)
    f = img[..., :3].astype(np.float32)
    for (rx0, ry0, rx1, ry1, scol, tcol) in p.get('recolor', []):  # skin-coloured 'doll joint' caps -> cloth colour
        sub = f[max(0, ry0 - y0):max(0, ry1 - y0), max(0, rx0 - x0):max(0, rx1 - x0)]
        R, G, Bc = sub[..., 0], sub[..., 1], sub[..., 2]
        skin = (R > 140) & (R > G) & (G > Bc) & ((R - Bc) > 55)
        lum = lambda c: 0.299 * c[..., 0] + 0.587 * c[..., 1] + 0.114 * c[..., 2]
        ls = lum(np.array(scol, np.float32)[None])[0]
        k = (lum(sub) / ls)[..., None]
        sub[skin] = np.clip(np.array(tcol, np.float32)[None] * k[skin], 0, 255)
    if p.get('drop_navy'):  # keep a cap cut from the torso without the vest around it
        R, G, Bc = f[..., 0], f[..., 1], f[..., 2]
        navy = (Bc > R + 8) & ((R + G + Bc) / 3 < 150)
        img[..., 3] = np.where(navy, 0, img[..., 3]).astype(np.uint8)
    img[..., :3] = f.astype(np.uint8)
    im = Image.fromarray(img)
    piv = [(px - x0, py - y0) for (px, py) in p['pivots']]  # pivots in crop px
    # rotate so the limb axis (pivot 0 -> pivot 1) points straight down, or by a fixed angle
    ang = 0.0
    if p.get('align') and len(piv) >= 2:
        dx, dy = piv[1][0] - piv[0][0], piv[1][1] - piv[0][1]
        ang = -math.degrees(math.atan2(dx, dy))  # PIL angle (counter-clockwise) that makes the axis point straight down
    ang += p.get('rotate', 0.0)
    if abs(ang) > 0.01:
        w0, h0 = im.size
        im2 = im.rotate(ang, resample=Image.BICUBIC, expand=True)
        w1, h1 = im2.size
        cx0, cy0, cx1, cy1 = w0 / 2, h0 / 2, w1 / 2, h1 / 2
        t = math.radians(ang)
        def rot(pt):  # PIL rotates counter-clockwise by ang (image y down): x' = cos*dx + sin*dy, y' = -sin*dx + cos*dy
            dx, dy = pt[0] - cx0, pt[1] - cy0
            return (cx1 + math.cos(t) * dx + math.sin(t) * dy, cy1 - math.sin(t) * dx + math.cos(t) * dy)
        piv = [rot(q) for q in piv]
        im = im2
    # scale to the atlas resolution: B units per sheet px * px per B
    s = p['scale'] * BPX
    sx = s * p.get('sx', 1.0)
    w, h = max(1, round(im.width * sx)), max(1, round(im.height * s))
    im = im.convert('RGBa').resize((w, h), Image.LANCZOS, reducing_gap=3.0).convert('RGBA')
    piv = [(q[0] * sx, q[1] * s) for q in piv]
    bb = im.getbbox()
    im = im.crop(bb)
    piv = [(q[0] - bb[0], q[1] - bb[1]) for q in piv]
    if p.get('center_pivot'):  # pad left or right so the pivot is on the vertical centre line (a strip drawn along a chain)
        half = math.ceil(max(piv[0][0], im.width - piv[0][0]))
        pad = Image.new('RGBA', (2 * half, im.height), (0, 0, 0, 0)); pad.alpha_composite(im, (round(half - piv[0][0]), 0))
        piv = [(q[0] + round(half - piv[0][0]), q[1]) for q in piv]; im = pad
    whole[name] = (im.copy(), piv, p.get('far'))
    trim = cfg.get('trims', {}).get(name)
    if trim:  # cut a joint end away (a skin-coloured dome that would show over the neighbouring part)
        a = np.array(im).astype(np.float32)
        h = a.shape[0]; t0, fe = trim['top'] * h, max(1.0, trim.get('feather', 0.02) * h)
        ramp = np.clip((np.arange(h) - t0) / fe, 0, 1)[:, None]
        a[..., 3] *= ramp
        im = Image.fromarray(a.clip(0, 255).astype(np.uint8))
    im.save(f'{OUT}/parts_{look}/{name}.png')
    parts[name] = {'w': im.width, 'h': im.height, 'pivots': [[round(q[0], 2), round(q[1], 2)] for q in piv], 'angle': round(ang, 2)}
    if p.get('far'):  # a darker copy for the far limb
        d = np.array(im).astype(np.float32); d[..., :3] *= p['far']
        Image.fromarray(d.clip(0, 255).astype(np.uint8)).save(f'{OUT}/parts_{look}/{name}_far.png')

# joint caps: a band of a part (rows as fractions of its height), turned half as far as the limb by the rig. The band's
# cut edges are feathered; `drop_blue` keeps only the armour (drops the blue cloth around a pauldron or a couter).
for name, c in cfg.get('caps', {}).items():
    src, piv, far = whole[c['from']]
    a = np.array(src).astype(np.float32)
    h = a.shape[0]; y0, y1 = c['band'][0] * h, c['band'][1] * h; fe = max(1.0, c.get('feather', 0.04) * h)
    rows = np.arange(h)[:, None]
    ramp = np.clip((rows - y0) / fe + (1.0 if c['band'][0] <= 0 else 0.0), 0, 1) * np.clip((y1 - rows) / fe + (1.0 if c['band'][1] >= 1 else 0.0), 0, 1)
    a[..., 3] *= ramp
    if c.get('drop_blue'):
        R_, G_, B_ = a[..., 0], a[..., 1], a[..., 2]
        a[..., 3] = np.where((B_ > R_ + 12) & (B_ > G_), 0, a[..., 3])
    im = Image.fromarray(a.clip(0, 255).astype(np.uint8))
    bb = im.getbbox(); im = im.crop(bb)
    q = piv[c.get('pivot', 0)]
    im.save(f'{OUT}/parts_{look}/{name}.png')
    parts[name] = {'w': im.width, 'h': im.height, 'pivots': [[round(q[0] - bb[0], 2), round(q[1] - bb[1], 2)]], 'angle': 0}
    if far:
        d = np.array(im).astype(np.float32); d[..., :3] *= far
        Image.fromarray(d.clip(0, 255).astype(np.uint8)).save(f'{OUT}/parts_{look}/{name}_far.png')

json.dump({'look': look, 'bpx': BPX, 'parts': parts}, open(f'{OUT}/parts_{look}.json', 'w'), indent=1)
print(json.dumps({k: (v['w'], v['h'], v['pivots']) for k, v in parts.items()}))
