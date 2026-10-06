# masters.py <ver> [big] : the ONE sheet GPT edits for every head item (1536×1024, magenta, 256-px grid):
#   cell 0        = the upright idle frame (the item's main drawing, placed rigidly on every side-view frame);
#                   with `big` it fills a 2×2 block (512 px = 1.45× the game frame) so GPT draws the item large and crisp
#   other cells   = the side-view frames whose head pose is furthest from upright (pose hints)
# Writes tools/base/masters/<ver>.png/.json (cells + their [x, y, size] on the sheet), <ver>_frame.png/_mask.png
# (cell 0 snapshot), <ver>_cells.npz (all cells).
import json, sys, os, numpy as np
from PIL import Image
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from anchors import masks, fit
G = os.path.dirname(os.path.abspath(__file__)) + '/../../'; S = 352; C = 256
BASE = G + 'public/assets/final/body/warrior/base/'; MD = G + 'tools/base/masters/'
VER = sys.argv[1] if len(sys.argv) > 1 else 'v5'
BIG = 'big' in sys.argv[2:]
BACK = []   # no climbing in the game: side view only
anims = sorted(json.load(open(G + 'src/data/base-sheets.json')))
T = masks('idle', 0)
cand = []; seen = set()   # identical frames reused by several moves count once
for a in anims:
  m = np.array(Image.open(BASE + a + '_m.png'))[..., 0]
  for c in range(m.shape[1] // S):
    if a == 'idle' and c > 0: continue           # idle uses one frame
    h = m[:, c * S:(c + 1) * S] == 40
    if h.sum() < 50 or h.tobytes() in seen: continue
    seen.add(h.tobytes())
    r, _ = fit(T, masks(a, c), allow_flip=False); cand.append((r[4], a, c)); print(a, c, r[4], flush=True)
cand.sort()
pos = [[0, 0, 2 * C if BIG else C]] + [[(j % 6) * C, (j // 6) * C, C] for j in range(24) if j and not (BIG and j % 6 < 2 and j // 6 < 2)]
cells = [['idle', 0]] + [[a, c] for _, a, c in cand[:len(pos) - 1 - len(BACK)]] + BACK
json.dump({'cells': cells, 'pos': pos, 'back': list(range(len(pos) - len(BACK), len(pos))) if BACK else []}, open(MD + VER + '.json', 'w'))
im = Image.new('RGB', (1536, 1024), (255, 0, 255)); F = []; M = []
for j, (a, c) in enumerate(cells):
  px = np.array(Image.open(BASE + a + '.png').convert('RGBA'))[:, c * S:(c + 1) * S]; mk = np.array(Image.open(BASE + a + '_m.png'))[:, c * S:(c + 1) * S]
  F.append(px); M.append(mk)
  x_, y_, sz = pos[j]
  b = Image.fromarray(px).resize((sz, sz), Image.LANCZOS); bg = Image.new('RGB', (sz, sz), (255, 0, 255)); bg.paste(b, (0, 0), b)
  im.paste(bg, (x_, y_))
im.save(MD + VER + '.png')
Image.fromarray(F[0]).save(MD + VER + '_frame.png'); Image.fromarray(M[0]).save(MD + VER + '_mask.png')
np.savez_compressed(MD + VER + '_cells.npz', frames=np.stack(F), masks=np.stack(M))
print('master', VER, cells)
