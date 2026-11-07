"""The Archer's outfit cut into items over the base body (GPT 7 Nov: the round trip — base + the original items must
rebuild the approved master pixel for pixel). Every master pixel has one owner: the base (where the base already draws
it: the face, the bangs, the hands, shared outlines) or an item — hood (headwear), tunic (top: the tunic, its sleeves,
the belt, the skirt), bracers (forearms), boots (footwear), cape (back cloth), quiver (back accessory: the feathers,
the quiver, its strap across the chest). The bow is its own layer already (frames_R.with_bow).
An item that hangs behind the body (cape, quiver) is split by the base's silhouette: its pixels over the body are its
front part (the cape's wrap at the shoulder, the strap across the chest), the rest goes behind the body."""
import os, sys
from collections import Counter
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE); sys.path.insert(0, os.path.join(HERE, '..', '..'))
from pix import Grid
import frames_R as A
import minimal_R as MR
import base_R as BR

M, BASE = A.MASTER, BR.BASE
W, H = M.w, M.h
GREEN = set('LGgDYy')
STRAP = {(28, 36), (27, 37), (26, 38), (25, 39), (24, 40), (23, 41), (24, 34), (25, 34), (26, 34), (25, 35)}
ORDER = ['boots', 'tunic', 'bracers', 'quiver', 'cape', 'hood']          # front items, back to front
BEHIND = ('cape', 'quiver')


def owner(x, y, ch):
    lay = MR.LAY.get((x, y))
    if (x, y) == (6, 40): return 'cape'                                  # (the cape's edge, not the quiver's strap)
    if (x, y) in STRAP: return 'quiver'
    qx0, qx1, qy0, qy1 = A.QUIVER_BOX
    if lay == 'back' and not (ch in GREEN or ch in 't'):                  # the feathers, the quiver, its back strap
        return 'quiver'
    if (qx0 <= x <= qx1 and qy0 <= y <= qy1) and ch in 'FWR': return 'quiver'
    if ch in GREEN and y <= 28: return 'hood'
    if ch in GREEN and y <= 35 and lay == 'top': return 'hood'           # the hood's collar under the chin
    if lay == 'back': return 'cape'
    if lay == 'legs': return 'boots'
    if lay == 'near': return 'bracers' if y >= 38 and ch not in 'TtF' else 'tunic'
    if lay == 'far': return 'bracers' if y <= 46 else 'tunic'
    if lay == 'head': return 'hood'
    return 'tunic'


def cut():
    own = {}
    for y in range(H):
        for x in range(W):
            ch = M.px[y][x]
            if ch == '.': continue
            if BASE.px[y][x] == ch: own[(x, y)] = 'base'; continue
            if ch != 'O': own[(x, y)] = owner(x, y, ch)
    for y in range(H):                                                   # an outline goes with the item it borders
        for x in range(W):
            if M.px[y][x] != 'O' or (x, y) in own: continue
            c = Counter(own[(x + dx, y + dy)] for dx in (-1, 0, 1) for dy in (-1, 0, 1)
                        if (x + dx, y + dy) in own and own[(x + dx, y + dy)] != 'base')
            own[(x, y)] = 'cape' if (x, y) == (6, 40) else (c.most_common(1)[0][0] if c else owner(x, y, 'O'))
    items = {k: Grid(W, H) for k in ORDER}
    for (x, y), k in own.items():
        if k != 'base': items[k].px[y][x] = M.px[y][x]
    for k in ORDER:                        # an outline shared by two items is both's: removing one keeps the other's edge
        mine = [(x, y) for (x, y), kk in own.items() if kk == k and M.px[y][x] != 'O']
        for (x, y) in mine:
            for dx in (-1, 0, 1):
                for dy in (-1, 0, 1):
                    q = (x + dx, y + dy)
                    if q in own and M.px[q[1]][q[0]] == 'O' and own[q] not in ('base', k): items[k].px[q[1]][q[0]] = 'O'
    back = {}
    for k in BEHIND:                                                     # behind the body / over it
        b, f = Grid(W, H), Grid(W, H)
        for y in range(H):
            for x in range(W):
                ch = items[k].px[y][x]
                if ch == '.': continue
                (f if BASE.px[y][x] != '.' else b).px[y][x] = ch
        back[k], items[k] = b, f
    return items, back, own


ITEMS, BACK, OWN = cut()


def dress(wear=ORDER, base=BASE) -> Grid:
    """The base with the given items on, each in its place: the back parts of the cape and quiver behind the body,
    everything else over it."""
    g = Grid(W, H)
    for k in BEHIND:
        if k in wear: g.stamp(BACK[k], 0, 0)
    g.stamp(base, 0, 0)
    for k in ORDER:
        if k in wear: g.stamp(ITEMS[k], 0, 0)
    close(g)
    return g


def close(g: Grid) -> None:
    """Where a removed item leaves another one's edge bare (in the clothed outfit two items met without an outline),
    the edge gets its outline: an empty pixel inside the clothed silhouette, beside a coloured one, becomes outline.
    With every item on there is no such pixel, so the round trip is untouched."""
    add = [(x, y) for y in range(H) for x in range(W) if g.px[y][x] == '.' and M.px[y][x] != '.' and
           any(0 <= x + dx < W and 0 <= y + dy < H and g.px[y + dy][x + dx] not in '.O' for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)))]
    for (x, y) in add: g.px[y][x] = 'O'


def roundtrip() -> int:
    g = dress()
    return sum(1 for y in range(H) for x in range(W) if g.px[y][x] != M.px[y][x])


if __name__ == '__main__':
    print('mismatches', roundtrip(), Counter(OWN.values()))
