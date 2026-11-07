"""The shot on the base body (GPT 8 Nov): the four poses composed from the base, the worn items and arms drawn by
arms_R over the rigid upper body — the torso without its two arms (their places closed with support art), the head,
the cape and quiver as in the idle. A proof first: the Raise and the Full Draw (FRAMES 'shot_proof~<variant>', not
played by the game)."""
import math, os, sys
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE); sys.path.insert(0, os.path.join(HERE, '..', '..'))
from pix import Grid
from procbow import bow
import frames_R as A
import minimal_R as MR
import base_R as BR
import items_R as IR
import outfit_R as O
import arms_R as AR

W, H, F = IR.W, IR.H, A.F
UW = W + 24                                                   # the upper body's grid: room in front for the bow
OX, OY = MR.OX, MR.OY
FAR = {p for p, l in MR.LAY.items() if l == 'far'}
FAR_SLEEVE = {(x, y) for (x, y), l in MR.LAY.items()
              if l == 'top' and y >= 35 and ((y <= 41 and x >= 29) or (42 <= y <= 45 and x >= 31))}
ARMS = O.NEAR | FAR | FAR_SLEEVE
LEGS = O.LEGS
FAR_SH, NEAR_SH = (31, 34), (15, 33)                           # the shoulders (pose map A)


def torso(wear) -> Grid:
    """The rigid upper body without its arms: the base's torso and head, the support art where the near arm hung (the
    tunic's side when it is worn), the worn items' torso parts; the near side outlined against the cape, the front
    edge outlined where the bow arm hung."""
    g = Grid(W, H)
    g.stamp(O.pick(BR.BASE, lambda x, y: (x, y) not in ARMS and (x, y) not in LEGS), 0, 0)
    sup = O.T_SUPPORT if 'tunic' in wear else (T_SUPPORT_B if 'tunic_b' in wear else None)
    for (x, y) in O.NEAR:
        for s in (O.B_SUPPORT, sup):
            if s is not None and s.px[y][x] != '.': g.px[y][x] = s.px[y][x]
    for k in ORDER:
        if k in wear and not k.startswith('boots'):
            g.stamp(O.pick(ITEMS[k], lambda x, y: (x, y) not in ARMS and (x, y) not in LEGS), 0, 0)
    for y in range(33, 53):                                    # the near arm's place: its holes filled from the torso,
        row = [x for x in range(8, 23) if (x, y) in O.NEAR]    # its back edge an outline
        if not row: continue
        for x in row:
            if g.px[y][x] != '.': continue
            fill = next((g.px[y][xx] for xx in range(x + 1, x + 6) if g.get(xx, y) not in '.O'), None)
            if fill and any(g.get(xx, y) != '.' for xx in range(x - 4, x)): g.px[y][x] = fill
        xl = min(x for x in row if g.px[y][x] != '.') if any(g.px[y][x] != '.' for x in row) else None
        if xl is not None and y >= 36: g.px[y][xl] = 'O'
    O.close_upper(g, O.back(wear))
    return g


def raise_bow(grip, tilt, nock, half=16, bend=3) -> Grid:
    t = math.radians(tilt)
    tip = lambda s: (grip[0] - bend * math.cos(t) - s * half * math.sin(t), grip[1] - bend * math.sin(t) + s * half * math.cos(t))
    (x0, y0), (x1, y1) = tip(-1), tip(1)
    mx, my = (x0 + x1) / 2, (y0 + y1) / 2
    g, _ = bow(UW, H, grip[0], grip[1], half=half, bend=bend, tilt=t, pull=(mx - nock[0], nock[1] - my),
               style=A.BOW_STYLE, recurve=1.0)
    return g


def arrow(g: Grid, nock, length=28):
    nx, ny = nock; tx = nx + length
    for x in range(nx + 1, tx - 2): g.set(x, ny, 'J')
    for dx in (2, 3): g.set(nx + dx, ny - 1, 'F'); g.set(nx + dx, ny + 1, 'F')
    g.set(tx - 2, ny, 'f'); g.set(tx - 1, ny, 'f'); g.set(tx, ny, 'O')
    g.set(tx - 2, ny - 1, 'O'); g.set(tx - 2, ny + 1, 'O')


# THE HANDS (material letters: a light, b mid, c shade, O outline, ' ' nothing; '.' lets the bow show through)
GRIP_FIST = ['  OO.O ',                                        # round the riser tilted +25° (the Raise proof's mitten)
             ' Obbc.O',
             'Obbcbbo',
             'Obcbbco',
             'Ocbbco ',
             ' OO.OO ']
