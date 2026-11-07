"""The minimal-motion test (David 7 Nov 21:41, reviewed with GPT — DECISIONS.md "Minimal motion"): the walk in 4 frames
where only the legs, a 1 px bob, the free arm and the cape's hem move. The head, the torso, the bow arm and the bow are
one drawing each (the idle master), shifted by the bob. Outfit B (a different tunic and boots) proves the point: a swap
needs one torso drawing and one drawing per leg pose. Adds FRAMES 'walk4', 'idleb', 'blinkb', 'walk4b' to frames_R;
the 6-frame walk stays the default (the benchmark and the fallback)."""
import os, sys
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE); sys.path.insert(0, os.path.join(HERE, '..', '..'))
from pix import Grid
import frames_R as A

M = A.MASTER
GREEN = 'LGgDYy'
OX, OY = A.FOOT[0] - A.M_FOOT[0], A.FOOT[1] - A.M_FOOT[1]          # the master's place in a 96 × 96 frame


def layer_of(x, y, ch):
    """The master's layers (the borders of the breakdown reviewed with GPT)."""
    if ch == '.': return None
    qx0, qx1, qy0, qy1 = A.QUIVER_BOX
    if qx0 <= x <= qx1 and qy0 <= y <= qy1 and (y >= 24 or ch in 'FWR'): return 'back'
    if y < 29: return 'head'
    if ch in GREEN and (x <= 13 or y >= 52): return 'back'          # the cape behind, its hem
    if x <= 10: return 'back'                                        # the cape's outline, the quiver's strap
    if ch in GREEN and y <= 34: return 'top'                         # the collar under the chin
    if y >= 52: return 'legs'
    if 13 <= x <= 17 and 36 <= y <= 41 and ch == 'F': return 'top'     # the sleeve's highlight (the sleeve is the top's)
    if 11 <= x <= 20 and y >= 33 and ch not in GREEN + 'Tt': return 'near'
    if x >= 31 and y >= 33 and ch not in 'Tt': return 'far'
    return 'top'


LAY = {(x, y): layer_of(x, y, M.px[y][x]) for y in range(M.h) for x in range(M.w) if M.px[y][x] != '.'}
NEAR = {p for p, l in LAY.items() if l == 'near'}


def only(g: Grid, keep, extra='body') -> Grid:
    """The pixels of g in the given layers (by the master's borders; a pixel the master doesn't have — a new item's
    shape — goes with `extra`)."""
    out = Grid(g.w, g.h)
    for y in range(g.h):
        for x in range(g.w):
            if g.px[y][x] != '.' and LAY.get((x, y), extra) in keep: out.px[y][x] = g.px[y][x]
    return out


def support(body: Grid) -> Grid:
    """The art hidden under the free arm, for when it swings: on each row the front half of the arm's place gets the
    torso's side (the belt on the belt's rows), the back half the tunic beside it."""
    out = body.copy()
    for y in range(38, 53):
        xs = sorted(x for x in range(8, 22) if (x, y) in NEAR)
        if not xs: continue
        xl, xr = xs[0], xs[-1]
        right = next((body.px[y][x] for x in range(xr + 1, xr + 6) if body.px[y][x] not in '.O'), 't')
        for x in range(xl, xr + 1):
            if out.px[y][x] != '.': continue
            out.px[y][x] = ('b' if 42 <= y <= 45 else 't') if x - xl < (xr - xl + 1) // 2 else right
    return out


def swing(arm: Grid, s: int) -> Grid:
    """The free arm swung s px at the fist (forward +, back −): the upper sleeve stays, the forearm moves half."""
    half = s // 2 if s >= 0 else -((-s) // 2)
    out = Grid(arm.w, arm.h)
    for y in range(arm.h):
        d = 0 if y < 42 else (half if y < 47 else s)
        for x in range(arm.w):
            if arm.px[y][x] != '.': out.set(x + d, y, arm.px[y][x])
    return out


