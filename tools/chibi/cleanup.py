"""Clean a native-size letter grid taken from a guide: lone stray pixels take their neighbours' tone, pin holes inside
the figure are filled, and the silhouette's rim becomes the outline. Thin details (outline, eyes, highlights) are kept."""
from collections import Counter
try:
    from .pix import Grid
except ImportError:
    from pix import Grid

KEEP = set('OEWFf')
# tones of one material (a lone tone inside its own material takes the material's local tone)
FAMILY = {}
for fam in ('LGgD', 'Yy', 'JHh', 'Ss', 'Tt', 'RBbK', 'Pp'):
    for ch in fam: FAMILY[ch] = fam
N4 = ((1, 0), (-1, 0), (0, 1), (0, -1))
N8 = N4 + ((1, 1), (1, -1), (-1, 1), (-1, -1))


def despeckle(g: Grid, rounds: int = 2) -> Grid:
    for _ in range(rounds):
        out = g.copy()
        for y in range(g.h):
            for x in range(g.w):
                ch = g.px[y][x]
                if ch == '.' or ch in KEEP: continue
                n4 = [g.get(x + dx, y + dy) for dx, dy in N4]
                if ch in n4: continue
                c = Counter(g.get(x + dx, y + dy) for dx, dy in N8)
                best, k = c.most_common(1)[0]
                if best != '.' and k >= 4: out.px[y][x] = best
        g = out
    return g


def smooth_family(g: Grid) -> Grid:
    """Within one material, a tone that is alone among its own material's neighbours takes the tone most of them have
    (the guide's soft shading left salt-and-pepper tones; this keeps the light and shadow areas whole)."""
    out = g.copy()
    for y in range(g.h):
        for x in range(g.w):
            ch = g.px[y][x]
            fam = FAMILY.get(ch)
            if not fam: continue
            same = [g.get(x + dx, y + dy) for dx, dy in N8]
            mine = [c for c in same if c in fam]
            if len(mine) < 5 or mine.count(ch) >= 2: continue
            best, k = Counter(mine).most_common(1)[0]
            if k >= 4: out.px[y][x] = best
    return out


def fill_holes(g: Grid) -> Grid:
    out = g.copy()
    for y in range(g.h):
        for x in range(g.w):
            if g.px[y][x] != '.': continue
            n4 = [g.get(x + dx, y + dy) for dx, dy in N4]
            if '.' not in n4:
                out.px[y][x] = Counter(n4).most_common(1)[0][0]
    return out


def rim(g: Grid) -> Grid:
    out = g.copy()
    for y in range(g.h):
        for x in range(g.w):
            if g.px[y][x] == '.': continue
            if any(g.get(x + dx, y + dy) == '.' for dx, dy in N4): out.px[y][x] = 'O'
    return out


def prune(g: Grid) -> Grid:
    """Outline pixels left hanging (a single outline pixel with only one opaque neighbour) go."""
    out = g.copy()
    for y in range(g.h):
        for x in range(g.w):
            if g.px[y][x] != 'O': continue
            n = sum(g.get(x + dx, y + dy) != '.' for dx, dy in N8)
            if n <= 1: out.px[y][x] = '.'
    return out


def clean(g: Grid) -> Grid:
    return prune(rim(fill_holes(smooth_family(despeckle(g)))))
