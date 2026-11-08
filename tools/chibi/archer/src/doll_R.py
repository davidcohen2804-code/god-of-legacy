"""The paper doll (8 Nov — David: the clothes easy to change, a character creation and a cash shop; GPT: precomposed
layers, the game only stacks them). Every frame the game plays is exported as an ordered list of layers — the base
body's parts and each item's parts, already moved where that frame puts them — and the game stacks the layers of the
worn items for the chosen look, then closes bare edges with an outline inside the frame's reference silhouette (the
frame with every original item on: with everything worn the stack IS the approved frame). Palette swaps (skin, hair,
bow) are per layer. Head attachments (hair styles, eyes, hats, face accessories) are single drawings placed per frame
at the head's offset ('@' slots in the layer list).

Content-dependent moves (the idle's breathing stretch, the cape's lag) are applied to every layer through the move the
same operation makes on the reference composite (a grid of coordinates), so the layers move exactly as the approved
composite did."""
import json, os, sys
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE); sys.path.insert(0, os.path.join(HERE, '..', '..'))
from pix import Grid
from procbow import path_bow
import frames_R as A
import minimal_R as MR
import base_R as BR
import items_R as IR
import outfit_R as O
import arms_R as AR
import shotbase_R as SB

F, W, H = A.F, IR.W, IR.H
OX, OY = MR.OX, MR.OY
ORIG = tuple(IR.ORDER)                                    # the original Archer's items


def item_of(key: str) -> str:
    return key.split('.')[0]


class Frame:
    """An ordered list of (key, Grid F×F); '@slot' keys (Grid None) mark where head attachments go."""
    def __init__(self):
        self.layers = []
        self.head = (0, 0)
        self.T = None                                     # the head's place (master px → frame px), when not a move
        self.shut = False                                 # the eyes shut (the blink, the hit)

    def add(self, key, g, ox=0, oy=0):
        if g is None: self.layers.append((key, None)); return
        out = Grid(F, F); out.stamp(g, ox, oy); self.layers.append((key, out))

    def flat(self, wear=ORIG) -> Grid:
        g = Grid(F, F)
        for key, L in self.layers:
            if L is not None and (item_of(key) == 'base' or item_of(key) == 'bow' or item_of(key) in wear): g.stamp(L, 0, 0)
        return g


# --- moving layers the way the composite moved -----------------------------------------------------------------------
def tag(ref: Grid) -> Grid:
    t = Grid(ref.w, ref.h)
    for y in range(ref.h):
        for x in range(ref.w):
            if ref.px[y][x] != '.': t.px[y][x] = (x, y)
    return t


def moved(layers, ref: Grid, op):
    """op (a Grid → Grid move) applied to every layer as it moved the composite `ref`."""
    m = op(tag(ref))
    out = []
    for key, g in layers:
        if g is None: out.append((key, None)); continue
        o = Grid(m.w, m.h)
        for y in range(m.h):
            for x in range(m.w):
                s = m.px[y][x]
                if s != '.': o.px[y][x] = g.get(*s)
        out.append((key, o))
    return out


def stack(layers, w, h, wear=ORIG) -> Grid:
    g = Grid(w, h)
    for key, L in layers:
        if L is not None and (item_of(key) in ('base', 'bow') or item_of(key) in wear): g.stamp(L, 0, 0)
    return g


def with_bow(layers, w, h, grip=A.GRIP, rot=0.0, fist=A.CARRY_FIST):
    """frames_R.with_bow on layers: the bow at the bottom, every layer cut round the grip, the grip fist on top."""
    gx, gy = grip
    b, _ = path_bow(w + 16, h, gx, gy, A.CARRY_LIMB, A.CARRY_STRING, rot=rot, style=A.BOW_STYLE)
    out = [('bow', b)]
    for key, g in layers:
        if g is None: out.append((key, None)); continue
        c = Grid(w + 16, h); c.stamp(g, 0, 0)
        for y in range(gy - 2, gy + 4):
            for x in range(gx - 2, gx + 4): c.set(x, y, '.')
        out.append((key, c))
    fg = Grid(w + 16, h)
    for j, row in enumerate(fist):
        for i, ch in enumerate(row):
            if ch not in ' .': fg.set(gx - 3 + i, gy - 3 + j, ch)
    out.append(('base.fist', fg))
    return out


