#!/usr/bin/env python3
"""Colour-matches a hero's keyed PvP clip (see-through WebM) to the painting it hands over to.

PixVerse shifts colours a little (the samurai's crimson came back orange-red), so where the clip's last frame
crossfades into the painting (src/ui/HeroClip.ts) the colours jumped. This fits a colour LUT on that last frame against
the painting — laid where HeroClip.ts puts it (its measured fit) — and applies it to every frame. The LUT corrects only
the colours the painting actually shows (its local mean difference, fading to none where there are no samples), so
colours that are not in the painting (petals, ink, light effects) stay as they are. Geometry, timing and the alpha
are untouched (the alpha is re-encoded with the frames).

--rim also cleans the figure's outer rim, which the green screen left olive / yellow (on the crimson cloth it read as a
light outline): each rim pixel gets no more green than the solid figure just inside it has for its red, and green is
never above the brighter of red / blue anywhere. Only for a hero with no green in his look (not the archer).

    python3 tools/heroes/clip_color.py samurai vs [--rim] [--crf 34] [--dry]

Reads / writes public/assets/final/heroes/<cls>/<kind>_in.webm; the painting is <kind>.webp next to it. Run it once on
the keyed clip as delivered (each run re-encodes). Needs ffmpeg with libvpx-vp9, numpy, scipy, Pillow.
"""
import argparse
import json
import os
import re
import shutil
import subprocess
import sys
import tempfile

import numpy as np
from PIL import Image, ImageFilter
from scipy import ndimage as ndi

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
N = 33  # LUT grid per channel


def fits(cls: str, kind: str):
    """The clip's frame on its painting's box (percent: l, t, w, h), read from HeroClip.ts so they stay in step."""
    src = open(os.path.join(ROOT, 'src/ui/HeroClip.ts'), encoding='utf-8').read()
    m = re.search(r'\b' + re.escape(cls) + r':\s*\{(.*?)\},\n', src)
    if not m:
        sys.exit(f'{cls}: no clip fit in src/ui/HeroClip.ts')
    f = re.search(re.escape(kind) + r':\s*\{\s*l:\s*([-\d.]+),\s*t:\s*([-\d.]+),\s*w:\s*([-\d.]+),\s*h:\s*([-\d.]+)', m.group(1))
    if not f:
        sys.exit(f'{cls} {kind}: no fit in src/ui/HeroClip.ts')
    return tuple(float(v) for v in f.groups())


def placed(img: Image.Image, pw: int, ph: int, fit) -> Image.Image:
    """The clip frame laid on the painting's box as the page lays it (object-fit: fill into l/t/w/h %)."""
    l, t, w, h = fit
    cw, ch = round(pw * w / 100), round(ph * h / 100)
    cx, cy = round(pw * l / 100), round(ph * t / 100)
    frame = img.convert('RGBA').resize((cw, ch), Image.LANCZOS)
    layer = Image.new('RGBA', (pw, ph), (0, 0, 0, 0))
    layer.alpha_composite(frame, (max(cx, 0), max(cy, 0)), (max(-cx, 0), max(-cy, 0)))
    return layer


def samples(last: Image.Image, paint: Image.Image, fit):
    """Matching colour pairs (clip, painting), 0..1: smooth inside areas only (the two are not pixel-identical)."""
    pw, ph = paint.size
    clip = placed(last, pw, ph, fit)
    P = np.asarray(paint.filter(ImageFilter.GaussianBlur(2))).astype(float) / 255
    C = np.asarray(clip.filter(ImageFilter.GaussianBlur(2))).astype(float) / 255
    both = (np.asarray(paint)[..., 3] > 250) & (np.asarray(clip)[..., 3] > 250)
    m = ndi.binary_erosion(both, iterations=6)
    gray = P[..., :3].mean(-1)
    grad = np.hypot(ndi.sobel(gray, 0), ndi.sobel(gray, 1))
    m &= grad < np.percentile(grad[m], 60)
    return C[m][:, :3], P[m][:, :3]


def fit_lut(X, Y, sigma=1.2, k=20.0):
    """A residual LUT on an N^3 grid: the local mean of (painting - clip) where there are samples, fading to 0."""
    idx = np.clip(np.rint(X * (N - 1)).astype(int), 0, N - 1)
    flat = idx[:, 0] * N * N + idx[:, 1] * N + idx[:, 2]
    cnt = np.bincount(flat, minlength=N ** 3).reshape(N, N, N).astype(float)
    R = Y - X
    sums = [np.bincount(flat, weights=R[:, c], minlength=N ** 3).reshape(N, N, N) for c in range(3)]
    cb = ndi.gaussian_filter(cnt, sigma, mode='nearest')
    lut = np.stack([ndi.gaussian_filter(s, sigma, mode='nearest') / np.maximum(cb, 1e-9) for s in sums], -1)
    return lut * (cb / (cb + k))[..., None]


def apply_lut(lut, rgb):
    """rgb (..., 3) 0..1 -> corrected (trilinear)."""
    shape = rgb.shape
    p = rgb.reshape(-1, 3) * (N - 1)
    corr = np.stack([ndi.map_coordinates(lut[..., c], p.T, order=1, mode='nearest') for c in range(3)], -1)
    return np.clip(rgb.reshape(-1, 3) + corr, 0, 1).reshape(shape)


