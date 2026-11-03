"""A point on a hero's painted body, read by eye per atlas frame, for the effects that sit there (David 3 Nov 01:27: "under
the palm in every move — it's critical"): tools/heroes/data/<cls>_<what>_marks.json (frame px from the frame's top-left)
→ src/data/<cls>-<what>.json { "<action>-<i>": [x, y] } relative to the frame's feet (frame px); a frame not read keeps
the effect's own place. Usage: python3 tools/heroes/body_points.py archer bow   (the archer's bow grip, where the arrow
rests: her charge gathers and flashes there). Run after tools/heroes/cut.py <cls> (re-read a re-shot action).
(The gambler's free hand has its own tool, hand_points.py: it also finds his painted card fan by colour.)"""
import json, os, sys

ROOT = os.path.join(os.path.dirname(__file__), '..', '..')
cls, what = sys.argv[1], sys.argv[2]
A = json.load(open(os.path.join(ROOT, 'src/data/hero-atlas.json')))[cls]['actions']
M = json.load(open(os.path.join(ROOT, f'tools/heroes/data/{cls}_{what}_marks.json')))
out = {}
for key, p in M.items():
    act, i = key.rsplit('-', 1); f = A[act][int(i)]
    out[key] = [round(p[0] - f[4], 1), round(p[1] - f[5], 1)]
json.dump(out, open(os.path.join(ROOT, f'src/data/{cls}-{what}.json'), 'w'), separators=(',', ':'))
print(len(out), 'frames')
