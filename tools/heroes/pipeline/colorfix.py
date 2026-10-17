"""colorfix.py <cls> <act,act,...> [--L] : shift each action's colour balance to the idle's (mean Lab a/b over the
action's frames vs the idle frames; --L also its brightness when off by > 3). One shift per action, alpha untouched."""
import sys, glob
import numpy as np, cv2
from scipy import ndimage
cls, acts = sys.argv[1], sys.argv[2].split(','); useL = '--L' in sys.argv
D = f'/home/claude/god-of-legacy/tools/heroes/motion/{cls}'
def px(f):
    A = cv2.imread(f, cv2.IMREAD_UNCHANGED); m = ndimage.binary_erosion(A[..., 3] > 200, iterations=3)
    return cv2.cvtColor(A[..., :3], cv2.COLOR_BGR2LAB).astype(float)[m]
def mean(act):
    fs = sorted(glob.glob(f'{D}/{act}_[0-9]*.png')); return np.concatenate([px(f) for f in fs]).mean(0), fs
ref, _ = mean('idle')
for act in acts:
    mu, fs = mean(act); d = ref - mu
    sh = np.array([d[0] if (useL and abs(d[0]) > 3) else 0.0, d[1], d[2]])
    for f in fs:
        A = cv2.imread(f, cv2.IMREAD_UNCHANGED)
        L = cv2.cvtColor(A[..., :3], cv2.COLOR_BGR2LAB).astype(float) + sh
        A[..., :3] = cv2.cvtColor(np.clip(L, 0, 255).astype(np.uint8), cv2.COLOR_LAB2BGR); cv2.imwrite(f, A)
    print(cls, act, 'shift L a b', np.round(sh, 1), len(fs), 'frames')
