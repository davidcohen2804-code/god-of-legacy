"""regwarp.py <cls> <act> [frames e.g. 2,3,4] [--dry]: register frames onto frame 1 (ORB, scale+shift, no rotation)."""
import sys, glob, os
import numpy as np, cv2
cls, act = sys.argv[1], sys.argv[2]
only = [int(x) for x in sys.argv[3].split(',')] if len(sys.argv) > 3 and not sys.argv[3].startswith('--') else None
dry = '--dry' in sys.argv
D = f'/home/claude/god-of-legacy/tools/heroes/motion/{cls}'
fs = sorted(glob.glob(f'{D}/{act}_[0-9]*.png'))
def g(a):
    rgb = a[..., :3].copy(); rgb[a[..., 3] < 40] = 0
    return cv2.cvtColor(rgb, cv2.COLOR_BGR2GRAY), (a[..., 3] > 40).astype(np.uint8) * 255
orb = cv2.ORB_create(4000); bf = cv2.BFMatcher(cv2.NORM_HAMMING, crossCheck=True)
R = cv2.imread(fs[0], cv2.IMREAD_UNCHANGED); gr, mr = g(R); kr, dr = orb.detectAndCompute(gr, mr)
for n, f in enumerate(fs, 1):
    if n == 1 or (only and n not in only): continue
    A = cv2.imread(f, cv2.IMREAD_UNCHANGED); gi, mi = g(A); ki, di = orb.detectAndCompute(gi, mi)
    ms = sorted(bf.match(di, dr), key=lambda m: m.distance)[:600]
    src = np.float32([ki[m.queryIdx].pt for m in ms]); dst = np.float32([kr[m.trainIdx].pt for m in ms])
    M, inl = cv2.estimateAffinePartial2D(src, dst, method=cv2.RANSAC, ransacReprojThreshold=4)
    s = float(np.hypot(M[0, 0], M[1, 0]))
    # keep scale + translation, drop rotation: map the inlier centroid the same way
    c = src[inl.ravel() == 1].mean(0); cd = M[:, :2] @ c + M[:, 2]
    T = np.float32([[s, 0, cd[0] - s * c[0]], [0, s, cd[1] - s * c[1]]])
    W = cv2.warpAffine(A, T, (768, 768), flags=cv2.INTER_LANCZOS4, borderMode=cv2.BORDER_CONSTANT, borderValue=(0, 0, 0, 0))
    ys = np.where((W[..., 3] > 40).any(1))[0]; ys0 = np.where((A[..., 3] > 40).any(1))[0]
    print(os.path.basename(f), 'scale', round(s, 3), 'dy', round(float(T[1, 2]), 1), 'bot', ys0[-1], '->', ys[-1], 'top', ys[0])
    if not dry: cv2.imwrite(f, W)
