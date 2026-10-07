# qc.py [area ...] [--grid] : draws an area's walkable floor (green), prop footprints (red), occluders (blue outline +
# front line), exits (yellow zone, cyan = door at the edge, magenta = where the player stops), monster spawns (orange),
# NPCs (white), portal (violet), start (star) over its image → tools/world/qc/<area>.png
import json, os, sys
from PIL import Image, ImageDraw
G = os.path.dirname(os.path.abspath(__file__)) + '/../../'
D = json.load(open(G + 'src/data/world-areas.json'))
args = [a for a in sys.argv[1:] if not a.startswith('--')]
grid = '--grid' in sys.argv
os.makedirs(G + 'tools/world/qc', exist_ok=True)
for aid in args or list(D['areas']):
  A = D['areas'][aid]
  im = Image.open(G + f'tools/world/src/{aid}.png').convert('RGBA')
  ov = Image.new('RGBA', im.size, (0, 0, 0, 0)); d = ImageDraw.Draw(ov)
  if grid:
    for x in range(0, im.size[0], 50): d.line([(x, 0), (x, im.size[1])], fill=(255, 255, 255, 40 if x % 100 else 80))
    for y in range(0, im.size[1], 50): d.line([(0, y), (im.size[0], y)], fill=(255, 255, 255, 40 if y % 100 else 80))
  P = lambda pts: [tuple(p) for p in pts]
  d.polygon(P(A['walk']), fill=(40, 255, 90, 70), outline=(40, 255, 90, 255))
  for p in A.get('props', []):
    d.polygon(P(p['foot']), fill=(255, 40, 40, 110), outline=(255, 60, 60, 255))
    if p.get('occ'):
      d.line(P(p['occ']) + [tuple(p['occ'][0])], fill=(70, 140, 255, 255), width=2)
      fy = max(q[1] for q in p['foot']); xs = [q[0] for q in p['occ']]
      d.line([(min(xs), fy), (max(xs), fy)], fill=(70, 140, 255, 160), width=1)
  for e in A.get('exits', []):
    d.polygon(P(e['zone']), fill=(255, 230, 40, 90), outline=(255, 230, 40, 255))
    for k, c in (('door', (0, 255, 255, 255)), ('entry', (255, 60, 255, 255))):
      x, y = e[k]; d.ellipse([x - 7, y - 7, x + 7, y + 7], fill=c)
    x, y = e['entry']; d.text((x + 9, y - 6), f"→ {e['to']} ({e['dir']})", fill=(255, 255, 255, 255))
  for s in A.get('mobs', {}).get('spawns', []):
    x, y = s; d.ellipse([x - 6, y - 6, x + 6, y + 6], fill=(255, 150, 30, 255))
  for n in A.get('npcs', []):
    x, y = n['x'], n['y']; d.ellipse([x - 8, y - 8, x + 8, y + 8], fill=(255, 255, 255, 255)); d.text((x + 10, y - 6), n['id'], fill=(255, 255, 255, 255))
  if A.get('portal'):
    x, y = A['portal']['x'], A['portal']['y']; d.ellipse([x - 22, y - 10, x + 22, y + 10], outline=(200, 90, 255, 255), width=3)
  if D['start']['area'] == aid:
    x, y = D['start']['x'], D['start']['y']; d.regular_polygon((x, y, 10), 5, fill=(255, 255, 255, 255))
  im.alpha_composite(ov)
  im.convert('RGB').save(G + f'tools/world/qc/{aid}.png')
  print('qc', aid)
