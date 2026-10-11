import numpy as np
def head_w(m, thr=45, band=70):
    """m: bool mask. Head top = first row at least `thr` px wide (a raised arm / sword is thinner); head width = widest row in `band` rows below."""
    w = m.sum(1); rows = np.where(w >= thr)[0]
    if not len(rows): return None
    t = rows[0]; seg = m[t:t + band]
    widths = []
    for r in seg:  # width of the longest run (not bbox: a hand beside the head must not count)
        xs = np.where(r)[0]
        if not len(xs): widths.append(0); continue
        runs = np.split(xs, np.where(np.diff(xs) > 1)[0] + 1); widths.append(max(len(q) for q in runs))
    return int(np.max(widths)), int(t)
