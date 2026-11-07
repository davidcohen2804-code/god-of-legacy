"""Find the figures on a guide sheet (flat light ground): their boxes, row by row, left to right.
Usage: python3 figures.py sheet.png"""
import sys
import numpy as np
from PIL import Image


def ground_colour(a):
    c = np.concatenate([a[:8, :8].reshape(-1, 3), a[:8, -8:].reshape(-1, 3), a[-8:, :8].reshape(-1, 3), a[-8:, -8:].reshape(-1, 3)])
    return np.median(c, 0)


def figure_boxes(a, min_area=1500):
    bg = ground_colour(a)
    fg = np.abs(a.astype(float) - bg).sum(2) > 40
    # label connected parts (8-neighbour) with a simple flood fill over a downscaled mask
    from collections import deque
    h, w = fg.shape
    seen = np.zeros_like(fg)
    boxes = []
    for y0 in range(0, h, 2):
        for x0 in range(0, w, 2):
            if fg[y0, x0] and not seen[y0, x0]:
                q = deque([(y0, x0)]); seen[y0, x0] = True; ys = [y0]; xs = [x0]; n = 0
                while q:
                    y, x = q.popleft(); n += 1
                    for dy in (-1, 0, 1):
                        for dx in (-1, 0, 1):
                            yy, xx = y + dy, x + dx
                            if 0 <= yy < h and 0 <= xx < w and fg[yy, xx] and not seen[yy, xx]:
                                seen[yy, xx] = True; q.append((yy, xx)); ys.append(yy); xs.append(xx)
                if n >= min_area: boxes.append((min(xs), min(ys), max(xs), max(ys), n))
    # merge boxes that overlap a lot (a figure split by a thin gap)
    merged = []
    for b in sorted(boxes, key=lambda b: -b[4]):
        for i, m in enumerate(merged):
            if b[0] < m[2] + 6 and b[2] > m[0] - 6 and b[1] < m[3] + 6 and b[3] > m[1] - 6:
                merged[i] = (min(b[0], m[0]), min(b[1], m[1]), max(b[2], m[2]), max(b[3], m[3]), m[4] + b[4]); break
        else: merged.append(b)
    # rows by the boxes' centres
    merged.sort(key=lambda b: (b[1] + b[3]) / 2)
    rows, cur = [], []
    for b in merged:
        if cur and (b[1] + b[3]) / 2 - (cur[-1][1] + cur[-1][3]) / 2 > (b[3] - b[1]) * 0.5: rows.append(cur); cur = []
        cur.append(b)
    if cur: rows.append(cur)
    return bg, [sorted(r, key=lambda b: b[0]) for r in rows]


if __name__ == '__main__':
    a = np.asarray(Image.open(sys.argv[1]).convert('RGB'))
    bg, rows = figure_boxes(a)
    print('ground', bg)
    for i, r in enumerate(rows):
        print(i, [(b[0], b[1], b[2] - b[0] + 1, b[3] - b[1] + 1) for b in r])