def to_frame(layers, ox=OX, oy=OY, head=(0, 0)) -> Frame:
    f = Frame()
    for key, g in layers: f.add(key, g, ox, oy)
    f.head = head
    return f


# --- the standing figure (idle, blink) ---------------------------------------------------------------------------------
def dressed():
    """IR.dress as layers: the back parts, the base, '@' head slots, the items in order (hood last), '@hat'."""
    L = [('cape.back', IR.BACK['cape'].copy()), ('quiver.back', IR.BACK['quiver'].copy()), ('base', BR.BASE.copy()),
         ('@hair', None), ('@eyes', None), ('@face', None)]
    for k in IR.ORDER: L.append((k, IR.ITEMS[k].copy()))
    L.append(('@hat', None))
    return L


RISE = lambda g: A.lift(A.lift(A.shift_rows(g, 0, 44, -1), 31, 36, 46, 51), 11, 19, 47, 51)


def keep_top(f: Frame, d_layers):
    """outfit_R.keep_top on layers: each layer's own top row one row above the risen figure."""
    tops = {key: g for key, g in d_layers if g is not None}
    for i, (key, g) in enumerate(f.layers):
        if g is None or key not in tops: continue
        for x in range(W):
            ch = tops[key].px[0][x]
            if ch != '.': g.set(x + OX, OY - 1, ch)


def idle_frames():
    d = dressed()
    ref = stack(d, W, H)
    rise = moved(d, ref, RISE)
    rref = stack(rise, W, H)
    seq = []
    for i, (lay, lref, up, lag, ms, hd) in enumerate(((d, ref, False, False, 400, 0), (rise, rref, True, False, 300, -1),
                                                      (rise, rref, True, True, 400, -1), (d, ref, False, True, 300, 0))):
        if lag: lay = moved(lay, lref, A.LAG)
        L = with_bow(lay, W, H, A.UP if up else A.GRIP)
        f = to_frame(L, head=(0, hd))
        if up: keep_top(f, d)
        seq.append((f, ms))
    return seq


def blink_frame():
    d = dressed()
    ref = stack(d, W, H)
    shut = A.blink(ref)
    for y in range(H):                                           # the lids: on the base (the face), off any item there
        for x in range(W):
            if shut.px[y][x] != ref.px[y][x]:
                for key, g in d:
                    if g is not None and key != 'base': g.px[y][x] = '.'
                dict(d)['base'].px[y][x] = shut.px[y][x]
    f = to_frame(with_bow(d, W, H)); f.shut = True
    return [(f, 130)]


# --- the walk (outfit_R.walk) ------------------------------------------------------------------------------------------
def walk_frames():
    seq = []
    for k, (wi, bob, s, lag) in enumerate(MR.PLAN):
        back = [('cape.back', O.back(('cape',), walking=True)), ('quiver.back', O.back(('quiver',), walking=True))]
        if lag: back = moved(back, stack(back, W, H, ORIG), A.LAG)
        f = Frame()
        for key, g in back: f.add(key, g, OX, OY + bob)
        f.add('base.legs', O.base_walk_legs(wi, bob))
        f.add('boots', MR._LEGS[wi])
        up = [('base.upper', O.B_UPPER),
              ('base.support', O.pick(O.B_SUPPORT, lambda x, y: (x, y) in O.NEAR)),
              ('tunic.support', O.pick(O.T_SUPPORT, lambda x, y: (x, y) in O.NEAR)),
              ('@hair', None), ('@eyes', None), ('@face', None)]
        for it in IR.ORDER: up.append((it, O.item_part(it, lambda x, y: (x, y) not in O.NEAR and (x, y) not in O.LEGS)))
        up.append(('@hat', None))
        for key, g in with_bow(up, W, H): f.add(key, g, OX, OY + bob)
        f.add('base.arm', MR.swing(O.B_ARM, s), OX, OY + bob)
        for it in IR.ORDER: f.add(it + '.arm', MR.swing(O.item_part(it, lambda x, y: (x, y) in O.NEAR), s), OX, OY + bob)
        f.head = (0, bob)
        seq.append((f, MR.MS))
    return seq