def parts(master: Grid) -> dict:
    return {'back': only(master, {'back'}), 'body': support(only(master, {'head', 'top', 'far', 'body'})),
            'arm': only(master, {'near'}), 'legs': only(master, {'legs'})}


# THE WALK (4 frames): (your walk frame giving the legs, the bob, the free arm's swing, the hem a pixel behind)
PLAN = [(0, 0, +2, False),     # 1 right contact — legs of walk frame 1, the free arm forward
        (2, -1, 0, True),      # 2 passing — walk frame 3, a pixel up, the arm in the middle, the hem lags
        (3, 0, -2, False),     # 3 left contact — walk frame 4, the arm back
        (5, -1, 0, True)]      # 4 passing — walk frame 6
MS = 165                       # (GPT: the old 660 ms cycle; 150 ms is tried in the game with &wms=150)


def walk_legs(wi: int) -> Grid:
    """The legs of one of GPT's walk frames, under the skirt: its pixels below the master's skirt line, without the
    cape (green), the skin and the carried bow (the rigid upper body brings its own fist and bow)."""
    g = A.FRAMES['walk'][wi][0]; top = A.WALK_TOP[wi]
    out = Grid(A.F, A.F)
    for y in range(top + 52, A.F):
        for x in range(A.F):
            ch = g.px[y][x]
            if ch == '.' or ch in GREEN or ch in 'Ss' or (x >= OX + 32 and y < OY + 56): continue
            out.px[y][x] = ch
    return drop_bits(out)


def drop_bits(g: Grid, keep=20) -> Grid:
    """Only the legs: small pieces cut off from them (bits of the drawing's cape outline at the hem, 2–13 px) go —
    with the cape off they would float beside the legs."""
    out = g.copy(); seen = set()
    for y0 in range(g.h):
        for x0 in range(g.w):
            if g.px[y0][x0] == '.' or (x0, y0) in seen: continue
            comp, stack = [], [(x0, y0)]; seen.add((x0, y0))
            while stack:
                x, y = stack.pop(); comp.append((x, y))
                for dx in (-1, 0, 1):
                    for dy in (-1, 0, 1):
                        q = (x + dx, y + dy)
                        if 0 <= q[0] < g.w and 0 <= q[1] < g.h and q not in seen and g.px[q[1]][q[0]] != '.': seen.add(q); stack.append(q)
            if len(comp) < keep:
                for (x, y) in comp: out.px[y][x] = '.'
    return out


def boots_b(legs: Grid) -> Grid:
    """Outfit B's boots on one leg pose: the same drawing in dark leather (every leather tone of the leg drawings)."""
    rec = {'J': 'X', 'R': 'X', 't': 'X', 'H': 'N', 'B': 'N', 'e': 'N', 'h': 'n', 'b': 'n', 'E': 'n', 'K': 'n'}
    out = Grid(legs.w, legs.h)
    for y in range(legs.h):
        for x in range(legs.w):
            ch = legs.px[y][x]
            if ch != '.': out.px[y][x] = rec.get(ch, ch)
    return out


def cuff(frame: Grid, legs: Grid, cover: set) -> None:
    """Outfit B's fur cuff, on each leg where its boot comes out from under the clothes: per column, the first two
    boot pixels that show right under the tunic (so it follows each leg's own top, steps down under the point and
    never lands on a toe), a pixel of outline out to the side where the boot meets the air."""
    for x in range(frame.w):
        top = None
        for y in range(frame.h):
            if legs.px[y][x] not in '.O' and frame.px[y][x] == legs.px[y][x]: top = y; break
        if top is None or not any((x, yy) in cover for yy in (top - 1, top - 2)): continue
        frame.px[top][x] = 'F'
        if frame.px[top + 1][x] == legs.px[top + 1][x] and legs.px[top + 1][x] not in '.O': frame.px[top + 1][x] = 'f'
        for dx in (-1, 1):
            if frame.px[top][x + dx] == '.': frame.px[top][x + dx] = 'O'


