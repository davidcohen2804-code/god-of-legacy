"""The Archer's looks (David 8 Nov: a character creation — hair styles, eyes, skin, a first outfit, a first bow — and a
cash shop; GPT's art direction, DECISIONS.md). The base head is split into the face (the skin under every hair style:
the cheeks, the ear, the jaw's outline, the forehead filled), the hair (the approved Wind-Tousled Fringe) and the eyes
(the approved Calm Focus); every hair style, eye style, hat and face accessory is one drawing in the master's pixels,
which the game lays on each frame at the head's place. Colours: GPT's hex, as recolour maps (letter → colour) per item
or per drawing. With the approved choices (Wind-Tousled, Calm Focus, the original items) every frame is the approved
frame pixel for pixel (doll_R.check)."""
import os, sys
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE); sys.path.insert(0, os.path.join(HERE, '..', '..'))
from pix import Grid
import frames_R as A
import base_R as BR

M = A.MASTER
W, H = M.w, M.h
HD = BR.head()                                   # the base head as approved (hair, face, eyes)
HAIRL = set('JHhb')                              # the hair's letters (light, mid, dark, deepest) — the hair colour maps
N4 = ((1, 0), (-1, 0), (0, 1), (0, -1))


def grid(rows, y0=0) -> Grid:
    """A drawing from text rows (41 wide), starting at master row y0."""
    g = Grid(W, H)
    for j, r in enumerate(rows):
        for x, ch in enumerate(r):
            if ch not in '. ' and x < W: g.px[y0 + j][x] = ch
    return g


# --- the eyes (the approved Calm Focus: the lids on row 20, the eyes rows 21–23) --------------------------------------
EYE_BOX = {(x, 20) for x in range(22, 27)} | {(x, y) for y in range(21, 24) for x in range(22, 27)} | \
          {(x, 20) for x in range(29, 34)} | {(x, y) for y in range(21, 24) for x in range(30, 33)}


def _calm():
    g = Grid(W, H)
    for (x, y) in EYE_BOX: g.px[y][x] = HD.px[y][x]
    return g


def _shut(lash_near=range(22, 27), lash_far=range(30, 33), corners=((21, 21), (29, 21))):
    """Eyes shut (frames_R.blink): a lash line on row 22, the corners down a pixel."""
    g = Grid(W, H)
    for x in lash_near: g.px[22][x] = 'O'
    for x in lash_far: g.px[22][x] = 'O'
    for (x, y) in corners: g.px[y][x] = 'O'
    g.px[20][21] = 'S'                       # (the lid's outer corner, the blink's own: skin when the eye shuts)
    return g


CALM, CALM_SHUT = _calm(), _shut()

# Bright Curious (GPT: a wider opening, a lighter expression): the lid a row higher and rounded, a light iris with a
# catch-light. Sharp Hunter (GPT: a more angled upper lid, fiercer): the lid slanting down toward the nose, the iris
# narrower under it, darker. Letters: O outline, W sclera, E the iris' dark top, i the iris, F the catch-light.
BRIGHT = grid([
    '......................OOOOO...OOO........',   # 19
    '.....................OWWEEWO.OWEWO.......',   # 20
    '......................WWFEW...WEW........',   # 21
    '......................WWiiW...WiW........',   # 22
    '......................WWiiW...WiW........',   # 23
], 19)
SHARP = grid([
    '.....................OOOO.....OOO........',   # 20
    '......................WWOOO.OOEW.........',   # 21
    '......................WWEEW..WEW.........',   # 22
    '......................WWiiW..WiW.........',   # 23
], 20)
EYE_PAL = {
    'calm': {},                                                          # (the approved palette's own W, E, y)
    'bright': {'W': '#F5F1EA', 'E': '#2B211B', 'i': '#6B5A36', 'F': '#FFFFFF'},   # (the outline: the palette's own)
    'sharp': {'W': '#F5F1EA', 'E': '#2B211B', 'i': '#4E4028'},
}


# --- the face (the skin under every hair style) ------------------------------------------------------------------------
FOREHEAD = lambda x, y: 12 <= y <= 23 and 18 <= x <= 33


