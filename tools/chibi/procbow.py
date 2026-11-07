"""The bow as its own layer, drawn from a few numbers so any frame (and any bow) gets it the same way:
grip point, half length, bend, tilt, the string's pull point and whether an arrow is nocked. A right-facing bow is a
')' — the grip at the front, the tips curving back toward the archer; the string joins the tips (or runs to the pull
point). Colours come from a style (light / base / dark wood, string, arrow) so another bow is another style."""
import math
try:
    from .pix import Grid, edge
except ImportError:
    from pix import Grid, edge

WOOD = {'light': 'R', 'base': 'B', 'dark': 'b', 'string': 'F', 'shaft': 'B', 'head': 'f', 'fletch': 'F'}


def _rot(x, y, cx, cy, a):
    c, s = math.cos(a), math.sin(a)
    return cx + (x - cx) * c - (y - cy) * s, cy + (x - cx) * s + (y - cy) * c


def _spline(pts, n=14):
    """Catmull-Rom through the points (n samples per segment)."""
    P = [pts[0]] + list(pts) + [pts[-1]]
    out = []
    for i in range(1, len(P) - 2):
        p0, p1, p2, p3 = P[i - 1], P[i], P[i + 1], P[i + 2]
        for k in range(n):
            t = k / n; t2, t3 = t * t, t * t * t
            out.append(tuple(0.5 * (2 * p1[j] + (p2[j] - p0[j]) * t + (2 * p0[j] - 5 * p1[j] + 4 * p2[j] - p3[j]) * t2
                                    + (3 * p1[j] - p0[j] - 3 * p2[j] + p3[j]) * t3) for j in (0, 1)))
    out.append(tuple(pts[-1]))
    return out


def path_bow(w, h, gx, gy, limb, string=None, rot=0.0, style=WOOD, outline=True):
    """A bow drawn along a path instead of a formula — for a carry whose look is set by a drawing (the approved
    reference), not by bow physics. limb: [(dx, dy), …] from inside the fist (the grip) to the tip, character px
    (+x the facing side, +y down); string: ((dx, dy), (dx, dy)) its run, drawn under the limb; rot: radians about the
    grip (+ turns the top toward the facing side) — the bow turns with the hand, never on its own.
    The limb is two pixels wide (the outer pixel light), a pixel at the tip, outlined; another bow = another style."""
    g = Grid(w, h)
    R = lambda p: _rot(gx + p[0], gy + p[1], gx, gy, rot)
    s = _spline([R(p) for p in limb])
    body, lite = set(), set()
    for i, (x, y) in enumerate(s):
        a, b = s[max(i - 1, 0)], s[min(i + 1, len(s) - 1)]
        tx, ty = b[0] - a[0], b[1] - a[1]; L = math.hypot(tx, ty) or 1.0
        nx, ny = -ty / L, tx / L                     # the outer side (the bow's back, away from the string)
        if i > len(s) * 0.88:
            body.add((int(round(x)), int(round(y)))); continue
        pi = (int(round(x - 0.5 * nx)), int(round(y - 0.5 * ny))); po = (int(round(x + 0.5 * nx)), int(round(y + 0.5 * ny)))
        body.add(pi); body.add(po); lite.add(po)
    strg = set()
    if string:
        (x0, y0), (x1, y1) = R(string[0]), R(string[1])
        m = int(max(abs(x1 - x0), abs(y1 - y0))) + 1
        strg = {(int(round(x0 + (x1 - x0) * k / m)), int(round(y0 + (y1 - y0) * k / m))) for k in range(m + 1)} - body
        for (x, y) in strg: g.set(x, y, style['string'])
    for (x, y) in body: g.set(x, y, style['light'] if (x, y) in lite else style['base'])
    if outline:
        rim = {(x + dx, y + dy) for (x, y) in body for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1))} - body - strg
        for (x, y) in rim:
            if g.get(x, y) == '.': g.set(x, y, 'O')
    return g, {'grip': (gx, gy), 'tip': tuple(int(round(v)) for v in s[-1])}


def bow(w, h, gx, gy, half=15, bend=4, tilt=0.0, pull=None, arrow=False, style=WOOD, outline=True, recurve=0.0):
    """Returns a Grid w×h with the bow. gx, gy: the grip (where the hand closes). half: grip→tip length (px).
    bend: how far back the tips curve (px). tilt: radians, + turns the top toward the facing side.
    pull: (px back from the string's rest line, px down) of the drawing hand, or None at rest.
    recurve: how far the last quarter of each limb flicks back out, away from the string (px) — a recurve's tips."""
    g = Grid(w, h)
    limb = set(); lite = set()
    n = 80
    tips = []
    for i in range(n + 1):
        t = -1 + 2 * i / n
        x = gx - bend * t * t
        if recurve and abs(t) > 0.72: x += recurve * ((abs(t) - 0.72) / 0.28) ** 2
        y = gy + t * half
        x, y = _rot(x, y, gx, gy, tilt)
        thick = 1.0 if abs(t) < 0.75 else 0.6
        for dx in (-0.5, 0, 0.5):
            for dy in (-0.5, 0, 0.5):
                if dx * dx + dy * dy <= thick * thick:
                    p = (int(round(x + dx)), int(round(y + dy)))
                    limb.add(p)
                    if dx < 0: lite.add(p)
        if i in (0, n): tips.append((x, y))
    (tx0, ty0), (tx1, ty1) = tips
    string = set()
    def line(a, b):
        (x0, y0), (x1, y1) = a, b
        m = int(max(abs(x1 - x0), abs(y1 - y0))) + 1
        return {(int(round(x0 + (x1 - x0) * k / m)), int(round(y0 + (y1 - y0) * k / m))) for k in range(m + 1)}
    if pull is None:
        string = line((tx0, ty0), (tx1, ty1))
        nock = ((tx0 + tx1) / 2, (ty0 + ty1) / 2)
    else:
        mx, my = (tx0 + tx1) / 2, (ty0 + ty1) / 2
        px, py = _rot(mx - pull[0], my + pull[1], gx, gy, 0)
        string = line((tx0, ty0), (px, py)) | line((px, py), (tx1, ty1))
        nock = (px, py)
    # draw: string under the limbs, the limbs, their outline
    for (x, y) in string: g.set(x, y, style['string'])
    for (x, y) in limb: g.set(x, y, style['base'])
    for (x, y) in lite: g.set(x, y, style['light'])
    if outline:
        rim = {(x + dx, y + dy) for (x, y) in limb for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1))} - limb - string
        for (x, y) in rim:
            if g.get(x, y) == '.': g.set(x, y, 'O')
    if arrow:
        hx, hy = gx + 5, nock[1]
        for (x, y) in line(nock, (hx, hy)): g.set(x, y, style['shaft'])
        g.set(int(round(hx)) + 1, int(round(hy)), style['head']); g.set(int(round(hx)) + 2, int(round(hy)), 'O')
        fx, fy = int(round(nock[0])), int(round(nock[1]))
        g.set(fx + 1, fy - 1, style['fletch']); g.set(fx + 2, fy - 1, style['fletch'])
        g.set(fx + 1, fy + 1, style['fletch']); g.set(fx + 2, fy + 1, style['fletch'])
    return g, {'grip': (gx, gy), 'nock': (round(nock[0]), round(nock[1])), 'tips': [(round(tx0), round(ty0)), (round(tx1), round(ty1))]}
