# eye_colors.py : eye colours for the base character (male / female, every face): the iris re-coloured with its light and
#   shade kept — the darkest lines (lashes, pupil), the white of the eye, the highlights and the skin stay as drawn →
#   public/assets/characters/base/eyes/<G>_<face>_c<n>.png   menus: the wide canvas, laid over the face
#   public/assets/final/body/naked/<g>/eyes/f<face>c<n>.png   the game: the idle cell, moved with the head like a face layer
#   src/data/eye-colors.json                                   the colours (name, swatch); colour 0 = as drawn (no layer)
# The iris is found on the menu pictures (the biggest iris-coloured blob beside the white of each eye, as a convex shape);
# the game's cell is the same head smaller: the menu → cell mapping is fitted on the face layers (faces 1-3), and the
# colour is worked out on the game's own pixels. Run after tools/base/naked_frames.py (it remakes the faces).
# python3 tools/base/eye_colors.py
import json, os
import numpy as np, cv2
from PIL import Image
from scipy import ndimage, optimize

H = os.path.dirname(os.path.abspath(__file__)); G = H + '/../../'
MENU = G + 'public/assets/characters/base/'
GAME = G + 'public/assets/final/body/naked/'
S = 352
# name, LAB hue of the new colour (deg; the drawn iris sits near 40), chroma gain, lightness gain
COLORS = [('brown', None, 1, 1), ('blue', 262, 1.15, 1.3), ('green', 140, 1.0, 1.25), ('violet', 315, 1.05, 1.25), ('red', 28, 1.35, 1.1)]
EYES = {'male': dict(band=(125, 200, 150, 262), split=225), 'female': dict(band=(150, 225, 225, 360), split=315)}  # (y0, y1, x0, x1), near | far eye


def lab_of(rgb):
    l = cv2.cvtColor(np.clip(rgb, 0, 255).astype(np.uint8), cv2.COLOR_RGB2LAB).astype(np.float32)
    return l[..., 0] * 100 / 255, l[..., 1] - 128, l[..., 2] - 128


def recolor(rgb, hue, gain, light):
    """The iris colour turned to `hue` (its gradient kept: the chroma vector rotated and scaled), lightness scaled."""
    L, A, B = lab_of(rgb)
    t = np.radians(hue - 40)
    A2 = (A * np.cos(t) - B * np.sin(t)) * gain; B2 = (A * np.sin(t) + B * np.cos(t)) * gain
    lab = np.dstack([np.clip(L * light, 0, 100) * 255 / 100, A2 + 128, B2 + 128]).clip(0, 255).astype(np.uint8)
    return cv2.cvtColor(lab, cv2.COLOR_LAB2RGB).astype(np.float32)


def weight(rgb):
    """How much of a pixel is iris colour: not the darkest lines, not the light skin / white, not grey."""
    L, A, B = lab_of(rgb); C = np.hypot(A, B)
    return np.clip((L - 6) / 6, 0, 1) * np.clip((72 - L) / 10, 0, 1) * np.clip((C - 6) / 8, 0, 1)


def iris_of(rgba, band, split):
    """The irises (near eye, far eye) on a menu picture: per eye the biggest iris-coloured blob beside the white of the
    eye, filled as a convex shape; off the head's outline."""
    rgb, al = rgba[..., :3].astype(np.float32), rgba[..., 3] / 255
    L, A, B = lab_of(rgb); C = np.hypot(A, B); hue = np.degrees(np.arctan2(B, A)) % 360
    y0, y1, x0, x1 = band
    zone = np.zeros(L.shape, bool); zone[y0:y1, x0:x1] = True
    white = zone & (L > 88) & (C < 14) & (al > 0.9)
    lab, n = ndimage.label(white); size = ndimage.sum(np.ones_like(lab), lab, range(1, n + 1))
    white = np.isin(lab, [i + 1 for i in range(n) if size[i] >= 6])
    inside = ndimage.distance_transform_edt(al > 0.5) > 4.5
    core = zone & inside & (L > 10) & (L < 70) & (C > 18) & ((hue < 75) | (hue > 340))
    core = cv2.morphologyEx(core.astype(np.uint8), cv2.MORPH_OPEN, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (3, 3))) > 0
    lab, _ = ndimage.label(core)
    near = ndimage.binary_dilation(white, iterations=4)
    xs = np.arange(L.shape[1])[None, :].repeat(L.shape[0], 0)
    iris = np.zeros(L.shape, bool)
    for side in (xs < split, xs >= split):
        ids = sorted(set(np.unique(lab[near & core & side]).tolist()) - {0})
        if not ids: raise SystemExit('no iris found')
        blob = (lab == max(ids, key=lambda i: int((lab == i).sum()))).astype(np.uint8)
        hm = np.zeros(L.shape, np.uint8); cv2.fillConvexPoly(hm, cv2.convexHull(cv2.findNonZero(blob)), 1)
        iris |= ndimage.binary_dilation(hm > 0, iterations=1)
    return (iris & inside).astype(np.float32)


def over(top, bot):
    ta, ba = top[..., 3:4] / 255, bot[..., 3:4] / 255; oa = ta + ba * (1 - ta)
    oc = np.where(oa > 1e-4, (top[..., :3] * ta + bot[..., :3] * ba * (1 - ta)) / np.maximum(oa, 1e-4), 0)
    return np.concatenate([oc, oa * 255], -1)


