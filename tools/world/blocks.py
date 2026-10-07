# blocks.py : the stone blocks standing on each map's floor — found by matching a measured block (TPL: one each side of
# the middle) near the rough spots listed in BLOCKS; each becomes a prop of its area in world-areas.json:
#   foot : its ground footprint (front edge = the plinth's bottom, DEPTH deep)   h / top : its height (the top face's
#          front edge above the plinth's bottom)   stand : the ground band under the top face as drawn (feet rest there)
#   occ  : its silhouette (top face, front face, the side face it shows — right of it left of the middle, left of it right
#          of the middle), a little inside the outline, so it never cuts a bite out of someone standing behind it
#   python3 tools/world/blocks.py   (then tools/world/strip.py)
import json, os
import numpy as np, cv2
G = os.path.dirname(os.path.abspath(__file__)) + '/'
R = G + '../../'
BLOCKS = {  # rough boxes (x0, y0, x1, y1) of the blocks, map px
 'courtyard': [(185,378,275,458),(550,465,650,560),(1150,368,1235,447),(1425,468,1530,562)],
 'training':  [(430,372,525,455),(185,475,305,575),(1435,372,1525,455),(1185,470,1295,575)],
 'plaza':     [(430,372,525,455),(185,470,305,575),(1180,372,1270,455),(1400,470,1520,575)],
 'ruins':     [(435,385,525,462),(185,475,305,578),(1205,385,1290,462),(1405,475,1525,578)],
 'temple':    [(430,372,525,455),(185,470,305,575),(1205,372,1290,455),(1405,470,1520,575)],
}
# Two measured blocks (courtyard, 5x zoom): one left of the middle (shows its right side), one right of it (its left side).
#   box, silhouette (box-relative, a little inside the outline), top face front edge (box-relative), footprint x range
TPL = {
  'L': {'box': (183, 377, 277, 456), 'occ': [(0.06, 0.20), (0.15, 0.05), (0.97, 0.02), (0.98, 0.80), (0.91, 0.95), (0.83, 0.99), (0.02, 0.99), (0.02, 0.86), (0.05, 0.72)],
        'lip': 0.20, 'fx': (0.03, 0.92)},
  'R': {'box': (1150, 369, 1236, 448), 'occ': [(0.02, 0.05), (0.77, 0.02), (0.94, 0.19), (0.96, 0.77), (0.98, 0.94), (0.94, 0.99), (0.10, 0.99), (0.05, 0.90), (0.02, 0.80)],
        'lip': 0.19, 'fx': (0.08, 0.97)},
}
DEPTH, STAND = 38, 20   # landing footprint depth / the top face as drawn (px at scale 1): a jump from the front or the back
                        # lands, then the feet settle onto the drawn top face (the scene does that, see WorldObject.stand)
src = cv2.imread(G + 'src/courtyard.png')
for t in TPL.values():
  x0, y0, x1, y1 = t['box']; t['img'] = src[y0:y1, x0:x1]
  m = np.zeros((y1 - y0, x1 - x0), np.uint8); m[:int((y1 - y0) * 0.78), :] = 255; t['mask'] = m   # top + front face (leaves ring the plinth)

D = json.load(open(R + 'src/data/world-areas.json'))
# blocks GPT added to a map (only in its cut-out picture, tools/world/layers/gpt/<area>.png): matched there
ADDED = {'training': [(780, 325, 890, 425)], 'temple': [(780, 350, 895, 455)]}
for a, rough in BLOCKS.items():
  im = cv2.imread(G + f'src/{a}.png')
  props = [p for p in D['areas'][a].get('props', []) if not p['id'].startswith('block-')]
  gpt = cv2.imread(G + f'layers/gpt/{a}.png') if ADDED.get(a) else None
  for i, (x0, y0, x1, y1) in enumerate(rough + ADDED.get(a, [])):
    if i >= len(rough): im = gpt
    X0, Y0, X1, Y1 = x0 - 40, y0 - 40, x1 + 40, y1 + 40
    t = TPL['R' if (x0 + x1) / 2 > 836 else 'L']
    reg = im[Y0:Y1, X0:X1]; best = None
    for sc in np.arange(0.85, 1.45, 0.01):
      ti = cv2.resize(t['img'], None, fx=sc, fy=sc, interpolation=cv2.INTER_AREA); m = cv2.resize(t['mask'], (ti.shape[1], ti.shape[0]), interpolation=cv2.INTER_NEAREST)
      if ti.shape[0] >= reg.shape[0] or ti.shape[1] >= reg.shape[1]: continue
      r = cv2.matchTemplate(reg, ti, cv2.TM_CCORR_NORMED, mask=m)
      _, mx, _, loc = cv2.minMaxLoc(r)
      if best is None or mx > best[0]: best = (mx, sc, loc, ti.shape[1], ti.shape[0])
    mx, sc, (lx, ly), w, h = best
    bx0, by0 = X0 + lx, Y0 + ly
    # a block far right of the middle shows more of its left side than the measured one: its outline reaches further left
    side = 0.08 if t is TPL['R'] and (x0 + x1) / 2 > 1350 else 0
    fx = lambda u: round(bx0 + (u - side * max(0, 1 - u / 0.12)) * w, 1)
    fy = lambda v: round(by0 + v * h, 1)
    front = by0 + h; height = round((1 - t["lip"]) * h); back = round(front - max(DEPTH * sc, 40), 1)
    foot = [[fx(t['fx'][0]), back], [fx(t['fx'][1]), back], [fx(t['fx'][1]), round(front, 1)], [fx(t['fx'][0]), round(front, 1)]]
    props.append({'id': f'block-{i}', 'foot': foot, 'h': height, 'top': height, 'stand': [round(front - STAND * sc, 1), round(front - 3, 1)],
                  'occ': [[fx(u), fy(v)] for u, v in t['occ']]})
    print(a, i, 'box', [bx0, by0, bx0 + w, by0 + h], 'scale', round(float(sc), 2), 'match', round(float(mx), 3), 'height', height)
  D['areas'][a]['props'] = props
open(R + 'src/data/world-areas.json', 'w').write(json.dumps(D, indent=1, ensure_ascii=False) + '\n')