def tunic_b(master: Grid) -> Grid:
    """Outfit B's top, one drawing: a red tunic, gold hem and front edges, a dark belt with a steel buckle, and a point
    hanging 3 px below the old hem (a new silhouette, in front of the legs). The collar, cape and strap stay."""
    out = master.copy()
    for (x, y), l in LAY.items():
        if l != 'top' or y < 34: continue
        ch = master.px[y][x]
        if 24 <= x <= 27 and 42 <= y <= 45 and ch == 'Y': out.px[y][x] = 'f'
        elif 43 <= y <= 44 and ch in 'Bb': out.px[y][x] = 'K'
        else: out.px[y][x] = {'T': 'M', 't': 'm', 'W': 'Y', 'F': 'Y'}.get(ch, ch)   # (the sleeve's edge in gold, as the hem)
    for y, x0, x1 in ((52, 22, 27), (53, 23, 26), (54, 24, 25)):
        out.px[y][x0 - 1] = out.px[y][x1 + 1] = 'O'
        for x in range(x0, x1 + 1): out.px[y][x] = 'm'
    out.px[55][24] = out.px[55][25] = 'O'
    return out


POINT = {(x, y) for y in range(52, 56) for x in range(21, 29)}
_tb = tunic_b(M)
PB = parts(_tb)
for (x, y) in POINT:                                                 # the point belongs to the top, not to the legs
    if _tb.px[y][x] != M.px[y][x]: PB['body'].px[y][x] = _tb.px[y][x]
_legs_b = boots_b(only(M, {'legs'}))
MASTER_B = Grid(M.w, M.h)                                            # the idle in outfit B: back, boots B, tunic B, arm
for g in (PB['back'], _legs_b, PB['body'], PB['arm']): MASTER_B.stamp(g, 0, 0)
cuff(MASTER_B, _legs_b, {(x, y) for y in range(M.h) for x in range(M.w) if PB['body'].px[y][x] != '.'})


def walk4(p: dict, legs_of, cuffed=False):
    seq = []
    for wi, bob, s, lag in PLAN:
        f = Grid(A.F, A.F)
        legs = legs_of(wi, bob)
        f.stamp(A.LAG(p['back']) if lag else p['back'], OX, OY + bob)
        f.stamp(legs, 0, 0)
        body = A.with_bow(p['body'])
        f.stamp(body, OX, OY + bob)
        f.stamp(swing(p['arm'], s), OX, OY + bob)
        if cuffed: cuff(f, legs, {(x + OX, y + OY + bob) for y in range(body.h) for x in range(body.w) if body.px[y][x] != '.'})
        seq.append((f, MS))
    return seq


PA = parts(M)
_LEGS = {wi: walk_legs(wi) for wi, _, _, _ in PLAN}
A.FRAMES['walk4'] = walk4(PA, lambda wi, bob: _LEGS[wi])
A.FRAMES['walk4b'] = walk4(PB, lambda wi, bob: boots_b(_LEGS[wi]), cuffed=True)
_RISE_B = A.lift(A.lift(A.shift_rows(MASTER_B, 0, 44, -1), 31, 36, 46, 51), 11, 19, 47, 51)


def _top(f: Grid) -> Grid:                                           # (the risen frames keep the hood's top row)
    for x in range(M.w):
        if MASTER_B.px[0][x] != '.': f.set(x + OX, OY - 1, MASTER_B.px[0][x])
    return f


A.FRAMES['idleb'] = [(A.place(A.with_bow(MASTER_B)), 400), (_top(A.place(A.with_bow(_RISE_B, A.UP))), 300),
                     (_top(A.place(A.with_bow(A.LAG(_RISE_B), A.UP))), 400), (A.place(A.with_bow(A.LAG(MASTER_B))), 300)]
A.FRAMES['blinkb'] = [(A.place(A.with_bow(A.blink(MASTER_B))), 130)]