PINCH = [' OOO ',                                              # the draw hand on the string: the fingers over the nock
         'ObbbO',
         'ObcbO',
         'OcbcO',
         ' OOO ']


def fist(rows, at):
    """A hand drawing centred on `at` (its middle pixel there)."""
    hx, hy = at[0] - len(rows[0]) // 2, at[1] - len(rows) // 2
    return [r.replace('o', 'O') for r in rows], (hx, hy)


def hand_holes(rows, at):
    hx, hy = at[0] - len(rows[0]) // 2, at[1] - len(rows) // 2
    return {(hx + i, hy + j) for j, r in enumerate(rows) for i, ch in enumerate(r) if ch == '.'}


POSES = {
    # Raise (GPT 8 Nov): grip (40,37) +25°, the hand on the string at (25,34) — the arrow level on the grip fist's top
    # row — the draw elbow down behind the hand at (19,39), the bow elbow at (33,41)
    'raise': dict(grip=(40, 37), tilt=25, nock=(25, 34),
                  far=AR.Arm('far', FAR_SH, (33.4, 40.6), (38.0, 38.2), r_up=1.7, r_fore=1.6, r_wrist=1.5),
                  near=AR.Arm('near', NEAR_SH, (19.0, 38.8), (23.2, 35.6), r_up=2.0, r_fore=1.8, r_wrist=1.6)),
    # the Raise, option: the hand at (22,34), the upper arm down the near side as it hangs, the elbow at (14,39)
    'raise_alt': dict(grip=(40, 37), tilt=25, nock=(22, 34),
                      far=AR.Arm('far', FAR_SH, (33.4, 40.6), (38.0, 38.2), r_up=1.7, r_fore=1.6, r_wrist=1.5),
                      near=AR.Arm('near', NEAR_SH, (14.2, 39.0), (20.2, 35.4), r_up=2.0, r_fore=1.8, r_wrist=1.6)),
    # Full Draw: grip (45,34) +15°, bow arm straight, the hand under the near jaw (20,31), the elbow back at the
    # shoulder's height (the upper arm foreshortened: it points back, away from us), the forearm along the arrow
    'draw': dict(grip=(45, 34), tilt=15, nock=(20, 31),
                 far=AR.Arm('far', FAR_SH, (38.0, 34.0), (43.0, 34.0), r_up=1.7, r_fore=1.6, r_wrist=1.5),
                 near=AR.Arm('near', NEAR_SH, (12.0, 33.0), (17.8, 31.6), r_up=2.0, r_fore=1.8, r_wrist=1.6)),
    # the Full Draw, option (GPT: test the elbow slightly lower)
    'draw_low': dict(grip=(45, 34), tilt=15, nock=(20, 31),
                     far=AR.Arm('far', FAR_SH, (38.0, 34.0), (43.0, 34.0), r_up=1.7, r_fore=1.6, r_wrist=1.5),
                     near=AR.Arm('near', NEAR_SH, (12.4, 35.2), (17.8, 32.0), r_up=2.0, r_fore=1.8, r_wrist=1.6)),
}


def upper(pose: str, wear) -> Grid:
    """The upper body in a shot pose (UW × H, master px): back → front — the far upper arm, the torso, the far forearm,
    the bow, the arrow, the grip fist, the string, the near arm and draw hand (GPT's render order)."""
    P = POSES[pose]
    g = Grid(UW, H)
    far = P['far']; far.hand = None
    fm = AR.material(far)
    fa = AR.dress_arm(far, wear, fm)
    g.stamp(fa, 0, 0)                                         # the far upper arm behind the body,
    g.stamp(torso(wear), 0, 0)
    for (x, y), (kind, t, _) in fm.items():                   # its forearm (from the elbow) in front of it
        if t >= 0.5 and fa.get(x, y) != '.': g.set(x, y, fa.get(x, y))
    b = raise_bow(P['grip'], P['tilt'], P['nock'])
    string = Grid(UW, H)
    for y in range(H):                                        # the string goes over the grip fist (drawn after it)
        for x in range(UW):
            if b.px[y][x] == 'f': string.px[y][x] = 'f'; b.px[y][x] = '.'
    g.stamp(b, 0, 0)
    arrow(g, P['nock'])
    rows, at = fist(GRIP_FIST, P['grip'])
    for j, r in enumerate(rows):
        for i, ch in enumerate(r):
            if ch not in ' .': g.set(at[0] + i, at[1] + j, 'O' if ch == 'O' else AR.HAND['base']['abc'.index(ch)])
    g.stamp(string, 0, 0)
    near = P['near']
    near.hand = fist(PINCH, P['nock'])
    m = AR.material(near)
    arm = AR.dress_arm(near, wear, m)
    AR.blend(arm, near, g, m)
    g.stamp(arm, 0, 0)
    return g


