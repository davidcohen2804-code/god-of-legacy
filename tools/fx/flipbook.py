#!/usr/bin/env python3
"""Turns an effect into a frame sheet for the room's flip piece (Fx3D.flip / pieces.ts `flip`) — DFO, 18 Oct (David 20:51:
"a free hand in GPT and PixVerse").

    python3 tools/fx/flipbook.py SRC OUT.webp [--frames 16] [--start 0] [--end 0] [--size 384] [--cols 0]
                                 [--key black|green|magenta|alpha] [--crop auto|none] [--pad 12] [--quality 92]

SRC: a video (a PixVerse effect: mp4 / webm / mov / gif), a folder of frames (png / jpg / webp, in name order), or one
picture (a GPT sheet already laid out: then it is only re-keyed and saved).
--frames  how many frames to keep, spread evenly over [start, end] (s; end 0 = the clip's end).
--size    each frame's longer side in px (the sheet = cols x rows frames; keep it under 4096 px a side).
--key     black (default): the effect painted on black — kept as it is (the flip piece turns its brightness into its
          cover in the shader: `key: 'black'`); green / magenta: a flat screen keyed out to alpha (`key: 'alpha'`);
          alpha: the picture's own alpha kept (GPT 'transparent background' pictures).
--crop    auto (default): cut every frame to the box the effect fills over the whole clip (plus --pad px).
Writes OUT (WebP, alpha kept) and OUT.json: { frame: [w, h], grid: [cols, rows], frames, fps } — pass `frame` and `fps`
to flip(). Needs numpy, Pillow and ffmpeg.
"""
import argparse
import glob
import json
import math
import os
import shutil
import subprocess
import sys
import tempfile

import numpy as np
from PIL import Image

ap = argparse.ArgumentParser()
ap.add_argument('src'); ap.add_argument('out')
ap.add_argument('--frames', type=int, default=16)
ap.add_argument('--start', type=float, default=0.0); ap.add_argument('--end', type=float, default=0.0)
ap.add_argument('--size', type=int, default=384); ap.add_argument('--cols', type=int, default=0)
ap.add_argument('--key', choices=['black', 'green', 'magenta', 'alpha'], default='black')
ap.add_argument('--crop', choices=['auto', 'none'], default='auto'); ap.add_argument('--pad', type=int, default=12)
ap.add_argument('--quality', type=int, default=92)
o = ap.parse_args()

VID = ('.mp4', '.webm', '.mov', '.gif', '.mkv', '.avi')
tmp = None
if os.path.isdir(o.src):
    paths = sorted(p for p in glob.glob(os.path.join(o.src, '*')) if p.lower().endswith(('.png', '.jpg', '.jpeg', '.webp')))
    fps = 24.0
elif o.src.lower().endswith(VID):
    tmp = tempfile.mkdtemp(prefix='flip_')
    probe = subprocess.run(['ffprobe', '-v', 'error', '-select_streams', 'v:0', '-show_entries', 'stream=r_frame_rate:format=duration',
                            '-of', 'json', o.src], capture_output=True, text=True)
    info = json.loads(probe.stdout or '{}')
    dur = float(info.get('format', {}).get('duration', 0) or 0)
    end = o.end if o.end > 0 else dur
    span = max(0.05, end - o.start)
    rate = o.frames / span  # frames a second to sample so that exactly --frames land in [start, end]
    subprocess.run(['ffmpeg', '-v', 'error', '-y', '-ss', str(o.start), '-t', str(span), '-i', o.src, '-vf', f'fps={rate:.5f}',
                    os.path.join(tmp, 'f%04d.png')], check=True)
    paths = sorted(glob.glob(os.path.join(tmp, 'f*.png')))
    fps = rate
else:
    paths = [o.src]
    fps = 24.0
if not paths:
    sys.exit('no frames in ' + o.src)
if len(paths) > o.frames and os.path.isdir(o.src):
    paths = [paths[round(i * (len(paths) - 1) / (o.frames - 1))] for i in range(o.frames)]


def keyed(p):
    im = Image.open(p).convert('RGBA')
    a = np.asarray(im).astype(np.float32) / 255.0
    rgb, al = a[..., :3], a[..., 3]
    if o.key == 'green' or o.key == 'magenta':
        if o.key == 'green':
            lean = rgb[..., 1] - np.maximum(rgb[..., 0], rgb[..., 2])
        else:
            lean = np.minimum(rgb[..., 0], rgb[..., 2]) - rgb[..., 1]
        al = np.clip(1.0 - (lean - 0.06) / 0.22, 0.0, 1.0)
        if o.key == 'green':  # the screen's cast pulled out of what stays
            rgb[..., 1] = np.minimum(rgb[..., 1], np.maximum(rgb[..., 0], rgb[..., 2]) * 1.05)
        else:
            spill = np.clip(np.minimum(rgb[..., 0], rgb[..., 2]) - rgb[..., 1] * 1.05, 0.0, None)
            rgb[..., 0] -= spill; rgb[..., 2] -= spill
    elif o.key == 'black':
        al = np.ones_like(al)  # (kept as painted: the flip piece reads its brightness as its cover)
    return np.dstack([rgb, al])


frames = [keyed(p) for p in paths]
# the box the effect fills over the whole clip
if o.crop == 'auto':
    cover = np.zeros(frames[0].shape[:2], dtype=bool)
    for f in frames:
        cover |= (f[..., 3] > 0.02) & (f[..., :3].max(axis=2) > (0.035 if o.key == 'black' else -1))
    ys, xs = np.nonzero(cover)
    if len(xs):
        x0, x1 = max(0, xs.min() - o.pad), min(cover.shape[1], xs.max() + 1 + o.pad)
        y0, y1 = max(0, ys.min() - o.pad), min(cover.shape[0], ys.max() + 1 + o.pad)
        frames = [f[y0:y1, x0:x1] for f in frames]
h0, w0 = frames[0].shape[:2]
k = o.size / max(w0, h0)
fw, fh = max(1, round(w0 * k)), max(1, round(h0 * k))
n = len(frames)
cols = o.cols or math.ceil(math.sqrt(n * fh / fw))
rows = math.ceil(n / cols)
if cols * fw > 4096 or rows * fh > 4096:
    print(f'warning: the sheet is {cols * fw} x {rows * fh} px — over 4096 a side; lower --size or --frames', file=sys.stderr)
sheet = Image.new('RGBA', (cols * fw, rows * fh), (0, 0, 0, 0 if o.key != 'black' else 255))
for i, f in enumerate(frames):
    im = Image.fromarray((np.clip(f, 0, 1) * 255).astype(np.uint8), 'RGBA').resize((fw, fh), Image.LANCZOS)
    sheet.paste(im, ((i % cols) * fw, (i // cols) * fh))
os.makedirs(os.path.dirname(os.path.abspath(o.out)), exist_ok=True)
if o.key == 'black':
    sheet = sheet.convert('RGB')
sheet.save(o.out, 'WEBP', quality=o.quality, method=6)
meta = {'frame': [fw, fh], 'grid': [cols, rows], 'frames': n, 'fps': round(fps, 2), 'key': 'black' if o.key == 'black' else 'alpha'}
json.dump(meta, open(o.out + '.json', 'w'))
print(o.out, f'{cols * fw}x{rows * fh}', meta)
if tmp:
    shutil.rmtree(tmp, ignore_errors=True)
