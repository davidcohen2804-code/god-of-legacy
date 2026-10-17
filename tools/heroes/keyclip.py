#!/usr/bin/env python3
"""Keys a hero's PvP clip (PixVerse, on a flat screen colour) to a see-through VP9 WebM for HeroClip.ts.

    python3 tools/heroes/keyclip.py <src.mp4> <dst.webm> [--screen green|magenta] [--crf 40] [--scale 0.9] [--frames N] [--glow]

Alpha from how much a pixel leans to the screen colour (green: G over max(R, B); magenta: min(R, B) over G), a soft
edge; the edge un-mixed from the screen behind it (a leaf's rim is leaf, not leaf-and-screen) and any cast of the screen
pulled out of what stays. Green for every hero but the archer (green is hers: magenta). Then colour-match the result to
its painting with tools/heroes/clip_color.py (after its fit is in HeroClip.ts). --frames keeps only the first N frames (a
take whose end goes wrong: the book mage's victory move melts into her painting in its last 0.6 s). --glow (green only):
light over the screen (the book mage's blue vortex and flame) is keyed by how far it is from the screen (measured on the
first frame), not by its green excess — blue light on green reads teal, and keyed opaque teal; this way it is a see-through
glow in her own blue (green held under 0.85 of the blue there). Needs opencv-python, numpy, ffmpeg.
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
ap.add_argument('--frames', type=int, default=0)
ap.add_argument('--glow', action='store_true')
o = ap.parse_args()
cap = cv2.VideoCapture(o.src); fps = cap.get(cv2.CAP_PROP_FPS) or 24
w0, h0 = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH)), int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
w, h = int(round(w0 * o.scale / 2) * 2), int(round(h0 * o.scale / 2) * 2)
enc = subprocess.Popen(['ffmpeg', '-v', 'error', '-y', '-f', 'rawvideo', '-pix_fmt', 'rgba', '-s', f'{w}x{h}', '-r', str(fps), '-i', '-',
                        '-c:v', 'libvpx-vp9', '-pix_fmt', 'yuva420p', '-b:v', '0', '-crf', o.crf, '-row-mt', '1', '-deadline', 'good', '-cpu-used', '2', '-auto-alt-ref', '0', o.dst], stdin=subprocess.PIPE)
screen = np.array([0.0, 255.0, 0.0]) if o.screen == 'green' else np.array([255.0, 0.0, 255.0])
n = 0
while not o.frames or n < o.frames:
    ok, f = cap.read()
    if not ok:
        break
    if (w, h) != (w0, h0):
        f = cv2.resize(f, (w, h), interpolation=cv2.INTER_AREA)
    b, g, r = [f[..., i].astype(np.float32) for i in range(3)]
    if o.glow and n == 0:  # (the clip's own screen: the first frame's border)
        edge = np.concatenate([f[:8].reshape(-1, 3), f[-8:].reshape(-1, 3), f[:, :8].reshape(-1, 3), f[:, -8:].reshape(-1, 3)]).astype(np.float32)[:, ::-1]
        pure = edge[(edge[:, 1] > 150) & (edge[:, 0] < 60) & (edge[:, 2] < 60)]
        screen = np.median(pure, axis=0) if len(pure) > 100 else screen
        print('screen', screen.round())
    if o.screen == 'green':
        a = np.clip(1 - (g - np.maximum(r, b) - 28) / 70, 0, 1)
        if o.glow:  # (blue light over the screen: a see-through glow by its distance from the screen)
            lit = (b > r * 1.5 + 20) & (g > 0.55 * screen[1])
            far = np.sqrt((r - screen[0]) ** 2 + (g - screen[1]) ** 2 + (b - screen[2]) ** 2)
            a = np.where(lit, np.clip((far - 20) / 190, 0, 1), a)
    else:  # (a touch of magenta already lets the screen through: blurred leaves, a bow in motion)
        a = np.clip(1 - (np.minimum(r, b) - g - 10) / 75, 0, 1)
    a = cv2.GaussianBlur(a, (3, 3), 0.7)
    ae = np.clip(a, 0.25, 1)[..., None]  # (nearly clear: not blown up)
    rgb = np.clip((np.dstack([r, g, b]) - (1 - ae) * screen) / ae, 0, 255)
    r, g, b = rgb[..., 0], rgb[..., 1], rgb[..., 2]
    if o.screen == 'green':
        g = np.minimum(g, np.maximum(r, b) * 1.04 + 6)
        if o.glow:
            g = np.where(lit, np.minimum(g, np.maximum(r, 0.85 * b)), g)
    else:
        ex = np.maximum(0, np.minimum(r, b) - (g * 1.04 + 6)); r, b = r - ex, b - ex
    rgba = np.dstack([r, g, b, a * 255]).clip(0, 255).astype(np.uint8)
    rgba[..., :3] = (rgba[..., :3].astype(np.float32) * (a[..., None] > 0.02)).astype(np.uint8)
    enc.stdin.write(rgba.tobytes()); n += 1
enc.stdin.close(); enc.wait()
print(o.dst, n, 'frames', os.path.getsize(o.dst) // 1024, 'KB')