def clean_rim(rgba, ring=2, sigma=2.0, tol=1.12):
    """rgba (h, w, 4) 0..1: the outer rim's green held to the inside's green per red; green nowhere above max(red, blue)."""
    a, rgb = rgba[..., 3], rgba[..., :3].copy()
    inner = ndi.binary_erosion(a >= 0.5, iterations=ring + 1)  # the figure's inside, clear of the rim
    rim = (a > 0.003) & ~inner & ndi.binary_dilation(inner, iterations=ring + 3)
    wi = inner.astype(float)
    r, g = (ndi.gaussian_filter(rgb[..., c] * wi, sigma) for c in (0, 1))
    den = ndi.gaussian_filter(wi, sigma)
    ratio = np.where((den > 0.02) & (r > 1e-4), g / np.maximum(r, 1e-4), 1.0)
    cap_all = np.maximum(rgb[..., 0], rgb[..., 2])
    use = rim & (den > 0.02) & (r / np.maximum(den, 1e-6) > 0.12)  # (a dark inside gives no reliable ratio)
    rgb[..., 1] = np.minimum(rgb[..., 1], np.where(use, np.minimum(rgb[..., 0] * ratio * tol, cap_all), cap_all))
    out = rgba.copy()
    out[..., :3] = rgb
    return out


def crimson(X, Y):
    red = (Y[:, 0] > 0.55) & (Y[:, 1] < 0.25) & (Y[:, 2] < 0.25)
    return red, (X[red].mean(0) * 255).round(1) if red.any() else None


def run(*cmd):
    subprocess.run(cmd, check=True)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('cls')
    ap.add_argument('kind', choices=['vs', 'win'])
    ap.add_argument('--crf', type=int, default=34)  # (≈ the keyed clips' size; ~50 dB to the corrected frames)
    ap.add_argument('--rim', action='store_true', help='also clean the green-screen rim (heroes with no green only)')
    ap.add_argument('--dry', action='store_true', help='fit and report only')
    a = ap.parse_args()
    d = os.path.join(ROOT, 'public/assets/final/heroes', a.cls)
    clip_path, paint_path = os.path.join(d, f'{a.kind}_in.webm'), os.path.join(d, f'{a.kind}.webp')
    fit = fits(a.cls, a.kind)
    probe = json.loads(subprocess.run(['ffprobe', '-v', 'error', '-select_streams', 'v:0', '-show_entries', 'stream=r_frame_rate,width,height',
                                       '-of', 'json', clip_path], capture_output=True, text=True, check=True).stdout)['streams'][0]
    fps = probe['r_frame_rate']
    tmp = tempfile.mkdtemp(prefix='clipcol_')
    try:
        # (the browser shows an untagged VP9 as BT.601, as ffmpeg decodes it: these frames are what the page shows)
        run('ffmpeg', '-hide_banner', '-loglevel', 'error', '-c:v', 'libvpx-vp9', '-i', clip_path, '-pix_fmt', 'rgba', os.path.join(tmp, 'f%04d.png'))
        frames = sorted(f for f in os.listdir(tmp) if f.endswith('.png'))
        load = lambda f: np.asarray(Image.open(os.path.join(tmp, f)).convert('RGBA')).astype(float) / 255
        prep = (lambda im: clean_rim(im)) if a.rim else (lambda im: im)
        paint = Image.open(paint_path).convert('RGBA')
        last = Image.fromarray((prep(load(frames[-1])) * 255 + 0.5).astype(np.uint8), 'RGBA')
        X, Y = samples(last, paint, fit)
        lut = fit_lut(X, Y)
        Xc = apply_lut(lut, X)
        red, before = crimson(X, Y)
        print(f'{a.cls} {a.kind}: {len(frames)} frames at {fps}, fit {fit}, {len(X)} colour pairs')
        print(f'  mean error to the painting {np.abs(X - Y).mean() * 255:.2f} -> {np.abs(Xc - Y).mean() * 255:.2f}')
        if before is not None:
            print(f'  crimson: clip {before} -> {(Xc[red].mean(0) * 255).round(1)}, painting {(Y[red].mean(0) * 255).round(1)}')
        if a.dry:
            return
        out = os.path.join(tmp, 'out')
        os.mkdir(out)
        for f in frames:
            im = prep(load(f))
            im[..., :3] = apply_lut(lut, im[..., :3])
            Image.fromarray((im * 255 + 0.5).astype(np.uint8), 'RGBA').save(os.path.join(out, f))
        enc = os.path.join(tmp, 'clip.webm')
        run('ffmpeg', '-hide_banner', '-loglevel', 'error', '-y', '-framerate', fps, '-i', os.path.join(out, 'f%04d.png'),
            '-c:v', 'libvpx-vp9', '-pix_fmt', 'yuva420p', '-b:v', '0', '-crf', str(a.crf), '-deadline', 'good', '-cpu-used', '1',
            '-row-mt', '1', '-auto-alt-ref', '0', '-an', enc)
        print(f'  {os.path.getsize(clip_path) / 1e6:.2f} MB -> {os.path.getsize(enc) / 1e6:.2f} MB')
        shutil.copyfile(enc, clip_path)
    finally:
        shutil.rmtree(tmp, ignore_errors=True)


if __name__ == '__main__':
    main()
