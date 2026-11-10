# rebake.py, vectorised (triangles in batches by their box size).  python3 rebake2.py REPACK.glb OLDTEX.png OUT.png [size]
import sys, json, struct, numpy as np
from PIL import Image
from scipy import ndimage
src, oldtex, out = sys.argv[1:4]; S = int(sys.argv[4]) if len(sys.argv) > 4 else 2048
b = open(src, 'rb').read(); jl = struct.unpack_from('<I', b, 12)[0]; js = json.loads(b[20:20 + jl]); bo = 20 + jl + 8
def acc(i):
    a = js['accessors'][i]; v = js['bufferViews'][a['bufferView']]; off = bo + v.get('byteOffset', 0) + a.get('byteOffset', 0)
    n = {'SCALAR': 1, 'VEC2': 2, 'VEC3': 3}[a['type']]; dt = np.dtype({5126: np.float32, 5125: np.uint32, 5123: np.uint16}[a['componentType']])
    st = v.get('byteStride', 0)
    if st and st != n * dt.itemsize:
        raw = np.frombuffer(b, dtype=np.uint8, count=st * (a['count'] - 1) + n * dt.itemsize, offset=off)
        arr = np.lib.stride_tricks.as_strided(raw, shape=(a['count'], n * dt.itemsize), strides=(st, 1)).copy().view(dt).reshape(a['count'], n)
        return arr if n > 1 else arr.reshape(-1)
    return np.frombuffer(b, dtype=dt, count=a['count'] * n, offset=off).reshape(-1, n) if n > 1 else np.frombuffer(b, dtype=dt, count=a['count'], offset=off)
p = js['meshes'][0]['primitives'][0]; at = p['attributes']
NUV = acc(at['TEXCOORD_0']).astype(np.float64); OUV = acc(at['TEXCOORD_1']).astype(np.float64); I = acc(p['indices']).astype(np.int64).reshape(-1, 3)
T = np.asarray(Image.open(oldtex).convert('RGB')).astype(np.float32); TH, TW = T.shape[:2]
img = np.zeros((S, S, 3), np.float32); have = np.zeros((S, S), bool)
tn = NUV[I] * S; to = OUV[I]                       # (nT, 3, 2)
x0 = np.floor(tn[..., 0].min(1)).astype(int) - 1; y0 = np.floor(tn[..., 1].min(1)).astype(int) - 1
w = np.ceil(tn[..., 0].max(1)).astype(int) + 1 - x0 + 1; h = np.ceil(tn[..., 1].max(1)).astype(int) + 1 - y0 + 1
def sample(uv):
    x = uv[:, 0] * TW - 0.5; y = uv[:, 1] * TH - 0.5
    xa = np.clip(np.floor(x).astype(int), 0, TW - 2); ya = np.clip(np.floor(y).astype(int), 0, TH - 2)
    fx = np.clip(x - xa, 0, 1)[:, None]; fy = np.clip(y - ya, 0, 1)[:, None]
    return T[ya, xa] * (1 - fx) * (1 - fy) + T[ya, xa + 1] * fx * (1 - fy) + T[ya + 1, xa] * (1 - fx) * fy + T[ya + 1, xa + 1] * fx * fy
# size classes
for B in (4, 8, 16, 32, 64, 128, 256, 512):
    sel = np.where((np.maximum(w, h) <= B) & (np.maximum(w, h) > B // 2 if B > 4 else np.maximum(w, h) <= 4))[0]
    if len(sel) == 0: continue
    for ch in range(0, len(sel), max(1, 400000 // (B * B))):
        ids = sel[ch:ch + max(1, 400000 // (B * B))]
        gx = x0[ids, None, None] + np.arange(B)[None, None, :]; gy = y0[ids, None, None] + np.arange(B)[None, :, None]
        qx = gx + 0.5; qy = gy + 0.5
        t = tn[ids]; A0 = t[:, 0]; e1 = t[:, 1] - A0; e2 = t[:, 2] - A0
        det = e1[:, 0] * e2[:, 1] - e1[:, 1] * e2[:, 0]; ok_t = np.abs(det) > 1e-12; det = np.where(ok_t, det, 1)
        rx = qx - A0[:, 0, None, None]; ry = qy - A0[:, 1, None, None]
        l1 = (rx * e2[:, 1, None, None] - ry * e2[:, 0, None, None]) / det[:, None, None]
        l2 = (ry * e1[:, 0, None, None] - rx * e1[:, 1, None, None]) / det[:, None, None]
        l0 = 1 - l1 - l2
        inside = (l0 >= -0.03) & (l1 >= -0.03) & (l2 >= -0.03) & ok_t[:, None, None] & (gx >= 0) & (gy >= 0) & (gx < S) & (gy < S)
        k, iy, ix = np.nonzero(inside)
        if len(k) == 0: continue
        bc = np.stack([l0[k, iy, ix], l1[k, iy, ix], l2[k, iy, ix]], 1); bc = np.clip(bc, 0, 1); bc /= bc.sum(1, keepdims=True)
        o = to[ids[k]]; uv = (bc[:, :, None] * o).sum(1)
        px = gx[k, 0, ix]; py = gy[k, iy, 0]
        img[py, px] = sample(uv); have[py, px] = True
    print('size', B, 'tris', len(sel), flush=True)
print('texels filled', int(have.sum()), '(%.1f%%)' % (100 * have.mean()))
known = have.astype(np.float32); col = img * known[..., None]
for it in range(12):
    num = np.stack([ndimage.uniform_filter(col[..., c], 3) for c in range(3)], -1); den = ndimage.uniform_filter(known, 3)
    grow = (den > 0) & (known == 0); col[grow] = num[grow] / den[grow, None]; known[grow] = 1.0; col = col * known[..., None]
col[known == 0] = img[have].mean(0)
Image.fromarray(np.clip(col, 0, 255).astype(np.uint8)).save(out); print('wrote', out)