# --- the shot (shotbase_R) ---------------------------------------------------------------------------------------------
def torso_layers():
    """shotbase_R.torso as layers: the base's torso with its supports, fills and edges (the base alone), the tunic's
    torso with its support and the fills it changes, the other items' torso parts."""
    base = SB.torso((), close=False)                          # (bare edges: closed by the game, per look)
    a1, a0 = SB.torso(O.ALL), SB.torso(O.ALL, close=False)    # the edges bare even with everything on (where the arms
    for y in range(H):                                         # hung): the base's own outline
        for x in range(W):
            if a1.px[y][x] != a0.px[y][x]: base.px[y][x] = a1.px[y][x]
    tun = SB.torso(('tunic',), close=False)
    tl = Grid(W, H)
    for y in range(H):
        for x in range(W):
            if tun.px[y][x] != base.px[y][x] and tun.px[y][x] != '.': tl.px[y][x] = tun.px[y][x]
    L = [('base.torso', base), ('@hair', None), ('@eyes', None), ('@face', None), ('tunic.torso', tl)]
    for k in SB.ORDER:
        if k in ('tunic', 'boots', 'boots_b', 'tunic_b', 'bracers_b'): continue
        L.append((k, O.pick(SB.ITEMS[k], lambda x, y: (x, y) not in SB.ARMS and (x, y) not in SB.LEGS)))
    L.append(('@hat', None))
    return L


def arm_layers(arm: AR.Arm, items=('tunic', 'bracers')):
    """One arm in a pose as layers: the base's colours, then each item's bands alone (their pixels and edges)."""
    m = AR.material(arm)
    base = AR.dress_arm(arm, (), m)
    out = [('base.' + arm.side + 'arm', base)]
    for it in items:
        g = AR.dress_arm(arm, (it,), m)
        d = Grid(g.w, g.h)
        for y in range(g.h):
            for x in range(g.w):
                if g.px[y][x] != base.px[y][x]: d.px[y][x] = g.px[y][x]
        out.append((it + '.' + arm.side + 'arm', d))
    return out, m


def shot_frame(pose: str) -> Frame:
    P = SB.POSES[pose]
    UW = SB.UW
    f = Frame()
    for key, g in (('cape.back', O.back(('cape',))), ('quiver.back', O.back(('quiver',)))): f.add(key, g, OX, OY)
    legs, boots = SB.stand_legs(())
    f.add('base.legs', legs)
    _, b2 = SB.stand_legs(('boots',))
    f.add('boots', b2)
    up = []
    far = P['far']; far.hand = None
    fl, fm = arm_layers(far)
    for key, g in fl:                                        # the far upper arm behind the torso
        up.append((key, O.pick(g, lambda x, y: fm.get((x, y), ('O', 0))[1] < 0.5)))
    up += torso_layers()
    for key, g in fl:                                        # its forearm (from the elbow) over it
        up.append((key.replace('arm', 'fore'), O.pick(g, lambda x, y: fm.get((x, y), ('O', 0))[1] >= 0.5)))
    bw = SB.raise_bow(P['grip'], P['tilt'], P['nock'], bend=P.get('bend', 3))
    string = Grid(UW, H)
    for y in range(H):
        for x in range(UW):
            if bw.px[y][x] == 'f': string.px[y][x] = 'f'; bw.px[y][x] = '.'
    up.append(('bow', bw))
    if P['nock'] is not None:
        ar = Grid(UW, H); SB.arrow(ar, P['nock']); up.append(('bow.arrow', ar))
    rows, at = SB.fist(SB.GRIP_FIST, P['grip'])
    gf = Grid(UW, H)
    for j, r in enumerate(rows):
        for i, ch in enumerate(r):
            if ch not in ' .': gf.set(at[0] + i, at[1] + j, 'O' if ch == 'O' else AR.HAND['base']['abc'.index(ch)])
    up.append(('base.grip', gf))
    up.append(('bow.string', string))
    near = P['near']
    near.hand = SB.fist(*P['hand'])
    nl, nm = arm_layers(near)
    body = stack(up, UW, H, ())                              # (the shoulder blend: against the base body)
    for key, g in nl:
        AR.blend(g, near, body, nm)
        up.append((key, g))
    for key, g in up: f.add(key, g, OX, OY)
    return f


