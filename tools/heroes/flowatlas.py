#!/usr/bin/env python3
"""A hero's painting brought to life (src/ui/LivingArt.ts): the motion of a short AI clip of that very painting, measured
as optical flow, packed into the small atlas the VS screens warp the painting by.

    flowatlas.py CLIP ART OUT [--rigid "x,y x,y x,y ..."]... [--still "x,y ..."]... [--feet Y] [--preview DIR]

CLIP  the PixVerse clip (image-to-video of the painting itself on a plain dark background, camera locked, 5 s)
ART   the painting (assets/final/heroes/<cls>/vs.webp, 1024 x 1536)
OUT   the atlas (assets/final/heroes/<cls>/vs_flow.webp): 61 frames at 12 fps, 128 x 192 each, 8 to a row; R = x, G = y
      (128 = still, +-127 = +-80 px of the art) — the shader shows the painting at v + d(v) (d: where each point of the
      moving picture comes from in the painting).
--rigid  polygons in the painting's pixels held rigid (a face; the arms, the bow and the arrow as one): the group rides
         the motion round it as one piece (its median shift), never bends. Several polygons of one group: ';' between
         them. Repeatable (one group each).
--still  a polygon that does not move at all (a planted foot); the clip's drift (their median shift) is taken out of
         every frame. Repeatable.
--feet   the line (painting y) the feet stand on: no motion below it, fading in over the 140 px above (planted feet);
         without --still, the drift is the median shift of the band above it.
--preview  writes the painting warped at a few frames (and a sheet of them) to check.
"""
import argparse
import os

import cv2
import numpy as np
from PIL import Image

FRAMES, FPS, COLS, CW, CH, RANGE = 61, 12, 8, 128, 192, 80.0
WORK = (512, 768)  # (the flow is measured at half the painting's size)


def read_clip(path):
    cap = cv2.VideoCapture(path)
    fps = cap.get(cv2.CAP_PROP_FPS) or 24
    frames = []
    while True:
        ok, f = cap.read()
        if not ok:
            break
        frames.append(f)
    cap.release()
    if not frames:
        raise SystemExit(f'no frames in {path}')
    return frames, fps


