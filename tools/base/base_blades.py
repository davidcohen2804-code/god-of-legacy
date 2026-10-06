"""Per-frame sword line (hilt -> tip) of the beginner BASE body strips, from their own *_weapon.png sword masks.
The armour sheets' lines (src/data/blade-lines.json) do not match the redrawn base frames, so effects that ride the
sword (Radiant Blade's light blade, sword skins) need these.
Output: src/data/base-blade-lines.json  {anim: [[hx, hy, tx, ty] | null per frame]}  (sheet px, relative to the feet
(176, 310) of each 352 px cell). QC: tools/base/qc/base_blades.png (red = hilt, yellow = tip).
usage: python3 tools/base/base_blades.py
"""
import glob
import json
import os

import numpy as np
from PIL import Image, ImageDraw
from scipy import ndimage as nd

G = os.path.join(os.path.dirname(__file__), '..', '..')
BASE = os.path.join(G, 'public/assets/final/body/warrior/base/')
CELL, FX, FY = 352, 176, 310

out, qc_rows = {}, []
for f in sorted(glob.glob(BASE + '*.png')):
    if f.endswith('_m.png') or f.endswith('_weapon.png'):
        continue
    anim = os.path.basename(f)[:-4]
    wf = f[:-4] + '_weapon.png'
    if not os.path.exists(wf):
        continue
    body = np.array(Image.open(f).convert('RGBA'))
    sword = np.array(Image.open(wf).convert('RGBA'))[..., 3] > 0
    n = body.shape[1] // CELL
    row = []
    for c in range(n):
        m = sword[:, c * CELL:(c + 1) * CELL]
        b = body[:, c * CELL:(c + 1) * CELL, 3] > 100
        lab, k = nd.label(nd.binary_dilation(m, iterations=2))
        if k == 0:
            row.append(None); continue
        sz = nd.sum(m, lab, range(1, k + 1))
        comp = (lab == 1 + int(np.argmax(sz))) & m
        ys, xs = np.nonzero(comp)
        if len(xs) < 40:
            row.append(None); continue
        p = np.vstack([xs, ys]).astype(float)
        mu = p.mean(1, keepdims=True)
        _, evec = np.linalg.eigh(np.cov(p - mu))
        d = evec[:, 1]
        t = d @ (p - mu)
        a, z = mu[:, 0] + d * t.min(), mu[:, 0] + d * t.max()
        if t.max() - t.min() < 30:
            row.append(None); continue
        by, bx = np.nonzero(b & ~m)
        cb = np.array([bx.mean(), by.mean()])
        if np.linalg.norm(a - cb) > np.linalg.norm(z - cb):
            a, z = z, a  # hilt = the end nearer the body
        row.append([round(float(a[0] - FX), 1), round(float(a[1] - FY), 1), round(float(z[0] - FX), 1), round(float(z[1] - FY), 1)])
    out[anim] = row
    # QC strip
    im = Image.fromarray(body, 'RGBA').convert('RGB')
    dr = ImageDraw.Draw(im)
    for c, ln in enumerate(row):
        if not ln:
            continue
        hx, hy, tx, ty = ln[0] + FX + c * CELL, ln[1] + FY, ln[2] + FX + c * CELL, ln[3] + FY
        dr.line([hx, hy, tx, ty], fill=(255, 230, 0), width=3)
        dr.ellipse([hx - 5, hy - 5, hx + 5, hy + 5], fill=(255, 0, 0))
    qc_rows.append(im.resize((im.width // 3, im.height // 3)))

json.dump(out, open(os.path.join(G, 'src/data/base-blade-lines.json'), 'w'), separators=(',', ':'))
W = max(r.width for r in qc_rows)
qc = Image.new('RGB', (W, sum(r.height for r in qc_rows)), (40, 40, 48))
y = 0
for r in qc_rows:
    qc.paste(r, (0, y)); y += r.height
os.makedirs(os.path.join(G, 'tools/base/qc'), exist_ok=True)
qc.save(os.path.join(G, 'tools/base/qc/base_blades.png'))
print(len(out), 'anims', sum(1 for v in out.values() for x in v if x), 'frames with a sword line')