# --- the outfits: the original (the approved Archer), outfit B (GPT: different sleeve colours and proportions), base --
B_MAP = {'T': 'M', 't': 'm', 'W': 'Y', 'F': 'Y'}


def recolour(g: Grid, mp, belt=False) -> Grid:
    out = Grid(g.w, g.h)
    for y in range(g.h):
        for x in range(g.w):
            ch = g.px[y][x]
            if ch == '.': continue
            if belt and 24 <= x <= 27 and 42 <= y <= 45 and ch == 'Y': out.px[y][x] = 'f'
            elif belt and 43 <= y <= 44 and ch in 'Bb': out.px[y][x] = 'K'
            else: out.px[y][x] = mp.get(ch, ch)
    return out


ITEMS = dict(IR.ITEMS)
ITEMS['tunic_b'] = recolour(IR.ITEMS['tunic'], B_MAP, belt=True)
ITEMS['bracers_b'] = Grid(W, H)                                  # (bracers have no torso part)
ITEMS['boots_b'] = MR.boots_b(IR.ITEMS['boots'])
ORDER = ['boots', 'boots_b', 'tunic', 'tunic_b', 'bracers', 'bracers_b', 'quiver', 'cape', 'hood']
T_SUPPORT_B = recolour(O.T_SUPPORT, B_MAP)
POINT_B = {(x, y): MR._tb.px[y][x] for (x, y) in MR.POINT if MR._tb.px[y][x] != MR.M.px[y][x]}
OUTFITS = {'base': (), 'original': O.ALL, 'B': ('boots_b', 'tunic_b', 'bracers_b', 'quiver', 'cape', 'hood')}


def frame(pose: str, wear, legs: Grid, boots: Grid, bob=0, lag=False) -> Grid:
    f = Grid(F, F)
    bk = O.back(wear, walking=lag)
    f.stamp(A.LAG(bk) if lag else bk, OX, OY + bob)
    f.stamp(legs, 0, 0)
    up = upper(pose, wear)
    f.stamp(up, OX, OY + bob)
    if 'tunic_b' in wear:                                        # outfit B: the tunic's point over the legs, the cuff
        for (x, y), ch in POINT_B.items(): f.set(x + OX, y + OY + bob, ch)
        MR.cuff(f, boots, {(x + OX, y + OY + bob) for y in range(H) for x in range(UW) if up.px[y][x] != '.'} |
                {(x + OX, y + OY + bob) for (x, y) in POINT_B})
    return f


def boots_of(wear, legs: Grid) -> Grid:
    return MR.boots_b(legs) if 'boots_b' in wear else legs


def stand_legs(wear):
    g = Grid(F, F)
    g.stamp(O.pick(BR.BASE, lambda x, y: (x, y) in LEGS), OX, OY)
    b = Grid(F, F)
    if 'boots' in wear or 'boots_b' in wear:
        b.stamp(O.pick(ITEMS['boots_b' if 'boots_b' in wear else 'boots'], lambda x, y: (x, y) in LEGS), OX, OY)
        g.stamp(b, 0, 0)
    return g, b


def walk_legs(wear, k=1):
    wi, bob, _, _ = MR.PLAN[k]
    g = O.base_walk_legs(wi, bob)
    b = Grid(F, F)
    if 'boots' in wear or 'boots_b' in wear:
        b = boots_of(wear, MR._LEGS[wi]); g.stamp(b, 0, 0)
    return g, b


def shot_frame(pose, outfit, passing=False):
    wear = OUTFITS[outfit]
    if passing:
        legs, boots = walk_legs(wear)
        return frame(pose, wear, legs, boots, -1, True)
    legs, boots = stand_legs(wear)
    return frame(pose, wear, legs, boots)


for _o in OUTFITS:
    A.FRAMES[f'shot_proof~{_o}'] = [(shot_frame(p, _o, pas), 200) for pas in (False, True) for p in POSES]
