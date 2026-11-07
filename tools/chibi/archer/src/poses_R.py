"""The rest of the Archer's moves on the paper doll (GPT 8 Nov, the minimal set): the landing squash, the air pose, the
hit recoil, the combat stance (a softened Raise, breathing), the run (the walk, faster, leaning a pixel forward), the
knockdown (lying), the get-up crouch, and three category poses for the non-shot skills — kick, kneel/place,
call/summon. Every pose is the rigid upper body (the torso, the head and its slots, the items' torso parts) moved as a
whole, the limbs from the rig (arms_R: the base's colours, each item's bands), the bow carried or raised.
Master px: x forward, y down, the feet's soles on row 63."""
import math, os, sys
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE); sys.path.insert(0, os.path.join(HERE, '..', '..'))
from pix import Grid
from procbow import path_bow
import frames_R as A
import minimal_R as MR
import outfit_R as O
import arms_R as AR
import shotbase_R as SB
import doll_R as D

W, H, F = D.W, D.H, D.F
OX, OY = D.OX, D.OY
UW = SB.UW
NEAR_SH, FAR_SH = SB.NEAR_SH, SB.FAR_SH
NEAR_HIP, FAR_HIP = (17.5, 47.0), (27.5, 47.0)


def ik(s, w, l1=7.0, l2=7.5, fwd=True):
    """The middle joint of a two-bone limb from s to w (lengths l1, l2): the knee forward (+x) or the elbow back."""
    dx, dy = w[0] - s[0], w[1] - s[1]
    d = max(0.01, min(math.hypot(dx, dy), l1 + l2 - 0.05))
    a = (l1 * l1 - l2 * l2 + d * d) / (2 * d); h = math.sqrt(max(0.0, l1 * l1 - a * a))
    ux, uy = dx / d, dy / d
    c1 = (s[0] + a * ux - h * uy, s[1] + a * uy + h * ux)
    c2 = (s[0] + a * ux + h * uy, s[1] + a * uy - h * ux)
    return max(c1, c2) if fwd else min(c1, c2)


def leg(side, hip, ankle, toe, knee=None):
    k = knee or ik(hip, ankle, 7.5, 7.5, True)
    return AR.Arm(side, hip, k, ankle, r_up=2.8, r_fore=2.6, r_wrist=2.4, toe=toe, r_toe=1.6)


def arm(side, sh, wrist, elbow=None, back=True, hand=None):
    e = elbow or ik(sh, wrist, 7.0, 6.0, not back)
    return AR.Arm(side, sh, e, wrist, hand=hand, r_up=1.9 if side == 'near' else 1.7, r_fore=1.8 if side == 'near' else 1.6,
                  r_wrist=1.6 if side == 'near' else 1.5)


def shifted(g: Grid, dx, dy) -> Grid:
    o = Grid(g.w, g.h); o.stamp(g, dx, dy); return o


FIST = [' OOO ',                                            # a closed hand at the end of a free arm
        'ObbbO',
        'OcbbO',
        ' OOO ']


def limb_layers(limb: AR.Arm):
    """A limb's layers (base, then each item's bands), the shoulder outline blended into the body."""
    out, m = D.arm_layers(limb, items=('boots',) if 'leg' in limb.side else ('tunic', 'bracers'))
    return out, m


def eyes_shut(L):
    """The blink's lids on the base torso layer (frames_R.blink's edits)."""
    for key, g in L:
        if key == 'base.torso':
            ref = g.copy(); sh = A.blink(ref)
            for y in range(H):
                for x in range(W):
                    if sh.px[y][x] != ref.px[y][x]: g.px[y][x] = sh.px[y][x]


