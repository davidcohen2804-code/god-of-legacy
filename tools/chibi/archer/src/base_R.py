"""The Archer's base body (David 7 Nov 23:26: clothes must stay easy to change and remove; GPT: derive it from the approved
master). The face and the bangs are the master's own pixels; under the hood the hair is completed; under the tunic a
plain ivory short-sleeved undershirt; bare forearms and the master's own hands; brown shorts; bare shins; neutral foot
wraps. Nothing removable is baked in (no hood, cape, quiver, tunic, belt, bracers, boots, bow).
`python3 base_R.py` prints BASE as text (base_R.txt) for review."""
import math, os, sys
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE); sys.path.insert(0, os.path.join(HERE, '..', '..'))
from pix import Grid
import frames_R as A

M = A.MASTER
W, H = M.w, M.h
HOOD = set('LGgDYy')
HAIR = set('HhJb')
SKIN = set('Ss')


def nbrs(x, y):
    return ((x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1))


def inside(x, y):
    return 0 <= x < W and 0 <= y < H


# --- the head: the face and the bangs as the master draws them; the hair completed under the hood ---------------------
FACE = {(x, y) for y in range(15, 31) for x in range(14, 36) if M.px[y][x] in 'SsWEey'}
FACE |= {(x, y) for y in range(15, 31) for x in range(14, 36) if M.px[y][x] == 'O' and y in (20, 23, 28, 29, 30)
         and any(p in FACE for p in nbrs(x, y))}                     # the lids, the chin's line
BANGS = {(x, y) for y in range(5, 27) for x in range(14, 41) if M.px[y][x] in HAIR}
OUT = {(x, y) for y in range(H) for x in range(W) if M.px[y][x] == '.'}


def dist_out(x, y, r=4):
    """How deep (px, up to r) a pixel sits inside the character: its distance to the nearest outside pixel."""
    for d in range(1, r + 1):
        for dy in range(-d, d + 1):
            for dx in range(-d, d + 1):
                if max(abs(dx), abs(dy)) == d and ((x + dx, y + dy) in OUT or not inside(x + dx, y + dy)): return d
    return r + 1


# the hood's own shading, carried into the hair: its light front → the hair's light, its mass → mid, its shade → dark
HOOD_TO_HAIR = {'L': 'J', 'G': 'H', 'g': 'h', 'D': 'h', 'Y': 'H', 'y': 'h'}
# the skull: under the hood, 3 px in from its outer edge (the hood's cloth and the air in it), not lower than the nape
DEPTH = 3
NAPE = lambda x, y: y <= 26 - max(0, 12 - x)                         # the back of the head rounds off into the nape
TUFTS = [(6, 9), (5, 10), (4, 11), (4, 12), (3, 13), (4, 16), (4, 17), (5, 18), (15, 3), (16, 2), (21, 2), (22, 1)]


def head() -> Grid:
    g = Grid(W, H)
    for y in range(0, 25):
        for x in range(W):
            ch = M.px[y][x]
            if ch in HOOD and dist_out(x, y) > DEPTH and NAPE(x, y): g.px[y][x] = HOOD_TO_HAIR[ch]
    for (x, y) in TUFTS:                                            # (a tuft only where its outline fits too)
        if all(M.px[y + dy][x + dx] != '.' for dx in (-1, 0, 1) for dy in (-1, 0, 1)): g.px[y][x] = 'H'
    for (x, y) in FACE: g.px[y][x] = M.px[y][x]
    for (x, y) in BANGS: g.px[y][x] = M.px[y][x]
    for y in range(0, 25):                                           # the master's outlines inside the new hair → hair
        for x in range(W):
            if M.px[y][x] == 'O' and g.px[y][x] == '.' and (x, y) not in FACE and \
                    sum(1 for p in nbrs(x, y) if inside(*p) and g.px[p[1]][p[0]] not in '.O') >= 3:
                g.px[y][x] = 'h'
    for y in range(H):                     # the outline round the whole head (inside the clothed silhouette: the hood
        for x in range(W):                 # is bigger than the head, so the hair's own edge always fits under it)
            if g.px[y][x] == '.' and M.px[y][x] != '.' and y <= 30 and \
                    any(inside(*p) and g.px[p[1]][p[0]] not in '.O' for p in nbrs(x, y)):
                g.px[y][x] = 'O'
    return g


# --- the body: the master's own shapes and shading, recoloured into the under-layer -----------------------------------
import minimal_R as MR                                              # (the master's layers: top, near, far, legs, back)
SHIRT = {'T': 'F', 't': 'T', 'W': 'F', 'F': 'F', 'B': 'F', 'b': 'T', 'R': 'F', 'Y': 'F', 'y': 'T',
         'L': 'F', 'G': 'F', 'g': 'T', 'D': 'T', 'H': 'F', 'h': 'T', 'J': 'F'}
