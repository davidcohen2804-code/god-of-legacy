#!/usr/bin/env python3
"""Keys a hero's PvP clip (PixVerse, on a flat screen colour) to a see-through VP9 WebM for HeroClip.ts.

    python3 tools/heroes/keyclip.py <src.mp4> <dst.webm> [--screen green|magenta] [--crf 40] [--scale 0.9]

Alpha from how much a pixel leans to the screen colour (green: G over max(R, B); magenta: min(R, B) over G), a soft
edge; the edge un-mixed from the screen behind it (a leaf's rim is leaf, not leaf-and-screen) and any cast of the screen
pulled out of what stays. Green for every hero but the archer (green is hers: magenta). Then colour-match the result to
its painting with tools/heroes/clip_color.py (after its fit is in HeroClip.ts). Needs opencv-python, numpy, ffmpeg.
"""
import argparse
import os
import subprocess

import cv2
import numpy as np

ap = argparse.ArgumentParser()
ap.add_argument('src'); ap.add_argument('dst')
ap.add_argument('--screen', choices=['green', 'magenta'], default='green')
ap.add_argument('--crf', default='40'); ap.add_argument('--scale', type=float, default=0.9)
o = ap.parse_args()
cap = cv2.VideoCapture(o.src); fps = cap.get(cv2.CAP_PROP_FPS) or 24
w0, h0 = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH)), int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
w, h = int(round(w0 * o.scale / 2) * 2), int(round(h0 * o.scale / 2) * 2)
enc = subprocess.Popen(['ffmpeg', '-v', 'error', '-y', '-f', 'rawvideo', '-pix_fmt', 'rgba', '-s', f'{w}x{h}', '-r', str(fps), '-i', '-',
                        '-c:v', 'libvpx-vp9', '-pix_fmt', 'yuva420p', '-b:v', '0', '-crf', o.crf, '-row-mt', '1', '-deadline', 'good', '-cpu-used', '2', '-auto-alt-ref', '0', o.dst], stdin=subprocess.PIPE)
screen = np.array([0.0, 255.0, 0.0]) if o.screen == 'green' else np.array([255.0, 0.0, 255.0])
n = 0
while True:
    ok, f = cap.read()
    if not ok:
        break
    if (w, h) != (w0, h0):
        f = cv2.resize(f, (w, h), interpolation=cv2.INTER_AREA)
    b, g, r = [f[..., i].astype(np.float32) for i in range(3)]
    if o.screen == 'green':
        a = np.clip(1 - (g - np.maximum(r, b) - 28) / 70, 0, 1)
    else:  # (a touch of magenta already lets the screen through: blurred leaves, a bow in motion)
        a = np.clip(1 - (np.minimum(r, b) - g - 10) / 75, 0, 1)
    a = cv2.GaussianBlur(a, (3, 3), 0.7)
    ae = np.clip(a, 0.25, 1)[..., None]  # (nearly clear: not blown up)
    rgb = np.clip((np.dstack([r, g, b]) - (1 - ae) * screen) / ae, 0, 255)
    r, g, b = rgb[..., 0], rgb[..., 1], rgb[..., 2]
    if o.screen == 'green':
        g = np.minimum(g, np.maximum(r, b) * 1.04 + 6)
    else:
        ex = np.maximum(0, np.minimum(r, b) - (g * 1.04 + 6)); r, b = r - ex, b - ex
    rgba = np.dstack([r, g, b, a * 255]).clip(0, 255).astype(np.uint8)
    rgba[..., :3] = (rgba[..., :3].astype(np.float32) * (a[..., None] > 0.02)).astype(np.uint8)
    enc.stdin.write(rgba.tobytes()); n += 1
enc.stdin.close(); enc.wait()
print(o.dst, n, 'frames', os.path.getsize(o.dst) // 1024, 'KB')
