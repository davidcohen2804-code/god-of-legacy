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
# id: (name, stand-in map, mirrored, monsters) — the first maps keep their own entry (None); a stand-in map None: the
# area has its own GPT map already (src/ + layers/gpt/), its floor is the standard one, its blocks come from platforms.py
ROUTE = [
  ('courtyard', None),
  ('terraces_1', ('Ivy Terraces', None, False, 'sprout')),            # its own map (platforms.py)
  ('terraces_2', ('Upper Gardens', None, False, 'sprout')),
  ('training', None),
  ('training_2', ('Sparring Yard', None, False, 'rusted')),
  ('training_3', ('Archery Range', None, False, 'rusted')),
  ('plaza', None),
  ('orchard_1', ('Orchard Path', None, False, 'thorn')),
  ('orchard_2', ('Harvest Square', None, False, 'thorn')),
  ('ruins', None),
  ('ruins_2', ('Broken Colonnade', None, False, 'cursed')),
  ('ruins_3', ('Sunken Shrine', None, False, 'cursed')),
  ('gate_1', ('Siege Approach', None, False, 'cursed')),
  ('gate_2', ("Warden's Hold", None, False, 'warden')),
  ('temple', None),
  # chapter 3: east of the Temple Road, the twilight gardens (their own GPT maps; blocks.py)
  ('dusk_1', ('Wisteria Walk', None, False, 'glowcap')),
  ('dusk_village', ('Elderwood Village', None, False, None)),   # the archers' town: no monsters
  ('dusk_2', ('Lantern Steps', None, False, 'moth')),
  ('dusk_bridge', ('Moonfall Bridge', None, False, 'moth')),
  ('dusk_wood', ('Elderwood Path', None, False, 'glowcap')),
  ('dusk_3', ('The Elder Hollow', None, False, 'shade_fox')),
  # the Thief's Den: five rooms inside the Elder Tree (interiors, walled off; Den.ts runs the party quest in them)
  ('den_1', ('Root Cellar', None, False, None)),
  ('den_2', ('Hanging Roots', None, False, None)),
  ('den_3', ('Lantern Ledges', None, False, None)),
  ('den_4', ("Magpie's Nest", None, False, None)),
  ('den_5', ('Treasure Hoard', None, False, None)),
]
DEN = {'den_1', 'den_2', 'den_3', 'den_4', 'den_5'}
SPAWNS = [[420, 440], [600, 610], [760, 420], [930, 600], [1090, 430], [1260, 610], [1400, 450]]   # 7 a map
WARDEN = [[1000, 520]]
# a map's boss: where it stands (map px) and the lesser monsters round it (mobs2)
BOSSES = {'warden': {'spawns': WARDEN, 'mobs2': 'cursed'}, 'shade_fox': {'spawns': [[836, 530]], 'mobs2': 'moth'}}
# maps of their own: spawns clear of their blocks and ledges
# maps whose floor is not the standard band (map px): the village square ends at its front railing
OWN_WALK = {'dusk_village': [[0, 346], [AW, 346], [AW, 586], [0, 586]]}
OWN_SPAWNS = {'terraces_2': [[420, 600], [380, 440], [700, 560], [1000, 590], [1250, 430], [1300, 610], [1520, 470]],
              'orchard_1': [[300, 430], [250, 610], [650, 560], [950, 600], [1300, 430], [1250, 610], [1550, 450]],
              'terraces_1': [[600, 460], [820, 600], [1060, 470], [1230, 600], [1180, 430], [560, 615], [1520, 590]]}

mx = lambda x: round(AW - x, 1)
def mirror_poly(p): return [[mx(x), y] for x, y in p]

for id_, spec in ROUTE:
  if spec is None: continue
  name, src, flip, mob = spec
  if src is not None and id_ in OWN_SPAWNS: pass
  if src is None:   # painted: keep its props (platforms.py, urns.py), set its name / floor / monsters
    a = D['areas'].get(id_, {'props': []})
    if a.pop('standin', None): a['props'] = []; a.pop('paint', None)   # was a stand-in copy: its own GPT map now (blocks.py finds its blocks)
    a.pop('mirrored', None)
    a.update({'name': name, 'walk': OWN_WALK.get(id_, [[0, 346], [AW, 346], [AW, 652], [0, 652]]), 'mobs': {'kind': mob, 'spawns': BOSSES[mob]['spawns'] if mob in BOSSES else OWN_SPAWNS.get(id_, SPAWNS)} if mob else {'kind': 'none', 'spawns': []}})
    if mob in BOSSES: a['mobs2'] = {'kind': BOSSES[mob]['mobs2'], 'spawns': SPAWNS[::2]}
    else: a.pop('mobs2', None)
    D['areas'][id_] = a; continue
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
  a['mobs'] = {'kind': mob, 'spawns': BOSSES[mob]['spawns'] if mob in BOSSES else OWN_SPAWNS.get(id_) or ([[mx(x), y] for x, y in SPAWNS] if flip else SPAWNS)}
  if mob in BOSSES: a['mobs2'] = {'kind': BOSSES[mob]['mobs2'], 'spawns': SPAWNS[::2]}
  if id_ == 'terraces_2': a['walk'] = [[0, 346], [AW, 346], [AW, 652], [0, 652]]   # Ivy Heights stands over the courtyard's back alcove
  a['standin'] = src; a['mirrored'] = flip
  D['areas'][id_] = a
D['row'] = [r[0] for r in ROUTE]
D['joins'] = {f'{a}|{b}': {'blend': 0} if b in DEN else {'blend': 90} for a, b in zip(D['row'], D['row'][1:])}   # (into / inside the den: a hard edge, no blend)
for k in DEN:
  if k in D['areas']:
    D['areas'][k]['interior'] = True
    if k == 'den_1' and not any(p['id'] == 'entry-wall' for p in D['areas'][k]['props']):   # the den's mouth: sealed (Bram's door is the way in, by Den.ts)
      D['areas'][k]['props'].append({'id': 'entry-wall', 'foot': [[-30, 290], [30, 290], [30, 710], [-30, 710]], 'h': 999})
for k in list(D['areas']):
  if k not in D['row']: del D['areas'][k]
open(R + 'src/data/world-areas.json', 'w').write(json.dumps(D, indent=1, ensure_ascii=False) + '\n')
print('row', D['row'])