# --- check and export --------------------------------------------------------------------------------------------------
def same(a: Grid, b: Grid):
    return sum(1 for y in range(F) for x in range(F) if a.px[y][x] != b.px[y][x])


def anims():
    out = {'idle': idle_frames(), 'blink': blink_frame(), 'walk4': walk_frames()}
    sh = [(shot_frame(p), 0) for p in ('raise', 'draw', 'release', 'recover')]
    out['shot'] = sh
    return out


def check(an=None):
    an = an or anims()
    rep = {}
    for name in ('idle', 'blink', 'walk4'):
        rep[name] = [same(f.flat(ORIG), h) for (f, _), (h, _) in zip(an[name], A.FRAMES[name])]
    rep['shot'] = [same(f.flat(ORIG), SB.shot_frame(p, 'original')) for (f, _), p in zip(an['shot'], ('raise', 'draw', 'release', 'recover'))]
    return rep


if __name__ == '__main__':
    print(check())


def runtime(f: Frame, wear) -> Grid:
    """What the game draws for a look: the worn layers stacked, then the bare edges closed inside the reference."""
    g = f.flat(wear)
    ref = f.flat(ORIG)
    add = [(x, y) for y in range(F) for x in range(F) if g.px[y][x] == '.' and ref.px[y][x] != '.' and
           any(0 <= x + dx < F and 0 <= y + dy < F and g.px[y + dy][x + dx] not in '.O' for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)))]
    for (x, y) in add: g.px[y][x] = 'O'
    return g


# --- export ------------------------------------------------------------------------------------------------------------
def rle(g: Grid, x0, y0, x1, y1, fill=None) -> str:
    rows = []
    for y in range(y0, y1 + 1):
        s = ''.join(('#' if g.px[y][x] != '.' else '.') if fill else g.px[y][x] for x in range(x0, x1 + 1))
        out, i = [], 0
        while i < len(s):
            j = i
            while j < len(s) and s[j] == s[i]: j += 1
            out.append((str(j - i) if j - i > 1 else '') + s[i]); i = j
        rows.append(''.join(out))
    return '/'.join(rows)


def bbox(g: Grid):
    xs = [x for y in range(g.h) for x in range(g.w) if g.px[y][x] != '.']
    ys = [y for y in range(g.h) for x in range(g.w) if g.px[y][x] != '.']
    return (min(xs), min(ys), max(xs), max(ys)) if xs else None


def frame_json(f: Frame) -> dict:
    L = []
    for key, g in f.layers:
        if g is None: L.append([key]); continue
        b = bbox(g)
        if b: L.append([key, b[0], b[1], rle(g, *b)])
    ref = getattr(f, 'ref', None) or f.flat(ORIG); b = bbox(ref)
    d = {'L': L, 'ref': [b[0], b[1], rle(ref, *b, fill=True)], 'head': list(f.head), 'T': list(head_T(f))}
    if f.shut: d['shut'] = 1
    return d


LOOPS = {'idle': True, 'walk4': True}


LOOPS.update({'stance': True, 'run': True})


# --- the head's looks (looks_R): the face in the base, the hair and the eyes laid on per frame ---------------------
HEAD_LAYERS = ('base', 'base.upper', 'base.torso')


def head_T(f: Frame):
    if f.T is not None: return f.T
    return (1, 0, OX + f.head[0], 0, 1, OY + f.head[1])


def at(T, x, y):
    return T[0] * x + T[1] * y + T[2], T[3] * x + T[4] * y + T[5]