def poly_mask(points, size):
    m = np.zeros((size[1], size[0]), np.float32)
    cv2.fillPoly(m, [np.round(np.asarray(points, np.float32)).astype(np.int32)], 1.0)
    return m


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('clip'); ap.add_argument('art'); ap.add_argument('out')
    ap.add_argument('--rigid', action='append', default=[])
    ap.add_argument('--still', action='append', default=[])
    ap.add_argument('--feet', type=float, default=None)
    ap.add_argument('--preview', default=None)
    ap.add_argument('--smooth', type=float, default=8.0, help='spatial smoothing (working px): a cloth bends, it does not swirl')
    ap.add_argument('--gain', type=float, default=0.7, help='how much of the clip\'s motion (a calmer sway than the AI clip)')
    ap.add_argument('--lighting', action='store_true', help='the clip\'s light changes (a glowing gem): measured on local contrast, not brightness')
    a = ap.parse_args()

    art = Image.open(a.art).convert('RGBA')
    AW, AH = art.size
    frames, fps = read_clip(a.clip)
    print(f'clip: {len(frames)} frames at {fps:.1f} fps, {frames[0].shape[1]}x{frames[0].shape[0]}; art {AW}x{AH}')
    picks = [min(len(frames) - 1, round(k / FPS * fps)) for k in range(FRAMES)]
    W, H = WORK
    gray = [cv2.GaussianBlur(cv2.cvtColor(cv2.resize(frames[i], (W, H), interpolation=cv2.INTER_AREA), cv2.COLOR_BGR2GRAY), (0, 0), 0.8) for i in picks]
    if a.lighting:  # (each point against its neighbourhood: a glow brightens it all, the shapes stay)
        def norm(g):
            g = g.astype(np.float32); m = cv2.GaussianBlur(g, (0, 0), 10); d = g - m
            sd = np.sqrt(cv2.GaussianBlur(d * d, (0, 0), 10)) + 6
            return np.clip(128 + 42 * d / sd, 0, 255).astype(np.uint8)
        gray = [norm(g) for g in gray]
    s = AW / W  # (working px -> painting px)

    # the figure (with room round it for cloth that swings out): flow outside it is the clip's background, let go
    alpha = np.asarray(art.split()[-1].resize((W, H), Image.BILINEAR), np.float32) / 255
    near = cv2.GaussianBlur(cv2.dilate((alpha > 0.1).astype(np.uint8), np.ones((41, 41), np.uint8)).astype(np.float32), (0, 0), 10)

    rigid = []
    for spec in a.rigid:  # (one group: its polygons, ';' between them, ride as one piece)
        m = np.zeros((H, W), np.float32)
        for poly in spec.split(';'):
            m = np.maximum(m, poly_mask([tuple(float(v) / s for v in p.split(',')) for p in poly.split()], (W, H)))
        rigid.append((m > 0.5, cv2.GaussianBlur(m, (0, 0), 4)))
    still = np.zeros((H, W), np.float32)
    for spec in a.still:
        still = np.maximum(still, poly_mask([tuple(float(v) / s for v in p.split(',')) for p in spec.split()], (W, H)))
    still_hard, still_soft = still > 0.5, cv2.GaussianBlur(cv2.dilate(still, np.ones((9, 9), np.uint8)), (0, 0), 6)
    yy = np.arange(H, dtype=np.float32)[:, None]
    if a.feet is not None:
        fy = a.feet / s
        plant = np.clip((fy - yy) / (140 / s), 0, 1) * np.ones((1, W), np.float32)
        band = (yy > fy - 220 / s) & (yy < fy - 40 / s) & (alpha > 0.5)
    else:
        plant, band = np.ones((H, W), np.float32), None

    flows = []
    for k in range(FRAMES):
        if k == 0:
            flows.append(np.zeros((H, W, 2), np.float32)); continue
        f = cv2.calcOpticalFlowFarneback(gray[k], gray[0], None, 0.5, 5, 31, 6, 7, 1.5, cv2.OPTFLOW_FARNEBACK_GAUSSIAN)
        if still_hard.any():  # (the clip's own drift: the feet do not walk)
            f -= np.median(f[still_hard], axis=0)
        elif band is not None and band.any():
            f -= np.median(f[band], axis=0)
        for hard, soft in rigid:  # (a rigid part rides as one piece)
            med = np.median(f[hard], axis=0) if hard.any() else np.zeros(2, np.float32)
            f = f * (1 - soft[..., None]) + med[None, None, :] * soft[..., None]
        f *= (plant * near * (1 - still_soft))[..., None]
        flows.append(f)
    F = np.stack(flows)  # (k, H, W, 2) in working px
    # calmer: a touch of smoothing in time and space (the AI clip's flicker is not motion)
    G = F.copy()
    wts = np.exp(-0.5 * (np.arange(-3, 4) / 1.5) ** 2)
    for k in range(1, FRAMES):
        idx = [min(FRAMES - 1, max(1, k + d)) for d in range(-3, 4)]
        G[k] = np.tensordot(wts / wts.sum(), F[idx], axes=1)
    for k in range(1, FRAMES):
        G[k] = cv2.GaussianBlur(G[k], (0, 0), a.smooth)
    ramp = np.clip(np.arange(FRAMES) / 6, 0, 1) ** 2  # (out of the painting softly: frame 0 is still)
    G *= (s * a.gain) * ramp[:, None, None, None]  # painting px
    mag = np.hypot(G[..., 0], G[..., 1])
    print('motion (painting px): mean', ' '.join(f'{mag[k].mean():.1f}' for k in range(0, FRAMES, 10)), '| max', f'{mag.max():.1f}', '| clipped at', RANGE, f'{(mag > RANGE).mean() * 100:.2f} %')

    rows = (FRAMES + COLS - 1) // COLS
    atlas = np.zeros((rows * CH, COLS * CW, 3), np.uint8); atlas[..., 0] = 128; atlas[..., 1] = 128
    for k in range(FRAMES):
        d = np.clip(G[k], -RANGE, RANGE)
        small = cv2.resize(d, (CW, CH), interpolation=cv2.INTER_AREA)
        enc = np.clip(np.round(128 + small / RANGE * 127), 1, 255).astype(np.uint8)
        if k == 0:
            enc[...] = 128  # (frame 0 is the painting itself)
        r, c = divmod(k, COLS)
        atlas[r * CH:(r + 1) * CH, c * CW:(c + 1) * CW, :2] = enc
    Image.fromarray(atlas).save(a.out, lossless=True, quality=100, method=6)
    print(a.out, os.path.getsize(a.out), 'bytes')

    if a.preview:  # the painting as the shader warps it (bilinear, from the stored atlas)
        os.makedirs(a.preview, exist_ok=True)
        A = np.asarray(Image.open(a.out).convert('RGB')).astype(np.float32)
        src = np.asarray(art).astype(np.float32)
        gx, gy = np.meshgrid(np.arange(AW, dtype=np.float32), np.arange(AH, dtype=np.float32))
        sheet = []
        for k in (0, 15, 30, 45, 60):
            r, c = divmod(k, COLS)
            cell = A[r * CH:(r + 1) * CH, c * CW:(c + 1) * CW, :2]
            d = cv2.resize((cell - 128) / 127 * RANGE, (AW, AH), interpolation=cv2.INTER_LINEAR)
            out = cv2.remap(src, (gx + d[..., 0]).astype(np.float32), (gy + d[..., 1]).astype(np.float32), cv2.INTER_LINEAR, borderMode=cv2.BORDER_CONSTANT, borderValue=0)
            img = Image.fromarray(np.clip(out, 0, 255).astype(np.uint8), 'RGBA')
            bg = Image.new('RGBA', img.size, (42, 42, 50, 255)); bg.alpha_composite(img)
            bg.convert('RGB').save(os.path.join(a.preview, f'f{k:02d}.jpg'), quality=88)
            sheet.append(bg.convert('RGB').resize((AW // 3, AH // 3)))
        S = Image.new('RGB', (sum(i.size[0] for i in sheet) + 8 * (len(sheet) - 1), sheet[0].size[1]))
        x = 0
        for i in sheet:
            S.paste(i, (x, 0)); x += i.size[0] + 8
        S.save(os.path.join(a.preview, 'sheet.jpg'), quality=85)
        print('preview', a.preview)


if __name__ == '__main__':
    main()
