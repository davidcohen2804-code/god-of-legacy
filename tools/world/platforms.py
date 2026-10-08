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
PLATFORMS = {
  'terraces_1': [
    {'id': 'block-low', 'x': (262, 372), 'front': 528, 'h': 73, 'depth': 22},
    {'id': 'block-tall', 'x': (376, 492), 'front': 520, 'h': 100, 'depth': 31},
    {'id': 'ledge', 'x': (697, 1026), 'front': 398, 'h': 98, 'depth': 30},
    {'id': 'block-right', 'x': (1342, 1451), 'front': 528, 'h': 70, 'depth': 25},
  ],
}
D = json.load(open(R + 'src/data/world-areas.json'))
for a, blocks in PLATFORMS.items():
  props = [p for p in D['areas'][a].get('props', []) if not p['id'].startswith(('block', 'ledge', 'platform'))]
  for b in blocks:
    x0, x1 = b['x']; f, h = b['front'], b['h']
    s0 = f - b['depth']; back = s0 - h + FOOT_R - EDGE
    top = f - h - b['depth']
    occ = b.get('occ') or [[x0 + 2, top + 3], [x1 - 2, top + 3], [x1 - 1, f - 2], [x0 + 1, f - 2]]
    props.append({'id': b['id'], 'foot': [[x0, back], [x1, back], [x1, f], [x0, f]], 'base': [[x0, s0], [x1, s0], [x1, f], [x0, f]],
                  'h': h, 'top': h, 'stand': [s0, f - 3], 'occ': occ})
  D['areas'][a]['props'] = props
  print(a, [p['id'] for p in props])
open(R + 'src/data/world-areas.json', 'w').write(json.dumps(D, indent=1, ensure_ascii=False) + '\n')
