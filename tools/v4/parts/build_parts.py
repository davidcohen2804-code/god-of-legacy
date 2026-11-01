# Cut one rig parts sheet (magenta background) into rig parts, put each in its rest orientation at its own scale, and
# write into the work dir: parts_<look>/<name>.png (RGBA at B = 512 px; far limbs also as <name>_far.png, darkened)
# and parts_<look>.json (pivots in px, size, rotation). The config gives, per part: a seed pixel (or `from`), its joint
# pivots on the sheet, the sheet scale (B per sheet px), and optional clears, recolours, rotation and far shade.
# Usage: build_parts.py <sheet.png> <look> <config.json> [work dir = the config's folder]
import json, math, os, sys
import cv2
import numpy as np
from PIL import Image, ImageDraw
from scipy import ndimage

sheet_path, look, cfg_path = sys.argv[1:4]
OUT = sys.argv[4] if len(sys.argv) > 4 else os.path.dirname(os.path.abspath(cfg_path))
cfg = json.load(open(cfg_path))
BPX = 512  # atlas resolution: px per B

SHEETS = {}


def quad(p, n=400):
    (ax, ay), (cx, cy), (bx, by) = p; t = np.linspace(0, 1, n)
    return np.stack([(1 - t) ** 2 * ax + 2 * (1 - t) * t * cx + t ** 2 * bx, (1 - t) ** 2 * ay + 2 * (1 - t) * t * cy + t ** 2 * by], 1)


def panel_out(src, c, seed=7):
    """Take a hanging panel drawn on a piece away (the Golden hips' short tabard, now a separate piece on the hip chain)
    and paint the trousers' cloth where it was: the panel is found by colour (blue cloth, gold trim and its own outline)
    inside the polygon `bound` (sheet px); the leg openings' outlines below `openings_below` stay; each row's cloth tone
    comes from the cloth beside the panel, shaded under the belt (`belt_y`) and beside the tassets (`tasset_edges`),
    with a seam and folds as soft strokes; below the `crotch` curve the background (the gap between the legs)."""
    im = src.astype(np.float32); H, W = im.shape[:2]
    r, g, b = im[..., 0], im[..., 1], im[..., 2]
    lum = im @ np.array([0.299, 0.587, 0.114], np.float32)
    bound = np.zeros((H, W), np.uint8); cv2.fillPoly(bound, [np.array(c['bound'], np.int32)], 1); bound = bound.astype(bool)
    blue = (b > r + 25) & (b > g + 5) & (b > 90)
    gold = (r > 150) & (g > 100) & (b < 110) & (r - b > 60)
    core = ndimage.binary_fill_holes(ndimage.binary_closing((blue | gold) & bound, iterations=2)) & bound
    ink = lum < 60
    opening = (lum >= 45) & (lum < 82) & (b >= r) & ~core & (np.arange(H)[:, None] >= c['openings_below'])
    near_open = ndimage.binary_dilation(opening, iterations=2)
    mask = core | (ndimage.binary_dilation(core, iterations=c.get('ring', 3)) & bound & ~(ink & near_open))
    sat = (im.max(2) - im.min(2)) / np.maximum(im.max(2), 1)
    cloth = (lum > 45) & (lum < 125) & (b >= r - 4) & (sat < 0.35) & ~mask
    ys_, xs_ = np.nonzero(mask); y0, y1 = ys_.min(), ys_.max() + 1; x0, x1 = xs_.min(), xs_.max() + 1
    L = np.full((H, 3), np.nan, np.float32); R = np.full((H, 3), np.nan, np.float32)
    for y in range(y0, y1):
        row = np.nonzero(mask[y])[0]
        if not len(row): continue
        a, e = row.min(), row.max()
        for (lo, hi, dst) in ((max(0, a - 12), a - 1, L), (e + 2, min(W, e + 13), R)):
            sel = cloth[y, lo:hi]
            if sel.sum() >= 3: dst[y] = np.median(im[y, lo:hi][sel], axis=0)
    idx = np.arange(H)
    for A in (L, R):
        good = ~np.isnan(A[:, 0])
        for k in range(3):
            A[:, k] = np.interp(idx, idx[good], A[good, k]); A[:, k] = cv2.GaussianBlur(A[:, k].reshape(-1, 1), (1, 0), 4).ravel()
    ys, xs = np.mgrid[0:H, 0:W].astype(np.float32)
    t = np.clip((xs - x0) / max(1, x1 - x0), 0, 1)[..., None]
    base = L[:, None, :] * (1 - t) + R[:, None, :] * t
    bd = c.get('belt_dark', 0.5)
    base *= (bd + (1 - bd) * np.clip((ys - c['belt_y']) / c.get('belt_soft', 10.0), 0, 1))[..., None]
    for (ex, ey0, ey1, side) in c.get('tasset_edges', []):
        k = np.where((ys >= ey0) & (ys <= ey1), 0.72 + 0.28 * np.clip((xs - ex) * side / 7.0, 0, 1), 1.0)
        base *= cv2.GaussianBlur(k.astype(np.float32), (0, 0), 2.0)[..., None]
    strokes = np.zeros((H, W), np.float32); hi = np.zeros((H, W), np.float32)
    def line(a, pts, w): cv2.polylines(a, [np.array(pts, np.int32).reshape(-1, 1, 2)], False, 1.0, thickness=w, lineType=cv2.LINE_AA)
    line(strokes, c['seam'], 2); line(hi, [[q[0] - 3, q[1]] for q in c['seam']], 2)
    for f in c.get('folds', []): line(strokes, f, 3)
    strokes = cv2.GaussianBlur(strokes, (0, 0), 1.3); hi = cv2.GaussianBlur(hi, (0, 0), 1.5)
    base = base * (1 - 0.25 * strokes[..., None]) + c.get('hi', 6) * hi[..., None]
    n = cv2.GaussianBlur(np.random.default_rng(seed).normal(0, 1, (H, W)).astype(np.float32), (0, 0), 2.0)
    base = base + c.get('grain', 2.0) * (n / (n.std() + 1e-6))[..., None]
    cur = quad(c['crotch'])
    yb = np.interp(np.arange(W), cur[:, 0], cur[:, 1], left=np.nan, right=np.nan)
    below = mask & (ys > yb[None, :])
    edge = np.zeros((H, W), np.float32)
    cv2.polylines(edge, [np.round(cur * 4).astype(np.int32).reshape(-1, 1, 2)], False, 1.0, thickness=c.get('ink_w', 3), lineType=cv2.LINE_AA, shift=2)
    soft = cv2.GaussianBlur(mask.astype(np.float32), (0, 0), 0.8); soft = np.where(mask, 1.0, soft * 0.6)
    comp = im * (1 - soft[..., None]) + base * soft[..., None]
    inkc = np.array(c.get('ink', [30, 27, 38]), np.float32)
    comp = comp * (1 - edge[..., None]) + inkc[None, None, :] * edge[..., None]
    comp[below & (edge < 0.35)] = [255, 0, 255]
    return np.clip(comp, 0, 255)