SKINC = {'J': 'S', 'R': 'S', 'H': 'S', 'B': 'S', 'T': 'S', 't': 's', 'F': 'S', 'h': 's', 'b': 's', 'K': 's'}
SHORTS = {'t': 'P', 'T': 'P', 'W': 'p', 'y': 'p', 'Y': 'p', 'B': 'P', 'b': 'p', 'H': 'P', 'h': 'p', 'J': 'P', 'R': 'P'}
WRAPS = {'J': 'T', 'H': 't', 'B': 't', 'R': 'T', 'h': 't', 'b': 't', 'K': 't'}
NECK = {(x, y) for y in range(27, 32) for x in range(18, 29) if x >= 21 or y >= 28}   # the neck, under the chin
BOW_PX = {(35, 43)}                       # a pixel of the carried bow's string baked into the master: the bow's (GPT)
_N8 = [(dx, dy) for dx in (-1, 0, 1) for dy in (-1, 0, 1) if dx or dy]
CAPE_HEM = {(x, y) for (x, y), l in MR.LAY.items()   # the cape hem's outline that came with the legs: the cape's (with
            if l == 'legs' and M.px[y][x] == 'O' and  # the cape off it stuck out beside the shin)
            any(M.get(x + dx, y + dy) in HOOD for dx, dy in _N8) and
            not any(MR.LAY.get((x + dx, y + dy)) == 'legs' and M.get(x + dx, y + dy) not in 'O.' for dx, dy in _N8)}
MAT = {'F': 'shirt', 'T': 'shirt', 'S': 'skin', 's': 'skin', 'P': 'shorts', 'p': 'shorts'}
SHADE = {'shirt': 'T', 'skin': 's', 'shorts': 'p'}


def body() -> Grid:
    g = Grid(W, H)
    for (x, y), l in MR.LAY.items():
        ch = M.px[y][x]
        if (x, y) in NECK and l != 'head': g.px[y][x] = 'S' if x > 21 else 's'; continue
        if l in ('back', 'head') or y < 29 or (l == 'top' and ((y <= 35 and x < 14) or (y <= 44 and x < 13))): continue   # (the cape's collar and lining)
        if l == 'near' and y < 36: continue                                      # (the quiver's edge, not the arm)
        if (x, y) in CAPE_HEM: continue
        if ch == 'O' or ch in SKIN: g.px[y][x] = ch; continue                    # outlines and the hands stay
        if l == 'top':
            if y <= 44: g.px[y][x] = SHIRT.get(ch, 'F')                            # shoulders, chest, under the belt
            elif y == 45: g.px[y][x] = 'p'                                          # the shorts' waistband
            else: g.px[y][x] = SHORTS.get(ch, 'P')
        elif l == 'near':
            g.px[y][x] = SHIRT.get(ch, 'F') if y <= 41 and ch in 'TtF' else SKINC.get(ch, 'S')
        elif l == 'far':
            if ch == 'F' and y > 38: continue                                    # (a pixel of the carried bow's string)
            g.px[y][x] = SHIRT.get(ch, 'F') if y <= 38 else SKINC.get(ch, 'S')
        elif l == 'legs':
            g.px[y][x] = SHORTS.get(ch, 'P') if y <= 54 else (SKINC.get(ch, 'S') if y <= 58 else WRAPS.get(ch, 't'))
    for y in range(29, 53):                    # the master's seams inside one material (collar folds, the sleeve's top,
        for x in range(W):                     # the tunic's split) close up: an outline amid one material takes its shade
            if g.px[y][x] != 'O': continue
            n = [g.px[q][p] for p, q in nbrs(x, y) if inside(p, q)]
            mats = {MAT.get(c) for c in n if c not in 'O.'}
            if '.' not in n and len([c for c in n if c not in 'O.']) >= 3 and len(mats) == 1 and None not in mats:
                g.px[y][x] = SHADE[mats.pop()]
    for y in range(27, H):                                                       # outline where the cape was
        for x in range(W):
            if g.px[y][x] == '.' and M.px[y][x] != '.' and (x, y) not in BOW_PX and \
                    any(inside(*p) and g.px[p[1]][p[0]] not in '.O' for p in nbrs(x, y)):
                g.px[y][x] = 'O'
    return g


def base() -> Grid:
    g = Grid(W, H)
    g.stamp(body(), 0, 0)
    g.stamp(head(), 0, 0)
    return g


BASE = base()

if __name__ == '__main__':
    out = os.path.join(HERE, 'base_R.txt')
    with open(out, 'w') as fh:
        fh.write('# The archer\'s base body, facing right (three-quarter) — built by base_R.py from the master.\n')
        for row in BASE.px: fh.write(''.join(row) + '\n')
    print('→', out)
