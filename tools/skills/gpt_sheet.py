# gpt_sheet.py : GPT skill art on flat magenta (#FF00FF) → game files.
#   icons <sheet.png> <cls> <id> [<id> ...]
#       a grid of framed icons (left to right, top row first; '-' skips one) →
#       public/assets/final/skills/<cls>/<id>/icon.png, 128 px, the frame's rounded corners clear
#   fx <sheet.png> <cls> <id> [cols rows cell]
#       an effect sheet of cols x rows frames in equal cells (default 4 x 2), each frame where GPT drew it in its cell →
#       public/assets/final/skills/<cls>/<id>/vfx.png, one row of frames of cell x cell px (default 384)
# Icons: opaque inside, only the outline is blended off the magenta (its colour taken from just inside).
# Effects are glows drawn over magenta: each pixel is split into the least-opaque light that gives that colour over
# magenta (alpha = max(1 - r, g, 1 - b)), so the glow keeps its own colour and fades out instead of a pink fringe;
# the game draws them additively.
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


def fx(sheet, cls, iid, cols=4, rows=2, cell=384):
    rgb = np.asarray(Image.open(sheet).convert('RGB')).astype(np.float32) / 255
    H, W = rgb.shape[:2]
    alpha = np.max(np.stack([1 - rgb[..., 0], rgb[..., 1], 1 - rgb[..., 2]]), 0)    # the least-opaque light over magenta
    alpha = np.where(alpha < 0.045, 0, alpha)
    col = np.clip((rgb - (1 - alpha[..., None]) * (M / 255)) / np.maximum(alpha[..., None], 1e-3), 0, 1)
    # specks: tiny islands of faint light far from the effect
    lab, n = ndimage.label(alpha > 0.08)
    if n:
        size = ndimage.sum(np.ones_like(lab), lab, range(1, n + 1))
        peak = ndimage.maximum(alpha, lab, range(1, n + 1))
        drop = np.isin(lab, [i + 1 for i in range(n) if size[i] < 12 and peak[i] < 0.5])
        alpha = np.where(drop, 0, alpha)
    pm = np.dstack([col * alpha[..., None], alpha])                                  # premultiplied, 0..1
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
            reach.append(max(cx - a, b - cx, cy - (y0 + (ys.min() if len(ys) else 0)), (y0 + (ys.max() if len(ys) else 0)) - cy))
    half = int(max(reach) + 6)
    padded = np.zeros((H + 2 * half, W + 2 * half, 4), np.float32); padded[half:-half, half:-half] = pm
    own = np.full((H + 2 * half, W + 2 * half), -1, np.int32); own[half:-half, half:-half] = owner
    strip = np.zeros((cell, cell * cols * rows, 4), np.float32)
    worst = 0.0
    for k in range(cols * rows):
        r_, c_ = divmod(k, cols)
        cx, cy = round((c_ + 0.5) * cw) + half, round((r_ + 0.5) * ch) + half
        part = padded[cy - half:cy + half, cx - half:cx + half] * (own[cy - half:cy + half, cx - half:cx + half] == k)[..., None]
        edge = max(part[:2, :, 3].max(), part[-2:, :, 3].max(), part[:, :2, 3].max(), part[:, -2:, 3].max())
        worst = max(worst, edge)
        im = Image.fromarray((part * 255).round().clip(0, 255).astype(np.uint8), 'RGBA').resize((cell, cell), Image.LANCZOS)
        strip[:, k * cell:(k + 1) * cell] = np.asarray(im).astype(np.float32) / 255
    a = strip[..., 3:4]
    out = np.concatenate([np.where(a > 0, strip[..., :3] / np.maximum(a, 1e-4), 0), a], 2)
    out = (out * 255).round().clip(0, 255).astype(np.uint8)
    out[out[..., 3] == 0] = 0
    d = G + f'public/assets/final/skills/{cls}/{iid}/'
    os.makedirs(d, exist_ok=True)
    Image.fromarray(out, 'RGBA').save(d + 'vfx.png', optimize=True)
    print('fx', cls, iid, f'{cols * rows} frames of {cell}px', f'| window {2 * half}px on GPT cells of {cw:.0f}x{ch:.0f}',
          '| strongest light on a window edge', round(float(worst), 2))


if __name__ == '__main__':
    cmd, args = sys.argv[1], sys.argv[2:]
    if cmd == 'icons': icons(args[0], args[1], args[2:])
    elif cmd == 'fx': fx(args[0], args[1], args[2], *[int(v) for v in args[3:6]])
    else: raise SystemExit(__doc__)