def load_sheet(path, fix=None):
    """A parts sheet keyed off its magenta background: (RGBA image, component labels). A part may name its own sheet
    (`sheet`, relative to the config's folder), for pieces redrawn later on a separate sheet, and a `panel_out` fix
    applied to the sheet before it is keyed."""
    key = path + ('#' + json.dumps(fix, sort_keys=True) if fix else '')
    if key not in SHEETS:
        src = np.array(Image.open(path).convert('RGB')).astype(np.float32)
        if fix: src = panel_out(src, fix)
        r, g, b = src[..., 0], src[..., 1], src[..., 2]
        m = np.minimum(r, b) - g
        alpha = np.clip(1.0 - (m - 70.0) / 80.0, 0.0, 1.0)
        a3 = alpha[..., None]
        fgc = np.clip(np.where(a3 > 0.02, (src - (1 - a3) * np.array([255.0, 0, 255.0])) / np.maximum(a3, 0.02), 0), 0, 255)
        lab_, _ = ndimage.label(ndimage.binary_closing(alpha > 0.5, iterations=2))
        SHEETS[key] = (np.dstack([fgc, alpha * 255]).astype(np.uint8), lab_)
    return SHEETS[key]


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
    rgba, lab = load_sheet(os.path.join(os.path.dirname(os.path.abspath(cfg_path)), p['sheet']) if p.get('sheet') else sheet_path, p.get('panel_out'))
    if p.get('from'):  # cut out of another part's region (e.g. the shoulder cap from the torso)
        mask = component_at(*p['from'])
    else:
        mask = component_at(*p['seed'])
    keep = mask.copy()
    if p.get('fill_rows'):
        # rebuild a band of the part from one of its own rows (sheet px): [y0, y1, y_ref] replaces rows y0..y1 with row
        # y_ref, outline and width included (a bare forearm continued up over a sleeve end drawn on it)
        rgba = rgba.copy()
        for (fy0, fy1, fyr) in p['fill_rows']:
            rgba[fy0:fy1] = rgba[fyr]; keep[fy0:fy1] = keep[fyr]
    if p.get('fill_rows_rgb'):
        # the same, colours only: the band keeps its own shape (a joint dome painted with the leather of the row below it)
        rgba = rgba.copy()
        for (fy0, fy1, fyr) in p['fill_rows_rgb']:
            rgba[fy0:fy1, :, :3] = rgba[fyr, :, :3]
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
    if p.get('keep_hue') or p.get('drop_hue'):
        # split a piece drawn in one by colour (a sleeve's end on a forearm): `keep_hue` keeps only that colour and the
        # outline along it, `drop_hue` removes it and any outline that borders only it
        f0 = rgba[..., :3].astype(np.float32)
        def hue_mask(h):
            R_, G_, B_ = f0[..., 0], f0[..., 1], f0[..., 2]
            if h == 'crimson': return (R_ > 95) & (R_ > G_ + 45) & (R_ > B_ + 35) & (G_ < 110)
            raise SystemExit(f'unknown hue {h}')
        dark = f0.max(axis=2) < 75
        if p.get('keep_hue'):
            hm = hue_mask(p['keep_hue']); keep &= hm | (dark & ndimage.binary_dilation(hm, iterations=3))
        if p.get('drop_hue'):
            hm = hue_mask(p['drop_hue']); other = ~hm & ~dark
            orphan = dark & ndimage.binary_dilation(hm, iterations=3) & ~ndimage.binary_dilation(other, iterations=3)
            keep &= ~hm & ~orphan
        lb, nb = ndimage.label(keep); szs = ndimage.sum(keep, lb, range(1, nb + 1))  # drop specks the split left
        keep &= np.isin(lb, [i + 1 for i, z in enumerate(szs) if z >= 40])
    ys, xs = np.where(keep)
    x0, y0, x1, y1 = xs.min(), ys.min(), xs.max() + 1, ys.max() + 1
    img = rgba[y0:y1, x0:x1].copy()
    img[..., 3] = (img[..., 3] * keep[y0:y1, x0:x1]).astype(np.uint8)
    f = img[..., :3].astype(np.float32)
    for rc in p.get('recolor', []):  # skin-coloured 'doll joint' caps -> cloth colour (in a rectangle, or the ellipse in it)
        (rx0, ry0, rx1, ry1, scol, tcol), shape = rc[:6], (rc[6] if len(rc) > 6 else 'rect')
        sub = f[max(0, ry0 - y0):max(0, ry1 - y0), max(0, rx0 - x0):max(0, rx1 - x0)]
        R, G, Bc = sub[..., 0], sub[..., 1], sub[..., 2]
        skin = (R > 140) & (R > G) & (G > Bc) & ((R - Bc) > 55)
        if shape == 'ellipse':  # only inside the ellipse inscribed in the rectangle (a dome beside leather of a similar hue)
            yy, xx = np.mgrid[max(0, ry0 - y0):max(0, ry1 - y0), max(0, rx0 - x0):max(0, rx1 - x0)].astype(np.float32)
            cx_, cy_, ax_, ay_ = (rx0 + rx1) / 2 - x0, (ry0 + ry1) / 2 - y0, (rx1 - rx0) / 2, (ry1 - ry0) / 2
            skin &= ((xx - cx_) / ax_) ** 2 + ((yy - cy_) / ay_) ** 2 <= 1.0
        lum = lambda c: 0.299 * c[..., 0] + 0.587 * c[..., 1] + 0.114 * c[..., 2]
        ls = lum(np.array(scol, np.float32)[None])[0]
        k = (lum(sub) / ls)[..., None]
        sub[skin] = np.clip(np.array(tcol, np.float32)[None] * k[skin], 0, 255)
    if p.get('skin_to'):  # match a part's skin to the body's (the hands' median skin colour), shading kept
        R, G, Bc = f[..., 0], f[..., 1], f[..., 2]
        sk = (R > 190) & (R > G + 12) & (G > Bc + 12)
        if sk.any():
            f[sk] = np.clip(f[sk] * (np.array(p['skin_to'], np.float32) / np.median(f[sk], axis=0))[None], 0, 255)
    if p.get('erase_lines'):
        # remove inner outline strokes inside rectangles (sheet px), e.g. a joint dome's rim once the dome is recoloured
        # to the boot: dark pixels at least 3 px inside the part are painted over from the colours around them
        inside = ndimage.binary_erosion(img[..., 3] > 127, iterations=3)
        hole = np.zeros(inside.shape, np.uint8)
        for (ex0, ey0, ex1, ey1) in p['erase_lines']:
            box = np.zeros(inside.shape, bool); box[max(0, ey0 - y0):max(0, ey1 - y0), max(0, ex0 - x0):max(0, ex1 - x0)] = True
            hole |= (box & inside & (f.max(axis=2) < 85)).astype(np.uint8)
        hole = ndimage.binary_dilation(hole, iterations=1).astype(np.uint8) * (inside > 0)
        f = cv2.inpaint(np.clip(f, 0, 255).astype(np.uint8), hole.astype(np.uint8), 4, cv2.INPAINT_TELEA).astype(np.float32)
    if p.get('cut_below'):  # fade the part out below a row (sheet px): [y, feather px]
        cy0, cfe = p['cut_below']
        rows = np.arange(y0, y1)[:, None].astype(np.float32)
        img[..., 3] = (img[..., 3] * np.clip((cy0 + cfe - rows) / cfe, 0, 1)).astype(np.uint8)
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
    if p.get('end_disc'):
        # a round joint end under the part (a short cap drawn on the sheet that a bent knee would open): a disc of the
        # part's own cloth (the median colour just above the joint, darker towards its rim) and outline, centred on the
        # joint pivot, added only where the part is transparent
        ed = p['end_disc']; q = piv[ed.get('pivot', 1)]; r = ed['r'] * BPX
        a = np.array(im).astype(np.float32)
        H0, W0 = a.shape[:2]; padB = max(0, int(math.ceil(q[1] + r + 2)) - H0); padS = max(0, int(math.ceil(r + 2 - min(q[0], W0 - q[0]))))
        if padB or padS:
            a2 = np.zeros((H0 + padB, W0 + 2 * padS, 4), np.float32); a2[:H0, padS:padS + W0] = a; a = a2
            piv = [(x + padS, y) for x, y in piv]; q = piv[ed.get('pivot', 1)]
        yy, xx = np.mgrid[0:a.shape[0], 0:a.shape[1]].astype(np.float32)
        dist = np.hypot(xx - q[0], yy - q[1])
        band = (a[..., 3] > 200) & (yy < q[1]) & (yy > q[1] - 0.6 * r) & (dist < r) & (a[..., :3].max(axis=2) > 40)
        col = np.median(a[band][:, :3], axis=0) if band.any() else np.array([60, 55, 58], np.float32)
        shade = (1.0 - 0.22 * np.clip(dist / r, 0, 1) ** 2)[..., None]
        disc = np.zeros_like(a); disc[..., :3] = col * shade; disc[..., 3] = np.clip(r - dist + 0.5, 0, 1) * 255
        ring = np.clip(1.0 - np.abs(dist - (r - 1.0)) / 1.0, 0, 1)
        disc[..., :3] = disc[..., :3] * (1 - ring[..., None]) + np.array([26, 22, 28], np.float32) * ring[..., None]
        top = a[..., 3:] / 255.0  # the part over its disc
        out = a.copy(); out[..., :3] = a[..., :3] * top + disc[..., :3] * (1 - top)
        out[..., 3] = 255 * (top[..., 0] + disc[..., 3] / 255 * (1 - top[..., 0]))
        im = Image.fromarray(out.clip(0, 255).astype(np.uint8))
    whole[name] = (im.copy(), piv, p.get('far'))
    trim = cfg.get('trims', {}).get(name)
    if trim:  # cut a joint end away (a skin-coloured dome that would show over the neighbouring part), top and/or bottom
        a = np.array(im).astype(np.float32)
        h = a.shape[0]; rows = np.arange(h)
        if 'top' in trim:
            t0, fe = trim['top'] * h, max(1.0, trim.get('feather', 0.02) * h)
            a[..., 3] *= np.clip((rows - t0) / fe, 0, 1)[:, None]
        if 'bottom' in trim:  # the part fades out over `bottom_feather` (fractions of the height) ending at `bottom`
            b0, fe = trim['bottom'] * h, max(1.0, trim.get('bottom_feather', 0.02) * h)
            a[..., 3] *= np.clip((b0 - rows) / fe, 0, 1)[:, None]
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
