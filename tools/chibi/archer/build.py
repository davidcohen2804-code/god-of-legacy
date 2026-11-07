"""Build the archer's sprites for the game: every animation frame (96 × 96, feet at (48, 88), facing right — the game
mirrors for left) packed into public/assets/chibi/archer/archer.png + archer.json (a Phaser atlas), and the animations
(frames, ms, loop, events, the bow grip per frame) into archer.anims.json. Usage: python3 tools/chibi/archer/build.py"""
import json, os, sys
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, 'src')); sys.path.insert(0, os.path.join(HERE, '..'))
from PIL import Image
import frames_R as A
import minimal_R  # the minimal-motion test (walk4, outfit B: idleb, blinkb, walk4b) — adds to A.FRAMES
import outfit_R   # the base body + items: the default idle / blink / walk4 from them, and the removal test's variants

ROOT = os.path.abspath(os.path.join(HERE, '..', '..', '..'))
OUT = os.path.join(ROOT, 'public', 'assets', 'chibi', 'archer')
COLS = 12

frames = []          # (name, grid)
anims = {}
LOOP = {'idle': True, 'walk': True, 'run': True, 'blink': False, 'walk4': True, 'idleb': True, 'blinkb': False, 'walk4b': True}
for name, seq in A.FRAMES.items():
    names = []
    for i, (g, ms) in enumerate(seq):
        n = f'{name}_{i}'; frames.append((n, g)); names.append(n)
    anims[name] = {'frames': names, 'ms': [ms for _, ms in seq], 'loop': LOOP.get(name.split('~')[0], False),
                   'events': getattr(A, 'EVENTS', {}).get(name, {})}
F = A.F
rows = (len(frames) + COLS - 1) // COLS
sheet = Image.new('RGBA', (COLS * F, rows * F), (0, 0, 0, 0))
atlas = {'frames': {}, 'meta': {'app': 'tools/chibi/archer/build.py', 'image': 'archer.png', 'format': 'RGBA8888',
                                 'size': {'w': COLS * F, 'h': rows * F}, 'scale': '1'}}
for i, (n, g) in enumerate(frames):
    x, y = (i % COLS) * F, (i // COLS) * F
    sheet.alpha_composite(g.render(1), (x, y))
    atlas['frames'][n] = {'frame': {'x': x, 'y': y, 'w': F, 'h': F}, 'rotated': False, 'trimmed': False,
                          'spriteSourceSize': {'x': 0, 'y': 0, 'w': F, 'h': F}, 'sourceSize': {'w': F, 'h': F}}
os.makedirs(OUT, exist_ok=True)
sheet.save(os.path.join(OUT, 'archer.png'), optimize=True)
json.dump(atlas, open(os.path.join(OUT, 'archer.json'), 'w'), indent=1)
json.dump({'frame': F, 'origin': [48, 88], 'height': 62, 'facing': 'right', 'anims': anims},
          open(os.path.join(OUT, 'archer.anims.json'), 'w'), indent=1)
print(len(frames), 'frames →', os.path.relpath(OUT, ROOT))
import doll_R      # the paper doll: every frame as layers, composed in the game for the chosen look
print('doll', doll_R.export(os.path.join(OUT, 'archer.doll.json')), 'bytes')