def _face():
    g = Grid(W, H)
    for y in range(31):
        for x in range(W):
            ch = HD.px[y][x]
            if ch == '.': continue
            if (x, y) in EYE_BOX: g.px[y][x] = 'S'; continue
            if ch in HAIRL or (ch == 'O' and y <= 19):
                if FOREHEAD(x, y): g.px[y][x] = 'S'
                continue
            g.px[y][x] = ch
    for y in range(12, 20):                                               # the forehead: one skin tone (the hair's
        for x in range(18, 34): g.px[y][x] = 'S'                          # shadow is each style's own)
    for (x, y), ch in (((17, 20), 'O'), ((17, 21), 's'), ((17, 22), 's')):   # the ear joined to the cheek
        g.px[y][x] = ch
    for y in range(31):                                                   # outlines: only the face's own
        for x in range(W):
            if g.px[y][x] == 'O' and not any(g.get(x + dx, y + dy) in 'Ss' for dx, dy in N4): g.px[y][x] = '.'
    return g


FACE = _face()


def _wind():
    """The approved hair: everything of the base head that is not the face or the eyes."""
    g = Grid(W, H)
    for y in range(31):
        for x in range(W):
            if (x, y) in EYE_BOX: continue
            if HD.px[y][x] != '.' and HD.px[y][x] != FACE.px[y][x]: g.px[y][x] = HD.px[y][x]
    return g


WIND = _wind()


def recompose(face=FACE, hair=WIND, eyes=CALM) -> Grid:
    g = Grid(W, H)
    for L in (face, hair, eyes): g.stamp(L, 0, 0)
    return g


def head_check():
    g = recompose()
    bad = [(x, y) for y in range(31) for x in range(W) if g.px[y][x] != HD.px[y][x]]
    out = [(x, y) for y in range(31) for x in range(W) if FACE.px[y][x] != '.' and HD.px[y][x] == '.']
    return bad, out


if __name__ == '__main__':
    print(head_check())


# --- hair styles -------------------------------------------------------------------------------------------------------
def spans(d):
    """{y: [(x0, x1), ...]} → the set of pixels."""
    return {(x, y) for y, ss in d.items() for (x0, x1) in ss for x in range(x0, x1 + 1)}


def _near_hair(src: Grid, x, y):
    for r in range(1, 6):
        for dx in range(-r, r + 1):
            for dy in range(-r, r + 1):
                ch = src.get(x + dx, y + dy)
                if ch in HAIRL: return ch
    return 'H'


def styled(mask, src=WIND, keep_src=True, dark_bottom=True):
    """A hair style: the mask's pixels in the source hair's own colours (its strands), its bottom edges dark, an outline
    round it where it meets the outside (none over the face's skin: there the edge is the hair's dark tone)."""
    g = Grid(W, H)
    for (x, y) in mask:
        ch = src.get(x, y) if keep_src else '.'
        g.px[y][x] = ch if ch in HAIRL else _near_hair(src, x, y)
    if dark_bottom:
        for (x, y) in mask:
            if (x, y + 1) not in mask and g.px[y][x] in 'JH': g.px[y][x] = 'h'
    ring = {(x + dx, y + dy) for (x, y) in mask for dx, dy in N4} - mask
    for (x, y) in ring:
        if 0 <= x < W and 0 <= y < H and FACE.get(x, y) not in 'Ss': g.px[y][x] = 'O'
    return g


CROP_MASK = spans({                                       # (GPT: a pixel or two more volume at the back and the top)
    3: [(17, 23)], 4: [(14, 26)], 5: [(12, 28)], 6: [(10, 30)], 7: [(9, 32)], 8: [(8, 33)], 9: [(7, 34)], 10: [(7, 35)],
    11: [(6, 36)], 12: [(6, 36)], 13: [(6, 36)], 14: [(6, 36)], 15: [(6, 36)],
    16: [(6, 22), (24, 29), (31, 36)],                  # the fringe parts into three pointed bangs, swept forward
    17: [(6, 21), (25, 28), (32, 36)],
    18: [(6, 15), (19, 21), (26, 28), (33, 36)],
    19: [(6, 15), (20, 21), (27, 28), (34, 36)],
    20: [(7, 15), (21, 21), (28, 28), (34, 36)],
    21: [(7, 13), (35, 36)],
    22: [(8, 13)],
    23: [(9, 12)],
})
NAPE = {(12, 24): 's', (13, 24): 's', (14, 24): 's', (13, 25): 's', (14, 25): 's', (15, 25): 's',
        (14, 26): 's', (15, 26): 's', (16, 26): 's', (17, 26): 's', (15, 27): 's', (16, 27): 's', (17, 27): 's', (18, 27): 's'}


