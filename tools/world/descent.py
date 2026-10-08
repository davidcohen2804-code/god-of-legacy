# descent.py : the Sun Seal Plaza — the boss ground below Temple Road (the temple area), reached by walking down a
# staircase cut into the temple's front arcade (no portal: the camera just follows you down).
#   in : tools/world/arena/arena_gpt.png (GPT's picture: the stairs + the plaza, at the strip's scale x 0.5)
#        tools/world/arena/arena_x2.jpg  (the same, upscaled x2 by Real-ESRGAN x4plus then halved: see arena/README)
#   out: public/assets/world/arena/<i>.webp (the plaza's picture tiles), the staircase patched into
#        public/assets/world/strip/0.webp, public/assets/world/minimap/arena.jpg, src/data/world-arena.json
# Run after strip.py (strip.py runs it at its end).   python3 tools/world/descent.py [--preview]
import json, os, sys
import numpy as np
from PIL import Image, ImageDraw, ImageFilter
from shapely.geometry import Polygon, box
from shapely.ops import unary_union

G = os.path.dirname(os.path.abspath(__file__)) + '/'
R = G + '../../'
STRIP = json.load(open(R + 'src/data/world-strip.json'))
TERRACE_H = STRIP['h']                     # 941: the terrace picture's height = where the plaza starts
EDGE_Y = 652                               # the terrace floor's front edge (the balustrade)

# GPT picture (native px): the staircase between its cheek walls, and the line under the stairs where the plaza starts
STAIR = (620, 48, 1050, 236)               # x0, y0, x1, y1
CROP_Y = 236
SCALE = 1.6                                # plaza: native x1.6 (made from the x2 upscale)
# where the staircase goes in the temple's front arcade: between its two pillars (temple-urn-13 / -14), on the
# temple's gold centre line (world px); the strip tile that holds it
DX = STRIP['areas']['temple']['x'] - 6373          # the temple moved along the world: its stairs go with it
GAP = (6923 + DX, 7433 + DX)
# the plaza starts at the world's left end (x 0): the terrace runs above all of it, so looking up from anywhere on the
# plaza shows the courtyard's arcade (the stairs come down onto its left part, the seal is further right)
OX = STRIP['w'] - round(1672 * SCALE)         # the plaza ends where the world ends (x 8000): the terrace runs above all of it
OY = TERRACE_H
# the walkable stairs (inside the cheek walls)
WALK_STAIRS = (6955 + DX, 7401 + DX)
# the plaza floor (native px): inside the ruined walls and the columns
FLOOR = [(130, 240), (1540, 240), (1508, 330), (1508, 540), (1585, 600), (1580, 760), (1470, 830), (200, 830),
         (92, 760), (88, 600), (166, 540), (166, 330)]

def W(p): return (OX + p[0] * SCALE, OY + (p[1] - CROP_Y) * SCALE)

def main():
  nat = Image.open(G + 'arena/arena_gpt.png').convert('RGB')
  esr = Image.open(G + 'arena/arena_x2.jpg').convert('RGB')
  lan = nat.resize(esr.size, Image.LANCZOS)
  big = Image.blend(lan, esr, 0.65)
  big = big.resize((round(nat.width * SCALE), round(nat.height * SCALE)), Image.LANCZOS)        # the upscale's clean lines, with the picture's own grain kept
  plaza = big.crop((0, round(CROP_Y * SCALE), big.width, big.height))
  # the arcade's shadow on the plaza's top edge
  a = np.asarray(plaza).astype(np.float32)
  sh = np.clip(1 - np.arange(a.shape[0]) / 70, 0, 1) ** 1.6 * 0.42
  a *= (1 - sh)[:, None, None]
  plaza = Image.fromarray(a.astype(np.uint8))
  pw, ph = plaza.size
  out = R + 'public/assets/world/arena/'; os.makedirs(out, exist_ok=True)
  for f in os.listdir(out): os.remove(out + f)
  tiles, half = [], (pw + 1) // 2
  for i, x in enumerate((0, half - 2)):
    w = min(pw - x, half + 2)
    plaza.crop((x, 0, x + w, ph)).save(out + f'{i}.webp', 'WEBP', quality=88, method=6)
    tiles.append([OX + x, w])

  # the staircase into the temple's front arcade: GPT's stairs stretched to the arcade's height, patched into every
  # strip tile it crosses
  top = EDGE_Y - 6
  st = nat.crop(STAIR).resize((GAP[1] - GAP[0], TERRACE_H - top), Image.LANCZOS).convert('RGBA')
  m = np.full((st.height, st.width), 255, np.uint8)
  ramp = 14                                # the top fades into the floor
  m[:ramp] = (np.arange(ramp) / ramp * 255).astype(np.uint8)[:, None]
  st.putalpha(Image.fromarray(m))
  for ti, (tx, tw) in enumerate(STRIP['tiles']):
    if tx + tw <= GAP[0] or tx >= GAP[1]: continue
    tp = R + f"public/assets/world/strip/{ti}.{STRIP.get('ext', 'jpg')}"
    t0 = Image.open(tp).convert('RGBA')
    gx0, gx1 = GAP[0] - tx, GAP[1] - tx
    under = t0.crop((gx0, top, gx1, TERRACE_H))   # (outside the tile: transparent; only the inside is pasted back)
    floor = t0.crop((gx0, top - ramp, gx1, top)).resize((gx1 - gx0, ramp))
    base = Image.new('RGBA', st.size); base.paste(under, (0, 0)); base.paste(floor, (0, 0))
    base.alpha_composite(st)
    t0.paste(base, (gx0, top))
    t0.save(tp, 'WEBP', quality=88, alpha_quality=100, method=6)
    print('stairs into tile', ti)

  # the one floor: the strip's + the stairs + the plaza
  walk = Polygon(STRIP['walk']).buffer(0)
  stairs = box(WALK_STAIRS[0], EDGE_Y - 2, WALK_STAIRS[1], OY + (FLOOR[0][1] - CROP_Y) * SCALE + 2)
  floorW = Polygon([W(p) for p in FLOOR])
  allw = unary_union([walk, stairs, floorW])
  assert allw.geom_type == 'Polygon', allw.geom_type
  coords = [[round(x, 1), round(y, 1)] for x, y in list(allw.exterior.coords)[:-1]]

  mm = R + 'public/assets/world/minimap/'
  plaza.resize((pw // 3, ph // 3), Image.LANCZOS).save(mm + 'arena.jpg', quality=82)
  data = {'name': 'Sun Seal Plaza', 'x': OX, 'y': OY, 'w': pw, 'h': ph, 'ext': 'webp', 'tiles': tiles,
          'edgeY': EDGE_Y, 'stairs': list(WALK_STAIRS), 'walk': coords}
  json.dump(data, open(R + 'src/data/world-arena.json', 'w'), separators=(',', ':'))
  print('plaza', OX, OY, pw, ph, 'tiles', tiles, 'floor pts', len(coords))

  if '--preview' in sys.argv:
    os.makedirs(G + 'qc', exist_ok=True)
    pv = plaza.copy(); d = ImageDraw.Draw(pv)
    d.polygon([(x - OX, y - OY) for x, y in floorW.exterior.coords], outline=(0, 255, 0), width=5)
    pv.resize((pw // 2, ph // 2)).save(G + 'qc/arena.jpg', quality=85)

if __name__ == '__main__': main()
