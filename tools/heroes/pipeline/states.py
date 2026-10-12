"""states.py <cls> <scale>: place the GPT stills in st/<cls>_*.jpg as backstep (4), quickrise (3), runstop (2), stunned (4-loop)."""
import sys, os, json, glob, shutil, numpy as np
from PIL import Image
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from gkey import key
from integrate import largest, place, hip_x
cls, S = sys.argv[1], float(sys.argv[2]); R = f'/home/claude/god-of-legacy/tools/heroes/motion/{cls}'
def put(src, out, lying=False, dx=0):
    a = largest(key(src)); m = a[..., 3] > 128; ys, xs = np.where(m)
    cx = (xs.min() + xs.max()) / 2 if lying else hip_x(m)
    place(a, S, cx + dx / S, ys.max(), out)
    b = np.array(Image.open(out))[..., 3] > 40; ys, xs = np.where(b); print(os.path.basename(out), xs.min(), xs.max(), ys.min(), ys.max())
plan = {'backstep': [('backstep1', False), ('backstep2', False), ('backstep3', False), ('backstep4', False)],
        'quickrise': [('quickrise1', True), ('quickrise2', False), ('runstop2', False)],
        'runstop': [('runstop1', False), ('runstop2', False)],
        'stunned': [('stunned1', False), ('stunned3', False), ('stunned2', False), ('stunned3', False)]}
mj = f'{R}/motion.json'; m = json.load(open(mj))
for act, items in plan.items():
    for f in glob.glob(f'{R}/{act}_[0-9]*.png'): os.remove(f)
    for n, (k, lying) in enumerate(items, 1): put(f'st/{cls}_{k}.jpg', f'{R}/{act}_{n:02d}.png', lying)
    m['animations'][act] = {'frames': len(items), 'source': 'gpt stills', 'loop': act == 'stunned', 'frame_ms': {'backstep': [80] * 4, 'quickrise': [55, 55, 50], 'runstop': [60, 60], 'stunned': [110] * 4}[act]}
json.dump(m, open(mj, 'w'), indent=2)
