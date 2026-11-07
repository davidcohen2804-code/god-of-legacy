"""The archer's master frame (facing right, three-quarter view, idle) — the approved guide's idle frame 1 reduced to
the 64 px grid (master_R_raw.txt, tools/chibi/native.py with the guide's own palette), then cleaned by hand here:
outline pixels unified, stray tones in the hair / face / tunic removed, the eyes redrawn as the guide draws them
(a heavy lid, white either side of a dark pupil, an olive bottom). `python3 master_R.py` writes master_R.txt."""
import os
HERE = os.path.dirname(os.path.abspath(__file__))
rows = [l.rstrip('\n') for l in open(os.path.join(HERE, 'master_R_raw.txt')) if not l.startswith('#')]
W = len(rows[0])
rows = [r.ljust(W, '.') for r in rows]

# 1. hand-cleaned rows (hood, hair, forehead) — each replaces the raw row whole
FIX = {
    0: '...............OOOOOOOOOOO...............',
    1: '............OOOOGLLLLLLGgOOOO............',
    3: '........OOOGGGGLLLLLLLLLLLLGGGgOO........',
    4: '.......OOGGGGGLLLLLLLLLLLLYYYYyyOOO......',
    5: '......OOGGGGGLLLLLLLLLLLYYYYYYYYyyOO.....',
    6: '.....OGGGGGGLLLLLLLLLLYYYYYYYYOOObHOO....',
    7: '.....OGGGGGGLLLLLLLLLYYYYYYOOObhOObbO....',
    9: '...OOGGGGGGGLLLLLLLYYYYyOhHHHHhHHHHJOOO..',
    10: '..OOGGGGGGGGLLLLLLYYYYOhHhHHHHHHHJJJHHOOO',
    11: '.OOGGGGGgDGGLLLLLYYYYObHHhHHHHHhHJJhHHHHO',
    12: '.OGGGGGgDGGGGLLLYYYYOhHHJhJHHJJJhJJHhOOO.',
    13: '.OgGGGGDDGGGGLLYYYYOhHHHHhHJHJJJhHHJHOO..',
    14: '.OggggDDGGGGGLYYYYOHHHHJhJhJHHHHhHHHHhO..',
    15: '.OOgggDDGGGGGLYYYOOHHHHHSShhHHHHhHHHhhOO.',
    16: '..OODDDGGGGGGYYYYOHHHHHHSShhHHHHhhHHhHHO.',
    17: '...OOOOGGGGGYYYYOhHHHHhSSsOhHHHhhhHHhhHHO',
    18: '.....OOGGGGGYYYYOHHHHhhSSSsOHHHhsOHHhOOOO',
    19: '....OOGGGGGYYYYOOhHHHHOSSSshhHHOShhHhOOOO',
    20: '....OOGGGGGYYYOOOhHHHOOOOOOSSOOOOOhHhO...',
    21: '....ODgGGGGYYYOOshHHHhWWEEWSSSWEWOhHhO...',
    22: '.....OgggGGGyYOssOhHHSWWEEWSSSWEWOhhO....',
    23: '.....OOODggRHOOsSShhHSWWyyWSSSWyWOhOO....',
    24: '...OOOWODgDDHHOOssSSSSSSSSSSSSSSSOOO.....',
    25: '..OWWRWWWDDDDHHOOOsSSSSSSSSSSSSSSO.......',
    29: 'OWWFRWWWHOgGGLLLLGGGgOOSSSSSSSOO.........',  # the collar under the chin: one outline, then green
    30: '.OOWWRFFOORhOgGGGLLLLGOOOOOOO............',
}
for y, r in FIX.items():
    assert len(r) == W, (y, len(r))
    rows[y] = r
g = [list(r) for r in rows]

# 2. the eyes (as the guide draws them): near eye x 22–26, far eye x 30–32, lid on row 20
def put(x, y, s):
    for i, ch in enumerate(s): g[y][x + i] = ch
put(21, 20, 'OOOOOO'); put(22, 21, 'WWEEW'); put(22, 22, 'WWEEW'); put(22, 23, 'WWyyW')
put(29, 20, 'OOOOO'); put(30, 21, 'WEW'); put(30, 22, 'WEW'); put(30, 23, 'WyW')
EYES = {(x, y) for y in range(20, 24) for x in list(range(21, 27)) + list(range(29, 34))}

# 2b. tunic, belt buckle, hands, boots: stray tones inside each region take the region's own tones
def region(x0, x1, y0, y1, table):
    for y in range(y0, y1 + 1):
        for x in range(x0, x1 + 1):
            ch = g[y][x]
            if ch in table: g[y][x] = table[ch]
region(19, 30, 46, 51, {'y': 't', 'Y': 't', 'F': 'W', 's': 'T', 'S': 'W', 'R': 't', 'J': 't'})   # skirt: tan sides, cream / white front
put(24, 42, 'YYYY'); put(24, 43, 'YbbY'); put(24, 44, 'YbbY'); put(24, 45, 'YYYY')                 # the buckle
region(11, 18, 46, 51, {'J': 's', 't': 's', 'K': 'b'})                                               # near hand
region(31, 36, 45, 51, {'J': 's', 't': 's'})                                                         # far hand
region(13, 34, 53, 63, {'e': 'h', 'K': 'b', 'D': 'O', 'R': 'J'})                                     # boots
region(4, 9, 33, 37, {'e': 'h'})

# 2c. the chest, ~20% quieter (GPT 7 Nov): inner black lines under the capelet become dark leather, stray tones go
#     (the V-neck, the main strap and the buckle stay)
for y in range(33, 42):
    for x in range(18, 34):
        ch = g[y][x]
        edge = any(g[y + dy][x + dx] == '.' for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)) if 0 <= y + dy < len(g) and 0 <= x + dx < W)
        if ch in 'OE' and not edge: g[y][x] = 'b'
        elif ch in 'eKD' : g[y][x] = 'b'
        elif ch == 's' and x > 22: g[y][x] = 'T'
region(22, 30, 38, 41, {'R': 'B', 'y': 't', 'L': 'g'})
# the chest redrawn simply: cream tunic, a small brown V-neck, one strap from the far shoulder to the belt, the far sleeve
put(19, 33, 'LLLggGYYLgggO')
put(19, 34, 'YYyLTbbbTyGgO')
put(19, 35, 'YyTTTTbTTTBBBO')
put(18, 36, 'OTTTTTTTTTBBRBO')
put(18, 37, 'OTTTTTTTTBTBRBBO')
put(19, 38, 'OTTTTTTBTTBRBbO')
put(19, 39, 'OTTTTTBTTTBRBbO')
put(19, 40, 'OTTTTBTTTTBRBbO')
put(19, 41, 'OtTTBTTTTtBRBbO')
# the belt: a brown band with the gold buckle
put(18, 42, 'OtttttYYYYttO'); put(18, 43, 'ObBBBBYbbYBbO'); put(18, 44, 'ObBBBBYbbYBbO'); put(18, 45, 'OtTTTTYYYYTtO')

# 3. outline tones unified (the guide's two near-blacks are one outline), except inside the eyes
for y in range(len(g)):
    for x in range(W):
        if g[y][x] == 'E' and (x, y) not in EYES: g[y][x] = 'O'

open(os.path.join(HERE, 'master_R.txt'), 'w').write('# The archer, facing right (three-quarter), idle master — built by master_R.py from master_R_raw.txt.\n'
                                                     + '\n'.join(''.join(r) for r in g) + '\n')
