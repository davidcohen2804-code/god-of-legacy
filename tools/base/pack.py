# pack.py : build the GPT base-body sheets (6x4 cells of 256 px, 1536x1024) from the right-facing warrior frames.
# Sheets already issued (numbers listed in KEEP) are left untouched; the remaining frames are re-packed after them.
# Skipped on purpose: death (MapleStory-style ghost death), hurt (the warrior uses the react sheet), recovery (react stance),
# idle columns 1-11 (no cape on the base: one idle frame + procedural breathing).
import json, numpy as np, hashlib, os, sys
from PIL import Image
G = os.path.dirname(os.path.abspath(__file__)) + '/../../'
KEEP = [int(x) for x in sys.argv[1:]]   # e.g. pack.py 1 2
SKIP_ANIM = {'death', 'hurt', 'recovery'}
cells = json.load(open(G + 'src/data/body-cells.json')); B = json.load(open(G + 'src/data/blade-lines.json'))
D = G + 'tools/base/sheets/'; os.makedirs(D, exist_ok=True)
old = json.load(open(D + 'sheets.json')) if os.path.exists(D + 'sheets.json') else []
kept = [s for s in old if s['sheet'] in KEEP]
issued = {(f['key'], f['k']) for s in kept for f in s['frames']}
groups = []
for key in B:
  name = key.split('/')[-2] if '/skills/' in key else key.split('/')[-1][:-4]; c = cells.get(name, {}) if '/skills/' in key else {}
  if name in SKIP_ANIM: continue
  W = c.get('w', 352); H = c.get('h', 352); fx = W // 2; fy = 310 + H - 352
  a = np.array(Image.open(G + 'public/' + key).convert('RGBA'))
  seen = {}; frames = []
  for k in range(a.shape[1] // W):
    if name == 'idle' and k > 0: continue
    f = a[352 * 1 + 0:352 * 1 + H, k * W:(k + 1) * W] if H == 352 else a[H:2 * H, k * W:(k + 1) * W]
    f = a[1 * H:2 * H, k * W:(k + 1) * W]
    if (f[..., 3] > 0).sum() < 200: continue
    h = hashlib.md5(f.tobytes()).hexdigest()
    if h in seen: seen[h]['dups'].append([1, k]); continue
    oy, ox = fy - 310, fx - 176; crop = np.zeros((352, 352, 4), np.uint8)
    sy0, sx0 = max(0, oy), max(0, ox); sy1, sx1 = min(H, oy + 352), min(W, ox + 352)
    crop[sy0 - oy:sy1 - oy, sx0 - ox:sx1 - ox] = f[sy0:sy1, sx0:sx1]
    e = dict(key=key, r=1, k=k, dups=[], crop=crop, W=W, H=H); seen[h] = e
    if (key, k) not in issued: frames.append(e)
  if frames: groups.append((name, frames))
groups.sort(key=lambda g: -len(g[1]))
remaining = list(groups); sheets = []
while remaining:
  cap = 24; s = []
  for g in list(remaining):
    if len(g[1]) <= cap: s.extend([(g[0], f) for f in g[1]]); cap -= len(g[1]); remaining.remove(g)
    if cap == 0: break
  if cap > 0 and remaining:
    g = remaining[0]; s.extend([(g[0], f) for f in g[1][:cap]]); remaining[0] = (g[0], g[1][cap:])
    if not remaining[0][1]: remaining.pop(0)
  sheets.append(s)
meta = kept[:]; first = (max(KEEP) if KEEP else 0) + 1
for old_s in old:   # drop files of re-packed sheets
  if old_s['sheet'] not in KEEP and os.path.exists(D + f"base_{old_s['sheet']:02d}.png"): os.remove(D + f"base_{old_s['sheet']:02d}.png")
for i, s in enumerate(sheets):
  no = first + i; im = Image.new('RGB', (1536, 1024), (255, 0, 255)); m = []
  for j, (name, f) in enumerate(s):
    cell = Image.fromarray(f['crop']).resize((256, 256), Image.LANCZOS)
    bg = Image.new('RGB', (256, 256), (255, 0, 255)); bg.paste(cell, (0, 0), cell); im.paste(bg, ((j % 6) * 256, (j // 6) * 256))
    m.append(dict(anim=name, key=f['key'], r=1, k=f['k'], W=f['W'], H=f['H'], dups=f['dups'], cell=j))
  im.save(D + f'base_{no:02d}.png'); meta.append(dict(sheet=no, frames=m, anims=sorted(set(x[0] for x in s))))
json.dump(meta, open(D + 'sheets.json', 'w'), indent=1)
for x in meta: print(x['sheet'], len(x['frames']), x['anims'])