def _crop():
    g = styled(CROP_MASK)
    for (x, y), ch in NAPE.items(): g.px[y][x] = ch                      # the trimmed back shows the nape
    for (x, y) in ((11, 24), (12, 25), (13, 26), (14, 27)): g.px[y][x] = 'O'
    for y in range(4, 9):                                                  # the light side part, sweeping forward
        x = 20 - (y - 4)
        if g.px[y][x] in HAIRL: g.px[y][x] = 'h'
    return g


CROP = _crop()

TAIL_MASK = {(x, y) for y in range(31) for x in range(W) if WIND.px[y][x] in HAIRL or WIND.px[y][x] == 's'}
TAIL_MASK -= {(x, y) for (x, y) in TAIL_MASK if 8 <= y <= 18 and x < 8}    # the back's loose tufts gathered


def _tail():
    g = Grid(W, H)
    for y in range(31):
        for x in range(W):
            if (x, y) in TAIL_MASK or (WIND.px[y][x] == 'O' and not (8 <= y <= 18 and x < 8)): g.px[y][x] = WIND.px[y][x]
    back = styled({p for p in TAIL_MASK if p[0] < 12 and 6 <= p[1] <= 20})   # the back re-edged smooth
    for y in range(4, 22):
        for x in range(0, 12):
            if back.px[y][x] != '.' : g.px[y][x] = back.px[y][x]
            elif g.px[y][x] == 'O' and x < 8: g.px[y][x] = '.'
    tail = grid([                                                          # the tied tail behind the head: a band
        '..OOO....',   # 9                                                   # of leather at its root, a pixel of
        '.OJJHOO..',   # 10                                                  # outline between it and the tail
        'OJJHHhORO',   # 11
        'OJHHhhOBO',   # 12
        'OHHhhbOBO',   # 13
        '.OHhhbOO.',   # 14
        '.OhhbO...',   # 15
        '..OhbO...',   # 16
        '..ObO....',   # 17
        '...O.....',   # 18
    ], 9)
    for y in range(31):
        for x in range(9):
            if tail.px[y][x] != '.': g.px[y][x] = tail.px[y][x]
    return g


TAIL = _tail()


# --- hats and face accessories (drawings in master px; rows may go above the master's top) ----------------------------
class Art(dict):
    """{(x, y): letter} with its own palette (letters → hex) and, for a hat, the hair it hides."""
    def __init__(self, px=None, pal=None):
        super().__init__(px or {})
        self.pal = pal or {}
        self.cut = set()

    @classmethod
    def rows(cls, rows, x0, y0, pal=None):
        a = cls(pal=pal)
        for j, r in enumerate(rows):
            for i, ch in enumerate(r):
                if ch not in '. ': a[(x0 + i, y0 + j)] = ch
        return a

    def over(self, other):
        for p, ch in other.items(): self[p] = ch
        return self


def outlined(px: dict, ring_ok=lambda x, y: True) -> dict:
    out = dict(px)
    for (x, y) in list(px):
        for dx, dy in N4:
            q = (x + dx, y + dy)
            if q not in px and ring_ok(*q): out[q] = 'O'
    return out


def shade3(px_set, cx, cy, rx, ry, light='a', mid='m', dark='d', lo=-0.35, hi=0.3):
    """A rounded mass lit from the upper left: light, mid and dark by where each pixel faces."""
    out = {}
    for (x, y) in px_set:
        u, v = (x - cx) / rx, (y - cy) / ry
        s = 0.6 * u + 0.8 * v
        out[(x, y)] = light if s < lo else (mid if s < hi else dark)
    return out


