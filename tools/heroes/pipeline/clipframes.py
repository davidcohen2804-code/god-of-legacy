"""clipframes.py <video> <cls> <act> <i,j,k,...>: frames of a camera-locked clip placed with ONE transform taken from
frame 0 (the standing ref): standing height 509, feet on y=700, hips at x=384 — so nothing grows or sinks."""
import sys, os, glob, pickle, tempfile, shutil
import numpy as np
from PIL import Image
sys.path.insert(0, '/home/claude/god-of-legacy/tools/heroes/pipeline')
from integrate import key_video, hip_x, place
v, cls, act = sys.argv[1], sys.argv[2], sys.argv[3]; idx = [int(x) for x in sys.argv[4].split(',')]
cache = v + '.keyed.pkl'
A = pickle.load(open(cache, 'rb')) if os.path.exists(cache) else key_video(v, tempfile.mkdtemp())
m0 = A[0][..., 3] > 128; ys = np.where(m0.any(1))[0]; S = 509.0 / (ys[-1] - ys[0]); hx = hip_x(m0); G = ys[-1]
out = f'/home/claude/god-of-legacy/tools/heroes/motion/{cls}'
for f in glob.glob(f'{out}/{act}_[0-9]*.png'): os.remove(f)
for n, i in enumerate(idx, 1): place(A[i], S, hx, G, f'{out}/{act}_{n:02d}.png')
print(cls, act, len(idx), 'frames, scale', round(S, 3))
