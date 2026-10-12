"""strip.py <cls> <act> <strip.jpg> <n> <frame_ms> [hold]: a horizontal strip of n video frames (frame 0 = the standing ref pose)
→ motion frames; scale = 509 / standing height of frame 0; feet on y=700, hips at x=384. hold: the last frame holds (win)."""
import sys, os, json, glob, numpy as np
from PIL import Image
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from gkey import key
from integrate import largest, place, hip_x
cls, act, strip, n, ms = sys.argv[1], sys.argv[2], sys.argv[3], int(sys.argv[4]), int(sys.argv[5]); hold = len(sys.argv) > 6
R = f'/home/claude/god-of-legacy/tools/heroes/motion/{cls}'
im = Image.open(strip); W = im.width // n
frames = []
for i in range(n):
    p = f'/tmp/strip_{i}.jpg'; im.crop((i * W, 0, (i + 1) * W, im.height)).save(p, quality=95); frames.append(largest(key(p)))
m0 = frames[0][..., 3] > 128; ys = np.where(m0.any(1))[0]; S = 509.0 / (ys[-1] - ys[0]); ground = ys[-1]
for f in glob.glob(f'{R}/{act}_[0-9]*.png'): os.remove(f)
for i, a in enumerate(frames, 1):
    m = a[..., 3] > 128; ys, xs = np.where(m)
    place(a, S, hip_x(m), min(ys.max(), ground + 6), f'{R}/{act}_{i:02d}.png')
mj = f'{R}/motion.json'; d = json.load(open(mj))
d['animations'][act] = {'frames': n, 'source': 'pixverse strip', 'loop': False, 'hold': hold, 'frame_ms': [ms] * n}
json.dump(d, open(mj, 'w'), indent=2); print(cls, act, n, 'frames scale', round(S, 3))