def split_head(f: Frame):
    """The base's head → the face (looks_R.FACE); the hair and the eyes go to their slots (drawn per look)."""
    import looks_R as LK
    T = head_T(f)
    body = BR.body()
    for key, g in f.layers:
        if g is None or key not in HEAD_LAYERS: continue
        for y in range(31):
            for x in range(W):
                if LK.HD.px[y][x] == '.': continue
                X, Y = at(T, x, y)
                v = LK.FACE.px[y][x]
                g.set(X, Y, v if v != '.' else body.px[y][x])
        return key
    raise ValueError('no head layer')


def draw_att(g: Grid, att: Grid, T, cut=None):
    for y in range(att.h):
        for x in range(att.w):
            ch = att.px[y][x]
            if ch == '.' or (cut and (x, y) in cut): continue
            X, Y = at(T, x, y)
            if 0 <= X < F and 0 <= Y < F: g.px[Y][X] = ch


def compose(f: Frame, wear=ORIG, hair=None, eyes=None, shut=None, hat=None, acc=None, cut=None) -> Grid:
    """The game's composition of a split frame (ChibiDoll.ts): the worn layers, the attachments at their slots, the bare
    edges closed inside the reference."""
    import looks_R as LK
    hair = LK.WIND if hair is None else hair
    eyes = (LK.CALM_SHUT if f.shut else LK.CALM) if eyes is None else (shut if f.shut and shut is not None else eyes)
    T = head_T(f)
    g = Grid(F, F)
    for key, L in f.layers:
        if L is None:
            if key == '@hair': draw_att(g, hair, T, cut)
            elif key == '@eyes': draw_att(g, eyes, T)
            elif key == '@face' and acc is not None: draw_att(g, acc, T)
            elif key == '@hat' and hat is not None: draw_att(g, hat, T)
            continue
        if item_of(key) in ('base', 'bow') or item_of(key) in wear: g.stamp(L, 0, 0)
    ref = f.ref
    add = [(x, y) for y in range(F) for x in range(F) if g.px[y][x] == '.' and ref.px[y][x] != '.' and
           any(0 <= x + dx < F and 0 <= y + dy < F and g.px[y + dy][x + dx] not in '.O' for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)))]
    for (x, y) in add: g.px[y][x] = 'O'
    return g


def split_all(an):
    """Every frame's head split; the check: with the approved hair, eyes and items every frame is what it was (and so
    is every removal of items)."""
    rep = {}
    for name, seq in an.items():
        for i, (f, _) in enumerate(seq):
            f.ref = f.flat(ORIG)
            before = {w: runtime(f, w) for w in (ORIG, (), ('tunic', 'boots'))}
            split_head(f)
            f.ref = before[ORIG]
            bad = [same(compose(f, w), before[w]) for w in before]
            if any(bad): rep[f'{name}{i}'] = bad
    return rep


def att_json(g: Grid, pal=None, mask=False) -> dict:
    b = bbox(g)
    d = {'x': b[0], 'y': b[1], 'rle': rle(g, *b, fill=mask)}
    if pal: d['pal'] = pal
    return d


def export(path: str):
    from palette import PALETTE
    import poses_R                                         # the rest of the moves (GPT's minimal set)
    import looks_R
    an = anims()
    an.update(poses_R.anims())
    bad = split_all(an)
    assert all(v[0] == 0 for v in bad.values()) and set(bad) <= {'hurt0'}, bad   # (the hit's shut eyes: the blink's
                                                                                  #  lids now, a pixel without the hood)
    frames, out = [], {}
    for name, seq in an.items():
        idx = []
        for f, ms in seq: idx.append(len(frames)); frames.append(frame_json(f))
        out[name] = {'frames': idx, 'ms': [ms for _, ms in seq], 'loop': LOOPS.get(name, False)}
    data = {'frame': F, 'origin': [A.FOOT[0], A.FOOT[1]], 'height': 62, 'facing': 'right', 'pal': PALETTE,
            'anims': out, 'frames': frames, 'looks': looks_R.export_json()}
    s = json.dumps(data, separators=(',', ':'))
    open(path, 'w').write(s)
    return len(s)
