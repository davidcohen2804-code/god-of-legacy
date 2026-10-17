"""drift.py <cls> [acts...]: mean Lab (L, a, b) of each action's frames vs the idle frames (opaque pixels, rim excluded)."""
import sys, glob, os
import numpy as np, cv2
from scipy import ndimage
cls = sys.argv[1]
acts = sys.argv[2:] or ['walk', 'run', 'jump', 'stance', 'hurt', 'launched', 'down_impact', 'down', 'getup', 'backstep', 'quickrise', 'runstop', 'stunned', 'win', 'intro']
D = f'/home/claude/god-of-legacy/tools/heroes/motion/{cls}'
def lab(f):
    A = cv2.imread(f, cv2.IMREAD_UNCHANGED); m = ndimage.binary_erosion(A[..., 3] > 200, iterations=3)
    L = cv2.cvtColor(A[..., :3], cv2.COLOR_BGR2LAB).astype(float)
    return L[m]
def stat(act):
    fs = sorted(glob.glob(f'{D}/{act}_[0-9]*.png'))
    if not fs: return None
    P = np.concatenate([lab(f) for f in fs[:: max(1, len(fs) // 6)]])
    return P.mean(0), np.median(P, 0)
ref = stat('idle')[0]
print(cls, 'idle L a b', np.round(ref, 1))
for a in acts:
    s = stat(a)
    if s is None: continue
    d = s[0] - ref; print(f'  {a:12s} dL {d[0]:+6.1f}  da {d[1]:+5.1f}  db {d[2]:+5.1f}')
