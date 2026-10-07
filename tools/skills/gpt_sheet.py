# gpt_sheet.py : GPT skill art on flat magenta (#FF00FF) → game files.
#   icons <sheet.png> <cls> <id> [<id> ...]
#       a grid of framed icons (left to right, top row first; '-' skips one) →
#       public/assets/final/skills/<cls>/<id>/icon.png, 128 px, the frame's rounded corners clear
#   fx <sheet.png> <cls> <id> [cols rows width [out]]
#       an effect sheet of cols x rows frames in equal cells (default 4 x 2), each frame where GPT drew it in its cell →
#       public/assets/final/skills/<cls>/<id>/<out or vfx>.png (out = name.webp: a WebP), one row of frames `width` px wide (default 384; the height
#       follows the frames' own shape: square for 4 x 2 sheets, wide for 2 x 4 ones). Prints the frame size (the game's
#       spritesheet cell). The background is found from the sheet's border: flat magenta (#FF00FF), green (#00FF00) or black.
#   parts <sheet.png> <cls> <id> <out> <width> <x0:y0:x1:y1> ...
#       frames GPT drew across its cells: one frame per given rectangle, each centred in one frame size (same scale) →
#       public/assets/final/skills/<cls>/<id>/<out>.png
# Icons: opaque inside, only the outline is blended off the magenta (its colour taken from just inside).
# Effects are glows drawn over a flat key colour: each pixel is split into the least-opaque light that gives that colour
# over it (magenta: alpha = max(1 - r, g, 1 - b); green: alpha = max(r, 1 - g, b); black: max(r, g, b) — measured against the
# sheet's own key colour), so the glow keeps its own colour and
# fades out instead of a coloured fringe; the game draws them additively / screened.
import os, sys
import numpy as np
from PIL import Image
from scipy import ndimage

G = os.path.dirname(os.path.abspath(__file__)) + '/../../'
M = np.array([255, 0, 255], np.float32)


def magenta_bg(rgb):
    """The flat background: near-magenta pixels joined to clearly magenta ones (its soft edge too), and magenta in the
    shade of ornaments (by hue)."""
    d = np.linalg.norm(rgb - M, axis=2)
    lab, _ = ndimage.label(d < 150)
    seed = np.unique(lab[d < 60]); seed = seed[seed > 0]
    bg = np.isin(lab, seed)
    mx, mn = rgb.max(2), rgb.min(2)
    sat = np.where(mx > 0, (mx - mn) / np.maximum(mx, 1), 0)
    hue_mag = (rgb[..., 1] < rgb[..., 0] * 0.55) & (rgb[..., 1] < rgb[..., 2] * 0.55) & (np.abs(rgb[..., 0] - rgb[..., 2]) < 70)
    lab, n = ndimage.label(hue_mag & (sat > 0.4) & (mx > 30) & ~bg)
    if n:
        size = ndimage.sum(np.ones_like(lab), lab, range(1, n + 1))
        touch = set(np.unique(lab[ndimage.binary_dilation(bg)]).tolist())
        bg |= np.isin(lab, [i for i in range(1, n + 1) if size[i - 1] >= 6 or i in touch])
    return bg


