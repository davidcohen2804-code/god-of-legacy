# expand.py : the first chapter's route — the world row made longer with new areas. Until an area has its own GPT map,
# it stands in as a copy of a painted one (mirrored every other time, so neighbours still meet seamlessly: a mirrored
# map's left edge is the original's right edge). Writes tools/world/src/<id>.png + layers/gpt/<id>.png (the copies),
# the areas (floor, props, paint boxes, monster spawns mirrored with the picture), the row and the joins.
#   python3 tools/world/expand.py   (then tools/world/strip.py)
import json, os, copy
from PIL import Image, ImageOps
G = os.path.dirname(os.path.abspath(__file__)) + '/'
R = G + '../../'
D = json.load(open(R + 'src/data/world-areas.json'))
AW = D['size'][0]
# id: (name, stand-in map, mirrored, monsters)   — the painted maps keep their own entry (None)
ROUTE = [
  ('courtyard', None),
  ('terraces_1', ('Ivy Terraces', 'courtyard', True, 'sprout')),
  ('terraces_2', ('Ivy Terraces', 'courtyard', False, 'sprout')),
  ('training', None),
  ('training_2', ('Training Grounds', 'training', True, 'rusted')),
  ('training_3', ('Training Grounds', 'training', False, 'rusted')),
  ('plaza', None),
  ('orchard_1', ('Old Orchard', 'plaza', True, 'thorn')),
  ('orchard_2', ('Old Orchard', 'plaza', False, 'thorn')),
  ('ruins', None),
  ('ruins_2', ('Crimson Ruins', 'ruins', True, 'cursed')),
  ('ruins_3', ('Crimson Ruins', 'ruins', False, 'cursed')),
  ('gate_1', ('Ruined Gate', 'ruins', True, 'cursed')),
  ('gate_2', ('Ruined Gate', 'ruins', False, 'warden')),
  ('temple', None),
]
SPAWNS = [[420, 440], [600, 610], [760, 420], [930, 600], [1090, 430], [1260, 610], [1400, 450]]   # 7 a map
WARDEN = [[1000, 520]]

mx = lambda x: round(AW - x, 1)
def mirror_poly(p): return [[mx(x), y] for x, y in p]

for id_, spec in ROUTE:
  if spec is None: continue
  name, src, flip, mob = spec
  for d in ('src/', 'layers/gpt/'):
    im = Image.open(G + d + src + '.png')
    (ImageOps.mirror(im) if flip else im).save(G + d + id_ + '.png')
  a = copy.deepcopy(D['areas'][src]); a['name'] = name
  a.pop('npcs', None); a.pop('portal', None)
  if flip:
    a['walk'] = mirror_poly(a['walk'])
    for p in a.get('props', []):
      for k in ('foot', 'base', 'occ'):
        if k in p: p[k] = mirror_poly(p[k])
    if 'paint' in a: a['paint'] = [[mx(b[2]), b[1], mx(b[0]), b[3]] for b in a['paint']]
  a['mobs'] = {'kind': mob, 'spawns': WARDEN if mob == 'warden' else ([[mx(x), y] for x, y in SPAWNS] if flip else SPAWNS)}
  if mob == 'warden': a['mobs2'] = {'kind': 'cursed', 'spawns': SPAWNS[::2]}
  a['standin'] = src
  D['areas'][id_] = a
D['row'] = [r[0] for r in ROUTE]
D['joins'] = {f'{a}|{b}': {'blend': 90} for a, b in zip(D['row'], D['row'][1:])}
for k in list(D['areas']):
  if k not in D['row']: del D['areas'][k]
open(R + 'src/data/world-areas.json', 'w').write(json.dumps(D, indent=1, ensure_ascii=False) + '\n')
print('row', D['row'])