def ellipse(cx, cy, rx, ry, tilt=0.0):
    return {(x, y) for y in range(int(cy - ry - 3), int(cy + ry + 4)) for x in range(int(cx - rx - 3), int(cx + rx + 4))
            if ((x - cx) / rx) ** 2 + ((y - (cy + (x - cx) * tilt)) / ry) ** 2 <= 1.0}


def brim_cut(art: dict, extra=0):
    """The hair a hat hides: in the hat's columns, everything above the hat's lower edge."""
    cols = {}
    for (x, y) in art:
        cols[x] = max(cols.get(x, -99), y)
    return {(x, y) for x, yb in cols.items() for y in range(-8, yb + 1 - extra)}


def _beret():
    crown = ellipse(20.5, 1.5, 15.5, 5.2, tilt=-0.22)                    # the soft crown, drooping to the back (asymmetric)
    px = shade3(crown, 18, -1, 15, 6, 'a', 'm', 'd')
    band = {(x, y) for (x, y) in crown if (x, y + 2) not in crown and x >= 9}   # the band round the head
    for p in band: px[p] = 'd'
    for (x, y) in crown:                                                  # a soft fold line under the puff
        if (x, y + 3) not in crown and (x, y + 2) in crown and 9 <= x <= 30: px[(x, y)] = 'm'
    leaf = grid([                                                        # the oversized leaf fold (front, on top)
        '.......aa..',
        '.....aaama.',
        '...aaamamd.',
        '.aaammmdd..',
        'ammmmddd...',
        '.mmddd.....',
    ], 0)
    for y in range(6):
        for x in range(11):
            ch = leaf.px[y][x]
            if ch != '.': px[(25 + x, -6 + y)] = ch
    for (x, y) in ((27, -2), (29, -3), (31, -4)): px[(x, y)] = 'd'        # the leaf's vein
    px[(8, 8)] = 'q'; px[(8, 9)] = 'k'                                    # the tiny bead charm on its cord (a highlight on top)
    px[(9, 7)] = 'd'
    a = Art(outlined(px), {'a': '#93A77A', 'm': '#6F8A63', 'd': '#3F4B36', 'k': '#D6C27A', 'q': '#F4E7B0'})
    a.cut = brim_cut({p: c for p, c in a.items() if p[0] >= 9})
    return a


def _cap():
    dome = {(x, y) for (x, y) in ellipse(21, 6.5, 14.5, 8.5) if y <= 7}    # the round crown
    px = shade3(dome, 18, 1, 14, 8, 'a', 'm', 'd')
    for x in range(7, 36):                                                # the band
        for y in (7, 8):
            if (x, y - 1) in dome or (x, y - 2) in dome: px[(x, y)] = 'd' if y == 8 else 'm'
    for x in range(33, 40): px[(x, 8)] = 'm'; px[(x, 9)] = 'd'            # the short brim, forward
    px[(40, 9)] = 'd'
    for (x, y) in ((28, 1), (27, 2), (28, 2), (29, 2), (28, 3), (26, 2), (30, 2), (27, 4), (29, 4)): px[(x, y)] = 'k'   # the star
    for (x, y) in ((28, 0), (25, 2), (31, 2)): px.pop((x, y), None) if False else None
    for x in range(10, 33, 2): px[(x, 6)] = 'n' if px.get((x, 6)) else px.get((x, 6))   # the stitching
    flap = grid([                                                         # the small side flap, buttoned
        '.mmm.',
        'mamdm',
        'mmkmd',
        'mmmdd',
        '.ddd.',
    ], 0)
    for y in range(5):
        for x in range(5):
            ch = flap.px[y][x]
            if ch != '.': px[(10 + x, 6 + y)] = ch
    px = {p: c for p, c in px.items() if c}
    a = Art(outlined(px), {'a': '#8399B7', 'm': '#5B6F8F', 'd': '#2E3748', 'k': '#E1C96E', 'n': '#8399B7'})
    a.cut = brim_cut({p: c for p, c in a.items() if 7 <= p[0] <= 36}, extra=0)
    return a


BERET, CAP = _beret(), _cap()