def icons(sheet, cls, ids):
    rgb = np.asarray(Image.open(sheet).convert('RGB')).astype(np.float32)
    bg = magenta_bg(rgb)
    lab, n = ndimage.label(~bg)
    size = ndimage.sum(np.ones_like(lab), lab, range(1, n + 1))
    big = [i + 1 for i in range(n) if size[i] > 0.25 * size.max()]
    boxes = []
    for i in big:
        ys, xs = np.nonzero(lab == i)
        boxes.append((ys.min(), xs.min(), ys.max() + 1, xs.max() + 1, i))
    h_med = np.median([b[2] - b[0] for b in boxes])
    boxes.sort(key=lambda b: (round(((b[0] + b[2]) / 2) / (h_med * 0.8)), b[1]))   # rows top to bottom, then left to right
    if len(boxes) != len(ids): raise SystemExit(f'{len(boxes)} icons on the sheet, {len(ids)} ids given')
    for (y0, x0, y1, x1, i), iid in zip(boxes, ids):
        if iid == '-': continue
        m = ndimage.binary_fill_holes(lab[y0:y1, x0:x1] == i)
        c = rgb[y0:y1, x0:x1]
        inner = ndimage.distance_transform_edt(m) > 2.0
        _, (iy, ix) = ndimage.distance_transform_edt(~inner, return_indices=True)
        F = c[iy, ix]
        a = np.clip(np.sum((c - M) * (F - M), 2) / np.maximum(np.sum((F - M) ** 2, 2), 1), 0, 1)
        near = ndimage.distance_transform_edt(~m) <= 1.5
        alpha = np.where(inner, 1.0, np.where(m | near, a, 0.0))
        col = np.where(inner[..., None], c, F)
        h, w = m.shape; s = max(h, w)
        pm = np.zeros((s, s, 4), np.float32)                                      # square, the icon centred
        oy, ox = (s - h) // 2, (s - w) // 2
        pm[oy:oy + h, ox:ox + w, :3] = col * alpha[..., None]; pm[oy:oy + h, ox:ox + w, 3] = alpha * 255
        im = Image.fromarray(pm.round().clip(0, 255).astype(np.uint8), 'RGBA').resize((128, 128), Image.LANCZOS)  # premultiplied
        q = np.asarray(im).astype(np.float32); a2 = q[..., 3:4] / 255
        out = np.concatenate([np.where(a2 > 0, q[..., :3] / np.maximum(a2, 1e-3), 0), q[..., 3:4]], 2).round().clip(0, 255).astype(np.uint8)
        out[out[..., 3] == 0] = 0
        d = G + f'public/assets/final/skills/{cls}/{iid}/'
        os.makedirs(d, exist_ok=True)
        Image.fromarray(out, 'RGBA').save(d + 'icon.png', optimize=True)
        print('icon', cls, iid, f'{x1 - x0}x{y1 - y0}')


def key_of(rgb):
    """The sheet's flat background, as drawn: the median colour of its border (flat magenta, green or black — GPT's green is
    rarely pure, so the measured colour is the key, not the ideal one)."""
    b = np.concatenate([rgb[:4].reshape(-1, 3), rgb[-4:].reshape(-1, 3), rgb[:, :4].reshape(-1, 3), rgb[:, -4:].reshape(-1, 3)])
    return np.median(b, 0).astype(np.float32)


def key_name(K):
    return 'black' if K.max() < 0.2 else 'green' if K[1] > K[0] and K[1] > K[2] else 'magenta'


def keyed(sheet):
    """The sheet's light split off its key colour: premultiplied RGBA (0..1), and the key."""
    rgb = np.asarray(Image.open(sheet).convert('RGB')).astype(np.float32) / 255
    K = key_of(rgb)
    # the least-opaque light over the key that gives each pixel: a dark key channel counts the light above it,
    # (c - k) / (1 - k); a bright one the light below it, (k - c) / k (the other way is only noise around the key)
    up, dn = np.clip((rgb - K) / np.maximum(1 - K, 1e-3), 0, 1), np.clip((K - rgb) / np.maximum(K, 1e-3), 0, 1)
    alpha = np.max(np.where(K < 0.5, up, dn), 2)
    alpha = np.where(alpha < 0.06, 0, alpha)
    col = np.clip((rgb - (1 - alpha[..., None]) * K) / np.maximum(alpha[..., None], 1e-3), 0, 1)
    # specks: tiny islands of faint light far from the effect
    lab, n = ndimage.label(alpha > 0.08)
    if n:
        size = ndimage.sum(np.ones_like(lab), lab, range(1, n + 1))
        peak = ndimage.maximum(alpha, lab, range(1, n + 1))
        drop = np.isin(lab, [i + 1 for i in range(n) if size[i] < 12 and peak[i] < 0.5])
        alpha = np.where(drop, 0, alpha)
    return np.dstack([col * alpha[..., None], alpha]), K


