# The ponytail's vertices in the repacked body, by nearest position (addbones weights them on the hair chain).
#   python3 ponyidx.py REPACK.glb PONY_RIG.json OUT.json
import json, sys, numpy as np
from scipy.spatial import cKDTree
sys.argv, args = sys.argv[:1] + [sys.argv[1], '', ''], sys.argv[1:]
src = args[0]
code = open(__file__.replace('ponyidx.py', 'rebake2.py')).read().split("p = js['meshes']")[0]
code = code.replace("src, oldtex, out = sys.argv[1:4]; S = int(sys.argv[4]) if len(sys.argv) > 4 else 2048", "")
exec(code)
p = js['meshes'][0]['primitives'][0]
P = acc(p['attributes']['POSITION']).astype(np.float64)
PV = np.array(json.load(open(args[1]))['pony_verts'])
d, _ = cKDTree(PV).query(P)
idx = np.where(d < 2e-4)[0]; json.dump(idx.tolist(), open(args[2], 'w')); print('ponytail vertices', len(idx), 'of', len(P))
