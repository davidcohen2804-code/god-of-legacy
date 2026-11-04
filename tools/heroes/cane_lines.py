"""The gambler's lit cane in every atlas frame, for Light Staff → src/data/gambler-cane.json:
{ "<action>-<i>": [startX, startY, endX, endY, blade] | null } — the points relative to the frame's feet (frame px).

The light runs from just under the hand that holds the cane (past the edge of the hand, or where the shaft comes out from
behind the body) to the cane's far end; its blade of light runs on out of that end `blade` frame px (1.15 × the whole cane,
"longer than the cane"; 0 = none: the end points into his body). David 3 Nov 01:27: "the light in his hand sits
unprofessionally — it must be under the palm in every move" (it lay over the hand and the cane above it).
Read by eye on every frame a skill / a state uses, on a fine grid (tools/heroes/data/gambler_cane_light.json: frame px from
the frame's top-left; null = the cane hidden); a frame not read (the idle / walk loops in places) is the straight blend of
the read frames on either side of it in its action (the nearest one at a loop's end). The cane's two ends as first marked
stay in tools/heroes/data/gambler_cane_marks.json. Run after tools/heroes/cut.py gambler (a recut keeps the readings valid
only while the frames keep their sizes — re-read a re-shot action)."""
import json, math, os

ROOT = os.path.join(os.path.dirname(__file__), '..', '..')
A = json.load(open(os.path.join(ROOT, 'src/data/hero-atlas.json')))['gambler']['actions']
L = json.load(open(os.path.join(ROOT, 'tools/heroes/data/gambler_cane_light.json')))
M = json.load(open(os.path.join(ROOT, 'tools/heroes/data/gambler_cane_marks.json')))
# David 4 Nov 14:59: the whole staff lit, behind his hand too — the cane's other part, from its marked rear end (the marked end
# farther from the lit far end) to just behind the hand (HAND frame px back from where the light starts). Appended to the
# reading as [.., rearX, rearY, handBackX, handBackY]; none where the hand holds the cane at its end.
HAND = 16

def with_rear(key, s):
    m = M.get(key)
    if s is None or not m: return s
    far, st = (s[2], s[3]), (s[0], s[1])
    e1, e2 = (m[0], m[1]), (m[2], m[3])
    rear = e1 if math.dist(e1, far) > math.dist(e2, far) else e2
    ux, uy = s[2] - s[0], s[3] - s[1]; n = math.hypot(ux, uy) or 1; ux, uy = ux / n, uy / n
    if math.dist(rear, st) <= HAND + 4: return s
    return list(s[:5]) + [rear[0], rear[1], st[0] - ux * HAND, st[1] - uy * HAND]

def rel(f, s):
    if s is None: return None
    fx, fy = f[4], f[5]
    out = [round(s[0] - fx, 1), round(s[1] - fy, 1), round(s[2] - fx, 1), round(s[3] - fy, 1), round(s[4])]
    if len(s) >= 9: out += [round(s[5] - fx, 1), round(s[6] - fy, 1), round(s[7] - fx, 1), round(s[8] - fy, 1)]
    return out
L = {k: with_rear(k, v) for k, v in L.items()}

out = {}
for act, fs in A.items():
    read = [i for i in range(len(fs)) if f'{act}-{i}' in L]
    for i, f in enumerate(fs):
        key = f'{act}-{i}'
        if key in L: out[key] = rel(f, L[key]); continue
        if not read: out[key] = None; continue
        lo = [j for j in read if j < i]; hi = [j for j in read if j > i]
        a = rel(fs[lo[-1]], L[f'{act}-{lo[-1]}']) if lo else None; b = rel(fs[hi[0]], L[f'{act}-{hi[0]}']) if hi else None
        if a is not None and b is not None:  # in between two read frames: the blend (from the feet)
            t = (i - lo[-1]) / (hi[0] - lo[-1])
            out[key] = [round(a[k] + (b[k] - a[k]) * t, 1) for k in range(4)] + [round(a[4] + (b[4] - a[4]) * t)]
            if len(a) >= 9 and len(b) >= 9: out[key] += [round(a[k] + (b[k] - a[k]) * t, 1) for k in range(5, 9)]
        else:
            j = min(read, key=lambda k: (abs(k - i), k > i))
            out[key] = rel(fs[j], L[f'{act}-{j}'])
json.dump(out, open(os.path.join(ROOT, 'src/data/gambler-cane.json'), 'w'), separators=(',', ':'))
print(sum(v is not None for v in out.values()), '/', len(out))
