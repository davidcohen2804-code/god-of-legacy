"""The Archer dressed from the base body and the items in every frame the game plays — the idle (4), the blink and the
4-frame walk — so the item system is where the frames come from (GPT 7 Nov: the round trip in motion, then removal
tests standing and walking). A frame is the base and the worn items composed the same way the approved frames were:
standing, the dressed figure moved by the idle's pixel moves; walking, the back behind the legs, the legs (the base's
legs under your walk drawings' boots), the upper body with the bow, the free arm swung in front.
Adds FRAMES '<anim>~<variant>' for the removal test (the variants below) and replaces nothing on its own."""
import os, sys
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE); sys.path.insert(0, os.path.join(HERE, '..', '..'))
from pix import Grid
import frames_R as A
import minimal_R as MR
import base_R as BR
import items_R as IR

W, H, F = IR.W, IR.H, A.F
OX, OY = MR.OX, MR.OY
NEAR = MR.NEAR
LEGS = {p for p, l in MR.LAY.items() if l == 'legs'}
ALL = tuple(IR.ORDER)
VARIANTS = {                                                   # the removal test (GPT: singles and a few combinations)
    'nohood': tuple(i for i in ALL if i != 'hood'),
    'notunic': tuple(i for i in ALL if i != 'tunic'),
    'nocape': tuple(i for i in ALL if i not in ('cape', 'quiver')),
    'noboots': tuple(i for i in ALL if i != 'boots'),
    'nobracers': tuple(i for i in ALL if i != 'bracers'),
    'tunicboots': ('tunic', 'boots'),
    'base': (),
}


def pick(g: Grid, keep) -> Grid:
    out = Grid(g.w, g.h)
    for y in range(g.h):
        for x in range(g.w):
            if g.px[y][x] != '.' and keep(x, y): out.px[y][x] = g.px[y][x]
    return out


# --- the parts ------------------------------------------------------------------------------------------------------
BASE = BR.BASE
B_ARM = pick(BASE, lambda x, y: (x, y) in NEAR)
B_UPPER = pick(BASE, lambda x, y: (x, y) not in NEAR and (x, y) not in LEGS)


def fill_under_arm(body: Grid, belt, side) -> Grid:
    """The support art under the free arm (for its swing), from the colours beside it: the front half of the arm's
    place takes the side colour (the belt's on the belt's rows), the back half the colour just behind the arm."""
    out = Grid(W, H)
    for y in range(38, 53):
        xs = sorted(x for x in range(8, 22) if (x, y) in NEAR)
        if not xs: continue
        xl, xr = xs[0], xs[-1]
        right = next((body.px[y][x] for x in range(xr + 1, xr + 6) if body.px[y][x] not in '.O'), side(y))
        for x in range(xl, xr + 1):
            out.px[y][x] = (belt if 42 <= y <= 45 else side(y)) if x - xl < (xr - xl + 1) // 2 else right
    return out


B_SUPPORT = fill_under_arm(B_UPPER, 'T', lambda y: 'T' if y <= 44 else 'p')        # the undershirt's / shorts' side
T_SUPPORT = pick(MR.support(MR.only(A.MASTER, {'head', 'top', 'far', 'body'})), lambda x, y: (x, y) in NEAR)   # the tunic's


def item_part(k, keep) -> Grid:
    return pick(IR.ITEMS[k], keep)


def upper(wear) -> Grid:
    """The upper body, master-sized: the base without its legs and free arm, the support under the arm (the tunic's
    side when the tunic is worn), the worn items over it (their pixels off the legs and the free arm), edges closed."""
    g = Grid(W, H)
    g.stamp(B_UPPER, 0, 0)
    for (x, y) in NEAR:                                          # (the support sits under the arm, over nothing else)
        for s in (B_SUPPORT, T_SUPPORT if 'tunic' in wear else None):
            if s is not None and s.px[y][x] != '.': g.px[y][x] = s.px[y][x]
    for k in IR.ORDER:
        if k in wear: g.stamp(item_part(k, lambda x, y: (x, y) not in NEAR and (x, y) not in LEGS), 0, 0)
    close_upper(g, back(wear))
    return g


def close_upper(g: Grid, behind: Grid) -> None:
    """IR.close for the upper body only (the legs come from elsewhere in the walk, and what hangs behind the body is
    drawn behind it: a pixel the worn back parts fill is not a bare edge)."""
    add = [(x, y) for y in range(H) for x in range(W) if g.px[y][x] == '.' and IR.MASTER_CLEAN.px[y][x] != '.' and
           (x, y) not in LEGS and (x, y) not in NEAR and behind.px[y][x] == '.' and
           any(0 <= x + dx < W and 0 <= y + dy < H and g.px[y + dy][x + dx] not in '.O' for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)))]
    for (x, y) in add: g.px[y][x] = 'O'


def arm(wear) -> Grid:
    g = Grid(W, H)
    g.stamp(B_ARM, 0, 0)
    for k in IR.ORDER:
        if k in wear: g.stamp(item_part(k, lambda x, y: (x, y) in NEAR), 0, 0)
    return g


def back(wear, walking=False) -> Grid:
    """The worn back parts (behind the body). Walking, without the cape hem's outline beside the standing legs (the
    walk's legs are elsewhere: it would float)."""
    g = Grid(W, H)
    for k in IR.BEHIND:
        if k in wear: g.stamp(IR.BACK[k], 0, 0)
    if walking:
        for (x, y) in BR.CAPE_HEM: g.px[y][x] = '.'
    return g