def pose(P) -> D.Frame:
    """One pose: P = dict(dx, dy (the upper body's move), legs: (near, far) Arm, far, near: Arm, bow: ('carry', grip, rot)
    | ('raise', grip, tilt, nock), shut: eyes shut, cape: px the cape's hem lifts)."""
    dx, dy = P.get('dx', 0), P.get('dy', 0)
    f = D.Frame()
    capeb = O.back(('cape',)); quivb = O.back(('quiver',))
    lift = P.get('cape', 0)
    if lift: capeb = A.shift_rows(capeb, 44, 58, -lift)
    bowl = []
    kind = P['bow'][0]
    if kind == 'carry':
        _, grip, rot = P['bow']
        b, _ = path_bow(UW, H, grip[0] + dx, grip[1] + dy, A.CARRY_LIMB, A.CARRY_STRING, rot=rot, style=A.BOW_STYLE)
        f.add('bow', b, OX, OY)                                   # behind everything (the far hand holds it)
    f.add('cape.back', shifted(capeb, dx, dy), OX, OY)
    f.add('quiver.back', shifted(quivb, dx, dy), OX, OY)
    for lg in P['legs']:                                         # the legs (base, the boots' bands)
        for key, g in limb_layers(lg)[0]: f.add(key.replace('base.', 'base.').replace('legarm', 'leg'), g, OX, OY)
    up = []
    far = P['far']
    fl, fm = limb_layers(far)
    for key, g in fl: up.append((key, O.pick(g, lambda x, y: fm.get((x, y), ('O', 0))[1] < 0.5)))
    tl = [(k, (shifted(g, 0, 0) if g is not None else None)) for k, g in D.torso_layers()]
    if P.get('shut'): eyes_shut(tl)
    up += tl
    for key, g in fl: up.append((key.replace('arm', 'fore'), O.pick(g, lambda x, y: fm.get((x, y), ('O', 0))[1] >= 0.5)))
    if kind == 'carry':
        _, grip, rot = P['bow']
        fg = Grid(UW, H)
        for j, row in enumerate(A.CARRY_FIST):
            for i, ch in enumerate(row):
                if ch not in ' .': fg.set(grip[0] - 3 + i, grip[1] - 3 + j, ch)
        up.append(('base.fist', fg))
    else:
        _, grip, tilt, nock = P['bow']
        bw = SB.raise_bow(grip, tilt, nock, bend=3)
        string = Grid(UW, H)
        for y in range(H):
            for x in range(UW):
                if bw.px[y][x] == 'f': string.px[y][x] = 'f'; bw.px[y][x] = '.'
        up.append(('bow', bw))
        rows, at = SB.fist(SB.GRIP_FIST, grip)
        gf = Grid(UW, H)
        for j, r in enumerate(rows):
            for i, ch in enumerate(r):
                if ch not in ' .': gf.set(at[0] + i, at[1] + j, 'O' if ch == 'O' else AR.HAND['base']['abc'.index(ch)])
        up.append(('base.grip', gf))
        up.append(('bow.string', string))
    near = P['near']
    nl, nm = limb_layers(near)
    body = D.stack(up, UW, H, ())
    for key, g in nl:
        AR.blend(g, near, body, nm)
        up.append((key, g))
    for key, g in up: f.add(key, None if g is None else shifted(g, dx, dy), OX, OY)
    f.head = (dx, dy)
    return f


# --- the poses (master px; the upper body's own coordinates before its move dx, dy) ------------------------------------
def stand_legs():
    return (leg('nearleg', NEAR_HIP, (17.0, 60.0), (21.0, 61.0)), leg('farleg', FAR_HIP, (28.0, 60.0), (32.0, 61.0)))


def carry_far(grip=(34, 48), rot=0.0, sh=FAR_SH):
    return arm('far', sh, (grip[0], grip[1] - 2), back=True), ('carry', grip, rot)


def hang_near(sh=NEAR_SH, wrist=(15.0, 46.0)):
    return arm('near', sh, wrist, back=True, hand=SB.fist(FIST, (int(round(wrist[0])), int(round(wrist[1] + 2)))))


