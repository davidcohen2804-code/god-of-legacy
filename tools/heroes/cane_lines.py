"""The gambler's cane in every atlas frame, for Light Staff (David 18 Oct 18:40: the light on the staff itself, in every frame)
→ src/data/gambler-cane.json: { "<action>-<i>": [hiltX, hiltY, tipX, tipY] | null } relative to the frame's feet (frame px;
the tip the end farther from his body). The cane's two ends were marked by eye on every frame a skill / a state uses
(tools/heroes/data/gambler_cane_marks.json: frame px from the frame's top-left; null = the cane hidden) — the colour-based
fit failed on the dark shaft against the dark coat. A frame not marked (the idle / walk / run loops are marked every few
frames) takes the nearest marked frame of its action. Run after tools/heroes/cut.py gambler (a recut keeps the marks
valid only while the frames keep their sizes — re-mark a re-shot action)."""
import json, os

ROOT = os.path.join(os.path.dirname(__file__), '..', '..')
A = json.load(open(os.path.join(ROOT, 'src/data/hero-atlas.json')))['gambler']['actions']
M = json.load(open(os.path.join(ROOT, 'tools/heroes/data/gambler_cane_marks.json')))

def rel(f, m):
    if m is None: return None
    x, y, w, h, fx, fy = f[:6]
    a, b = (m[0], m[1]), (m[2], m[3])
    cx, cy = w * 0.5, h * 0.42  # his body's middle: the tip is the end farther from it
    d = lambda p: (p[0] - cx) ** 2 + (p[1] - cy) ** 2
    hilt, tip = (a, b) if d(a) <= d(b) else (b, a)
    return [round(hilt[0] - fx, 1), round(hilt[1] - fy, 1), round(tip[0] - fx, 1), round(tip[1] - fy, 1)]

out = {}
for act, fs in A.items():
    marked = [i for i in range(len(fs)) if f'{act}-{i}' in M]
    for i, f in enumerate(fs):
        if not marked: out[f'{act}-{i}'] = None; continue
        j = min(marked, key=lambda k: abs(k - i))
        out[f'{act}-{i}'] = rel(fs[j], M[f'{act}-{j}'])
json.dump(out, open(os.path.join(ROOT, 'src/data/gambler-cane.json'), 'w'), separators=(',', ':'))
print(sum(v is not None for v in out.values()), '/', len(out))
