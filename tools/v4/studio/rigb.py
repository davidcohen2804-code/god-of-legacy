# B's rig in Python, identical to the runtime (src/v4/real/rigB.ts on the Phase 1 bone tree): rest geometry measured on
# the parts (assets/b.json) and the combat stance fitted to the approved illustration (assets/b_stance.json).
# fk(pose) → per bone: world position (B units, root at the soles' centre, y down) and world rotation (degrees, clockwise).
import json, math, os
R = os.path.join(os.path.dirname(os.path.abspath(__file__)), '../../../src/v4/real/assets/')
geo = json.load(open(R + 'b.json'))
G, L = geo['geometry'], geo['lengths']
STANCE = json.load(open(R + 'b_stance.json'))['pose']
# bone → (parent, offset in the parent's rest frame (B), rest rotation against the parent (deg), length (B))
BONES = {
    'hip': (None, tuple(G['hip']), 0, 0), 'chest': ('hip', tuple(G['chest']), 0, 0), 'head': ('chest', tuple(G['head']), 0, 0),
    'uparm_F': ('chest', tuple(G['uparm_F']), 90, L['uparm']), 'forearm_F': ('uparm_F', (L['uparm'], 0), 0, L['forearm']),
    'hand_F': ('forearm_F', (L['forearm'], 0), 0, L['hand']), 'weapon': ('hand_F', (L['hand'], 0), -90, 0),
    'uparm_B': ('chest', tuple(G['uparm_B']), 90, L['uparm']), 'forearm_B': ('uparm_B', (L['uparm'], 0), 0, L['forearm']),
    'hand_B': ('forearm_B', (L['forearm'], 0), 0, L['hand']),
    'thigh_F': ('hip', tuple(G['thigh_F']), 90, L['thigh']), 'shin_F': ('thigh_F', (L['thigh'], 0), 0, L['shin']), 'foot_F': ('shin_F', (L['shin'], 0), -90, 0),
    'thigh_B': ('hip', tuple(G['thigh_B']), 90, L['thigh']), 'shin_B': ('thigh_B', (L['thigh'], 0), 0, L['shin']), 'foot_B': ('shin_B', (L['shin'], 0), -90, 0),
}
REST = {}
for b, (p, _, r, _l) in BONES.items(): REST[b] = (REST[p] if p else 0) + r


def fk(pose=STANCE):
    out = {}
    for b, (p, (lx, ly), r, _l) in BONES.items():
        if p is None: out[b] = ((lx + pose.get('dx', 0), ly + pose.get('dy', 0)), r + pose.get('hip', 0)); continue
        (px, py), pr = out[p]
        c, s = math.cos(math.radians(pr)), math.sin(math.radians(pr))
        out[b] = ((px + c * lx - s * ly, py + s * lx + c * ly), pr + r + pose.get(b, 0))
    return out


def tip(w, b):
    """The bone's far end (its child's joint), world B."""
    (x, y), r = w[b]; l = BONES[b][3]
    return (x + math.cos(math.radians(r)) * l, y + math.sin(math.radians(r)) * l)