SKIN_W = {**BR.SKINC, 'e': 's', 'E': 's'}
SHORTS_W = {**BR.SHORTS, 'e': 'p', 'E': 'p'}
WRAPS_W = {**BR.WRAPS, 'e': 't', 'E': 't'}


def base_walk_legs(wi: int, bob: int) -> Grid:
    """The base's legs under one of your walk drawings: the same leg, its top two rows under the skirt the shorts'
    hems, its last five rows (the foot, wherever it is) the wraps, skin between; the outline as drawn."""
    legs = MR._LEGS[wi]
    out = Grid(F, F)
    seen = set()
    for y0 in range(F):
        for x0 in range(F):
            if legs.px[y0][x0] == '.' or (x0, y0) in seen: continue
            comp, stack = [], [(x0, y0)]; seen.add((x0, y0))
            while stack:                                         # one leg (with its outline)
                x, y = stack.pop(); comp.append((x, y))
                for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                    q = (x + dx, y + dy)
                    if 0 <= q[0] < F and 0 <= q[1] < F and q not in seen and legs.px[q[1]][q[0]] != '.':
                        seen.add(q); stack.append(q)
            bottom = max(y for _, y in comp)
            for (x, y) in comp:
                ch = legs.px[y][x]
                if ch == 'O': out.px[y][x] = 'O'
                elif y <= OY + bob + 54: out.px[y][x] = SHORTS_W.get(ch, 'P')
                elif y >= bottom - 4: out.px[y][x] = WRAPS_W.get(ch, 't')
                else: out.px[y][x] = SKIN_W.get(ch, 'S')
    return out


# --- the frames -----------------------------------------------------------------------------------------------------
def keep_top(f: Grid, d: Grid) -> Grid:
    """A risen frame keeps the figure's top row (shifting up a pixel pushed it out of the master's grid: the hood's
    or hair's top outline was lost on the two risen idle frames)."""
    for x in range(W):
        if d.px[0][x] != '.': f.set(x + OX, OY - 1, d.px[0][x])
    return f


def idle(wear):
    d = IR.dress(list(wear))
    rise = A.lift(A.lift(A.shift_rows(d, 0, 44, -1), 31, 36, 46, 51), 11, 19, 47, 51)
    return [(A.place(A.with_bow(d)), 400), (keep_top(A.place(A.with_bow(rise, A.UP)), d), 300),
            (keep_top(A.place(A.with_bow(A.LAG(rise), A.UP)), d), 400), (A.place(A.with_bow(A.LAG(d))), 300)]


def blink(wear):
    return [(A.place(A.with_bow(A.blink(IR.dress(list(wear))))), 130)]


def close_frame(f: Grid, ref: Grid) -> None:
    """A removed item's bare edges, closed in the finished frame: an empty pixel inside the fully dressed frame's
    silhouette, beside a coloured one, becomes outline (with everything worn there is none)."""
    add = [(x, y) for y in range(F) for x in range(F) if f.px[y][x] == '.' and ref.px[y][x] != '.' and
           any(0 <= x + dx < F and 0 <= y + dy < F and f.px[y + dy][x + dx] not in '.O' for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)))]
    for (x, y) in add: f.px[y][x] = 'O'


def walk(wear):
    seq = []
    for k, (wi, bob, s, lag) in enumerate(MR.PLAN):
        f = Grid(F, F)
        b = back(wear, walking=True)
        f.stamp(A.LAG(b) if lag else b, OX, OY + bob)
        f.stamp(base_walk_legs(wi, bob), 0, 0)
        if 'boots' in wear: f.stamp(MR._LEGS[wi], 0, 0)
        f.stamp(A.with_bow(upper(wear)), OX, OY + bob)
        f.stamp(MR.swing(arm(wear), s), OX, OY + bob)
        close_frame(f, A.FRAMES['walk4'][k][0])
        seq.append((f, MR.MS))
    return seq


def roundtrip_motion():
    """The item system with every item on against the frames the game plays now."""
    out = {}
    for name, mine in (('idle', idle(ALL)), ('blink', blink(ALL)), ('walk4', walk(ALL))):
        diffs = []
        for i, ((g, _), (h, _)) in enumerate(zip(mine, A.FRAMES[name])):
            diffs.append([(x, y, h.px[y][x], g.px[y][x]) for y in range(F) for x in range(F) if g.px[y][x] != h.px[y][x]])
        out[name] = diffs
    return out


if __name__ == '__main__':
    for name, diffs in roundtrip_motion().items():
        print(name, [len(d) for d in diffs], [d[:3] for d in diffs if d][:2])


# the game's frames from the item system: the removal test's variants, then the defaults themselves (the round trip
# above: identical but for the bow's own string pixel, GPT's cleanup)
for _v, _wear in VARIANTS.items():
    A.FRAMES[f'idle~{_v}'] = idle(_wear)
    A.FRAMES[f'blink~{_v}'] = blink(_wear)
    A.FRAMES[f'walk4~{_v}'] = walk(_wear)
_walk4 = walk(ALL)
A.FRAMES['idle'], A.FRAMES['blink'], A.FRAMES['walk4'] = idle(ALL), blink(ALL), _walk4