def _candy():
    """The Candy Ribbon Hood's own drawing over the recoloured hood (GPT: the ribbon and the jewel sell it): a big ribbon
    bow at the crown's back, a bow with a jewel at the collar's front."""
    a = Art.rows([
        '.OOO.....OOO..',    # -6
        'OlvlO...OlvlO.',    # -5
        'OllccO.OccllO.',    # -4
        'OcccxxOxxcccO.',    # -3
        '.OcxxOkOxxcO..',    # -2
        '..OOOxkxOOO...',    # -1
        '....OcxcO.....',    #  0
        '...OcxOxcO....',    #  1
        '...OxO.OxO....',    #  2
        '....O...O.....',    #  3
    ], 2, -6, {'c': '#C76B8E', 'l': '#E197B0', 'x': '#704055', 'v': '#F1D6DF', 'k': '#F1D6DF', 'w': '#FFFFFF'})
    a.over(Art.rows([
        '.OO..OO.',           # 29
        'OlcOOclO',           # 30
        'OcxvwxcO',           # 31
        'OxOvkOxO',           # 32
        '.O.OO.O.',           # 33
    ], 15, 29))
    a.cut = set()                                                         # (the hood's own cut)
    return a


CANDY = _candy()

GLASSES = Art.rows([                                                      # (the frame light on top, dark below,
    '..qqqqq..qqq.',       # 19                                             #  a glint on each lens)
    '.qw....q.qw..q',      # 20
    'qq.....qqq...q',      # 21
    '.r.....r.r...r',      # 22
    '.r.....r.r...r',      # 23
    '..rrrrr...rrr.',      # 24
], 20, 19, {'r': '#4B3A30', 'q': '#8A7766', 'w': '#CFC7BC'})
for _x in (18, 19): GLASSES[(_x, 21)] = 'q'                               # the arm, back to the ear
MONOCLE = Art.rows([
    '..ggggg..',           # 19
    '.g.....g.',           # 20
    '.w.....d.',           # 21
    '.g.....d.',           # 22
    '.g.....d.',           # 23
    '..dgddd..',           # 24
    '..g......',           # 25
    '.d.......',           # 26
    '.g.......',           # 27
    '..d......',           # 28
], 20, 19, {'g': '#BBA45A', 'w': '#E4D28A', 'd': '#6A5A2A'})
STAR = Art.rows([
    '..w..',               # 23
    '.kwk.',               # 24
    'kkkkk',               # 25
    '.kdk.',               # 26
    '.d.d.',               # 27
], 19, 23, {'k': '#F2D26B', 'w': '#F6E8A9', 'd': '#A17E1F'})
STAR[(24, 22)] = 'w'                                                      # a tiny sparkle beside it

# the Ribbon Skirt-Pants' skirt (GPT: a layered short skirt over the shorts): laid at the hips like the head's drawings,
# between the hands, a ribbon knot at the waist, pleats, a pale ruffle at the hem
SKIRT = Art.rows([
    '.OOOOOOOOOOO..',   # 44
    '.OddddddppddO.',   # 45
    '.OlrrrrOpOprO.',   # 46
    '.OlrrrrrOrOrO.',   # 47
    '.OlrrdrrrrrrO.',   # 48
    '.OlrdrrrdrrdO.',   # 49
    '.OrdrrrdrrdrrO',   # 50
    'OldrrrdrrdrrdO',   # 51
    'OppppppppppppO',   # 52
    '.OOOOOOOOOOOO.',   # 53
], 18, 44, {'r': '#7F586A', 'l': '#A97A8D', 'p': '#E1CAD4', 'd': '#44303A'})
# the Little Ranger Onepiece's utility pouches on the belt
POUCH = Art.rows([
    '.OOO.....OOO.',    # 42
    'OkkkO...OkkkO',    # 43
    'ObwbO...ObwbO',    # 44
    'ObbbO...ObbbO',    # 45
    '.OOO.....OOO.',    # 46
], 19, 42, {'k': '#C7B98D', 'b': '#8B623E', 'w': '#E8DDB5'})



