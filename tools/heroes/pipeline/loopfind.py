"""loopfind.py <video> <pmin> <pmax> : key the clip, rank (start, period) by how well frame start+period matches frame start
(whole body: mask IoU + colour), i.e. the cut whose last frame flows into the first."""
import sys, os, glob, subprocess, tempfile, pickle
import numpy as np
from PIL import Image
sys.path.insert(0, '/home/claude/god-of-legacy/tools/heroes/pipeline')
from integrate import key_video, hip_x
video, pmin, pmax = sys.argv[1], int(sys.argv[2]), int(sys.argv[3])
cache = video + '.keyed.pkl'
if os.path.exists(cache): A = pickle.load(open(cache, 'rb'))
else: A = key_video(video, tempfile.mkdtemp()); pickle.dump(A, open(cache, 'wb'))
n = len(A)
def norm(a):  # align on hips + feet, downscale
    m = a[..., 3] > 128; ys = np.where(m.any(1))[0]; hx = hip_x(m); bot = ys[-1]
    im = Image.fromarray(a); C = Image.new('RGBA', (900, 800)); C.paste(im, (int(450 - hx), int(760 - bot)), im)
    return np.array(C.resize((180, 160))).astype(float)
N = [norm(a) for a in A]
def dist(x, y):
    mx = x[..., 3] > 100; my = y[..., 3] > 100; iou = (mx & my).sum() / max(1, (mx | my).sum())
    both = mx & my; col = np.abs(x[..., :3] - y[..., :3])[both].mean() / 255 if both.any() else 1
    return (1 - iou) + col
step = np.median([dist(N[i], N[i + 1]) for i in range(n - 1)])
res = []
for p in range(pmin, pmax + 1):
    for s in range(0, n - p):
        res.append((dist(N[s], N[s + p]), s, p))
res.sort()
print('frames', n, 'median step', round(step, 3))
for d, s, p in res[:12]: print(f'start {s} period {p} seam {d:.3f} ({d/step:.2f} steps)')