def save_strip(strip, cls, iid, out_name):
    """<out>.png — or, when the name ends in .webp, a WebP (lossy, near half the size: big sheets load faster)."""
    a = strip[..., 3:4]
    out = np.concatenate([np.where(a > 0, strip[..., :3] / np.maximum(a, 1e-4), 0), a], 2)
    out = (out * 255).round().clip(0, 255).astype(np.uint8)
    out[out[..., 3] == 0] = 0
    d = G + f'public/assets/final/skills/{cls}/{iid}/'
    os.makedirs(d, exist_ok=True)
    if out_name.endswith('.webp'): Image.fromarray(out, 'RGBA').save(d + out_name, 'WEBP', quality=90, method=6, alpha_quality=95)
    else: Image.fromarray(out, 'RGBA').save(d + f'{out_name}.png', optimize=True)


def parts(sheet, cls, iid, out_name, width, rects):
    """Frames GPT drew across its cells: each given rectangle (x0:y0:x1:y1 on the sheet) is one frame, its drawing centred in a
    frame of one size for all (the same scale for all, so they keep their sizes), `width` px wide. A first argument
    align=r / align=l lines the drawings up by their right / left edges instead (a slash fading where it ended)."""
    align = 'c'
    if rects and rects[0].startswith('align='): align, rects = rects[0][6:], rects[1:]
    pm, K = keyed(sheet)
    cuts = []
    for r in rects:
        x0, y0, x1, y1 = [int(v) for v in r.split(':')]
        part = pm[y0:y1, x0:x1]
        ys, xs = np.nonzero(part[..., 3] > 0.03)
        cuts.append(part[ys.min():ys.max() + 1, xs.min():xs.max() + 1])
    fw, fh = max(c.shape[1] for c in cuts) + 12, max(c.shape[0] for c in cuts) + 12
    ow, oh = width, max(2, round(width * fh / fw))
    strip = np.zeros((oh, ow * len(cuts), 4), np.float32)
    for k, c in enumerate(cuts):
        fr = np.zeros((fh, fw, 4), np.float32)
        oy, ox = (fh - c.shape[0]) // 2, {'c': (fw - c.shape[1]) // 2, 'r': fw - 6 - c.shape[1], 'l': 6}[align]
        fr[oy:oy + c.shape[0], ox:ox + c.shape[1]] = c
        im = Image.fromarray((fr * 255).round().clip(0, 255).astype(np.uint8), 'RGBA').resize((ow, oh), Image.LANCZOS)
        strip[:, k * ow:(k + 1) * ow] = np.asarray(im).astype(np.float32) / 255
    save_strip(strip, cls, iid, out_name)
    print('parts', cls, iid, out_name, f'{len(cuts)} frames of {ow}x{oh}', f'| key {key_name(K)}')


