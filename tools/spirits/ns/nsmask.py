# The new Samurai's region mask for the spirit material (test only): python3 nsmask.py BONES.glb ALBEDO.png OUT.png SIZE
# In the atlas's own UV layout (the same for the full body and its lighter gameplay body): R the hair (the ponytail by
# its own bones' weights, the head's hair by its light lavender), G the eyes (their irises and highlights), B the face
# under the hair (the dark mask and the skin round the eyes: never a lit human face). Empty texels take their nearest
# chart's value (no seams in the distance's mip levels).
import sys, json, struct, numpy as np
from PIL import Image, ImageDraw
from scipy import ndimage
src, alb, out, SIZE = sys.argv[1], sys.argv[2], sys.argv[3], int(sys.argv[4])
b = open(src, 'rb').read(); jl = struct.unpack_from('<I', b, 12)[0]; js = json.loads(b[20:20 + jl]); bo = 20 + jl + 8
CT = {5126: np.float32, 5125: np.uint32, 5123: np.uint16, 5121: np.uint8, 5122: np.int16}
NC = {'SCALAR': 1, 'VEC2': 2, 'VEC3': 3, 'VEC4': 4}
def acc(i):
    a = js['accessors'][i]; v = js['bufferViews'][a['bufferView']]; off = bo + v.get('byteOffset', 0) + a.get('byteOffset', 0)
    n = NC[a['type']]; dt = np.dtype(CT[a['componentType']]); st = v.get('byteStride', 0) or n * dt.itemsize
    raw = np.frombuffer(b, dtype=np.uint8, count=st * (a['count'] - 1) + n * dt.itemsize, offset=off)
    arr = np.lib.stride_tricks.as_strided(raw, shape=(a['count'], n * dt.itemsize), strides=(st, 1)).copy().view(dt).reshape(a['count'], n).astype(np.float64)
    if a.get('normalized'):
        arr = arr / {5121: 255.0, 5123: 65535.0, 5122: 32767.0}[a['componentType']]
    return arr
p = js['meshes'][0]['primitives'][0]; at = p['attributes']
P = acc(at['POSITION']); I = acc(p['indices']).astype(np.int64).reshape(-1, 3); UV = acc(at['TEXCOORD_0'])
J = acc(at['JOINTS_0']).astype(int); W = acc(at['WEIGHTS_0'])
names = [js['nodes'][j]['name'] for j in js['skins'][0]['joints']]
hairJ = [i for i, n in enumerate(names) if n.startswith('hair_')]
print('hair joints', [names[i] for i in hairJ])
pw = (W * np.isin(J, hairJ)).sum(1)                       # each vertex's share on the ponytail's bones
fpw = pw[I].mean(1)
c = P[I].mean(1)
nrm = np.cross(P[I[:, 1]] - P[I[:, 0]], P[I[:, 2]] - P[I[:, 0]]); nrm /= np.maximum(np.linalg.norm(nrm, axis=1, keepdims=True), 1e-12)
# the face index of each texel (drawn in UV space)
idimg = Image.new('RGB', (SIZE, SIZE), (255, 255, 255)); dr = ImageDraw.Draw(idimg)
for f in range(len(I)):
    q = [(float(u * SIZE), float(v * SIZE)) for u, v in UV[I[f]]]
    dr.polygon(q, fill=(f & 255, (f >> 8) & 255, (f >> 16) & 255))
ida = np.asarray(idimg).astype(np.int64); fid = ida[..., 0] | (ida[..., 1] << 8) | (ida[..., 2] << 16)
empty = fid == 0xFFFFFF; fid[empty] = 0
T = np.asarray(Image.open(alb).convert('RGB').resize((SIZE, SIZE), Image.BOX)).astype(np.float64) / 255.0
r, g, bl = T[..., 0], T[..., 1], T[..., 2]; mx = T.max(2); mn = T.min(2); L = 0.2126 * r + 0.7152 * g + 0.0722 * bl
sat = (mx - mn) / np.maximum(mx, 1e-3)
X, Y, Z = c[fid, 0], c[fid, 1], c[fid, 2]; NZ = nrm[fid, 2]; PW = fpw[fid]
crim = (r > 0.25) & (g < 0.55 * r) & (bl < 0.95 * r)
# the eyes: their two places on the face (the drawing's irises: violet and pink, a white light in each)
EY = 1.566; EX = 0.032
ell = np.minimum(((np.abs(X) - EX) / 0.026) ** 2 + ((Y - EY) / 0.013) ** 2, 9.0)
front = (Z > 0.02) & (NZ > 0.2)
iris = ((bl > 0.45) & (bl > g + 0.12) & (r > 0.35)) | (mn > 0.80)        # violet / pink, or the white lights
eye = np.where(front & iris & ~crim, np.clip(1.3 - ell, 0, 1), 0.0)
# the face under the hair: the mask (dark) and the skin round the eyes (warm), in front, below the bangs' line
facebox = (np.abs(X) < 0.085) & (Y > 1.47) & (Y < 1.60) & front
skin = (r > g) & (g > bl * 0.95) & (r - bl > 0.06) & (L > 0.25) & ~crim   # (warm: beige, not lavender)
dark = (L < 0.20) & ~crim
face = facebox & ((L < 0.42) | skin) & ~crim & (eye < 0.5)
# the hair: the ponytail by its bones; the head's hair by its light lavender above the scarf (not the face, the tie, the scarf)
# (the head's zone: above the brows, or round the sides and the back above the scarf — all of it hair but the face, the
# eyes and the tie)
fxy = (np.abs(X) < 0.085) & (Z > 0.0) & (Y < 1.60)
head = (np.abs(X) < 0.22) & ((Y > 1.585) | ((Y > 1.50) & ~fxy) | (facebox & (L >= 0.42) & ~skin))
hair = np.maximum(np.clip((PW - 0.25) / 0.5, 0, 1) * (~crim), (head & ~face & ~crim & (eye < 0.3)).astype(float))
M = np.zeros((SIZE, SIZE, 3), np.float64); M[..., 0] = hair; M[..., 1] = eye; M[..., 2] = face.astype(float)
M[empty] = 0
# the gutters: each empty texel takes its nearest drawn one's value
_, (iy, ix) = ndimage.distance_transform_edt(empty, return_indices=True)
M = M[iy, ix]
Image.fromarray((np.clip(M, 0, 1) * 255 + 0.5).astype(np.uint8)).save(out)
print('texels: hair', int((hair > 0.5).sum()), 'eyes', int((eye > 0.3).sum()), 'face', int(face.sum()), 'empty share', round(empty.mean(), 3))