def fit_cell(g, Gn):
    """The menu → game cell mapping (x' = ax·x + bx, y' = ay·y + by), fitted on the face layers."""
    sig = lambda a: np.dstack([a[..., 3], (a[..., :3] @ np.array([.3, .59, .11], np.float32)) * a[..., 3]])
    pairs, n = [], 1
    while os.path.exists(f'{MENU}face/{Gn}_{n}.png'):
        m = np.array(Image.open(f'{MENU}face/{Gn}_{n}.png').convert('RGBA')).astype(np.float32) / 255
        q = np.array(Image.open(f'{GAME}{g}/face/f{n}.png').convert('RGBA')).astype(np.float32) / 255
        pairs.append((cv2.GaussianBlur(sig(m), (0, 0), 1.4), sig(q))); n += 1
    m1 = np.array(Image.open(f'{MENU}face/{Gn}_1.png'))[..., 3]; q1 = np.array(Image.open(f'{GAME}{g}/face/f1.png'))[..., 3]
    ym, xm = np.nonzero(m1 > 128); yq, xq = np.nonzero(q1 > 128)
    ax, ay = np.ptp(xq) / np.ptp(xm), np.ptp(yq) / np.ptp(ym)
    def cost(p):
        A = np.float32([[p[0], 0, p[1]], [0, p[2], p[3]]])
        return sum(float(((cv2.warpAffine(m, A, (S, S)) - q) ** 2).sum()) for m, q in pairs)
    r = optimize.minimize(cost, [ax, xq.min() - xm.min() * ax, ay, yq.min() - ym.min() * ay], method='Nelder-Mead',
                          options={'xatol': 1e-4, 'fatol': 1e-6, 'maxiter': 4000})
    return np.float32([[r.x[0], 0, r.x[1]], [0, r.x[2], r.x[3]]])


def save(rgb, a, path):
    px = np.dstack([rgb, a * 255]).round().clip(0, 255).astype(np.uint8)
    px[px[..., 3] == 0] = 0                                       # nothing kept where it is clear (a small file)
    Image.fromarray(px, 'RGBA').save(path, optimize=True)


swatch = {}
for g, Gn in (('male', 'Male'), ('female', 'Female')):
    A = fit_cell(g, Gn)
    base = np.array(Image.open(f'{MENU}Base_{Gn}_wide.png').convert('RGBA')).astype(np.float32)
    idle = np.array(Image.open(f'{GAME}{g}/idle.png').convert('RGBA')).astype(np.float32)[:, :S]   # the standing head (cell 0)
    os.makedirs(f'{MENU}eyes', exist_ok=True); os.makedirs(f'{GAME}{g}/eyes', exist_ok=True)
    for old in [f'{MENU}eyes/{f}' for f in os.listdir(f'{MENU}eyes') if f.startswith(Gn + '_')] + [f'{GAME}{g}/eyes/{f}' for f in os.listdir(f'{GAME}{g}/eyes')]:
        os.remove(old)
    face, nf = 0, 1
    while os.path.exists(f'{MENU}face/{Gn}_{nf}.png'): nf += 1
    for face in range(nf):
        menu = base if face == 0 else over(np.array(Image.open(f'{MENU}face/{Gn}_{face}.png').convert('RGBA')).astype(np.float32), base)
        cell = idle if face == 0 else over(np.array(Image.open(f'{GAME}{g}/face/f{face}.png').convert('RGBA')).astype(np.float32), idle)
        m = cv2.GaussianBlur(iris_of(menu, **EYES[g]), (0, 0), 0.8)
        mg = cv2.warpAffine(cv2.GaussianBlur(m, (0, 0), 1.5), A, (S, S))                # the same irises on the cell
        wm, wg = m * weight(menu[..., :3]), np.clip(mg * 1.15, 0, 1) * weight(cell[..., :3])
        for c, (name, hue, gain, light) in enumerate(COLORS):
            if c == 0: continue
            rm = recolor(menu[..., :3], hue, gain, light)
            save(rm, wm, f'{MENU}eyes/{Gn}_{face}_c{c}.png')
            save(recolor(cell[..., :3], hue, gain, light), wg, f'{GAME}{g}/eyes/f{face}c{c}.png')
            if g == 'male' and face == 0:                        # the swatch: the iris's middle tones in that colour
                sel = (wm > 0.8) & (lab_of(menu[..., :3])[0] > 22) & (lab_of(menu[..., :3])[0] < 55)
                swatch[c] = '#%02x%02x%02x' % tuple(int(v) for v in np.median(rm[sel], 0))
        if g == 'male' and face == 0:
            sel = (wm > 0.8) & (lab_of(menu[..., :3])[0] > 22) & (lab_of(menu[..., :3])[0] < 55)
            swatch[0] = '#%02x%02x%02x' % tuple(int(v) for v in np.median(menu[..., :3][sel], 0))
    print(g, 'faces', nf, '| cell mapping', np.round(A, 4).tolist())
json.dump([{'name': n, 'swatch': swatch[i]} for i, (n, *_) in enumerate(COLORS)], open(G + 'src/data/eye-colors.json', 'w'), indent=1)
print('eye colours', [(n, swatch[i]) for i, (n, *_) in enumerate(COLORS)])
