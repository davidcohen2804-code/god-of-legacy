"""Arms for new poses, dressed by any outfit (GPT 8 Nov: the shot's arms are upper-body pose art over the base, the
clothes over them). An arm in a pose is a skeleton — shoulder, elbow, wrist — and a hand drawing. It is drawn once as a
material map: for each pixel, where it lies along the arm (t: 0 at the shoulder, 0.5 at the elbow, 1 at the wrist) and
its tone across it (0 light, 1 mid, 2 shade — lit from the upper left), or that it is outline; the hand's pixels are
the hand's. The base and every arm item are colour bands over t (and the hand), so a new sleeve or bracer is one small
map and it dresses every pose; a removal leaves its bands out. Hand clean-ups are edits of the map, so they carry over
to every outfit."""
import math, os, sys
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE); sys.path.insert(0, os.path.join(HERE, '..', '..'))
from pix import Grid

LIGHT = (-0.6, -0.8)                                   # towards the light (the palette's: upper left)

# THE BANDS: (t from, t to, (light, mid, shade), edge at the band's start, edge at its end). An edge is the band's 1 px
# line along its border with the next part of the arm (a sleeve's hem, a bracer's cuff); None: no line.
BANDS = {
    'base':    {'near': [(0.00, 0.26, 'FFT', None, 'T'), (0.26, 9, 'SSs', None, None)],     # the undershirt's short sleeve, skin
                'far':  [(0.00, 0.26, 'FTT', None, 'T'), (0.26, 9, 'Sss', None, None)]},
    'tunic':   {'near': [(0.00, 0.50, 'FTt', None, 't')],                                     # the sleeve over the upper arm
                'far':  [(0.00, 0.50, 'RBb', None, 'b')]},                                    # (leather, as the master's far arm)
    'bracers': {'near': [(0.58, 0.97, 'JHh', 'B', 'b')],                                     # the cuff at the top, dark at the wrist
                'far':  [(0.54, 0.97, 'BBb', 'h', 'h')]},
    # outfit B (the test of another outfit, GPT 8 Nov): a red sleeve down to mid-forearm with a gold hem, a short dark
    # wrist guard with a steel edge
    'tunic_b':   {'near': [(0.00, 0.68, 'MMm', None, 'Y')], 'far': [(0.00, 0.68, 'Mmm', None, 'y')]},
    'bracers_b': {'near': [(0.80, 0.97, 'NNn', 'X', None)], 'far': [(0.80, 0.97, 'Nnn', 'X', None)]},
}
# THE LEGS (the same rig: hip → knee → ankle, then the foot to the toe at t 1.0 → 1.15): the base's shorts, bare shin and
# foot wraps; the boots from just under the shorts' hem, a dark band at their top
for _side in ('nearleg', 'farleg'):
    BANDS['base'][_side] = [(0.00, 0.58, 'PPp', None, 'p'), (0.58, 0.90, 'SSs', None, None), (0.90, 9, 'TTt', None, None)]
    BANDS['tunic'][_side] = []
    BANDS['bracers'][_side] = []
BANDS['boots'] = {'near': [], 'far': [], 'nearleg': [(0.50, 9, 'JHh', 'b', None)], 'farleg': [(0.50, 9, 'JHh', 'b', None)]}
HAND = {'base': 'SSs'}                                 # the hands' tones (gloves would add their own)
ARM_ITEMS = ('boots', 'tunic', 'tunic_b', 'bracers', 'bracers_b')                       # in their order, back to front


class Arm:
    """side: 'near' / 'far'; shoulder, elbow, wrist: master px (floats); r_up, r_fore: half-widths; hand: (rows, anchor
    (x, y) of the rows' (0, 0) in master px) — letters a/b/c light/mid/shade, O outline, ' ' nothing; edits: {(x, y):
    'O' | '.' | 0 | 1 | 2} applied to the map last."""
    def __init__(self, side, shoulder, elbow, wrist, hand=None, r_up=2.0, r_fore=1.8, r_wrist=1.6, edits=None,
                 blend_shoulder=True, toe=None, r_toe=1.4):
        self.side, self.S, self.E, self.Wr = side, shoulder, elbow, wrist
        self.toe, self.r_toe = toe, r_toe
        self.hand, self.r = hand, (r_up, r_fore, r_wrist)
        self.edits = edits or {}
        self.blend_shoulder = blend_shoulder


