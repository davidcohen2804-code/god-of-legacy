# Tiny GLB reader / writer for one mesh primitive (test only): positions, indices, uvs.
import json, struct, numpy as np
CT = {5126: np.float32, 5125: np.uint32, 5123: np.uint16, 5121: np.uint8}
NC = {'SCALAR': 1, 'VEC2': 2, 'VEC3': 3, 'VEC4': 4}
def read(path):
    b = open(path, 'rb').read(); jl = struct.unpack_from('<I', b, 12)[0]; js = json.loads(b[20:20 + jl]); bo = 20 + jl + 8
    def acc(i):
        a = js['accessors'][i]; v = js['bufferViews'][a['bufferView']]; off = bo + v.get('byteOffset', 0) + a.get('byteOffset', 0)
        n = NC[a['type']]; dt = np.dtype(CT[a['componentType']]); st = v.get('byteStride', 0)
        if st and st != n * dt.itemsize:
            raw = np.frombuffer(b, dtype=np.uint8, count=st * (a['count'] - 1) + n * dt.itemsize, offset=off)
            arr = np.lib.stride_tricks.as_strided(raw, shape=(a['count'], n * dt.itemsize), strides=(st, 1)).copy().view(dt).reshape(a['count'], n)
            return arr if n > 1 else arr.reshape(-1)
        arr = np.frombuffer(b, dtype=dt, count=a['count'] * n, offset=off)
        return arr.reshape(-1, n) if n > 1 else arr
    p = js['meshes'][0]['primitives'][0]; at = p['attributes']
    out = {'P': acc(at['POSITION']).astype(np.float64), 'I': acc(p['indices']).astype(np.int64).reshape(-1, 3)}
    if 'TEXCOORD_0' in at: out['UV'] = acc(at['TEXCOORD_0']).astype(np.float64)
    return out
def write(path, P, I, UV=None, png=None):
    P = np.asarray(P, np.float32); I = np.asarray(I, np.uint32).reshape(-1); parts = []; views = []; accs = []
    def add(arr, target, comp, typ, mm=False):
        nonlocal parts
        off = sum(len(x) for x in parts); raw = arr.tobytes(); raw += b'\0' * ((4 - len(raw) % 4) % 4); parts.append(raw)
        views.append({'buffer': 0, 'byteOffset': off, 'byteLength': len(arr.tobytes()), **({'target': target} if target else {})})
        a = {'bufferView': len(views) - 1, 'componentType': comp, 'count': int(arr.shape[0] if arr.ndim > 1 else arr.size), 'type': typ}
        if mm: a['min'] = arr.min(0).tolist(); a['max'] = arr.max(0).tolist()
        accs.append(a); return len(accs) - 1
    ii = add(I, 34963, 5125, 'SCALAR'); pi = add(P, 34962, 5126, 'VEC3', True)
    attrs = {'POSITION': pi}
    if UV is not None: attrs['TEXCOORD_0'] = add(np.asarray(UV, np.float32), 34962, 5126, 'VEC2')
    prim = {'attributes': attrs, 'indices': ii}
    g = {'asset': {'version': '2.0'}, 'scenes': [{'nodes': [0]}], 'scene': 0, 'nodes': [{'mesh': 0}], 'meshes': [{'primitives': [prim]}], 'bufferViews': views, 'accessors': accs}
    if png is not None:
        raw = open(png, 'rb').read(); off = sum(len(x) for x in parts); parts.append(raw + b'\0' * ((4 - len(raw) % 4) % 4))
        views.append({'buffer': 0, 'byteOffset': off, 'byteLength': len(raw)})
        g['images'] = [{'bufferView': len(views) - 1, 'mimeType': 'image/png'}]; g['textures'] = [{'source': 0}]
        g['materials'] = [{'pbrMetallicRoughness': {'baseColorTexture': {'index': 0}, 'metallicFactor': 0, 'roughnessFactor': 0.85}}]; prim['material'] = 0
    binb = b''.join(parts); g['buffers'] = [{'byteLength': len(binb)}]
    js = json.dumps(g).encode(); js += b' ' * ((4 - len(js) % 4) % 4)
    open(path, 'wb').write(struct.pack('<III', 0x46546C67, 2, 12 + 8 + len(js) + 8 + len(binb)) + struct.pack('<II', len(js), 0x4E4F534A) + js + struct.pack('<II', len(binb), 0x004E4942) + binb)
