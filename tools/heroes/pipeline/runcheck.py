#!/usr/bin/env python3
"""runcheck.py <video> <sheet.jpg>: contact sheet (every 8th frame) + front-foot touchdown frames for picking start/period."""
import sys, subprocess, glob, tempfile, numpy as np
from PIL import Image
v, sheet = sys.argv[1], sys.argv[2]
subprocess.run(['ffmpeg', '-loglevel', 'error', '-y', '-i', v, '-vf', 'select=not(mod(n\\,8)),scale=320:-1,tile=5x4', '-frames:v', '1', sheet])
d = tempfile.mkdtemp(); subprocess.run(['ffmpeg', '-loglevel', 'error', '-y', '-i', v, f'{d}/f_%03d.png'])
xs = []; hs = []
for f in sorted(glob.glob(f'{d}/f_*.png')):
    a = np.array(Image.open(f).convert('RGB')).astype(int); m = ~((a[..., 1] > 150) & (a[..., 0] < 120) & (a[..., 2] < 120))
    ys = np.where(m.any(1))[0]; bot = ys[-1]; band = m[bot - 25:bot + 1]; x = np.where(band)[1]; xs.append(int(x.max()) if len(x) else 0); hs.append(int(ys[-1] - ys[0]))
xs = np.array(xs)
# touchdown = frame where the front foot x jumps forward (new foot lands)
td = [i for i in range(1, len(xs)) if xs[i] - xs[i - 1] > 120]
print('frames', len(xs), 'touchdowns', td, 'spacing', np.diff(td).tolist())
print('height0', hs[0], 'median height', int(np.median(hs)))
