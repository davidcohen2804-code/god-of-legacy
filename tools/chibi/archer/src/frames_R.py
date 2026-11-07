"""The archer's animation frames (facing right; the game mirrors for left), built from the drawn master (master_R.txt)
and the drawn key poses (guides/), never from geometric parts: the master locks identity (its head is laid on every
frame, its palette is the only palette), the guides give each pose its body and cloth.
`python3 frames_R.py` → FRAMES (name → [(Grid 96×96, ms)]) used by build.py."""
import os, sys
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, '..', '..'))
from pix import Grid
from procbow import path_bow, WOOD

F = 96                      # frame size
FOOT = (48, 88)             # the feet's centre on the ground line (frame px)
MASTER = Grid.load(os.path.join(HERE, 'master_R.txt'))
MW, MH = MASTER.w, MASTER.h
# the master's own ground row and the centre between its feet (the boots' columns on the lowest rows)
_feet = [x for x in range(MW) for y in range(MH - 3, MH) if MASTER.get(x, y) != '.']
M_FOOT = ((min(_feet) + max(_feet)) // 2, MH)       # (x, row under the feet)
GRIP = (34, 48)                                       # the left (far) fist's centre on the master — the bow passes through it
# THE CARRY (David + GPT, 7 Nov: the approved reference governs the bow's silhouette, not only the colours). Read off the
# reference's idle at our scale, from the fist's centre: the riser starts inside the fist and leaves it at the front-top,
# sweeps forward and up in one curve and ends in a small forward flick just under the chin; the string leaves under the
# tip and runs down and back inside the curve, behind the chest. Behind the body (the far hand holds it): the fist closes
# over the riser, nothing hangs below it. It turns and moves only with the hand (rot about the grip).
# THE GRIP (David + GPT, 7 Nov — the bow read as detached: an empty-hand drawing, the wood leaving from the fist's top
# corner only, and the fist's dark outline as a seam). Three layers per frame: the bow, the body without its left fist,
# a fist overlay drawn as a grip. The limb comes down into the fist's front edge at mid-height, the riser runs down
# through the hand and 1 px of it shows under the fist (never more: it must not read as a hanging lower limb).
CARRY_LIMB = [(0.5, 3.2), (0.5, 2.3), (1.0, 1.0), (2.0, 0.4), (3.5, 0.1), (5.0, -0.9), (6.3, -2.6), (7.2, -5),
              (7.5, -7), (7.5, -10), (7.5, -13), (8, -15), (8.5, -16.5), (9.5, -18)]   # (the flick: GPT's compact one)
CARRY_STRING = ((8, -16), (-3, 3))
BOW_STYLE = dict(WOOD, string='f')
# The carry fist (GPT's design A): a simple chibi mitten — a knuckle shade along the riser, a 1 px thumb over its top
# edge, the outline open only where the wood leaves (front, mid-height) and enters (bottom). 6 × 7, the grip at (3, 3);
# ' ' keeps the body's pixel, '.' leaves the overlay transparent (the bow's wood shows there). One drawing for every
# carry frame (idle, walk), placed at each frame's own grip; the shot's poses get their own drawings.
CARRY_FIST = ['  OOO ',
              'OSSSSO',
              'OSSsSS',
              'OSsSS.',
              'OsSSs.',
              'OssSOO',
              'OOO..O']
HEAD_ROWS = 30                                        # rows 0..29: hood, hair, face (the identity)
QUIVER_BOX = (0, 10, 22, 31)                          # x0, x1, y0, y1 of the quiver's feathers (not head)


def place(g: Grid, dx=0, dy=0) -> Grid:
    """A master-sized grid into a 96 × 96 frame, feet on FOOT."""
    f = Grid(F, F); f.stamp(g, FOOT[0] - M_FOOT[0] + dx, FOOT[1] - M_FOOT[1] + dy); return f


def with_bow(body: Grid, grip=GRIP, rot=0.0, fist=CARRY_FIST) -> Grid:
    """The carried bow in the far (left) hand, in three layers: the bow (behind), the body with its own left fist
    taken out (the drawn fist's skin and right / lower outline around the grip), and the grip fist on top. The bow
    turns by rot about the grip; the fist stays upright."""
    gx, gy = grip
    b, _ = path_bow(body.w + 16, body.h, gx, gy, CARRY_LIMB, CARRY_STRING, rot=rot, style=BOW_STYLE)
    cut = body.copy()
    for y in range(gy - 2, gy + 4):
        for x in range(gx - 2, gx + 4): cut.set(x, y, '.')
    out = Grid(body.w + 16, body.h); out.stamp(b, 0, 0); out.stamp(cut, 0, 0)
    for j, row in enumerate(fist):
        for i, ch in enumerate(row):
            if ch not in ' .': out.set(gx - 3 + i, gy - 3 + j, ch)
    return out


def shift_rows(g: Grid, y0: int, y1: int, dy: int) -> Grid:
    """Rows y0..y1 moved by dy (−1: up); the row left behind keeps its old pixels (the cloth stretches a pixel)."""
    out = g.copy()
    for y in range(y0, y1 + 1):
        for x in range(g.w):
            if g.px[y][x] != '.': out.set(x, y + dy, g.px[y][x])
    return out


def shift_box(g: Grid, x0, x1, y0, y1, dx: int) -> Grid:
    """The box's pixels moved sideways by dx; the edge they leave keeps its old pixels (cloth stretching, no gap)."""
    out = g.copy()
    for y in range(y0, y1 + 1):
        for x in range(x0, x1 + 1):
            if g.px[y][x] != '.': out.set(x + dx, y, g.px[y][x])
    return out


def lift(g: Grid, x0, x1, y0, y1) -> Grid:
    """The box's pixels up a row; the row it leaves shows what was under its bottom edge (the row below the box)."""
    out = g.copy()
    for y in range(y0, y1 + 1):
        for x in range(x0, x1 + 1): out.px[y - 1][x] = g.px[y][x]
    for x in range(x0, x1 + 1): out.px[y1][x] = g.px[y1 + 1][x]
    return out


def blink(g: Grid) -> Grid:
    """Eyes shut: the eye pixels become skin and a lash line closes along the eyes' lower half."""
    out = g.copy()
    for y in range(21, 24):
        for x in list(range(22, 27)) + list(range(30, 33)): out.px[y][x] = 'S'
    for x in range(22, 27): out.px[22][x] = 'O'
    for x in range(30, 33): out.px[22][x] = 'O'
    for x in list(range(21, 27)) + list(range(29, 34)): out.px[20][x] = 'S' if out.px[20][x] == 'O' else out.px[20][x]
    out.px[21][21] = 'O'; out.px[21][29] = 'O'
    return out


HEAD = {(x, y) for y in range(HEAD_ROWS) for x in range(MW) if MASTER.get(x, y) != '.'}   # (the quiver's feathers with it)
HOOD = {(x, y) for (x, y) in HEAD if y < 16}


def _rgb(ch):
    from palette import RGB
    return RGB.get(ch)


def head_fit(g: Grid):
    """Where the master's head sits on a guide frame: the offset whose hood best matches (colour distance)."""
    best = None
    for dy in range(-4, 18):
        for dx in range(-16, 17):
            cost = 0; n = 0
            for (x, y) in HOOD:
                a = _rgb(MASTER.px[y][x]); b = _rgb(g.get(x + dx, y + dy))
                if b is None: cost += 300
                else: cost += sum(abs(i - j) for i, j in zip(a, b))
                n += 1
            if best is None or cost / n < best[0]: best = (cost / n, dx, dy)
    return best


def head_lock(g: Grid, keep_box=None):
    """The guide frame with the master's head laid on it: the guide's own head (everything above the chin, inside the
    head's reach) goes, then the master's head is stamped where the guide's sat — so every frame has one face."""
    cost, dx, dy = head_fit(g)
    out = g.copy()
    xs = [x for x, _ in HEAD]; x0, x1 = min(xs) - 2, max(xs) + 3
    for y in range(0, HEAD_ROWS + dy - 1):
        for x in range(x0 + dx, x1 + dx):
            if keep_box and keep_box[0] <= x <= keep_box[1] and keep_box[2] <= y <= keep_box[3]: continue
            out.set(x, y, '.')
    for (x, y) in HEAD: out.set(x + dx, y + dy, MASTER.px[y][x])
    return out, (dx, dy, round(cost))


# idle (GPT 7 Nov: subtle — the chest rises a pixel, the cape answers a beat later, an occasional blink). The hands and
# the bow breathe with the chest (one unit through the grip; the bow never moves on its own). The blink is not part of
# the loop: the game lays it on a base frame now and then.
BASE = MASTER
RISE = lift(lift(shift_rows(MASTER, 0, 44, -1), 31, 36, 46, 51), 11, 19, 47, 51)   # head, chest, both fists up a pixel
UP = (GRIP[0], GRIP[1] - 1)
LAG = lambda g: shift_box(g, 0, 9, 47, 57, -1)   # the cape's hem a pixel behind
FRAMES = {
    'idle': [(place(with_bow(BASE)), 400), (place(with_bow(RISE, UP)), 300), (place(with_bow(LAG(RISE), UP)), 400),
             (place(with_bow(LAG(BASE))), 300)],
    'blink': [(place(with_bow(blink(BASE))), 130)],
}

def far_fist(g: Grid, x_min: int, y_min: int = 0):
    """The far (left) hand on a guide frame: the skin pixels right of x_min and below y_min (under the chin — the face
    is skin too, and it can sit further forward than the hand), their centre — the bow's grip."""
    pts = [(x, y) for y in range(y_min, g.h) for x in range(x_min, g.w) if g.get(x, y) in 'Ss']
    if not pts: return None
    # the right-most skin cluster (the far fist is the hand furthest along the facing direction)
    xr = max(x for x, _ in pts); cl = [(x, y) for x, y in pts if x >= xr - 5]
    return (round(sum(x for x, _ in cl) / len(cl)), round(sum(y for _, y in cl) / len(cl)))


def retop(g: Grid, ground: int, height: int) -> Grid:
    """The figure made `height` rows tall (feet kept on `ground`) by taking out or doubling rows at the shins — so a
    cycle's bob is the one asked for, not whatever height each drawn pose happened to have."""
    rows = [y for y in range(g.h) if any(g.px[y][x] != '.' for x in range(g.w))]
    out = g.copy(); d = (ground - rows[0]) - height
    e = ground - 10
    for _ in range(max(0, d)):                                   # too tall: a shin row out, the body above drops
        out.px.pop(e); out.px.insert(0, ['.'] * g.w)
    for _ in range(max(0, -d)):                                  # too short: a shin row doubled, the body above rises
        out.px.insert(e, list(out.px[e])); out.px.pop(0)
    return out


def lift_foot(g: Grid, x0, x1, y0, y1) -> Grid:
    """A passing pose's lifted foot up a pixel (GPT: at ×2 it merged with the supporting boot): rows y0..y1 of columns
    x0..x1 move up one (the shin a pixel more bent), and the row they leave becomes air under the sole."""
    out = g.copy()
    for y in range(y0, y1 + 1):
        for x in range(x0, x1 + 1): out.px[y - 1][x] = g.px[y][x]
    for x in range(x0, x1 + 1): out.px[y1][x] = '.'
    return out


def clear_row(g: Grid, y: int) -> Grid:
    out = g.copy(); out.px[y] = ['.'] * g.w; return out


def arm_back(g: Grid, x0, x1, y0, y1, d=2) -> Grid:
    """A forearm and fist (columns x0..x1, rows y0..y1) moved d pixels back (toward the cape); the torso behind them
    continues into the columns they leave (copied from just past the box)."""
    out = g.copy()
    for y in range(y0, y1 + 1):
        for x in range(x0, x1 + 1): out.px[y][x - d] = g.px[y][x]
        for i in range(d): out.px[y][x1 - d + 1 + i] = g.px[y][x1 + 1 + i]
    return out


def from_guide(path_txt: str, pad=(10, 10), rot=0.0, top=None, fix=None):
    """A guide frame (native letters) → master head laid on it, the carry drawn through its far fist (turned by rot
    about the grip), placed on the 96 × 96 frame with the feet on the ground line and the head over the master's x
    (top: the frame row the head's top should reach — the cycle's bob; fix: the hand pass on the guide's own grid)."""
    f = Grid.load(path_txt)
    if fix: f = fix(f)
    g = Grid(f.w + 2 * pad[0], f.h + pad[1] + 4); g.stamp(f, pad[0], pad[1] + 4)
    g, (dx, dy, cost) = head_lock(g)
    ground = max(y for y in range(g.h) for x in range(g.w) if g.get(x, y) != '.') + 1
    if top is not None: g = retop(g, ground, FOOT[1] - top)
    grip = far_fist(g, dx + 26, dy + HEAD_ROWS + 8)          # (the hands hang below the belt: the master's at rows 46–51)
    if grip: g = with_bow(g, grip, rot)
    out = Grid(F, F)
    ox = FOOT[0] - M_FOOT[0] - dx            # the head over the master's head x
    oy = FOOT[1] - ground
    out.stamp(g, ox, oy)
    return out, {'head': (dx, dy), 'cost': cost, 'grip': grip}


def drop_specks(g: Grid, min_size=6) -> Grid:
    """Little islands of pixels cut off from the figure (left over from a guide's own head or quiver) go."""
    seen = set(); out = g.copy()
    for y in range(g.h):
        for x in range(g.w):
            if g.px[y][x] == '.' or (x, y) in seen: continue
            comp = []; stack = [(x, y)]; seen.add((x, y))
            while stack:
                cx, cy = stack.pop(); comp.append((cx, cy))
                for ddx in (-1, 0, 1):
                    for ddy in (-1, 0, 1):
                        nx, ny = cx + ddx, cy + ddy
                        if (nx, ny) not in seen and g.get(nx, ny) != '.': seen.add((nx, ny)); stack.append((nx, ny))
            if len(comp) < min_size:
                for (cx, cy) in comp: out.px[cy][cx] = '.'
    return out


GUIDES = os.path.join(HERE, 'guides_native')
# The walk (GPT + David, 7 Nov): the body is GPT's walk drawn with the bow hand low at the front of the hip, without
# the bow (walk_34_twin.png at pitch 9.5); the frozen carry goes through that fist in every frame and trails the step a
# little (GPT: at most 4–6°; contact near neutral, down a slight trail back, passing back through neutral).
# Six frames, two steps (GPT): contact R, down R, passing, contact L (the twin), down L, passing (walk_34_step2.png,
# GPT's second step at the twin's scale: pitch 11.26); 110 ms each, the pace following the real speed.
WALK_SRC = ['twin_r0c0', 'twin_r0c1', 'twin_r0c2', 'twin_r0c3', 'step2_r0c0', 'step2_r0c1']
WALK_ROT = [0.0, -3.0, -1.0, 1.0, 3.0, 1.0]
WALK_TOP = [23, 24, 22, 23, 24, 22]          # the bob (GPT): contact level, down a pixel lower, passing a pixel higher
WALK_FIX = {                                  # the hand pass (GPT): the passing frames' lifted foot a pixel up, air under it
    'twin_r0c2': lambda g: lift_foot(g, 15, 19, 59, 62),
    'step2_r0c0': lambda g: arm_back(g, 15, 23, 39, 46),   # (GPT: the right fist 2 px back, the swing even over 4–5–6)
    'step2_r0c1': lambda g: lift_foot(clear_row(g, 66), 17, 21, 58, 61),   # (row 66: a doubled sole line)
}
def _walk_twin():
    import math
    seq = []
    for src, deg, top in zip(WALK_SRC, WALK_ROT, WALK_TOP):
        g, info = from_guide(os.path.join(GUIDES, f'{src}.txt'), rot=math.radians(deg), top=top, fix=WALK_FIX.get(src))
        seq.append((drop_specks(g), 110))
    return seq


FRAMES['walk'] = _walk_twin()

if __name__ == '__main__':
    from pix import sheet
    out = sys.argv[1] if len(sys.argv) > 1 else '.'
    rows = [[g for g, _ in seq] for seq in FRAMES.values()]
    sheet(rows, k=4).save(os.path.join(out, 'frames_R.png'))
    print({k: len(v) for k, v in FRAMES.items()}, 'master feet', M_FOOT)
