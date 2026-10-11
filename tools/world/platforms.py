# platforms.py : stone blocks and raised ledges of the new maps, measured by hand on their GPT pictures (map px) — each
# becomes a prop of its area in world-areas.json the way blocks.py makes them (you jump onto them; they hide whoever stands
# behind them up to their top edge):
#   (x0, x1)    the block's left / right edge      front  the plinth's bottom (where it meets the floor)
#   h           its height (top face front edge above the plinth's bottom)      depth  the top face's depth as drawn
#   occ         its silhouette, a little inside the outline (default: the box)
#   python3 tools/world/platforms.py   (then tools/world/urns.py and tools/world/strip.py)
import json, os
G = os.path.dirname(os.path.abspath(__file__)) + '/'
R = G + '../../'
FOOT_R, EDGE = 10, 2
def stump(id_, x0, x1, top, front, depth, cut=12):
  """A round-topped stump / boulder: its box, its silhouette an octagon (the corners cut)."""
  return {'id': id_, 'x': (x0, x1), 'front': front, 'h': front - depth - top, 'depth': depth,
          'occ': [[x0 + cut, top + 2], [x1 - cut, top + 2], [x1 - 1, top + cut], [x1 - 1, front - 3], [x1 - cut, front - 1], [x0 + cut, front - 1], [x0 + 1, front - 3], [x0 + 1, top + cut]]}

PLATFORMS = {
  # Elderwood Path: four broad mossy stumps on the path (measured on the GPT picture)
  'dusk_wood': [stump('stump-1', 305, 425, 383, 465, 22), stump('stump-2', 652, 790, 438, 525, 25), stump('stump-3', 1000, 1158, 383, 465, 24), stump('stump-4', 1400, 1540, 440, 525, 26)],
  # The Elder Hollow: four stumps before the Elder Tree's door
  'dusk_3': [stump('stump-1', 120, 275, 390, 470, 25), stump('stump-2', 590, 740, 405, 490, 25), stump('stump-3', 1040, 1190, 390, 475, 25), stump('stump-4', 1420, 1560, 405, 490, 25)],
  'terraces_1': [
    {'id': 'block-low', 'x': (262, 372), 'front': 528, 'h': 73, 'depth': 22},
    {'id': 'block-tall', 'x': (376, 492), 'front': 520, 'h': 100, 'depth': 31},
    {'id': 'ledge', 'x': (697, 1030), 'front': 397, 'h': 97, 'depth': 31, 'solid_to': 346},
    {'id': 'block-right', 'x': (1342, 1451), 'front': 528, 'h': 70, 'depth': 25},
  ],
}
D = json.load(open(R + 'src/data/world-areas.json'))
for a, blocks in PLATFORMS.items():
  props = [p for p in D['areas'][a].get('props', []) if not p['id'].startswith(('block', 'ledge', 'platform', 'stump'))]
  for b in blocks:
    x0, x1 = b['x']; f, h = b['front'], b['h']
    s0 = f - b['depth']; back = s0 - h + FOOT_R - EDGE
    top = f - h - b['depth']
    occ = b.get('occ') or [[x0 + 2, top + 3], [x1 - 2, top + 3], [x1 - 1, f - 2], [x0 + 1, f - 2]]
    b0 = b.get('solid_to', s0)   # solid_to: nothing walkable behind it (it stands against the floor's back edge)
    props.append({'id': b['id'], 'foot': [[x0, back], [x1, back], [x1, f], [x0, f]], 'base': [[x0, b0], [x1, b0], [x1, f], [x0, f]],
                  'h': h, 'top': h, 'stand': [s0, f - 3], 'occ': occ})
  D['areas'][a]['props'] = props
  print(a, [p['id'] for p in props])
open(R + 'src/data/world-areas.json', 'w').write(json.dumps(D, indent=1, ensure_ascii=False) + '\n')