def _seg(p, a, b):
    (px, py), (ax, ay), (bx, by) = p, a, b
    dx, dy = bx - ax, by - ay
    L2 = dx * dx + dy * dy or 1e-9
    u = max(0.0, min(1.0, ((px - ax) * dx + (py - ay) * dy) / L2))
    ex, ey = px - (ax + u * dx), py - (ay + u * dy)
    nx, ny = -dy, dx
    nl = math.hypot(nx, ny) or 1.0
    nx, ny = nx / nl, ny / nl
    if nx * LIGHT[0] + ny * LIGHT[1] < 0: nx, ny = -nx, -ny
    return u, math.hypot(ex, ey), ex * nx + ey * ny


def material(arm: Arm) -> dict:
    """The arm's map: (x, y) → ('arm', t, tone) | ('hand', 0, tone) | ('O', t, None)."""
    r_up, r_fore, r_wr = arm.r
    pts = [arm.S, arm.E, arm.Wr] + ([arm.toe] if arm.toe else [])
    xs = [p[0] for p in pts]; ys = [p[1] for p in pts]
    segs = [(arm.S, arm.E), (arm.E, arm.Wr)] + ([(arm.Wr, arm.toe)] if arm.toe else [])
    m = {}
    for y in range(int(min(ys)) - 4, int(max(ys)) + 5):
        for x in range(int(min(xs)) - 4, int(max(xs)) + 5):
            best = None
            for k, (a, b) in enumerate(segs):
                u, d, v = _seg((x, y), a, b)
                r = r_up if k == 0 else (r_fore + (r_wr - r_fore) * u if k == 1 else arm.r_toe)
                if d <= r + 1e-6 and (best is None or d / r < best[0]):
                    best = (d / r, 0.5 * u if k == 0 else (0.5 + 0.5 * u if k == 1 else 1.0 + 0.15 * u), v, r)
            if best is None: continue
            _, t, v, r = best
            tone = 0 if v >= r - 1.0 else (2 if v <= -(r - 1.0) else 1)
            m[(x, y)] = ('arm', t, tone)
    if arm.hand:                                       # the hand over its own arm's end
        rows, (hx, hy) = arm.hand
        for j, row in enumerate(rows):
            for i, ch in enumerate(row):
                if ch == ' ': continue
                p = (hx + i, hy + j)
                if ch == 'O':                          # (its outline never cuts across its own forearm)
                    if p not in m or m[p][0] == 'O': m[p] = ('O', 1.0, None)
                else: m[p] = ('hand', 0, 'abc'.index(ch))
    inside = {p for p, v in m.items() if v[0] != 'O'}
    for (x, y) in list(inside):                         # the outline round the arm and hand
        for q in ((x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)):
            if q not in m: m[q] = ('O', m[(x, y)][1], None)
    for p, e in arm.edits.items():
        if e == '.': m.pop(p, None)
        elif e == 'O': m[p] = ('O', m.get(p, ('O', 1.0))[1], None)
        else: m[p] = (m[p][0], m[p][1], e) if p in m else ('arm', 1.0, e)
    return m


def dress_arm(arm: Arm, wear, m=None) -> Grid:
    """The arm in colours, master-sized + room in front (65 × 64): the base's bands, the worn items' over them."""
    m = m if m is not None else material(arm)
    g = Grid(65, 64)
    layers = [BANDS['base'][arm.side]] + [BANDS[k].get(arm.side, []) for k in ARM_ITEMS if k in wear]

    def band_of(t):
        hit = None
        for bands in layers:
            for b in bands:
                if b[0] <= t < b[1]: hit = b
        return hit
    for (x, y), (kind, t, tone) in m.items():
        if kind == 'O': g.set(x, y, 'O'); continue
        if kind == 'hand': g.set(x, y, HAND['base'][tone]); continue
        b = band_of(t)
        ch = b[2][tone]
        # a band's edge: its pixels that touch the arm beyond it (t past its end / before its start, still the arm)
        for q in ((x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)):
            mq = m.get(q)
            if not mq or mq[0] != 'arm': continue
            if b[4] and mq[1] >= b[1] and band_of(mq[1]) is not b: ch = b[4]
            if b[3] and mq[1] < b[0] and band_of(mq[1]) is not b: ch = b[3]
        g.set(x, y, ch)
    return g


def blend(g: Grid, arm: Arm, body: Grid, m=None) -> None:
    """The near arm grows out of its shoulder: its outline pixels near the shoulder that fall on the body are dropped."""
    m = m if m is not None else material(arm)
    for (x, y), (kind, t, _) in m.items():
        if kind == 'O' and t < 0.12 and body.get(x, y) not in '.O': g.set(x, y, '.')