# --- colours (GPT's hex) -------------------------------------------------------------------------------------------------
def _rgb(h): return tuple(int(h[i:i + 2], 16) for i in (1, 3, 5))
def _hex(c): return '#%02X%02X%02X' % tuple(max(0, min(255, round(v))) for v in c)
def mix(a, b, t): return _hex(tuple(x + (y - x) * t for x, y in zip(_rgb(a), _rgb(b))))
def dark(a, f=0.72): return _hex(tuple(v * f for v in _rgb(a)))


HAIR_COLOURS = [  # (GPT: dark, mid, light) → the hair's letters: J light, H mid, h dark, b deepest (the dark, deeper)
    ('chestnut', 'Chestnut Brown', '#7C4F35', '#A06A49', '#C28862'),
    ('walnut', 'Dark Walnut', '#4B3426', '#6B4A37', '#8A6550'),
    ('honey', 'Honey Blonde', '#B88B45', '#D2A85D', '#E8C57E'),
    ('ash', 'Ash Blonde', '#A68C67', '#C0A27B', '#D8BC94'),
    ('copper', 'Copper Red', '#964A2E', '#B85F3A', '#D77A53'),
    ('raven', 'Raven Black', '#262327', '#403B45', '#5A5460'),
    ('silver', 'Silver Mist', '#9A9FA8', '#BEC3CA', '#D8DCE2'),
    ('moss', 'Dusty Moss Green', '#56634F', '#707F68', '#8F9C86'),     # (GPT: a touch greyer / cooler than the greens)
]
SKINS = [  # (GPT: base, shade) → S, s
    ('porcelain', 'Fair Porcelain', '#F2D8C1', '#D9B79B'),
    ('ivory', 'Warm Ivory', '#E8C4A7', '#C89D7D'),
    ('tan', 'Soft Tan', '#D7A785', '#AF7B5C'),
    ('golden', 'Golden Brown', '#B97E5D', '#8D5A40'),
    ('cocoa', 'Deep Cocoa', '#8A5A44', '#60392B'),
]


def tunic_map(main, light, trim, darkc, belt=None):
    """A top on the tunic's cut: the cloth (cream T, tan t, white W/F) → the colours, the belt → the dark (or its own),
    the buckle and trims → the trim."""
    belt = belt or darkc
    return {'T': light, 't': main, 'W': mix(light, '#FFFFFF', 0.35), 'F': mix(light, '#FFFFFF', 0.5),
            'R': mix(belt, light, 0.35), 'B': belt, 'b': dark(belt), 'Y': trim, 'y': dark(trim, 0.8),
            'G': darkc, 'H': main, 'h': darkc}


def cape_map(main, light, pale, darkc):
    return {'G': main, 'L': light, 'g': mix(main, darkc, 0.5), 'D': darkc, 'Y': pale, 'y': mix(pale, main, 0.5),
            't': mix(pale, main, 0.35)}


def boots_map(main, light, trim, darkc=None):
    darkc = darkc or dark(main)
    return {'J': light, 'H': main, 'h': darkc, 'R': mix(light, trim, 0.35), 'B': mix(main, darkc, 0.5), 'b': dark(darkc, 0.85),
            'e': darkc, 'E': dark(darkc, 0.7), 't': trim}


def shorts_map(main, darkc):
    return {'P': main, 'p': darkc}


