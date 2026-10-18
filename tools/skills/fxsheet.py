# fxsheet.py : an effect clip on black (PixVerse video, or a folder of frames) -> one frame sheet the game plays (ArcherFx.flip)
#   python3 tools/skills/fxsheet.py IN.mp4 OUT.webp --frames 16 --size 256 [--from 0.0 --to 5.0] [--crop x0,y0,x1,y1] [--gamma 1.0]
# Every frame: black turned to alpha (alpha = the brightest channel, the colour un-premultiplied, so a dark edge keeps its
# colour and the planks show through only where the effect is thin), trimmed to the box of the whole clip, scaled so its
# longer side is `size`, laid in a grid of `cols` (default: square-ish). Prints the frame size and the grid for the loader.
import argparse, os, subprocess, tempfile, glob, math
import numpy as np
from PIL import Image

ap = argparse.ArgumentParser()
ap.add_argument('src'); ap.add_argument('out')
ap.add_argument('--frames', type=int, default=16); ap.add_argument('--size', type=int, default=256)
ap.add_argument('--from', dest='t0', type=float, default=0.0); ap.add_argument('--to', dest='t1', type=float, default=None)
ap.add_argument('--crop', default=None); ap.add_argument('--cols', type=int, default=0)
ap.add_argument('--gamma', type=float, default=1.0, help='alpha curve: >1 thins the faint haze')
ap.add_argument('--floor', type=float, default=0.04, help='alpha below this is cut (the clip\'s noise)')
a = ap.parse_args()

tmp = tempfile.mkdtemp()
if os.path.isdir(a.src):
    files = sorted(glob.glob(a.src + '/*.png') + glob.glob(a.src + '/*.jpg'))
else:
    dur = float(subprocess.run(['ffprobe', '-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', a.src], capture_output=True, text=True).stdout.strip())
    t1 = a.t1 if a.t1 is not None else dur
    fps = a.frames / max(0.05, t1 - a.t0)
    subprocess.run(['ffmpeg', '-v', 'error', '-ss', str(a.t0), '-to', str(t1), '-i', a.src, '-vf', f'fps={fps}', tmp + '/f%03d.png'], check=True)
    files = sorted(glob.glob(tmp + '/f*.png'))
files = files[:a.frames]
ims = []
for f in files:
    im = np.asarray(Image.open(f).convert('RGB')).astype(np.float32) / 255
    if a.crop: x0, y0, x1, y1 = map(int, a.crop.split(',')); im = im[y0:y1, x0:x1]
    al = im.max(axis=2)
    al = np.clip((al - a.floor) / (1 - a.floor), 0, 1) ** a.gamma
    rgb = np.where(al[..., None] > 1e-3, np.clip(im / np.maximum(im.max(axis=2, keepdims=True), 1e-3), 0, 1), 0)
    ims.append(np.dstack([rgb, al]))
# the box of the whole clip
mask = np.zeros(ims[0].shape[:2], bool)
for im in ims: mask |= im[..., 3] > 0.05
ys, xs = np.where(mask)
y0, y1, x0, x1 = ys.min(), ys.max() + 1, xs.min(), xs.max() + 1
h, w = y1 - y0, x1 - x0
k = a.size / max(h, w)
fw, fh = max(1, round(w * k)), max(1, round(h * k))
n = len(ims); cols = a.cols or math.ceil(math.sqrt(n)); rows = math.ceil(n / cols)
sheet = Image.new('RGBA', (cols * fw, rows * fh), (0, 0, 0, 0))
for i, im in enumerate(ims):
    fr = Image.fromarray((im[y0:y1, x0:x1] * 255).astype(np.uint8), 'RGBA').resize((fw, fh), Image.LANCZOS)
    sheet.paste(fr, ((i % cols) * fw, (i // cols) * fh))
os.makedirs(os.path.dirname(os.path.abspath(a.out)), exist_ok=True)
sheet.save(a.out, quality=88, method=6)
print(f'{a.out}: {n} frames {fw}x{fh} grid {cols}x{rows}')
