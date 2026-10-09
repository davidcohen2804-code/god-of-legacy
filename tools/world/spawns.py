# spawns.py : every monster spawn on open floor — clear of blocks, platforms, stairs and NPCs (a monster born against a
# block gets stuck or hides behind it), spread apart, and the stand-in maps' copied spawn lists varied per area (no two
# areas the same pattern).
#   in/out: src/data/world-areas.json (areas[].mobs/mobs2 spawns, area px), src/data/world-heights.json (mobs, world px)
#   python3 tools/world/spawns.py   (after expand.py / platforms.py; again after heights.py)
import json, os, hashlib, math
G = os.path.dirname(os.path.abspath(__file__)) + '/'
R = G + '../../'
A = json.load(open(R + 'src/data/world-areas.json'))
H = json.load(open(R + 'src/data/world-heights.json'))
T = json.load(open(R + 'src/data/world-towers.json'))
AW = A['size'][0]
AX = {k: v['x'] for k, v in json.load(open(R + 'src/data/world-strip.json'))['areas'].items()}
CLEAR, APART = 34, 80   # px from any block's footprint; between two spawns


def rnd(*k):
    return int(hashlib.md5('|'.join(map(str, k)).encode()).hexdigest()[:8], 16) / 0xffffffff


def place(spawns, boxes, ybox, xbox, key, jitter):
    """Each spawn (jittered for a stand-in) moved to the nearest point clear of the boxes, in bounds, apart from the rest."""
    out = []
    def ok(x, y):
        if not (xbox[0] <= x <= xbox[1] and ybox[0] <= y <= ybox[1]): return False
        if any(b[0] - CLEAR <= x <= b[2] + CLEAR and b[1] - CLEAR <= y <= b[3] + CLEAR for b in boxes): return False
        return all(math.hypot(x - q[0], y - q[1]) >= APART for q in out)
    for i, (x, y) in enumerate(spawns):
        if jitter: x, y = x + (rnd(key, i, 'x') - 0.5) * 160, y + (rnd(key, i, 'y') - 0.5) * 90
        best = None
        for r in range(0, 400, 6):
            for k in range(max(1, r // 3)):
                a = 2 * math.pi * k / max(1, r // 3)
                px, py = round(x + r * math.cos(a)), round(y + r * 0.6 * math.sin(a))
                if ok(px, py): best = (px, py); break
            if best: break
        out.append(list(best or (round(x), round(y))))
    return out


for k in A['row']:
    a = A['areas'][k]
    boxes = []
    for p in a.get('props', []):
        if p.get('h', 0) >= 999: continue   # urns stand below the floor's front edge
        xs, ys = [q[0] for q in p['foot']], [q[1] for q in p['foot']]
        boxes.append((min(xs), min(ys), max(xs), max(ys)))
    for t in T.get(k, []):
        if t.get('base'): continue   # stands on a map above
        boxes.append((t['x'][0], 340, t['x'][1], t['front']))
    for n in a.get('npcs', []): boxes.append((n['x'] - 30, n['y'] - 20, n['x'] + 30, n['y'] + 20))
    for m in ('mobs', 'mobs2'):
        if m in a and a[m]['kind'] != 'warden':
            a[m]['spawns'] = place(a[m]['spawns'], boxes, (400, 628), (70, AW - 70), k + m, bool(a.get('standin')))
for h in H:
    boxes = [(b['x0'], b['front'] - b['depth'] - b['h'], b['x1'], b['front']) for b in h['blocks']]
    for ak, ts in T.items():   # the stair cubes standing on this map (the way up to the next)
        for t in ts:
            if t.get('base') == h['H']: boxes.append((AX[ak] + t['x'][0], t.get('solid_to', t['front'] - t['depth']), AX[ak] + t['x'][1], t['front']))
    h['mobs']['spawns'] = place(h['mobs']['spawns'], boxes, (h['back'] + 40, h['front'] - 16), (h['x'] + 60, h['x'] + h['w'] - 60), h['id'], False)
open(R + 'src/data/world-areas.json', 'w').write(json.dumps(A, indent=1, ensure_ascii=False) + '\n')
open(R + 'src/data/world-heights.json', 'w').write(json.dumps(H, indent=1, ensure_ascii=False) + '\n')
print('spawns placed')
