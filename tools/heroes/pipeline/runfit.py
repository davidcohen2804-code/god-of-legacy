#!/usr/bin/env python3
"""runfit.py <cls> <video> <start> <period> [cycle]: integrate a run, then rescale so the median face width matches the walk."""
import sys, subprocess, glob, shutil, os, numpy as np
from PIL import Image
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from integrate import face_w
cls, video, start, period = sys.argv[1], sys.argv[2], sys.argv[3], sys.argv[4]; cycle = sys.argv[5] if len(sys.argv) > 5 else '760'
S = os.path.dirname(os.path.abspath(__file__)); R = f'/home/claude/god-of-legacy/tools/heroes/motion/{cls}'
def run(scale):
    shutil.rmtree(f'{S}/{cls}_run_prev', ignore_errors=True)
    subprocess.run(['python3', f'{S}/integrate.py', 'loop', cls, 'run', video, '--start', start, '--period', period, '--cycle', cycle, '--scale', str(scale)], check=True)
    shutil.rmtree(f'{S}/{cls}_run_prev', ignore_errors=True)
def med(act):
    v = []
    for f in sorted(glob.glob(f'{R}/{act}_*.png')):
        a = np.array(Image.open(f))[..., 3] > 40; ys = np.where(a.any(1))[0]; v.append(ys[-1] - ys[0])
    return float(np.median(v))
run(1.0)
w, r = med('walk'), med('run'); sc = 0.87 * w / r   # a sprint pose leans: ~87% of the walking height
print('height walk', w, 'run', r, 'scale', round(sc, 3))
if abs(sc - 1) > 0.03: run(round(sc, 3))
# preview sheet
fs = sorted(glob.glob(f'{R}/run_*.png')); ims = [Image.open(f).resize((192, 192)) for f in fs]
sh = Image.new('RGBA', (192 * 9, 192 * ((len(ims) + 8) // 9)), (60, 60, 60, 255))
for i, im in enumerate(ims): sh.paste(im, ((i % 9) * 192, (i // 9) * 192), im)
sh.convert('RGB').save(f'{S}/wr/{cls}_run_frames.jpg'); print(len(fs), 'frames')
