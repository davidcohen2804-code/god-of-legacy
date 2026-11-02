# The grip of a weapon drawn on its own (flat, the hilt or the foot to the left, the blade or the head to the right):
# where the fist closes on it and how thick the handle is drawn there, found from the drawing's width along its length.
import numpy as np


def find_grip(alpha):
    """Returns (grip [x, y], handle thickness px, kind, axis [dx, dy]) for the opaque shape in `alpha`."""
    m = alpha > 0.5
    ys, xs = np.where(m)
    pts = np.stack([xs, ys], 1).astype(np.float64)
    c = pts.mean(0)
    _, _, vt = np.linalg.svd(pts - c, full_matrices=False)
    ax = vt[0] if vt[0][0] >= 0 else -vt[0]          # along the weapon, toward the right (the blade or the head)
    nrm = np.array([-ax[1], ax[0]])
    t = (pts - c) @ ax; w = (pts - c) @ nrm
    t0 = np.floor(t.min()); n = int(np.ceil(t.max()) - t0) + 1
    i = (t - t0).astype(int)
    lo = np.full(n, np.inf); hi = np.full(n, -np.inf)
    np.minimum.at(lo, i, w); np.maximum.at(hi, i, w)
    ok = np.isfinite(lo)
    width = np.zeros(n); width[ok] = hi[ok] - lo[ok] + 1
    mid = np.zeros(n); mid[ok] = (hi[ok] + lo[ok]) / 2
    sm = np.convolve(width, np.ones(5) / 5, mode='same')
    L = n
    left = sm[: int(L * 0.45)]
    narrow = np.percentile(left[left > 0], 10) if (left > 0).any() else 0
    g = int(np.argmax(left)) if len(left) else 0
    if len(left) and left[g] >= 2.2 * narrow and g > 0.08 * L:
        # a hilt with a guard: the handle is the narrow run just left of the guard
        k = g
        while k > 0 and sm[k] > 1.3 * narrow: k -= 1      # the guard's left edge
        end = k; k = end
        while k > 0 and sm[k] <= 1.3 * narrow: k -= 1     # the handle runs left to the pommel
        start = k + 1
        kind = 'hilt'
    else:
        # a pole: the hand takes it a little under a third of the way up
        start, end = int(L * 0.22), int(L * 0.38)
        kind = 'pole'
    seg = slice(start, end + 1)
    tc = (start + end) / 2
    thick = float(np.median(width[seg][width[seg] > 0]))
    wc = float(np.median(mid[seg]))
    grip = c + (t0 + tc) * ax + wc * nrm
    return [round(float(grip[0]), 1), round(float(grip[1]), 1)], round(thick, 1), kind, [round(float(ax[0]), 4), round(float(ax[1]), 4)]


if __name__ == '__main__':
    import sys
    from keying import key
    for p in sys.argv[1:]:
        a, _ = key(p)
        print(p, find_grip(a))
