# Helpers for the body template (template_build.py): keying a drawing off its magenta ground, splitting it into parts
# (seeded watershed on the drawn outlines plus the template's joint cuts), and turning a drawn limb into the straight strip
# the runtime bends (rows tied to the joints, the same corner model as RigCharacter.layoutLimb).
import math
import numpy as np
import cv2
from PIL import Image
from scipy import ndimage

MAGENTA = np.array([255.0, 0.0, 255.0], np.float32)


def key(path):
    """A drawing on flat magenta → (alpha 0..1, straight colours 0..1), float32."""
    src = np.array(Image.open(path).convert('RGB')).astype(np.float32)
    r, g, b = src[..., 0], src[..., 1], src[..., 2]
    alpha = np.clip(1.0 - ((np.minimum(r, b) - g) - 70.0) / 80.0, 0.0, 1.0)
    a3 = alpha[..., None]
    fg = np.where(a3 > 0.02, (src - (1 - a3) * MAGENTA) / np.maximum(a3, 0.02), 0)
    return alpha.astype(np.float32), (np.clip(fg, 0, 255) / 255.0).astype(np.float32)


def premul(alpha, fg, mask=None):
    a = alpha if mask is None else alpha * mask
    return np.dstack([fg * a[..., None], a]).astype(np.float32)


def watershed(alpha, fg, seeds, front_to_back, overrides=()):
    """Seeded watershed out to the drawn outlines; a shared dark outline goes to the part in front."""
    names = list(seeds.keys())
    markers = np.zeros(alpha.shape, np.int32)
    for i, n in enumerate(names, start=1):
        for stroke in seeds[n]:
            pts = np.array(stroke, np.int32).reshape(-1, 1, 2)
            if len(stroke) == 1: cv2.circle(markers, tuple(int(v) for v in stroke[0]), 3, i, -1)
            else: cv2.polylines(markers, [pts], False, i, thickness=3)
    inside = alpha > 0.5
    markers[~inside] = 0
    bg = len(names) + 1
    markers[ndimage.binary_erosion(~inside, iterations=3)] = bg
    img8 = (np.clip(fg * alpha[..., None], 0, 1) * 255).astype(np.uint8)
    lab = cv2.watershed(cv2.cvtColor(img8, cv2.COLOR_RGB2BGR), markers.copy())
    lab[lab == bg] = 0
    unl = (lab <= 0) & (alpha > 0.02)
    if unl.any():
        _, (iy, ix) = ndimage.distance_transform_edt(~(lab > 0), return_indices=True)
        lab = np.where(unl, lab[iy, ix], lab)
    lab[alpha <= 0.02] = 0
    idx = {n: i for i, n in enumerate(names, start=1)}
    for ov in overrides:
        m = np.zeros(lab.shape, np.uint8); cv2.fillPoly(m, [np.array(ov['poly'], np.int32)], 1)
        lab[(m > 0) & (lab > 0)] = idx[ov['part']]
    dark = (fg.max(axis=2) < 0.32) & (alpha > 0.3)
    rank = {n: k for k, n in enumerate(front_to_back)}
    for _ in range(3):
        changed = 0
        for front in front_to_back:
            near = ndimage.binary_dilation(lab == idx[front], iterations=1)
            for back in front_to_back[rank[front] + 1:]:
                move = near & (lab == idx[back]) & dark
                lab[move] = idx[front]; changed += int(move.sum())
        if not changed: break
    return {n: lab == i for n, i in idx.items()}


def side_of(shape, p, d):
    """Pixels on the side of the line through p (perpendicular to direction d) that d points to: signed distance > 0."""
    h, w = shape
    yy, xx = np.mgrid[0:h, 0:w].astype(np.float32)
    d = np.asarray(d, np.float32) / np.linalg.norm(d)
    return (xx - p[0]) * d[0] + (yy - p[1]) * d[1]


def unit(a, b):
    v = np.asarray(b, np.float64) - np.asarray(a, np.float64)
    return v / np.linalg.norm(v)


def disk(shape, c, r):
    h, w = shape
    yy, xx = np.mgrid[0:h, 0:w]
    return (xx - c[0]) ** 2 + (yy - c[1]) ** 2 <= r * r


def limb_path(J0, J1, J2, top, bottom, bend, v):
    """Points of the limb's centre line for row positions v (px from the top edge of the strip; the top joint is at
    `top`), the corner model of RigCharacter.layoutLimb: straight, a quadratic turn over the corner's tangent lengths,
    straight. Returns (points, tangents)."""
    J0, J1, J2 = (np.asarray(p, np.float64) for p in (J0, J1, J2))
    a = unit(J0, J1); b = unit(J1, J2)
    l1 = np.linalg.norm(J1 - J0)
    th = math.atan2(a[0] * b[1] - a[1] * b[0], a[0] * b[0] + a[1] * b[1])
    l2 = np.linalg.norm(J2 - J1)
    t = min(bend * math.tan(abs(th) / 2), 0.8 * l1, 0.8 * l2)
    P0, P2 = J1 - a * t, J1 + b * t
    pts = np.zeros((len(v), 2)); tan = np.zeros((len(v), 2))
    for i, vv in enumerate(v):
        s = vv - top
        if s < l1 - t: pts[i] = J0 + a * s; tan[i] = a
        elif s < l1 + t:
            q = (s - (l1 - t)) / (2 * t)
            pts[i] = (1 - q) ** 2 * P0 + 2 * (1 - q) * q * J1 + q * q * P2
            g = 2 * (1 - q) * (J1 - P0) + 2 * q * (P2 - J1); tan[i] = g / np.linalg.norm(g)
        else: pts[i] = J1 + b * (s - l1); tan[i] = b
    return pts, tan


