"""Cash shop items with their own silhouette, made per frame from the items they are cut from (GPT 8 Nov, the order:
the sandals, the skirt-pants, the petal cape, the blouse, the onepiece). Each frame gets the variant's layers beside the
ones it comes from, so it moves exactly as they do:
- sandals: the base's foot wraps (letters U/u) become a sole, the toes, a strap and an ankle tie (the open foot);
- petalcape: the cape's layers, its hem cut into petals (lobes, a notch between them);
- blouse: the tunic's layers, the hem's corners rounded.
The skirt (Ribbon Skirt-Pants) and the Ranger's pouches are drawings laid at the hips like the head's (looks_R)."""
import os, sys
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE); sys.path.insert(0, os.path.join(HERE, '..', '..'))
from pix import Grid

FOOT = set('Uu')
SANDAL = {0: 'Q', 1: 'S', 2: 'V', 3: 'v'}                 # from the sole up: the sole, the toes, the strap, the ankle tie


def _down(T):
    """The master's 'down' in the frame (a turned frame lies on its side)."""
    return (T[1], T[4])


def sandals(L: Grid, T) -> Grid:
    """The open foot: the wraps' pixels from the sole up — the sole (dark), the toes (skin), a strap across the foot,
    skin, and an ankle tie on the wraps' top row."""
    dx, dy = _down(T)
    out = Grid(L.w, L.h)
    run = lambda x, y, sx, sy: next((k for k in range(8) if not (0 <= x + (k + 1) * sx < L.w and 0 <= y + (k + 1) * sy < L.h and L.px[y + (k + 1) * sy][x + (k + 1) * sx] in FOOT)), 8)
    for y in range(L.h):
        for x in range(L.w):
            if L.px[y][x] not in FOOT: continue
            below, above = run(x, y, dx, dy), run(x, y, -dx, -dy)
            if below == 0: ch = 'Q'                                  # the sole
            elif above == 0: ch = 'v'                                # the ankle tie
            elif below == 2: ch = 'V' if L.px[y][x] == 'U' else 'v'  # the strap across the foot
            else: ch = 'S' if L.px[y][x] == 'U' else 's'             # the skin between
            out.px[y][x] = ch
    return out


def petal_hem(L: Grid, T, period=5, depth=(3, 1, 0, 0, 1)) -> Grid:
    """The cape's hem in petals: per column, the lowest pixels cut back by the pattern (lobes with a notch between)."""
    dx, dy = _down(T)
    out = L.copy()
    if (dx, dy) == (0, 1):
        cols = {}
        for y in range(L.h):
            for x in range(L.w):
                if L.px[y][x] != '.': cols[x] = y
        for x, yb in cols.items():
            d = depth[x % period]
            for y in range(yb - d + 1, yb + 1): out.px[y][x] = '.'
            if d and yb - d >= 0 and out.px[yb - d][x] != '.': out.px[yb - d][x] = 'O'
    else:                                                       # (lying: the hem runs along x)
        rows = {}
        for y in range(L.h):
            for x in range(L.w):
                if L.px[y][x] != '.': rows[y] = max(rows.get(y, -1), x) if dx > 0 else min(rows.get(y, 10 ** 6), x)
        for y, xb in rows.items():
            d = depth[y % period]
            for k in range(d): out.px[y][xb - k * dx] = '.'
            if d and out.px[y][xb - d * dx] != '.': out.px[y][xb - d * dx] = 'O'
    return out


def rounded_hem(L: Grid, T) -> Grid:
    """The blouse: the tunic's hem corners rounded (the lowest row loses its two end pixels, the row above its last);
    the outline left hanging under the cut goes (the game closes the new edge)."""
    dx, dy = _down(T)
    out = L.copy()
    if (dx, dy) != (0, 1): return out
    ys = [y for y in range(L.h) for x in range(L.w) if L.px[y][x] not in '.O']
    if not ys: return out
    yb = max(ys)
    cut = []
    for y, n in ((yb, 2), (yb - 1, 1)):
        xs = [x for x in range(L.w) if L.px[y][x] not in '.O']
        if len(xs) < 8: continue
        cut += [(x, y) for x in xs[:n] + xs[-n:]]
    for (x, y) in cut: out.px[y][x] = '.'
    for x in range(L.w):                                        # a light trim along the hem's last row
        if out.px[yb][x] not in '.O': out.px[yb][x] = 'W'
    for (x, y) in cut:                                          # the outline around the cut that touches no cloth now
        for qx in range(x - 1, x + 2):
            for qy in range(y - 1, y + 2):
                if out.get(qx, qy) == 'O' and not any(out.get(qx + a, qy + b) not in '.O' for a, b in ((1, 0), (-1, 0), (0, 1), (0, -1))):
                    out.px[qy][qx] = '.'
    return out


def add_variants(f, head_T):
    """Inserts the variants' layers beside their sources in one frame."""
    T = head_T(f)
    new = []
    for key, L in f.layers:
        new.append((key, L))
        if L is None: continue
        it, _, part = key.partition('.')
        if it == 'base' and any(ch in FOOT for row in L.px for ch in row):
            new.append(('sandals' + ('.' + part if part else ''), sandals(L, T)))
        elif it == 'cape':
            new.append(('petalcape' + ('.' + part if part else ''), petal_hem(L, T) if part == 'back' else L.copy()))
        elif it == 'tunic':
            new.append(('blouse' + ('.' + part if part else ''), rounded_hem(L, T) if part in ('', 'torso') else L.copy()))
    f.layers = new
