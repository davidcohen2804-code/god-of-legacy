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
  # Elderwood Path: a fallen log, an old stump and a flat boulder, each its own (measured on the GPT picture)
  'dusk_wood': [{'id': 'log', 'x': (505, 935), 'front': 445, 'h': 55, 'depth': 30, 'occ': [[520, 357], [920, 372], [938, 392], [938, 440], [905, 452], [520, 452], [503, 440], [503, 372]]},
                stump('stump', 320, 480, 480, 600, 25), stump('boulder', 1100, 1270, 400, 520, 30, 18)],
  # The Elder Hollow: a great flat boulder, a small round one, the Elder Tree's arching root and a fallen log
  'dusk_3': [stump('boulder', 95, 455, 400, 530, 40, 24), stump('boulder-small', 500, 640, 455, 530, 25, 14),
             {'id': 'root-arch', 'x': (900, 1240), 'front': 525, 'h': 95, 'depth': 35, 'occ': [[940, 397], [1200, 397], [1238, 430], [1238, 522], [1200, 528], [940, 528], [902, 522], [902, 430]]},
             {'id': 'log', 'x': (1300, 1660), 'front': 520, 'h': 70, 'depth': 30, 'occ': [[1315, 422], [1645, 428], [1658, 450], [1658, 515], [1640, 522], [1315, 522], [1302, 505], [1302, 440]]}],
  # Elderwood Village: the crates and barrel, the well (its rim), the mossy boulder
  'dusk_village': [{'id': 'crates', 'x': (268, 436), 'front': 525, 'h': 70, 'depth': 28, 'occ': [[272, 388], [352, 388], [352, 440], [432, 440], [434, 522], [270, 522]]},
                   {'id': 'well', 'x': (690, 850), 'front': 528, 'h': 85, 'depth': 30, 'occ': [[700, 425], [840, 425], [848, 450], [848, 526], [692, 526], [692, 450]]},
                   stump('boulder', 1300, 1545, 420, 522, 35, 24)],
  # The Thief's Den, room 1 (Root Cellar): the glowing mushroom cap, the root knot, the stolen crates and chest
  'den_1': [stump('mushroom', 95, 455, 410, 545, 45, 30), {'id': 'root-knot', 'x': (700, 1080), 'front': 580, 'h': 60, 'depth': 40, 'occ': [[760, 470], [1020, 470], [1078, 520], [1078, 578], [702, 578], [702, 520]]},
            {'id': 'crates', 'x': (1230, 1600), 'front': 585, 'h': 110, 'depth': 40, 'occ': [[1240, 415], [1450, 415], [1455, 440], [1595, 440], [1598, 583], [1232, 583]]}],
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