def straighten(layer, J0, J1, J2, top, bottom, bend, width, k):
    """Sample a premultiplied RGBA layer (drawing px) into a straight strip: `k` drawing px per strip px, the strip
    `width` drawing px wide, rows from `top` above J0 to `bottom` past J2 (all drawing px). Column c maps to the point
    + perp·(c − W/2), perp = (ty, −tx) for the tangent (tx, ty), as Phaser's Rope lays its vertices."""
    l1 = np.linalg.norm(np.asarray(J1, float) - np.asarray(J0, float)); l2 = np.linalg.norm(np.asarray(J2, float) - np.asarray(J1, float))
    total = top + l1 + l2 + bottom
    H = int(round(total / k)); W = int(round(width / k))
    v = (np.arange(H) + 0.5) * k
    pts, tan = limb_path(J0, J1, J2, top, bottom, bend, v)
    u = (np.arange(W) + 0.5) * k - width / 2
    perp = np.stack([tan[:, 1], -tan[:, 0]], 1)
    mx = (pts[:, 0:1] + perp[:, 0:1] * u[None, :]).astype(np.float32)
    my = (pts[:, 1:2] + perp[:, 1:2] * u[None, :]).astype(np.float32)
    out = cv2.remap(layer, mx, my, cv2.INTER_LINEAR, borderMode=cv2.BORDER_CONSTANT, borderValue=(0, 0, 0, 0))
    rows = {'top': top / k, 'mid': (top + l1) / k, 'end': (top + l1 + l2) / k}
    return out, rows


def fill_rows(tex, r0, r1, ref):
    """Rows r0..r1 (exclusive) copied from row `ref` (a limb continuing as it is where the drawing hides it)."""
    tex[r0:r1] = tex[ref]
    return tex


def first_full_row(tex, lo, hi, frac=0.9):
    """The first row in [lo, hi) whose coverage reaches `frac` of the widest row there."""
    cov = (tex[..., 3] > 0.5).sum(1)
    ref = cov[lo:hi].max()
    for y in range(lo, hi):
        if cov[y] >= frac * ref: return y
    return lo


def last_full_row(tex, lo, hi, frac=0.9):
    cov = (tex[..., 3] > 0.5).sum(1)
    ref = cov[lo:hi].max()
    for y in range(hi - 1, lo - 1, -1):
        if cov[y] >= frac * ref: return y
    return hi - 1


def round_end(tex, row, radius, up=True):
    """Round a strip's end: beyond `row` (above it when up), keep only a half disc of `radius` around the centre line
    point at `row` (each side's own width taken into account), with a soft 1.5 px edge."""
    H, W = tex.shape[:2]
    yy, xx = np.mgrid[0:H, 0:W].astype(np.float32)
    cx = (W - 1) / 2
    d = np.sqrt((xx - cx) ** 2 + (yy - row) ** 2)
    beyond = (yy < row) if up else (yy > row)
    keep = np.clip((radius - d) / 1.5 + 0.5, 0, 1)
    f = np.where(beyond, keep, 1.0)
    return tex * f[..., None]


def feather(alpha_mask, width):
    """A soft-edged version of a boolean mask: 1 inside, falling to 0 over `width` px outside."""
    d = ndimage.distance_transform_edt(~alpha_mask)
    return np.clip(1.0 - d / max(width, 1e-6), 0.0, 1.0)


def inpaint_rgba(rgba, known, region, radius=5):
    """Fill `region` (premultiplied RGBA) from the colours of `known` pixels; filled pixels get alpha 1."""
    a = rgba[..., 3]
    col = np.where(a[..., None] > 1e-3, rgba[..., :3] / np.maximum(a[..., None], 1e-3), 0)
    img8 = (np.clip(col, 0, 1) * 255).astype(np.uint8)
    out = cv2.inpaint(img8, (~known).astype(np.uint8), radius, cv2.INPAINT_TELEA).astype(np.float32) / 255.0
    res = rgba.copy()
    sel = region & ~known
    res[sel, :3] = out[sel]; res[sel, 3] = 1.0
    return res


def to_png(rgba_premul):
    """Premultiplied float RGBA → straight RGBA uint8 Image."""
    a = rgba_premul[..., 3:4]
    rgb = np.where(a > 1e-4, rgba_premul[..., :3] / np.maximum(a, 1e-4), 0)
    return Image.fromarray((np.clip(np.dstack([rgb, a]), 0, 1) * 255).astype(np.uint8), 'RGBA')


def resize_premul(rgba, k):
    """Scale a premultiplied float RGBA image by k (area filter when shrinking)."""
    h, w = rgba.shape[:2]
    return cv2.resize(rgba, (max(1, round(w * k)), max(1, round(h * k))), interpolation=cv2.INTER_AREA if k < 1 else cv2.INTER_LINEAR)


def crop_alpha(rgba, pad=2):
    a = rgba[..., 3]
    ys, xs = np.where(a > 0.004)
    if not len(ys): return rgba[:1, :1], (0, 0)
    y0, y1 = max(0, ys.min() - pad), min(rgba.shape[0], ys.max() + 1 + pad)
    x0, x1 = max(0, xs.min() - pad), min(rgba.shape[1], xs.max() + 1 + pad)
    return rgba[y0:y1, x0:x1], (x0, y0)
