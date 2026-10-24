#!/usr/bin/env python3
"""inflate.py CUT.png OUT_PREFIX LENGTH_M GRIP_X GRIP_Y [RC_M] [P] [LONG_PX] [OPEN_PX]
A weapon drawn flat (a cut-out, long axis vertical) → a 3D body: the silhouette inflated (round where it is narrow — a grip,
a guard, a shaft — flat where it is wide — a blade), the drawing on its front and (mirrored) on its back.
Writes OUT_PREFIX.bin (float32 positions, float32 uvs, uint32 faces) + .json (counts, scale) + _tex.png (the drawing, its
colours bled past the edge). Frame: Y along the weapon (up in the drawing), X right, Z toward the viewer, metres, the origin
at the grip (GRIP_X, GRIP_Y: pixels of the cut-out)."""
import sys, json
import numpy as np
from PIL import Image
from scipy import ndimage
cut, out, L, gx, gy = sys.argv[1], sys.argv[2], float(sys.argv[3]), float(sys.argv[4]), float(sys.argv[5])
RC = float(sys.argv[6]) if len(sys.argv) > 6 else 0.015
PW = float(sys.argv[7]) if len(sys.argv) > 7 else 3.0
LONG = int(sys.argv[8]) if len(sys.argv) > 8 else 400
OPEN = int(sys.argv[9]) if len(sys.argv) > 9 else 0
BLADE_Y = float(sys.argv[10]) if len(sys.argv) > 10 else -1   # rows above this (source px) are a blade: a thin lens
BLADE_T = float(sys.argv[11]) if len(sys.argv) > 11 else 0.003  # its half-thickness at the middle (m)
im = Image.open(cut).convert('RGBA'); A = np.asarray(im)
ys, xs = np.where(A[..., 3] > 128); x0, x1, y0, y1 = xs.min(), xs.max(), ys.min(), ys.max()
m = 6; x0, y0 = max(0, x0 - m), max(0, y0 - m); x1, y1 = min(A.shape[1] - 1, x1 + m), min(A.shape[0] - 1, y1 + m)
crop = im.crop((x0, y0, x1 + 1, y1 + 1)); cw, ch = crop.size
k = LONG / ch; W, H = max(4, round(cw * k)), LONG
s = L / (y1 - y0 - 2 * m)          # metres per source pixel (the drawing's own length = L)
sp = s / k                          # metres per grid pixel
a = np.asarray(crop.resize((W, H), Image.LANCZOS))[..., 3] / 255.0
mask = a > 0.5
if OPEN: mask = ndimage.binary_opening(mask, iterations=OPEN)
lab, n = ndimage.label(mask); 
if n > 1:
    sizes = ndimage.sum(mask, lab, range(1, n + 1)); keep = 1 + np.argmax(sizes); mask = lab == keep
d = ndimage.distance_transform_edt(mask) * sp            # metres to the edge
R = ndimage.maximum_filter(d, size=int(max(5, 2 * d.max() / sp)) | 1)   # the local half-width (m)
R = np.maximum(R, d)
f = np.minimum(1.0, (RC / np.maximum(R, 1e-6)) ** PW)
z = np.sqrt(np.maximum(0, d * (2 * R - d))) * f
if BLADE_Y >= 0:
    rows = (np.arange(H)[:, None] + 0.5) / k + y0 < BLADE_Y
    u = np.clip(d / np.maximum(R, 1e-6), 0, 1)
    zb = BLADE_T * np.sqrt(np.maximum(0, u * (2 - u)))
    z = np.where(rows & mask, zb, z)
z = ndimage.gaussian_filter(z, 0.7) * mask
ring = ndimage.binary_dilation(mask) & ~mask
use = mask | ring
# vertices: front and back per used pixel
idx = -np.ones((H, W), np.int64); yy, xx = np.where(use); nv = len(yy); idx[yy, xx] = np.arange(nv)
gxs, gys = (gx - x0) * k, (gy - y0) * k        # the grip in grid pixels
X = (xx + 0.5 - gxs) * sp; Y = (gys - (yy + 0.5)) * sp; Z = z[yy, xx]
pos = np.zeros((2 * nv, 3), np.float32); pos[:nv] = np.stack([X, Y, Z], 1); pos[nv:] = np.stack([X, Y, -Z], 1)
uv = np.zeros((2 * nv, 2), np.float32); uv[:nv] = np.stack([(xx + 0.5) / W, (yy + 0.5) / H], 1); uv[nv:] = uv[:nv]
faces = []
a00 = idx[:-1, :-1]; a01 = idx[:-1, 1:]; a10 = idx[1:, :-1]; a11 = idx[1:, 1:]
ok = (a00 >= 0) & (a01 >= 0) & (a10 >= 0) & (a11 >= 0)
p, q, r, t = a00[ok], a01[ok], a10[ok], a11[ok]
# front (+Z), image rows go down = -Y: (p, r, q), (q, r, t) are counter-clockwise seen from +Z
faces.append(np.stack([p, r, q], 1)); faces.append(np.stack([q, r, t], 1))
faces.append(np.stack([p + nv, q + nv, r + nv], 1)); faces.append(np.stack([q + nv, t + nv, r + nv], 1))
F = np.concatenate(faces).astype(np.uint32)
with open(out + '.bin', 'wb') as fh: fh.write(pos.tobytes()); fh.write(uv.tobytes()); fh.write(F.tobytes())
json.dump({ 'nv': int(2 * nv), 'nf': int(len(F)), 'W': W, 'H': H, 'sp': sp, 'maxz': float(z.max()), 'size': [float(X.max() - X.min()), float(Y.max() - Y.min())] }, open(out + '.json', 'w'))
# the texture: the crop, its colours bled outwards
C = np.asarray(crop).astype(np.float32); fg = C[..., 3] > 128
ii = ndimage.distance_transform_edt(~fg, return_distances=False, return_indices=True)
T = C[ii[0], ii[1]]; T[..., 3] = 255
Image.fromarray(T.astype(np.uint8), 'RGBA').convert('RGB').save(out + '_tex.png')
print(json.dumps({ 'verts': int(2 * nv), 'tris': int(len(F)), 'grid': [W, H], 'mm_per_px': round(sp * 1000, 2), 'max_half_thickness_mm': round(float(z.max()) * 1000, 1) }))