OUTFITS = [  # the starter sets (GPT): the items worn and their colours
    ('none', 'No outfit', [], {}),
    ('novice', 'Novice Fieldwear', ['tunic', 'boots'],
     {'tunic': tunic_map('#B8A67F', '#D8D0BC', '#B8A67F', '#7A5736', belt='#7A5736'),
      'boots': boots_map('#6B4B34', mix('#6B4B34', '#D8D0BC', 0.3), '#B8A67F')}),
    ('wanderer', 'Wanderer Greens', ['cape', 'boots'],
     {'cape': cape_map('#7E8C59', mix('#7E8C59', '#E5DDC8', 0.3), '#E5DDC8', '#4F3828'),
      'base': {'F': '#E5DDC8', 'T': dark('#E5DDC8', 0.9), 'P': '#8B6948', 'p': '#4F3828'},
      'boots': boots_map('#4F3828', '#8B6948', '#8B6948')}),
    ('scout', 'Village Scout', ['tunic', 'boots'],
     {'tunic': tunic_map('#985842', mix('#985842', '#E7DBC5', 0.3), '#E7DBC5', '#5B4A43', belt='#5B4A43'),
      'base': {'F': '#E7DBC5', 'T': dark('#E7DBC5', 0.9), 'P': '#5B4A43', 'p': dark('#5B4A43')},
      'boots': boots_map('#6A5440', mix('#6A5440', '#E7DBC5', 0.3), '#E7DBC5')}),
]
BOWS = [  # the bow's letters: R light edge, B wood, b dark, f string
    ('hunter', "Hunter's Bow", {}),
    ('sprout', 'Sprout Bow', {'B': '#9B6B43', 'R': '#BB875A', 'b': dark('#9B6B43'), 'f': '#B8B8B8'}),
    ('trail', 'Trail Bow', {'B': '#6F4A32', 'R': '#9C7450', 'b': dark('#6F4A32'), 'f': '#C3C3C3'}),
]
SHOP = {  # the first cash shop collection (GPT): the drawings (hats, face) and the recolours on the items' cuts
    'hat': [
        ('moonleaf', 'Moonleaf Beret', {'att': 'moonleaf'}),
        ('courier', 'Star Courier Cap', {'att': 'courier'}),
        ('candy', 'Candy Ribbon Hood', {'att': 'candy', 'wear': ['hood'], 'maps': {'hood': {
            'G': '#C76B8E', 'L': '#E197B0', 'g': mix('#C76B8E', '#704055', 0.5), 'D': '#704055',
            'Y': '#F1D6DF', 'y': mix('#F1D6DF', '#C76B8E', 0.5)}}, 'cut': 'hood'}),
    ],
    'face': [
        ('glasses', 'Round Scholar Glasses', {'att': 'glasses'}),
        ('monocle', 'Dreamer Monocle Clip', {'att': 'monocle'}),
        ('star', 'Star Patch Sticker', {'att': 'star'}),
    ],
    'top': [
        ('rose', 'Rose Duelist Jacket', {'wear': ['tunic'], 'maps': {'tunic': tunic_map('#A9444D', '#D76872', '#D7B15E', '#4D2A2E')}}),
        ('nightscout', 'Night Scout Hoodie', {'wear': ['tunic'], 'maps': {'tunic': tunic_map('#3E4658', '#657089', '#AFC1D6', '#232A37')}}),
        ('mint', 'Mint Festival Blouse', {'wear': ['blouse'], 'unwear': ['tunic'], 'maps': {'blouse': tunic_map('#9DC7B0', '#C6E0D0', '#F4F0E3', '#5E7767')}}),
    ],
    'bottom': [
        ('traveler', 'Traveler Shorts', {'maps': {'base': shorts_map('#6B5847', '#3A2D24')}}),
        ('ribbon', 'Ribbon Skirt-Pants', {'maps': {'base': shorts_map('#7F586A', '#44303A')}, 'under': ['skirt']}),
    ],
    'overall': [
        ('ranger', 'Little Ranger Onepiece', {'wear': ['tunic'], 'maps': {
            'tunic': tunic_map('#7E8A5D', mix('#7E8A5D', '#C7B98D', 0.45), '#C7B98D', '#473422', belt='#8B623E'),
            'base': shorts_map('#7E8A5D', '#473422')}, 'over': ['pouch']}),
        ('pajama', 'Celestial Pajama Suit', {'wear': ['tunic'], 'maps': {
            'tunic': tunic_map('#7D7EB6', '#A7A9D8', '#F1E8B0', '#454774'),
            'base': shorts_map('#7D7EB6', '#454774')}}),
    ],
    'cape': [
        ('petal', 'Petal Drifter Cape', {'wear': ['petalcape'], 'unwear': ['cape'], 'maps': {'petalcape': cape_map('#D48CA1', '#E7B3C0', '#F2D8E0', '#784556')}}),
        ('forest', 'Forest Scout Mantle', {'wear': ['cape'], 'maps': {'cape': cape_map('#6D8158', '#90A56E', '#C4C98A', '#39442E')}}),
    ],
    'shoes': [
        ('fieldboots', 'Soft Field Boots', {'wear': ['boots'], 'maps': {'boots': boots_map('#6A4A38', '#8D6A54', '#B69A7C')}}),
        ('moonstep', 'Moonstep Sandals', {'wear': ['sandals'], 'unwear': ['boots']}),
        ('starrunner', 'Star Runner Shoes', {'wear': ['boots'], 'maps': {'boots': boots_map('#5D6C86', '#8EA1BF', '#F0E2A0', '#30384A')}}),
    ],
}
ARCHER = ['hood', 'tunic', 'bracers', 'boots', 'cape', 'quiver']        # the class's own outfit (the approved look)