def poses():
    P = {}
    fa, bw = carry_far()
    # the landing squash: the upper body down 2, both knees bent forward, feet planted
    P['land'] = dict(dy=2, legs=(leg('nearleg', (17.5, 49), (17.0, 60.0), (21.0, 61.0)), leg('farleg', (27.5, 49), (28.0, 60.0), (32.0, 61.0))),
                     far=arm('far', FAR_SH, (34, 46)), near=hang_near(NEAR_SH, (15.0, 46.0)), bow=('carry', (34, 48), 0.0))
    # the air pose: knees tucked, the bow arm out in front for balance, the free arm back, the cape's hem lifting
    P['air'] = dict(legs=(leg('nearleg', NEAR_HIP, (15.0, 56.0), (18.5, 58.5), knee=(22.5, 51.5)),
                          leg('farleg', FAR_HIP, (25.5, 56.0), (29.0, 58.5), knee=(32.5, 51.5))),
                    far=arm('far', FAR_SH, (39.0, 40.0), back=False), near=hang_near(NEAR_SH, (11.0, 42.0)),
                    bow=('carry', (40, 42), -0.5), cape=2)
    # the hit recoil: the upper body knocked back a pixel, the eyes shut, the free arm flung up and back
    P['hurt'] = dict(dx=-1, legs=(leg('nearleg', NEAR_HIP, (16.0, 60.0), (20.0, 61.0)), leg('farleg', FAR_HIP, (29.0, 60.0), (33.0, 61.0))),
                     far=arm('far', FAR_SH, (32.0, 45.0)), near=hang_near(NEAR_SH, (8.0, 27.0)),
                     bow=('carry', (32, 47), 0.35), shut=True, cape=1)
    # the combat stance: a softened Raise — the bow up, no arrow, the hand near the string, less drawn; breathing
    st = dict(legs=stand_legs(), far=arm('far', FAR_SH, (36.0, 39.0), elbow=(33.0, 41.0)),
              near=arm('near', NEAR_SH, (24.0, 38.0), elbow=(15.5, 40.5), hand=SB.fist(SB.PINCH, (25, 38))),
              bow=('raise', (38, 40), 20, (25, 38)))
    P['stance'] = st
    P['stance_up'] = dict(st, dy=-1)
    # the get-up: a crouch, deeper than the landing, the free hand on the knee
    P['getup'] = dict(dy=4, legs=(leg('nearleg', (17.5, 51), (16.5, 60.0), (20.5, 61.0)), leg('farleg', (27.5, 51), (28.5, 60.0), (32.5, 61.0))),
                      far=arm('far', FAR_SH, (34, 46)), near=hang_near(NEAR_SH, (21.0, 47.0)), bow=('carry', (34, 48), 0.0))
    # kick: the far leg out in front, the body leaning back a pixel, the free arm back for balance
    P['kick'] = dict(dx=-1, legs=(leg('nearleg', NEAR_HIP, (17.0, 60.0), (21.0, 61.0)),
                                  leg('farleg', FAR_HIP, (40.0, 45.0), (43.5, 43.5), knee=(33.5, 47.5))),
                     far=arm('far', FAR_SH, (33.0, 46.0)), near=hang_near(NEAR_SH, (8.0, 39.0)), bow=('carry', (33, 48), 0.2))
    # kneel / place: the near knee on the ground, the far foot planted ahead, the free hand reaching to the ground
    P['kneel'] = dict(dy=5, legs=(leg('nearleg', (17.5, 52), (11.0, 61.0), (8.0, 61.5), knee=(19.0, 58.5)),
                                  leg('farleg', (27.5, 52), (31.0, 60.0), (35.0, 61.0), knee=(33.5, 52.5))),
                      far=arm('far', FAR_SH, (34, 46)), near=hang_near(NEAR_SH, (22.0, 46.0)), bow=('carry', (34, 48), 0.0))
    # call / summon: the free arm raised high beside the head, the bow carried
    P['call'] = dict(legs=stand_legs(), far=fa, near=hang_near(NEAR_SH, (9.0, 20.0)), bow=bw)
    return P


def run_frames():
    """The run: the walk's four frames, the upper body a pixel forward (GPT: the walk, faster, a 1 px lean)."""
    seq = []
    for f, ms in D.walk_frames():
        g = D.Frame()
        for key, L in f.layers:
            if L is None or key.startswith('base.legs') or key == 'boots' or key.endswith('.back'): g.layers.append((key, L)); continue
            g.layers.append((key, shifted(L, 1, 0)))
        g.head = (f.head[0] + 1, f.head[1])
        seq.append((g, 110))
    return seq


def down_frame():
    """Knocked down, lying on the back: the standing figure turned a quarter (the face up, the head behind), on the
    ground."""
    st = D.idle_frames()[0][0]
    f = D.Frame()
    for key, L in st.layers:
        if L is None: f.layers.append((key, None)); continue
        o = Grid(F, F)
        for y in range(F):
            for x in range(F):
                ch = L.px[y][x]
                if ch == '.': continue
                nx, ny = y - 8, 113 - x                              # (x, y) → the body along the ground, the face up
                o.set(nx, ny, ch)
        f.layers.append((key, o))
    f.head = (0, 0)
    return f


def anims():
    P = poses()
    out = {}
    for name in ('land', 'air', 'hurt', 'getup', 'kick', 'kneel', 'call'):
        out[name] = [(pose(P[name]), 0)]
    out['stance'] = [(pose(P['stance']), 400), (pose(P['stance_up']), 300), (pose(P['stance_up']), 400), (pose(P['stance']), 300)]
    out['run'] = run_frames()
    out['down'] = [(down_frame(), 0)]
    return out
