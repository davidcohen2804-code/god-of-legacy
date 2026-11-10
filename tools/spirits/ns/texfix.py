# The body's texture, corrected where GPT pointed (test only):  python3 texfix.py IN.png OUT.png
#  1. the right pauldron and upper arm: the drawing had the ponytail over them, the bake's paint-out left a smear;
#     their texels are taken from the left side's mirror image (the costume is symmetric there);
#  2. the sash's tails: light streaks inside the crimson (the old hair / the tabard's light bleeding in) refilled
#     from the crimson round them; the right tail's edge (dark grey from the paint-out) made dark crimson.
import sys, numpy as np, glbio
from PIL import Image, ImageDraw
from scipy.spatial import cKDTree
from scipy import ndimage
src, dst = sys.argv[1:3]
B = glbio.read('../h3d/stripped2.glb'); P, I, UV = B['P'], B['I'], B['UV']
T = np.asarray(Image.open(src).convert('RGB')).astype(np.float64); S = T.shape[0]
c = P[I].mean(1)
nrm = np.cross(P[I[:, 1]] - P[I[:, 0]], P[I[:, 2]] - P[I[:, 0]]); nrm /= np.maximum(np.linalg.norm(nrm, axis=1, keepdims=True), 1e-12)
uvc = UV[I].mean(1); pxc = np.clip((uvc * S).astype(int), 0, S - 1); fcol = T[pxc[:, 1], pxc[:, 0]]
used_faces = np.zeros(len(I), bool); used_faces[:] = True

def texels_of(faces):
    """Every texel inside the faces' UV triangles: (px, py, face, barycentric)."""
    out = []
    for f in faces:
        t = UV[I[f]] * S; x0, y0 = np.floor(t.min(0)).astype(int); x1, y1 = np.ceil(t.max(0)).astype(int)
        xs, ys = np.meshgrid(np.arange(x0, x1 + 1), np.arange(y0, y1 + 1)); q = np.stack([xs.ravel() + 0.5, ys.ravel() + 0.5], 1)
        A = np.array([[t[1, 0] - t[0, 0], t[2, 0] - t[0, 0]], [t[1, 1] - t[0, 1], t[2, 1] - t[0, 1]]])
        if abs(np.linalg.det(A)) < 1e-9: continue
        l = np.linalg.solve(A, (q - t[0]).T).T; b = np.c_[1 - l.sum(1), l]
        ok = (b >= -0.02).all(1)
        for (qx, qy), bb in zip(q[ok].astype(int), b[ok]):
            if 0 <= qx < S and 0 <= qy < S: out.append((qx, qy, f, bb))
    return out

# ---------------- 1. the right pauldron and upper arm from the left's mirror
dst_f = np.where((c[:, 0] < -0.092) & (c[:, 1] > 1.20) & (c[:, 1] < 1.56) & (nrm[:, 2] > 0.15))[0]
src_f = np.where((c[:, 0] > 0.10) & (c[:, 1] > 1.15) & (c[:, 1] < 1.60))[0]
# dense samples on the source side (position -> uv)
rng = np.random.default_rng(0); k = 40
r1, r2 = rng.random((2, len(src_f) * k)); s1 = np.sqrt(r1); fi = np.repeat(src_f, k)
bw = np.stack([1 - s1, s1 * (1 - r2), s1 * r2], 1)
sp = (P[I[fi]] * bw[:, :, None]).sum(1); suv = (UV[I[fi]] * bw[:, :, None]).sum(1); sn = nrm[fi]
tree = cKDTree(sp * np.array([1, 1, 1]))
T2 = T.copy()
tx = texels_of(dst_f)
qx = np.array([a[0] for a in tx]); qy = np.array([a[1] for a in tx]); qf = np.array([a[2] for a in tx]); qb = np.array([a[3] for a in tx])
qp = (P[I[qf]] * qb[:, :, None]).sum(1); mirror = qp * np.array([-1, 1, 1])
d, j = tree.query(mirror, k=24)
qn = nrm[qf] * np.array([-1, 1, 1])
dots = np.einsum('ij,ikj->ik', qn, sn[j])
okn = (dots > 0.55) & (d < 0.03)
first = np.where(okn.any(1), okn.argmax(1), -1)
far = first < 0
jj = j[np.arange(len(j)), np.maximum(first, 0)]
def bil(uv):
    x = uv[:, 0] * S - 0.5; y = uv[:, 1] * S - 0.5; x0 = np.clip(np.floor(x).astype(int), 0, S - 2); y0 = np.clip(np.floor(y).astype(int), 0, S - 2)
    fx = (x - x0)[:, None]; fy = (y - y0)[:, None]
    return T[y0, x0] * (1 - fx) * (1 - fy) + T[y0, x0 + 1] * fx * (1 - fy) + T[y0 + 1, x0] * (1 - fx) * fy + T[y0 + 1, x0 + 1] * fx * fy
