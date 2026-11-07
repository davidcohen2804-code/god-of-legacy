"""The shot's first proof (pose map A, GPT 7 Nov): the Raise — the bow comes up in front of the body, the hand already on
the string — composed over the standing legs and over the 4-frame walk's passing legs. Minimal motion: the head, the
torso, the cape and the quiver are the idle master's one drawing; only the two arms, the grip fist, the bow and the
arrow are new. Master px (x forward, y down, feet at y 64): W waist (24,44), Sf far shoulder (31,34), Sn near shoulder
(15,33). Raise: grip (40,37), bow +25° (top forward), bend 3; hand = nock (29,34); arrow (29,34)→(57,34) on the fist's
top row, behind the grip fist; bow, arrow, string and both arms in front of the torso."""
import math, os, sys
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE); sys.path.insert(0, os.path.join(HERE, '..', '..'))
from pix import Grid
from procbow import bow
import frames_R as A
import minimal_R as MR

M = A.MASTER
GRIP, TILT, BEND, HALF = (40, 37), 25.0, 3, 16
NOCK = (29, 34)
ARROW_TIP = (57, 34)

# THE FAR (BOW) ARM, raised: the upper arm down from the shoulder to the elbow (35,39), the forearm up to the fist —
# leather like the hanging sleeve (R light on top, B, b shade under), outlined. (x0, y0) of row 0, col 0.
FAR_ARM = ((29, 34), [
    'OOOO.......',
    'OBRBO......',
    'ObBRBO.....',
    '.ObBRBOOO..',
    '..ObBBRRBO.',
    '...ObBBBbO.',
    '....OObbO..',
    '......OO...',
])
# THE NEAR (DRAW) ARM, reaching across the chest: the tunic's cream sleeve at the shoulder, the leather bracer, the hand
# on the string at the nock (the fingers pinch it: the string and the arrow's nock go under them).
NEAR_ARM = ((13, 31), [
    '.OOOO...............',
    'OTTFtOOOOOOOOO.OOO..',
    'OTFttBBHHHHHHhOSSSO.',
    'OttttBHHHHHHhhOSSsSO',
    '.OOBBHhhhhhhhOOsSsO.',
    '...OOOOOOOOOOO.OOO..',
])
# THE RAISE GRIP FIST (pose-specific, GPT's rule): a mitten round the riser tilted 25°, the wood showing through the
# top opening (front) and the bottom one (back); '.' lets the bow show, ' ' keeps what is under. Grip at (3, 3).
RAISE_FIST = ['  OO.O',
              ' OSSs.O',
              'OSSsSSO',
              'OSsSSsO',
              'OsSSsO ',
              ' OO.OO ']


def stamp_sprite(g: Grid, spr, keep=' '):
    (x0, y0), rows = spr
    for j, row in enumerate(rows):
        for i, ch in enumerate(row):
            if ch not in keep + '.': g.set(x0 + i, y0 + j, ch)


def raise_body() -> Grid:
    """The idle master without its two arms and its legs, the torso's side and front closed where the arms hung:
    behind the near arm the torso's near side (tunic shade, the belt on its rows) with an outline against the cape,
    the torso's front edge outlined where the bow arm hung."""
    g = MR.only(M, {'head', 'top', 'back'})
    for (x, y), l in MR.LAY.items():
        if l == 'far' or (l == 'top' and y >= 35 and ((y <= 41 and x >= 29) or (42 <= y <= 45 and x >= 31))):
            g.px[y][x] = '.'
    for y in range(35, 52):                                   # the front edge where the bow arm hung
        xs = [x for x in range(20, 34) if g.px[y][x] != '.']
        if xs: g.px[y][max(xs) + 1] = 'O'
    for y in range(36, 53):                                   # the near side where the free arm hung: the tunic goes on
        hole = [x for x in range(9, 22) if MR.LAY.get((x, y)) == 'near']
        if not hole: continue
        inner, side = SIDE.get(y, ('t', 't'))
        for k, x in enumerate(range(min(hole), max(hole) + 1)):
            if g.px[y][x] != '.': continue
            g.px[y][x] = 'O' if k == 0 or y == 52 else (side if k <= 2 else inner)
    return g


# the torso's near side, row by row (inner colour, the two columns at the side's edge): cream tunic, the belt, the tan
# skirt, its white hem — the same bands as the front, a shade darker at the edge
SIDE = {**{y: ('T', 't') for y in range(36, 42)}, 42: ('t', 't'), 43: ('B', 'b'), 44: ('B', 'b'), 45: ('t', 't'),
        **{y: ('t', 't') for y in range(46, 51)}, 51: ('W', 't')}


def raise_bow(w: int, h: int) -> Grid:
    """The bow at the Raise: tilted 25°, the string pulled to the nock (pose map A)."""
    t = math.radians(TILT)
    tip = lambda s: (GRIP[0] + (-BEND) * math.cos(t) - s * HALF * math.sin(t), GRIP[1] + (-BEND) * math.sin(t) + s * HALF * math.cos(t))
    (x0, y0), (x1, y1) = tip(-1), tip(1)
    mx, my = (x0 + x1) / 2, (y0 + y1) / 2
    g, info = bow(w, h, GRIP[0], GRIP[1], half=HALF, bend=BEND, tilt=t, pull=(mx - NOCK[0], NOCK[1] - my),
                  style=A.BOW_STYLE, recurve=1.0)
    return g


def arrow(g: Grid):
    """The arrow from the nock to its tip: fletching (light) by the nock, a wooden shaft, a steel head outlined."""
    nx, ny = NOCK; tx, ty = ARROW_TIP
    for x in range(nx + 1, tx - 2): g.set(x, ny, 'J')
    g.set(nx + 2, ny - 1, 'F'); g.set(nx + 3, ny - 1, 'F'); g.set(nx + 2, ny + 1, 'F'); g.set(nx + 3, ny + 1, 'F')
    g.set(tx - 2, ty, 'f'); g.set(tx - 1, ty, 'f'); g.set(tx, ty, 'O')
    g.set(tx - 2, ty - 1, 'O'); g.set(tx - 2, ty + 1, 'O')


def raise_frame(legs: Grid, bob: int, lag: bool) -> Grid:
    """One Raise frame (96 × 96): back, legs, torso and head, bow, arrow, grip fist, the two arms."""
    W = M.w + 24
    up = Grid(W, M.h)
    body = raise_body()
    back = MR.only(M, {'back'})
    f = Grid(A.F, A.F)
    f.stamp(A.LAG(back) if lag else back, MR.OX, MR.OY + bob)
    f.stamp(legs, 0, 0)
    f.stamp(body, MR.OX, MR.OY + bob)
    stamp_sprite(up, FAR_ARM)                                 # the far upper arm sits under the bow
    up.stamp(raise_bow(W, M.h), 0, 0)
    arrow(up)
    for j, row in enumerate(RAISE_FIST):                      # the grip fist over the riser and the arrow
        for i, ch in enumerate(row):
            if ch not in ' .': up.set(GRIP[0] - 3 + i, GRIP[1] - 3 + j, ch)
    stamp_sprite(up, NEAR_ARM)                                # the near arm in front of everything
    f.stamp(up, MR.OX, MR.OY + bob)
    return f


STAND = MR.only(M, {'legs'})
_stand = Grid(A.F, A.F); _stand.stamp(STAND, MR.OX, MR.OY)
A.FRAMES['raise_proof'] = [(raise_frame(_stand, 0, False), 200), (raise_frame(MR._LEGS[2], -1, True), 200)]
