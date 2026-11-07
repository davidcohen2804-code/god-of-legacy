"""Guide sheet → native-size letter grids, one per figure: each full-size pixel named by its nearest palette tone (the
flat ground → empty), then each native pixel takes its block's majority (thin lines win at a lower share); the phase
that gives the purest blocks wins. The pitch is the sheet's figure height over the wanted native height.
Usage: python3 native.py sheet.png out_dir prefix native_height [row,col ...]"""
import os, sys
import numpy as np
from PIL import Image
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from palette import RGB
from clean import lab
from figures import figure_boxes

KEYS = list(RGB) + ['.']
EMPTY = len(KEYS) - 1
P = np.array([RGB[k] for k in RGB], float)
PL = lab(P)
THIN = {'O': 0.30, 'E': 0.25, 'W': 0.20, 'Y': 0.35, 'F': 0.35}


def name_pixels(a, bg):
    d = ((lab(a)[:, :, None, :] - PL[None, None]) ** 2).sum(-1)
    idx = d.argmin(-1)
    ground = np.abs(a.astype(float) - bg).sum(2) < 34
    idx[ground] = EMPTY
    return idx


def vote(idx, p, ox, oy):
    h, w = idx.shape
    nw, nh = int((w - ox) / p), int((h - oy) / p)
    out = np.full((nh, nw), EMPTY); pur = []
    thin = [(KEYS.index(k), t) for k, t in THIN.items()]
    for by in range(nh):
        y0, y1 = int(round(oy + by * p)), int(round(oy + (by + 1) * p))
        for bx in range(nw):
            x0, x1 = int(round(ox + bx * p)), int(round(ox + (bx + 1) * p))
            blk = idx[y0:y1, x0:x1].ravel()
            if not len(blk): continue
            cnt = np.bincount(blk, minlength=len(KEYS)); n = len(blk)
            best = int(cnt.argmax()); share = cnt[best] / n
            if best == EMPTY and share < 0.6:  # a figure's rim: the figure wins a half-empty block
                cnt2 = cnt.copy(); cnt2[EMPTY] = 0; best = int(cnt2.argmax()); share = cnt2[best] / n
            for ki, t in thin:
                if cnt[ki] / n >= t and ki != best and KEYS[best] not in THIN and best != EMPTY: best, share = ki, cnt[ki] / n
            out[by, bx] = best; pur.append(share)
    return out, float(np.mean(pur))


def to_native(a, bg, box, p, steps=4):
    x0, y0, x1, y1 = box[:4]
    m = int(p * 2)
    crop = a[max(0, y0 - m):y1 + m, max(0, x0 - m):x1 + m]
    idx = name_pixels(crop, bg)
    best = None
    for ox in np.arange(0, p, p / steps):
        for oy in np.arange(0, p, p / steps):
            o, pur = vote(idx, p, ox, oy)
            if best is None or pur > best[0]: best = (pur, o)
    rows = [''.join(KEYS[v] for v in row) for row in best[1]]
    ys = [i for i, r in enumerate(rows) if r.strip('.')]
    xs = [i for r in rows for i, ch in enumerate(r) if ch != '.']
    return [r[min(xs):max(xs) + 1] for r in rows[min(ys):max(ys) + 1]], best[0]


if __name__ == '__main__':
    a = np.asarray(Image.open(sys.argv[1]).convert('RGB'))
    out, prefix, H = sys.argv[2], sys.argv[3], int(sys.argv[4])
    os.makedirs(out, exist_ok=True)
    bg, rows = figure_boxes(a)
    want = {tuple(map(int, s.split(','))) for s in sys.argv[5:]} or None
    ref_h = np.median([b[3] - b[1] + 1 for b in rows[0]])
    p = float(os.environ['PITCH']) if os.environ.get('PITCH') else ref_h / H  # PITCH: match another sheet's scale (by the hood's width)
    print('pitch %.3f' % p)
    for r, row in enumerate(rows):
        for c, box in enumerate(row):
            if want and (r, c) not in want: continue
            g, pur = to_native(a, bg, box, p)
            open(f'{out}/{prefix}_r{r}c{c}.txt', 'w').write('\n'.join(g) + '\n')
            print(r, c, len(g[0]), 'x', len(g), 'purity %.3f' % pur)