colm = bil(suv[jj])
# feather the edge of the region (by the texel's 3D distance to the region's border in x)
fe = np.clip((-qp[:, 0] - 0.092) / 0.03, 0, 1)[:, None]
newc = colm * fe + T[qy, qx] * (1 - fe)
newc[far] = T[qy[far], qx[far]]
T2[qy, qx] = newc
print('mirrored texels', len(qx), 'no partner', int(far.sum()))

# ---------------- 2. the sash's tails
r, g, b = T2[..., 0], T2[..., 1], T2[..., 2]; mx = T2.max(2); mn = T2.min(2)
crim_t = (g < 0.55 * r) & (b < 0.95 * r) & (r > 60)
pale_t = (mx > 125) & ((mx - mn) / np.maximum(mx, 1) < 0.40)
fr, fg, fb = fcol[:, 0], fcol[:, 1], fcol[:, 2]
crim_f = (fg < 0.55 * fr) & (fb < 0.95 * fr) & (fr > 60)
tail_zone = (c[:, 1] > 0.38) & (c[:, 1] < 1.0) & (np.abs(c[:, 0]) > 0.04) & (c[:, 2] > -0.06)
mask = Image.new('L', (S, S), 0); dr = ImageDraw.Draw(mask)
tf = np.where(tail_zone)[0]
# faces whose texels are mostly crimson (the tails), measured on their own texels
for f in tf:
    t = UV[I[f]] * S; dr.polygon([tuple(p) for p in t], fill=255)
Mz = np.asarray(mask) > 0
# the crimson share in a neighbourhood: streaks inside crimson areas only
share = ndimage.uniform_filter(crim_t.astype(float), 21)
bad = Mz & pale_t & (share > 0.22)
known = (Mz & crim_t).astype(float); fill = T2.copy()
for sig in (2, 4, 8, 16):
    num = np.stack([ndimage.gaussian_filter(T2[..., k_] * known, sig) for k_ in range(3)], -1); den = ndimage.gaussian_filter(known, sig)
    ok = bad & (den > 0.05) & (known == 0)
    fill[ok] = num[ok] / den[ok, None]; known = np.where(ok, 1.0, known)
T2[bad] = fill[bad]
print('sash streak texels refilled', int(bad.sum()))
# ---------------- 3. the chest (GPT 10 Nov: the crossed collar and the upper chest's ornament to read from the game's
# distance): its texels sharpened (unsharp mask) and their light and dark drawn a little apart
chest = (c[:, 1] > 1.12) & (c[:, 1] < 1.46) & (np.abs(c[:, 0]) < 0.24) & (nrm[:, 2] > 0.25)
mask = Image.new('L', (S, S), 0); dr = ImageDraw.Draw(mask)
for f in np.where(chest)[0]: dr.polygon([tuple(p) for p in UV[I[f]] * S], fill=255)
Mc = ndimage.binary_erosion(np.asarray(mask) > 0, iterations=1)
blur = np.stack([ndimage.gaussian_filter(T2[..., k_], 2.2) for k_ in range(3)], -1)
sharp = T2 + 0.9 * (T2 - blur)
mean_c = T2[Mc].mean(0)
sharp = mean_c + (sharp - mean_c) * 1.08
T2[Mc] = sharp[Mc]
print('chest texels sharpened', int(Mc.sum()))
Image.fromarray(np.clip(T2, 0, 255).astype(np.uint8)).save(dst)
