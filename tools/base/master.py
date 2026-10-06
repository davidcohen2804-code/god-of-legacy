# master.py : the ONE sheet GPT edits for every head item (hat, hairstyle, face piece…).
# Cell 0 = the upright idle frame (reference for all ordinary frames); cells 1–23 = the 23 base frames whose head pose
# is furthest from upright (lying, looking up, arms over the head…) — those get GPT's own drawing.
import json, os, numpy as np
from PIL import Image
G = os.path.dirname(os.path.abspath(__file__)) + '/../../'; S = 352
BASE = G + 'public/assets/final/body/warrior/base/'
anims = [a for a in sorted(json.load(open(G + 'src/data/base-sheets.json'))) if a != 'death']
ref = np.array(Image.open(BASE + 'idle_m.png'))[:, :S, 0] == 40; ry, rx = np.nonzero(ref); rc = (rx.mean(), ry.mean())
def fit(h):  # best IoU of the upright head rotated/shifted onto this head
  ty, tx = np.nonzero(h); best = 0
  for ang in range(-30, 31, 5):
    rr = np.array(Image.fromarray(ref.astype(np.uint8) * 255).rotate(ang, center=rc, translate=(tx.mean() - rc[0], ty.mean() - rc[1]))) > 127
    for dy in range(-6, 7, 2):
      for dx in range(-6, 7, 2):
        s = np.roll(np.roll(rr, dy, 0), dx, 1); best = max(best, (s & h).sum() / max(1, (s | h).sum()))
  return best
cand = []
for a in anims:
  m = np.array(Image.open(BASE + a + '_m.png'))[..., 0]; seen = set()
  for c in range(m.shape[1] // S):
    h = m[:, c * S:(c + 1) * S] == 40
    if h.sum() < 50 or h.tobytes() in seen: continue
    seen.add(h.tobytes()); cand.append((fit(h), a, c))
cand.sort()
cells = [['idle', 0]] + [[a, c] for _, a, c in cand[:23]]
json.dump({'cells': cells}, open(G + 'tools/base/master.json', 'w'))
im = Image.new('RGB', (1536, 1024), (255, 0, 255))
for j, (a, c) in enumerate(cells):
  b = Image.open(BASE + a + '.png').convert('RGBA').crop((c * S, 0, (c + 1) * S, S)).resize((256, 256), Image.LANCZOS)
  bg = Image.new('RGB', (256, 256), (255, 0, 255)); bg.paste(b, (0, 0), b); im.paste(bg, ((j % 6) * 256, (j // 6) * 256))
im.save(G + 'tools/base/item_master.png'); print(cells)