def fx(sheet, cls, iid, cols=4, rows=2, cell=384, out_name='vfx'):
    pm, K = keyed(sheet)
    alpha = pm[..., 3]
    H, W = alpha.shape
    cw, ch = W / cols, H / rows
    # GPT rarely keeps a frame inside its cell: find each frame (runs of lit columns in its row, nearby bits joined) and
    # cut a window around its cell's centre big enough for every frame, other frames masked out — so the frames keep
    # where GPT drew them relative to their cells (the motion), whole.
    owner = np.full((H, W), -1, np.int32)
    lo, hi = np.zeros(cols * rows), np.zeros(cols * rows)      # each frame's reach from its cell centre (x), (y)
    reach = []
    for r_ in range(rows):
        y0, y1 = round(r_ * ch), round((r_ + 1) * ch)
        lit = (alpha[y0:y1] > 0.12).any(0)
        runs, on = [], False
        for x in range(W + 1):
            v = x < W and lit[x]
            if v and not on: on, s0 = True, x
            if not v and on: on = False; runs.append([s0, x])
        joined = []
        for a, b in runs:
            if joined and a - joined[-1][1] < 25: joined[-1][1] = b
            else: joined.append([a, b])
        while len(joined) > cols:                                   # a stray bit: joined to its nearer neighbour
            i = int(np.argmin([b - a for a, b in joined]))
            j = i - 1 if i == len(joined) - 1 or (i > 0 and joined[i][0] - joined[i - 1][1] < joined[i + 1][0] - joined[i][1]) else i + 1
            joined[j] = [min(joined[i][0], joined[j][0]), max(joined[i][1], joined[j][1])]; joined.pop(i)
        if len(joined) < cols: joined = [[round(c_ * cw), round((c_ + 1) * cw)] for c_ in range(cols)]   # touching: the grid
        for c_, (a, b) in enumerate(joined):
            k = r_ * cols + c_
            owner[y0:y1, a:b] = k
            cx, cy = (c_ + 0.5) * cw, (r_ + 0.5) * ch
            ys = np.nonzero((alpha[y0:y1, a:b] > 0.03).any(1))[0]
            reach.append((max(cx - a, b - cx), max(cy - (y0 + (ys.min() if len(ys) else 0)), (y0 + (ys.max() if len(ys) else 0)) - cy)))
    hx = int(max(r[0] for r in reach) + 6); hy = int(max(r[1] for r in reach) + 6)
    if cw <= ch * 1.5: hx = hy = max(hx, hy)                  # square-ish cells: square frames (they may rotate in the game)
    ow, oh = cell, max(2, round(cell * hy / hx))
    P_ = max(hx, hy)
    padded = np.zeros((H + 2 * P_, W + 2 * P_, 4), np.float32); padded[P_:-P_, P_:-P_] = pm
    own = np.full((H + 2 * P_, W + 2 * P_), -1, np.int32); own[P_:-P_, P_:-P_] = owner
    strip = np.zeros((oh, ow * cols * rows, 4), np.float32)
    worst = 0.0
    for k in range(cols * rows):
        r_, c_ = divmod(k, cols)
        cx, cy = round((c_ + 0.5) * cw) + P_, round((r_ + 0.5) * ch) + P_
        part = padded[cy - hy:cy + hy, cx - hx:cx + hx] * (own[cy - hy:cy + hy, cx - hx:cx + hx] == k)[..., None]
        edge = max(part[:2, :, 3].max(), part[-2:, :, 3].max(), part[:, :2, 3].max(), part[:, -2:, 3].max())
        worst = max(worst, edge)
        im = Image.fromarray((part * 255).round().clip(0, 255).astype(np.uint8), 'RGBA').resize((ow, oh), Image.LANCZOS)
        strip[:, k * ow:(k + 1) * ow] = np.asarray(im).astype(np.float32) / 255
    save_strip(strip, cls, iid, out_name)
    print('fx', cls, iid, out_name, f'{cols * rows} frames of {ow}x{oh}', f'| key {key_name(K)} {np.round(K, 2).tolist()}', f'| window {2 * hx}x{2 * hy} on GPT cells of {cw:.0f}x{ch:.0f}',
          '| strongest light on a window edge', round(float(worst), 2))


if __name__ == '__main__':
    cmd, args = sys.argv[1], sys.argv[2:]
    if cmd == 'icons': icons(args[0], args[1], args[2:])
    elif cmd == 'fx': fx(args[0], args[1], args[2], *[int(v) for v in args[3:6]], *(args[6:7]))
    elif cmd == 'parts': parts(args[0], args[1], args[2], args[3], int(args[4]), args[5:])
    else: raise SystemExit(__doc__)