def hood_cut():
    """With the hood on, the hair outside its outline is hidden (a tail, a tuft): the hood covers the rest."""
    import items_R as IR
    m = IR.MASTER_CLEAN
    return {(x, y) for y in range(31) for x in range(W) if m.px[y][x] == '.'}


def _att(a, pal=None, cut=None):
    """A drawing as JSON: its box, its rows (RLE), its own colours; a hat's hidden hair as a mask."""
    import doll_R as D
    px = a if isinstance(a, dict) else {(x, y): a.px[y][x] for y in range(a.h) for x in range(a.w) if a.px[y][x] != '.'}
    xs = [x for x, _ in px]; ys = [y for _, y in px]
    x0, y0, x1, y1 = min(xs), min(ys), max(xs), max(ys)
    g = Grid(x1 - x0 + 1, y1 - y0 + 1)
    for (x, y), ch in px.items(): g.px[y - y0][x - x0] = ch
    d = {'x': x0, 'y': y0, 'rle': D.rle(g, 0, 0, g.w - 1, g.h - 1)}
    pal = pal if pal is not None else getattr(a, 'pal', None)
    if pal: d['pal'] = pal
    if cut:
        cx = [x for x, _ in cut]; cy = [y for _, y in cut]
        m = Grid(max(cx) - min(cx) + 1, max(cy) - min(cy) + 1)
        for (x, y) in cut: m.px[y - min(cy)][x - min(cx)] = '#'
        d['cut'] = {'x': min(cx), 'y': min(cy), 'rle': D.rle(m, 0, 0, m.w - 1, m.h - 1, fill=True)}
    return d


def export_json():
    hpal = {'S': None}
    out = {
        'hair': {'wind': _att(WIND), 'crop': _att(CROP), 'tail': _att(TAIL)},
        'eyes': {k: dict(_att(o, EYE_PAL[k]), shut=_att(sh)) for k, o, sh in
                 (('calm', CALM, CALM_SHUT), ('bright', BRIGHT, CALM_SHUT), ('sharp', SHARP, CALM_SHUT))},
        'att': {'moonleaf': _att(BERET, cut=BERET.cut), 'courier': _att(CAP, cut=CAP.cut), 'candy': _att(CANDY),
                'glasses': _att(GLASSES), 'monocle': _att(MONOCLE), 'star': _att(STAR), 'skirt': _att(SKIRT), 'pouch': _att(POUCH)},
        'cuts': {'hood': _att({p: '#' for p in hood_cut()})},
        'hairLetters': 'JHhb', 'skinLetters': 'Ss',
        'catalog': {
            'hairStyles': [['wind', 'Wind-Tousled Fringe'], ['crop', 'Scout Crop'], ['tail', 'Falcon Tail']],
            'hairColours': [[i, n, {'J': l, 'H': m, 'h': d, 'b': dark(d, 0.78)}] for i, n, d, m, l in HAIR_COLOURS],
            'eyes': [['calm', 'Calm Focus'], ['bright', 'Bright Curious'], ['sharp', 'Sharp Hunter']],
            'skins': [[i, n, {'S': b, 's': sh}] for i, n, b, sh in SKINS],
            'outfits': [[i, n, w, m] for i, n, w, m in OUTFITS],
            'bows': [[i, n, m] for i, n, m in BOWS],
            'shop': {k: [[i, n, d] for i, n, d in v] for k, v in SHOP.items()},
            'archer': ARCHER,
        },
    }
    return out
