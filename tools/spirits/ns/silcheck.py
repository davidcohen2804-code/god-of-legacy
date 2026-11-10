# The mesh's outline laid on the approved drawings through the bake's registration (test only).
#   python3 silcheck.py MESH.glb OUT.jpg [views]
import sys, json, numpy as np
from PIL import Image, ImageDraw
from scipy import ndimage
sys.path.insert(0, '/tmp/claude-0/-home-claude/3e5fb49a-8e0a-5558-8b49-0394b00826f4/scratchpad/ns/hair'); import glbio
R = '/tmp/claude-0/-home-claude/3e5fb49a-8e0a-5558-8b49-0394b00826f4/scratchpad/ns/'
bb = json.load(open(R + 'h3d/bbox_reg.json'))
H_ = {'front': np.array([1, 0, 0]), 'back': np.array([-1, 0, 0]), 'left': np.array([0, 0, -1]), 'right': np.array([0, 0, 1])}
m = glbio.read(sys.argv[1]); P, I = m['P'], m['I']
views = sys.argv[3].split(',') if len(sys.argv) > 3 else ['front', 'right', 'back', 'left']
crop = [int(x) for x in sys.argv[4].split(',')] if len(sys.argv) > 4 else None
tiles = []
for v in views:
    s0, s1, t0, t1 = bb['mesh_' + v]; x0, x1, y0, y1 = bb[v]
    s = P @ H_[v]; t = P[:, 1]
    px = x0 + (s - s0) * (x1 - x0) / (s1 - s0); py = y0 + (t1 - t) * (y1 - y0) / (t1 - t0)
    sil = Image.new('L', (1024, 1536), 0); d = ImageDraw.Draw(sil)
    for a, b, c in I: d.polygon([(px[a], py[a]), (px[b], py[b]), (px[c], py[c])], fill=255)
    S = np.asarray(sil) > 0; edge = S & ~ndimage.binary_erosion(S, iterations=2)
    im = Image.open(R + 'v2_%s_cut.png' % v).convert('RGBA'); bg = Image.new('RGB', im.size, (225, 225, 228)); bg.paste(im, (0, 0), im)
    A = np.asarray(bg).copy(); A[edge] = (255, 0, 40); A[S & ~edge] = (A[S & ~edge] * 0.8 + np.array([0, 60, 255]) * 0.2).astype(np.uint8)
    t_ = Image.fromarray(A)
    if crop: t_ = t_.crop(crop)
    tiles.append(t_)
W = sum(t.width for t in tiles); Hh = max(t.height for t in tiles)
out = Image.new('RGB', (W, Hh)); x = 0
for t in tiles: out.paste(t, (x, 0)); x += t.width
out.save(sys.argv[2], quality=88)
